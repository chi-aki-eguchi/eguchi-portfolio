import { resolve as pathResolve } from "node:path";
import app, { getOriginal, photoWithThumbs } from "./api";
import { db, withRetry, schema } from "./api/database";
import { runStartupMigrations } from "./api/database/migrate";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import {
  injectOgp,
  siteUrlFrom,
  BUILD_ID,
  ogCardTitleFrom,
} from "./api/ogp";
import { generateOgCardPng } from "./api/og-card";
import {
  canonicalPortfolioKitPath,
  canonicalSpaRedirectUrl,
  htmlStatusForSpaPath,
  isSeriesDetailPath,
} from "./api/public-routes";
import { contentTypeForStaticPath } from "./api/static-files";
import {
  compressResponse,
  createCompressedAssetCache,
} from "./api/http-compression";
import { settingsVersion } from "./api/settings-version";
import { imageUrlWithParams } from "./shared/image-url";
import { IMAGE_UPLOAD_REQUEST_MAX_BYTES } from "./shared/upload-limits";
import { hasPublicEnglishContent } from "./shared/public-english";
import { buildSitemapXml } from "./api/sitemap-xml";
import { buildGalleryPreloadTags } from "./api/gallery-preload";
import { resolveServiceVisibility } from "./shared/service-visibility";
import {
  DYNAMIC_FAVICON_PATHS,
  generateFaviconAsset,
  type DynamicFaviconPath,
} from "./api/favicon";

// 配布版(DATABASE_PROVIDER=postgres)は起動時に空DBへ自動マイグレーション。
// 本番(turso)は Drizzle migration こそ走らせないが、ensureTursoColumns() が
// 既知カラムの存在確認と欠落時の ALTER TABLE ADD COLUMN を行う(no-op ではない)。
// 失敗時はサーバを起動せず loud に落とす。
try {
  await runStartupMigrations();
} catch {
  process.exit(1);
}

// Prevent unhandled errors from silently crashing the process (shows as
// Railway error page). Log the error and keep the server alive.
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
});

const port = Number(process.env.PORT ?? 3000);
const distDir = pathResolve(import.meta.dir, "..", "dist");
const indexPath = `${distDir}/index.html`;

// Cache settings for OGP injection (refresh every 60s)
let settingsCache: Record<string, string> = {};
let settingsCacheTime = 0;
// settings書き込み(POST /admin/settings)で世代が上がると、TTL内でも失効させる。
// 差し替えで旧R2オブジェクトを削除した後のHTMLが最大60秒、削除済みURLを
// 出し続ける穴への対処(2026-07-14 codex-reviewer P2)。同一プロセス前提。
let settingsCacheVersion = -1;
const SETTINGS_TTL = 60_000;

type CachedFavicon = { body: Buffer; contentType: string };
const dynamicFaviconPaths = new Set<string>(DYNAMIC_FAVICON_PATHS);
const faviconCache = new Map<DynamicFaviconPath, CachedFavicon>();
let faviconCacheVersion = -1;

let ogCardCache: Buffer | null = null;
let ogCardCacheVersion = -1;

async function getFavicon(path: DynamicFaviconPath): Promise<CachedFavicon> {
  const version = settingsVersion();
  if (faviconCacheVersion !== version) {
    faviconCache.clear();
    faviconCacheVersion = version;
  }
  const cached = faviconCache.get(path);
  if (cached) return cached;

  const settings = await getSettings();
  const generated = await generateFaviconAsset(
    path,
    settings,
    async (key) => (await getOriginal(key)).buf,
    (error) =>
      console.error(
        "[favicon] profile image unavailable, using monogram:",
        error,
      ),
  );
  if (settingsVersion() !== version) return getFavicon(path);
  faviconCache.set(path, generated);
  return generated;
}

async function getOgCard(): Promise<Buffer> {
  const version = settingsVersion();
  if (ogCardCacheVersion !== version) {
    ogCardCache = null;
    ogCardCacheVersion = version;
  }
  if (ogCardCache) return ogCardCache;

  const settings = await getSettings();
  const generated = await generateOgCardPng(ogCardTitleFrom(settings));
  if (settingsVersion() !== version) return getOgCard();
  ogCardCache = generated;
  return generated;
}

async function getSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (
    now - settingsCacheTime < SETTINGS_TTL &&
    settingsCacheVersion === settingsVersion() &&
    Object.keys(settingsCache).length > 0
  ) {
    return settingsCache;
  }
  const version = settingsVersion();
  try {
    const rows = await withRetry(() => db.select().from(schema.siteSettings));
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;
    settingsCache = s;
    settingsCacheTime = now;
    settingsCacheVersion = version;
  } catch (e) {
    console.error("[OGP] settings fetch failed:", e); /* use stale cache */
  }
  return settingsCache;
}

// The OGP/social share image: prefer the first (non-deleted) hero photo — the
// actual front-of-site image — since the legacy `heroPhotoUrl` setting is no longer
// written. Cached 60s; "" means "no hero, fall back to profile/default".
type ImageRef = { url: string; rotationDeg: number; preloadUrl?: string };
let heroOgCache: ImageRef | null = null;
let heroOgCacheTime = 0;
function socialSourceForPhoto(p: {
  url: string;
  mediumKey?: string | null;
  rotationDeg?: number | null;
}): ImageRef {
  const rotationDeg = p.rotationDeg ?? 0;
  const mediumUrl = p.mediumKey ? `/api/images/${p.mediumKey}` : "";
  return {
    url: mediumUrl || p.url,
    rotationDeg,
    preloadUrl: mediumUrl
      ? imageUrlWithParams(mediumUrl, { rotationDeg })
      : undefined,
  };
}
async function getHeroOgImage(): Promise<ImageRef> {
  const now = Date.now();
  if (heroOgCache !== null && now - heroOgCacheTime < SETTINGS_TTL)
    return heroOgCache;
  try {
    const heroRows = await withRetry(() =>
      db.select().from(schema.heroPhotos).orderBy(schema.heroPhotos.sortOrder),
    );
    let image: ImageRef = { url: "", rotationDeg: 0 };
    // ヒーロー行ごとの個別クエリ(N+1)を避け、参照写真を1クエリでまとめて引く。
    // 選択規則は従来どおり: sortOrder 順で最初の未削除写真。
    if (heroRows.length > 0) {
      const photoRows = await withRetry(() =>
        db
          .select()
          .from(schema.photos)
          .where(
            and(
              inArray(
                schema.photos.id,
                heroRows.map((hr) => hr.photoId),
              ),
              isNull(schema.photos.deletedAt),
            ),
          ),
      );
      const photoById = new Map(photoRows.map((p) => [p.id, p]));
      for (const hr of heroRows) {
        const p = photoById.get(hr.photoId);
        if (p) {
          image = socialSourceForPhoto(p);
          break;
        }
      }
    }
    heroOgCache = image;
    heroOgCacheTime = now;
  } catch (e) {
    console.error("[OGP] hero image fetch failed:", e); /* use stale/empty */
  }
  return heroOgCache ?? { url: "", rotationDeg: 0 };
}

// First N gallery photo URLs for preloading grid thumbnails on /gallery.
let galleryPreloadCache: ImageRef[] = [];
let galleryPreloadCacheTime = 0;
const GALLERY_PRELOAD_COUNT = 8;
async function getGalleryPreloadImages(): Promise<ImageRef[]> {
  const now = Date.now();
  if (
    now - galleryPreloadCacheTime < SETTINGS_TTL &&
    galleryPreloadCache.length > 0
  )
    return galleryPreloadCache;
  try {
    const [[sortRow]] = [
      await withRetry(() =>
        db
          .select({ value: schema.siteSettings.value })
          .from(schema.siteSettings)
          .where(eq(schema.siteSettings.key, "gallerySortOrder"))
          .limit(1),
      ),
    ];
    const gallerySortOrder = sortRow?.value ?? "manual";
    const orderExpr =
      gallerySortOrder === "date_desc"
        ? sql`${schema.photos.shotAt} DESC NULLS LAST, ${schema.photos.sortOrder} ASC`
        : gallerySortOrder === "date_asc"
          ? sql`${schema.photos.shotAt} ASC NULLS LAST, ${schema.photos.sortOrder} ASC`
          : gallerySortOrder === "upload_desc"
            ? sql`${schema.photos.createdAt} DESC`
            : schema.photos.sortOrder;
    const rows = await withRetry(() =>
      db
        .select({
          url: schema.photos.url,
          rotationDeg: schema.photos.rotationDeg,
          // 一覧が実際に最初に描くのは作り置きのサムネである。これを
          // 持たずに先読みすると、別のURLを8枚ぶん取りに行って全部捨てる。
          thumbKey: schema.photos.thumbKey,
        })
        .from(schema.photos)
        .where(
          and(
            isNull(schema.photos.deletedAt),
            eq(schema.photos.isPublished, true),
          ),
        )
        .orderBy(orderExpr)
        .limit(GALLERY_PRELOAD_COUNT),
    );
    galleryPreloadCache = rows.map((r) => {
      const { thumbUrl } = photoWithThumbs({
        thumbKey: r.thumbKey,
        rotationDeg: r.rotationDeg,
      });
      return {
        url: r.url,
        rotationDeg: r.rotationDeg ?? 0,
        preloadUrl: thumbUrl ?? undefined,
      };
    });
    galleryPreloadCacheTime = now;
  } catch (e) {
    console.error("[preload] gallery photos fetch failed:", e);
  }
  return galleryPreloadCache;
}

// Per-series OGP so a shared /series/:slug link shows that series' own title,
// statement and cover image — not the generic site card. Cached per slug (60s);
// null = unknown/unpublished slug (caller falls back to the generic card).
type SeriesOg = {
  title: string;
  desc: string;
  image: string;
  imageRotationDeg: number;
};
const seriesOgCache = new Map<string, { data: SeriesOg | null; ts: number }>();
async function getSeriesOg(slug: string): Promise<SeriesOg | null> {
  const now = Date.now();
  const cached = seriesOgCache.get(slug);
  if (cached && now - cached.ts < SETTINGS_TTL) return cached.data;
  let data: SeriesOg | null = null;
  try {
    const [s] = await withRetry(() =>
      db
        .select()
        .from(schema.series)
        .where(
          and(
            eq(schema.series.slug, slug),
            eq(schema.series.isPublished, true),
          ),
        )
        .limit(1),
    );
    if (s) {
      let image = "";
      let imageRotationDeg = 0;
      if (s.coverPhotoId) {
        const [p] = await withRetry(() =>
          db
            .select()
            .from(schema.photos)
            .where(eq(schema.photos.id, s.coverPhotoId as number)),
        );
        if (p && !p.deletedAt) {
          const socialImage = socialSourceForPhoto(p);
          image = socialImage.url;
          imageRotationDeg = socialImage.rotationDeg;
        }
      }
      data = {
        title: s.title,
        desc: (s.statement || s.subtitle || "").slice(0, 200),
        image,
        imageRotationDeg,
      };
    }
  } catch (e) {
    console.error("[OGP] series fetch failed:", e); /* fall back to generic */
  }
  seriesOgCache.set(slug, { data, ts: now });
  return data;
}

async function buildSitemap(fallbackOrigin: string): Promise<string> {
  const settings = await getSettings();
  const siteUrl = siteUrlFrom(settings, fallbackOrigin);
  const paths = [
    "/",
    "/gallery",
    "/series",
    "/about",
    "/contact",
    // i18n Phase 3: 英語文が入力済みのサイトのみ /en/* を sitemap に載せる
    // （配布テンプレート既定では日本語のままの英語URLを検索対象にしない）
    ...(hasPublicEnglishContent(settings) ? ["/en/about", "/en/contact"] : []),
    ...(resolveServiceVisibility(settings.servicePageMode, siteUrl, "")
      ? ["/portfolio-kit", "/portfolio-kit/en"]
      : []),
  ];
  // Include each published series detail page so crawlers discover the actual
  // work, not just the section index. Failure → static paths only (never throw).
  let seriesPaths: string[] = [];
  let seriesIdBySlugPath = new Map<string, number>();
  type SitemapSeries = { title: string; coverPhotoId: number | null };
  let seriesById = new Map<number, SitemapSeries>();
  try {
    const rows = await withRetry(() =>
      db
        .select({
          id: schema.series.id,
          slug: schema.series.slug,
          title: schema.series.title,
          coverPhotoId: schema.series.coverPhotoId,
        })
        .from(schema.series)
        .where(eq(schema.series.isPublished, true))
        .orderBy(schema.series.sortOrder),
    );
    seriesPaths = rows.map((r) => `/series/${encodeURIComponent(r.slug)}`);
    seriesIdBySlugPath = new Map(
      rows.map((r) => [`/series/${encodeURIComponent(r.slug)}`, r.id]),
    );
    seriesById = new Map(
      rows.map((r) => [
        r.id,
        { title: r.title, coverPhotoId: r.coverPhotoId },
      ]),
    );
  } catch (e) {
    console.error("[sitemap] series fetch failed:", e);
  }

  // Image sitemap entries — Google Image Search is a real discovery channel for
  // a photographer, but only for images that carry words. Every published photo
  // used to be attached to /gallery; measured 2026-08-14 that was 569 entries
  // with **zero** titles (photos.title is empty), which cannot rank and scatters
  // single frames out of the sequence they were edited into. Owner decision
  // (2026-08-14): promote a small curated set instead — each series cover and
  // the profile portrait — and always give them text.
  // Note this reduces promotion, not exposure: Google may still index images it
  // finds by crawling /gallery. Failure → page entries only.
  type SitemapPhoto = {
    id: number;
    url: string;
    title: string;
    seriesId: number | null;
    createdAt: Date | null;
  };
  let livePhotos: SitemapPhoto[] = [];
  try {
    livePhotos = await withRetry(() =>
      db
        .select({
          id: schema.photos.id,
          url: schema.photos.url,
          title: schema.photos.title,
          seriesId: schema.photos.seriesId,
          createdAt: schema.photos.createdAt,
        })
        .from(schema.photos)
        .where(
          and(
            isNull(schema.photos.deletedAt),
            eq(schema.photos.isPublished, true),
          ),
        )
        .orderBy(schema.photos.sortOrder),
    );
  } catch (e) {
    console.error("[sitemap] photos fetch failed:", e);
  }
  return buildSitemapXml({
    siteUrl,
    paths,
    seriesPaths,
    seriesIdBySlugPath,
    seriesById,
    photos: livePhotos,
    profilePhotoUrl: settings.profilePhotoUrl,
    photographerName: settings.profileName || settings.siteName || "",
  });
}

function buildRobots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

function publicOriginFromRequest(request: Request): string {
  const requestUrl = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    requestUrl.protocol.replace(/:$/, "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    requestUrl.host;
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
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=()",
  );
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto === "https")
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

const compressedAssets = createCompressedAssetCache();

const server = Bun.serve({
  port,
  maxRequestBodySize: IMAGE_UPLOAD_REQUEST_MAX_BYTES,
  async fetch(request) {
    try {
      const url = new URL(request.url);

      // API is handled by Hono (its own CORS + cookies); don't re-wrap its responses,
      // so multi-value headers like Set-Cookie pass through untouched.
      if (url.pathname.startsWith("/api")) {
        return app.fetch(request);
      }

      // Compress before the security headers so `Vary` and `Content-Encoding`
      // are copied along with the rest. Measured 2026-08-23: nothing in front
      // of this origin compresses anything, so first load shipped 687KB of
      // plain text. See api/http-compression.ts.
      return withSecurityHeaders(
        await compressResponse(
          await serveNonApi(request, url),
          request,
          compressedAssets,
        ),
        request,
      );
    } catch (err) {
      console.error("[server] request handler crash:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});

async function serveNonApi(request: Request, url: URL): Promise<Response> {
  const publicOrigin = publicOriginFromRequest(request);
  const routePathname = canonicalPortfolioKitPath(url.pathname);
  if (routePathname !== url.pathname && !url.pathname.includes(".")) {
    return Response.redirect(
      canonicalSpaRedirectUrl(request.url, publicOrigin, routePathname),
      308,
    );
  }
  // F: SEO endpoints
  if (url.pathname === "/sitemap.xml") {
    return new Response(await buildSitemap(publicOrigin), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
  if (url.pathname === "/robots.txt") {
    return new Response(
      buildRobots(siteUrlFrom(await getSettings(), publicOrigin)),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      },
    );
  }

  // Service Worker must not be cached (browsers require fresh checks)
  if (url.pathname === "/sw.js") {
    const file = Bun.file(`${distDir}/sw.js`);
    if (await file.exists())
      return new Response(file, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
  }
  // Web App Manifest
  if (
    url.pathname === "/manifest.json" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    const file = Bun.file(`${distDir}/manifest.json`);
    if (await file.exists())
      return new Response(file, {
        headers: {
          "Content-Type": "application/manifest+json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
  }
  // Offline fallback
  if (url.pathname === "/offline.html") {
    const file = Bun.file(`${distDir}/offline.html`);
    if (await file.exists())
      return new Response(file, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
  }

  // 配布先で静的なオーナー写真を出さないため、同名のdistファイルより常に優先する。
  if (dynamicFaviconPaths.has(url.pathname)) {
    const favicon = await getFavicon(url.pathname as DynamicFaviconPath);
    return new Response(favicon.body as unknown as BodyInit, {
      headers: {
        "Cache-Control": "no-cache, must-revalidate",
        "Content-Type": favicon.contentType,
      },
    });
  }

  if (url.pathname === "/og-default.png") {
    const card = await getOgCard();
    return new Response(card as unknown as BodyInit, {
      headers: {
        "Cache-Control": "no-cache, must-revalidate",
        "Content-Type": "image/png",
      },
    });
  }

  // Serve legacy favicon aliases from dist (no-cache to bust CDN)
  if (
    url.pathname.startsWith("/favicon") ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname.startsWith("/icon-")
  ) {
    const file = Bun.file(`${distDir}${url.pathname}`);
    if (await file.exists())
      return new Response(file, {
        headers: {
          "Cache-Control": "no-cache, must-revalidate",
          "Content-Type": url.pathname.endsWith(".svg")
            ? "image/svg+xml"
            : url.pathname.endsWith(".ico")
              ? "image/x-icon"
              : "image/png",
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
      const contentType = contentTypeForStaticPath(url.pathname);
      if (contentType) headers["Content-Type"] = contentType;
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
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Serve index.html with dynamic OGP injection
  const index = Bun.file(indexPath);
  if (await index.exists()) {
    const html = await index.text();
    const settings = await getSettings();
    const heroImg = await getHeroOgImage();
    // Per-series OGP for /series/:slug so shared links carry that series' card.
    let override:
      | {
          title?: string;
          desc?: string;
          image?: string;
          imageRotationDeg?: number | null;
        }
      | undefined;
    let seriesFound = false;
    const seriesMatch = routePathname.match(/^\/series\/([^/]+)$/);
    if (seriesMatch) {
      const og = await getSeriesOg(decodeURIComponent(seriesMatch[1]));
      if (og) {
        seriesFound = true;
        override = {
          title: og.title,
          desc: og.desc,
          image: og.image || undefined,
          imageRotationDeg: og.imageRotationDeg,
        };
      }
    }
    let injected = injectOgp(
      html,
      settings,
      routePathname,
      heroImg.url,
      override,
      publicOrigin,
      heroImg.rotationDeg,
      heroImg.preloadUrl,
    );
    if (
      routePathname === "/gallery" ||
      (routePathname === "/" && (settings.topWorksMode ?? "auto") !== "random")
    ) {
      const preloadImages = await getGalleryPreloadImages();
      if (preloadImages.length > 0) {
        const preloadTags = buildGalleryPreloadTags(preloadImages);
        injected = injected.replace(
          "</head>",
          () => `  ${preloadTags}\n  </head>`,
        );
      }
    }
    const htmlStatus = htmlStatusForSpaPath(routePathname, {
      seriesFound: isSeriesDetailPath(routePathname) ? seriesFound : undefined,
    });
    return new Response(injected, {
      status: htmlStatus,
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
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }

  return new Response("Build output not found. Run `bun run build` first.", {
    status: 500,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

console.log(`Web server listening on http://localhost:${server.port}`);

// Log memory usage every 5 minutes so Railway logs capture OOM trends.
setInterval(() => {
  const rss = process.memoryUsage.rss();
  console.log(`[mem] rss=${Math.round(rss / 1024 / 1024)}MB`);
}, 5 * 60_000);

function getStaticFilePath(pathname: string) {
  const cleanPath = decodeURIComponent(pathname)
    .replace(/^\/+/, "")
    .replaceAll("..", "");

  if (!cleanPath) return indexPath;
  const resolved = pathResolve(distDir, cleanPath);
  if (!resolved.startsWith(distDir)) return indexPath;
  return resolved;
}
