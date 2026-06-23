import { resolve as pathResolve } from "node:path";
import app from "./api";
import { db, withRetry, schema } from "./api/database";
import { runStartupMigrations } from "./api/database/migrate";
import { eq, and, isNull } from "drizzle-orm";
import { injectOgp, siteUrlFrom, escapeHtml, BUILD_ID } from "./api/ogp";

// 配布版(DATABASE_PROVIDER=postgres)は起動時に空DBへ自動マイグレーション。
// 本番(turso)は no-op。失敗時はサーバを起動せず loud に落とす。
try {
  await runStartupMigrations();
} catch {
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const distDir = `${import.meta.dir}/../dist`;
const indexPath = `${distDir}/index.html`;

// Cache settings for OGP injection (refresh every 60s)
let settingsCache: Record<string, string> = {};
let settingsCacheTime = 0;
const SETTINGS_TTL = 60_000;

async function getSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - settingsCacheTime < SETTINGS_TTL && Object.keys(settingsCache).length > 0) {
    return settingsCache;
  }
  try {
    const rows = await withRetry(() => db.select().from(schema.siteSettings));
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;
    settingsCache = s;
    settingsCacheTime = now;
  } catch (e) { console.error("[OGP] settings fetch failed:", e); /* use stale cache */ }
  return settingsCache;
}

// The OGP/social share image: prefer the first (non-deleted) hero photo — the
// actual front-of-site image — since the legacy `heroPhotoUrl` setting is no longer
// written. Cached 60s; "" means "no hero, fall back to profile/default".
let heroOgCache: string | null = null;
let heroOgCacheTime = 0;
async function getHeroOgImageUrl(): Promise<string> {
  const now = Date.now();
  if (heroOgCache !== null && now - heroOgCacheTime < SETTINGS_TTL) return heroOgCache;
  try {
    const heroRows = await withRetry(() =>
      db.select().from(schema.heroPhotos).orderBy(schema.heroPhotos.sortOrder)
    );
    let url = "";
    for (const hr of heroRows) {
      const [p] = await withRetry(() =>
        db.select().from(schema.photos).where(eq(schema.photos.id, hr.photoId))
      );
      if (p && !p.deletedAt) { url = p.url; break; }
    }
    heroOgCache = url;
    heroOgCacheTime = now;
  } catch (e) { console.error("[OGP] hero image fetch failed:", e); /* use stale/empty */ }
  return heroOgCache ?? "";
}

// Per-series OGP so a shared /series/:slug link shows that series' own title,
// statement and cover image — not the generic site card. Cached per slug (60s);
// null = unknown/unpublished slug (caller falls back to the generic card).
type SeriesOg = { title: string; desc: string; image: string };
const seriesOgCache = new Map<string, { data: SeriesOg | null; ts: number }>();
async function getSeriesOg(slug: string): Promise<SeriesOg | null> {
  const now = Date.now();
  const cached = seriesOgCache.get(slug);
  if (cached && now - cached.ts < SETTINGS_TTL) return cached.data;
  let data: SeriesOg | null = null;
  try {
    const [s] = await withRetry(() =>
      db.select().from(schema.series)
        .where(and(eq(schema.series.slug, slug), eq(schema.series.isPublished, true)))
        .limit(1)
    );
    if (s) {
      let image = "";
      if (s.coverPhotoId) {
        const [p] = await withRetry(() =>
          db.select().from(schema.photos).where(eq(schema.photos.id, s.coverPhotoId as number))
        );
        if (p && !p.deletedAt) image = p.url;
      }
      data = { title: s.title, desc: (s.statement || s.subtitle || "").slice(0, 200), image };
    }
  } catch (e) { console.error("[OGP] series fetch failed:", e); /* fall back to generic */ }
  seriesOgCache.set(slug, { data, ts: now });
  return data;
}

async function buildSitemap(fallbackOrigin: string): Promise<string> {
  const siteUrl = siteUrlFrom(await getSettings(), fallbackOrigin);
  const paths = ["/", "/gallery", "/series", "/about", "/contact", "/service"];
  // Include each published series detail page so crawlers discover the actual
  // work, not just the section index. Failure → static paths only (never throw).
  let seriesPaths: string[] = [];
  let seriesIdBySlugPath = new Map<string, number>();
  try {
    const rows = await withRetry(() =>
      db.select({ id: schema.series.id, slug: schema.series.slug }).from(schema.series)
        .where(eq(schema.series.isPublished, true))
        .orderBy(schema.series.sortOrder)
    );
    seriesPaths = rows.map((r) => `/series/${encodeURIComponent(r.slug)}`);
    seriesIdBySlugPath = new Map(rows.map((r) => [`/series/${encodeURIComponent(r.slug)}`, r.id]));
  } catch (e) { console.error("[sitemap] series fetch failed:", e); }

  // Image sitemap entries — Google Image Search is a real discovery channel for
  // a photographer. Every published photo is attached to /gallery; each series
  // page additionally lists its own photos. Failure → page entries only.
  type SitemapPhoto = { url: string; title: string; seriesId: number | null };
  let livePhotos: SitemapPhoto[] = [];
  try {
    livePhotos = await withRetry(() =>
      db.select({ url: schema.photos.url, title: schema.photos.title, seriesId: schema.photos.seriesId })
        .from(schema.photos)
        .where(and(isNull(schema.photos.deletedAt), eq(schema.photos.isPublished, true)))
        .orderBy(schema.photos.sortOrder)
    );
  } catch (e) { console.error("[sitemap] photos fetch failed:", e); }
  const imageTag = (p: SitemapPhoto) =>
    `<image:image><image:loc>${siteUrl}${escapeHtml(p.url)}</image:loc>${p.title ? `<image:title>${escapeHtml(p.title)}</image:title><image:caption>${escapeHtml(p.title)}</image:caption>` : ""}</image:image>`;
  const imagesFor = (path: string): string => {
    if (path === "/gallery") return livePhotos.map(imageTag).join("");
    const sid = seriesIdBySlugPath.get(path);
    if (sid != null) return livePhotos.filter((p) => p.seriesId === sid).map(imageTag).join("");
    return "";
  };

  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = [...paths, ...seriesPaths]
    .map((p) => `  <url><loc>${siteUrl}${p}</loc><lastmod>${lastmod}</lastmod><changefreq>${p === "/" || p === "/gallery" ? "weekly" : "monthly"}</changefreq><priority>${p === "/" ? "1.0" : "0.7"}</priority>${imagesFor(p)}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`;
}

function buildRobots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

function publicOriginFromRequest(request: Request): string {
  const requestUrl = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    || requestUrl.protocol.replace(/:$/, "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    || request.headers.get("host")
    || requestUrl.host;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

// Baseline security headers for document/static responses. Framing is restricted
// to same-origin: the only legitimate framer is the admin live-preview iframe
// (src="/"), which is same-origin, so SAMEORIGIN / frame-ancestors 'self' allows
// it while blocking cross-origin clickjacking of /admin. (The previous ALLOWALL /
// frame-ancestors * was a Runable dashboard-preview workaround; Runable was
// decommissioned in the 2026-06 Railway migration.) HSTS is set only when the
// original request arrived over HTTPS (x-forwarded-proto behind the proxy).
// CSP report-only: observe violations without breaking anything. The inline
// gtag script requires 'unsafe-inline' for script-src; Tailwind's runtime
// styles need 'unsafe-inline' for style-src. Once violations are reviewed and
// addressed, this can graduate to an enforcing Content-Security-Policy header.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://formspree.io https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://formspree.io https://buy.stripe.com",
].join("; ");

function withSecurityHeaders(res: Response, request: Request): Response {
  const headers = new Headers(res.headers);
  headers.set("X-Build", BUILD_ID);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=()");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto === "https") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    // API is handled by Hono (its own CORS + cookies); don't re-wrap its responses,
    // so multi-value headers like Set-Cookie pass through untouched.
    if (url.pathname.startsWith("/api")) {
      return app.fetch(request);
    }

    return withSecurityHeaders(await serveNonApi(request, url), request);
  },
});

async function serveNonApi(request: Request, url: URL): Promise<Response> {
    const publicOrigin = publicOriginFromRequest(request);
    // F: SEO endpoints
    if (url.pathname === "/sitemap.xml") {
      return new Response(await buildSitemap(publicOrigin), {
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }
    if (url.pathname === "/robots.txt") {
      return new Response(buildRobots(siteUrlFrom(await getSettings(), publicOrigin)), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }

    // Serve favicon (no-cache to bust CDN)
    if (url.pathname.startsWith("/favicon") || url.pathname === "/apple-touch-icon.png") {
      const file = Bun.file(`${distDir}${url.pathname}`);
      if (await file.exists()) return new Response(file, {
        headers: {
          "Cache-Control": "no-cache, must-revalidate",
          "Content-Type": url.pathname.endsWith(".svg") ? "image/svg+xml" : url.pathname.endsWith(".ico") ? "image/x-icon" : "image/png",
        },
      });
    }

    // Always inject OGP for HTML pages (root and SPA routes)
    const isHtmlRequest = url.pathname === "/" || !url.pathname.includes(".");
    if (!isHtmlRequest) {
      const filePath = getStaticFilePath(url.pathname);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const headers: Record<string, string> = {};
        // Hashed assets (e.g. /assets/index-Bzsuqb-e.js) — cache forever
        const immutable = url.pathname.startsWith("/assets/");
        if (immutable) {
          headers["Cache-Control"] = "public, max-age=31536000, immutable";
        } else {
          // Non-hashed static files (og-image.jpg, etc.) can't be immutable, but
          // still deserve a revalidatable hour of browser/edge caching rather than
          // the no-header heuristic default.
          headers["Cache-Control"] = "public, max-age=3600";
        }
        return new Response(file, { headers });
      }
      // A request for a file with an extension that doesn't exist is a genuine 404
      // (a missing asset / stale chunk) — don't fall through to serving index.html,
      // which would return HTML (200) for a missing .png/.js and confuse caches.
      return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // Serve index.html with dynamic OGP injection
    const index = Bun.file(indexPath);
    if (await index.exists()) {
      const html = await index.text();
      const settings = await getSettings();
      const heroImg = await getHeroOgImageUrl();
      // Per-series OGP for /series/:slug so shared links carry that series' card.
      let override: { title?: string; desc?: string; image?: string } | undefined;
      const seriesMatch = url.pathname.match(/^\/series\/([^/]+)$/);
      if (seriesMatch) {
        const og = await getSeriesOg(decodeURIComponent(seriesMatch[1]));
        if (og) override = { title: og.title, desc: og.desc, image: og.image || undefined };
      }
      const injected = injectOgp(html, settings, url.pathname, heroImg, override, publicOrigin);
      return new Response(injected, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          // HTML must never be cached: it carries the current hashed asset URLs,
          // so a stale HTML = stale app even though assets are immutable. The two
          // CDN-* variants override Cache-Control specifically at the edge
          // (Cloudflare), which otherwise may cache HTML independent of the
          // browser-facing Cache-Control. See 2026-06-13 gzip/cache incident.
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "Cloudflare-CDN-Cache-Control": "no-store",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }

    return new Response("Build output not found. Run `bun run build` first.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}

console.log(`Web server listening on http://localhost:${server.port}`);

function getStaticFilePath(pathname: string) {
  const cleanPath = decodeURIComponent(pathname)
    .replace(/^\/+/, "")
    .replaceAll("..", "");

  if (!cleanPath) return indexPath;
  const resolved = pathResolve(distDir, cleanPath);
  if (!resolved.startsWith(distDir)) return indexPath;
  return resolved;
}
