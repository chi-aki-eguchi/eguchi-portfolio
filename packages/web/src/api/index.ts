import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db, withRetry, schema } from "./database";
import {
  eq,
  sql,
  isNull,
  isNotNull,
  inArray,
  lt,
  and,
  type SQL,
} from "drizzle-orm";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
sharp.cache(false);
sharp.concurrency(2);
import exifReader from "exif-reader";
import { createHash } from "node:crypto";
import {
  imageUrlWithParams,
  normalizeRotationDeg,
  parseRotationDeg,
} from "../shared/image-url";

// Node's Buffer<ArrayBufferLike> isn't assignable to DOM BodyInit in TS lib
// types, though Bun's Response accepts it at runtime. The cast is contained
// here; using it keeps route handlers' inferred types clean (an error inside
// one handler degrades the whole chained AppType the typed client relies on).
const asBody = (buf: Buffer): BodyInit => buf as unknown as BodyInit;
import { parseNoteRss, type NotePost } from "./note-rss";
import { BUILD_ID } from "./ogp";
import {
  SITE_DEFAULTS,
  displayNameEnFrom,
  displayNameFrom,
  isAllowedOrigin,
  siteDescriptionFrom,
} from "./site-defaults";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_MAX_BYTES,
  FONT_MAX_BYTES,
  isAllowedImageKey,
  clientIpFrom,
  passwordMatches as _passwordMatches,
  isHttpsRequest,
  LOGIN_WINDOW_MS,
  LOGIN_MAX_FAILS,
  clampImageWidth,
  clampImageQuality,
} from "./security";

// ── In-memory image caches (byte-budgeted true-LRU) ─────
// The gallery has 100+ photos × ~5 srcset widths (~600 variants). The old
// 200-entry cap thrashed badly: most scrolls evicted entries that were about to
// be re-requested, so sharp re-encoded (and storage re-fetched) the same thumbnails
// over and over — the main cause of slow / blank images in production. A byte
// budget holds them all instead (thumbnails are small). Map insertion order is
// the LRU order: get() moves an entry to the back, eviction drops the front.
const RESIZE_CACHE_BYTES = 128 * 1024 * 1024; // resized thumbnails
const resizeCache = new Map<string, { buf: Buffer; type: string }>();
let resizeBytes = 0;

function cacheGet(key: string) {
  const entry = resizeCache.get(key);
  if (!entry) return null;
  resizeCache.delete(key);
  resizeCache.set(key, entry); // bump to most-recent
  return entry;
}

function cacheSet(key: string, buf: Buffer, type: string) {
  const prev = resizeCache.get(key);
  if (prev) {
    resizeBytes -= prev.buf.length;
    resizeCache.delete(key);
  }
  resizeCache.set(key, { buf, type });
  resizeBytes += buf.length;
  while (resizeBytes > RESIZE_CACHE_BYTES && resizeCache.size > 1) {
    const oldest = resizeCache.keys().next().value as string;
    resizeBytes -= resizeCache.get(oldest)!.buf.length;
    resizeCache.delete(oldest);
  }
}

// Short-lived cache of the original storage object. Without it, the ~5 srcset widths
// for one photo each do their own GetObject (1–2MB) on a cold load — 5× the storage
// round-trips. Caching the original for a minute collapses that burst into one.
const ORIG_CACHE_BYTES = 48 * 1024 * 1024;
const ORIG_TTL_MS = 60_000;
const origCache = new Map<string, { buf: Buffer; type: string; ts: number }>();
let origBytes = 0;

const origInFlight = new Map<string, Promise<{ buf: Buffer; type: string }>>();

async function getOriginal(
  key: string,
): Promise<{ buf: Buffer; type: string }> {
  const now = Date.now();
  const cached = origCache.get(key);
  if (cached && now - cached.ts < ORIG_TTL_MS) {
    origCache.delete(key);
    origCache.set(key, cached); // LRU bump
    return cached;
  }
  const pending = origInFlight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    const buf = Buffer.from(await obj.Body!.transformToByteArray());
    const entry = { buf, type: obj.ContentType ?? "image/jpeg", ts: now };
    const prev = origCache.get(key);
    if (prev) {
      origBytes -= prev.buf.length;
      origCache.delete(key);
    }
    origCache.set(key, entry);
    origBytes += buf.length;
    while (origBytes > ORIG_CACHE_BYTES && origCache.size > 1) {
      const oldest = origCache.keys().next().value as string;
      origBytes -= origCache.get(oldest)!.buf.length;
      origCache.delete(oldest);
    }
    return entry;
  })();
  origInFlight.set(key, p);
  try {
    return await p;
  } finally {
    origInFlight.delete(key);
  }
}

// S3-compatible storage client (Cloudflare R2 in current prod; Railway Storage for template experiments).
const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle:
    process.env.S3_FORCE_PATH_STYLE === "1" ||
    process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET!;
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
// NOTE: Do NOT throw at module load — a missing env var would crash the whole
// process on startup (502). Instead we validate lazily inside the login route.
if (!ADMIN_PASSWORD) {
  console.error(
    "[WARN] ADMIN_PASSWORD env var is not set — admin login will be disabled.",
  );
}
const SESSION_KEY = "admin_session";
// Derive the session token from ADMIN_PASSWORD so the cookie value is secret and
// cannot be forged. A hardcoded constant would let anyone set the cookie by hand
// and bypass login entirely. Empty password → unguessable random value (login is
// disabled in that case anyway, so no valid cookie is ever issued).
const SESSION_VALUE = ADMIN_PASSWORD
  ? createHash("sha256")
      .update(`eguchi-portfolio::session::${ADMIN_PASSWORD}`)
      .digest("hex")
  : createHash("sha256")
      .update(`disabled::${Math.random()}::${Date.now()}`)
      .digest("hex");

// ── Upload-time resize config ───────────────────────────
// Store only one version: 3200px long-edge, quality 92, mozjpeg, full chroma.
// 3200 gives retina / full-bleed / lightbox-zoom enough detail to downscale from;
// 4:4:4 chroma keeps fine colour edges (skin, foliage, saturated tones) crisp —
// 4:2:0 visibly softens these on photographic content.
const UPLOAD_MAX_PX = 3200;
const UPLOAD_QUALITY = 92;

// Trash retention — items soft-deleted longer ago than this are purged for good.
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Upload size guards and MIME whitelist imported from ./security

// ── note RSS (J1) — server-side fetch + in-memory cache ─
// Fetch note.com's per-user RSS, parse to a small post list, and cache so we
// don't hammer note (or block page render) on every request. Must never throw:
// on failure the section simply renders empty.
const NOTE_CACHE_TTL_MS = 30 * 60_000; // 30 min
const NOTE_NEG_TTL_MS = 2 * 60_000; // 2 min — short cooldown after a failed fetch
const noteCache = new Map<string, { posts: NotePost[]; ts: number }>();
// Last-failure timestamp per username. Without it, a misconfigured username or a
// note.com outage makes every cold request pay the full (up to 8s) fetch timeout.
const noteFailTs = new Map<string, number>();

async function fetchNotePosts(
  username: string,
  limit: number,
): Promise<NotePost[]> {
  const cached = noteCache.get(username);
  const now = Date.now();
  if (cached && now - cached.ts < NOTE_CACHE_TTL_MS)
    return cached.posts.slice(0, limit);
  // No usable cache and a recent failure → skip the slow refetch for a short window.
  const failTs = noteFailTs.get(username);
  if (!cached && failTs && now - failTs < NOTE_NEG_TTL_MS) return [];
  try {
    const res = await fetch(
      `https://note.com/${encodeURIComponent(username)}/rss`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (portfolio-site note-feed)" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    const xml = await res.text();
    const posts = parseNoteRss(xml);
    noteCache.set(username, { posts, ts: now });
    noteFailTs.delete(username); // recovered — clear the cooldown
    return posts.slice(0, limit);
  } catch (e) {
    console.error(
      "[note] RSS fetch failed:",
      e instanceof Error ? e.message : e,
    );
    noteFailTs.set(username, now);
    // Serve stale cache if present; otherwise empty. Never throw.
    return cached ? cached.posts.slice(0, limit) : [];
  }
}

// Resize a raw image buffer → optimised JPEG, returns Buffer
async function optimiseImage(
  input: Buffer | Uint8Array,
  maxPx: number,
  quality: number,
): Promise<Buffer> {
  return sharp(Buffer.from(input))
    .rotate()
    .resize({
      width: maxPx,
      height: maxPx,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

const THUMB_WIDTH = 640;
const THUMB_QUALITY = 82;
const MEDIUM_WIDTH = 1920;
const MEDIUM_QUALITY = 85;

async function generateWebP(
  input: Buffer,
  maxWidth: number,
  quality: number,
): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

function photoWithThumbs<
  T extends {
    thumbKey?: string | null;
    mediumKey?: string | null;
    rotationDeg?: number | null;
  },
>(p: T): T & { thumbUrl: string | null; mediumUrl: string | null } {
  const rotationDeg = normalizeRotationDeg(p.rotationDeg);
  const rotated = rotationDeg !== 0;
  return {
    ...p,
    thumbUrl: p.thumbKey
      ? rotated
        ? keyToProxyUrl(p.thumbKey, { rotationDeg })
        : keyToPublicUrl(p.thumbKey)
      : null,
    mediumUrl: p.mediumKey
      ? rotated
        ? keyToProxyUrl(p.mediumKey, { rotationDeg })
        : keyToPublicUrl(p.mediumKey)
      : null,
  };
}

function keyToPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${key}`;
  return keyToProxyUrl(key);
}

function thumbKeyFrom(originalKey: string): string {
  const name = originalKey.replace(/^photos\//, "").replace(/\.[^.]+$/, "");
  return `thumbs/${name}.webp`;
}

function mediumKeyFrom(originalKey: string): string {
  const name = originalKey.replace(/^photos\//, "").replace(/\.[^.]+$/, "");
  return `medium/${name}.webp`;
}

async function generateAndUploadThumbnails(
  optimisedBuf: Buffer,
  originalKey: string,
): Promise<{ thumbKey: string; mediumKey: string }> {
  const tKey = thumbKeyFrom(originalKey);
  const mKey = mediumKeyFrom(originalKey);
  const [thumbBuf, mediumBuf] = await Promise.all([
    generateWebP(optimisedBuf, THUMB_WIDTH, THUMB_QUALITY),
    generateWebP(optimisedBuf, MEDIUM_WIDTH, MEDIUM_QUALITY),
  ]);
  await Promise.all([
    uploadToStorage(tKey, thumbBuf, "image/webp"),
    uploadToStorage(mKey, mediumBuf, "image/webp"),
  ]);
  return { thumbKey: tKey, mediumKey: mKey };
}

async function generateAndUploadThumb(
  optimisedBuf: Buffer,
  originalKey: string,
): Promise<{ thumbKey: string }> {
  const tKey = thumbKeyFrom(originalKey);
  const thumbBuf = await generateWebP(optimisedBuf, THUMB_WIDTH, THUMB_QUALITY);
  await uploadToStorage(tKey, thumbBuf, "image/webp");
  return { thumbKey: tKey };
}

async function generateAndUploadMedium(
  optimisedBuf: Buffer,
  originalKey: string,
): Promise<{ mediumKey: string }> {
  const mKey = mediumKeyFrom(originalKey);
  const mediumBuf = await generateWebP(optimisedBuf, MEDIUM_WIDTH, MEDIUM_QUALITY);
  await uploadToStorage(mKey, mediumBuf, "image/webp");
  return { mediumKey: mKey };
}

// Upload buffer to S3-compatible object storage.
async function uploadToStorage(key: string, buf: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }),
  );
}

function keyToProxyUrl(
  key: string,
  params: { w?: number | null; q?: number | null; rotationDeg?: unknown } = {},
) {
  return imageUrlWithParams(`/api/images/${key}`, params);
}

function parseFocalPoint(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

async function executeRaw(query: SQL) {
  const rawDb = db as typeof db & {
    execute?: (query: SQL) => Promise<unknown>;
    run?: (query: SQL) => Promise<unknown>;
  };
  if (typeof rawDb.execute === "function") return rawDb.execute(query);
  if (typeof rawDb.run === "function") return rawDb.run(query);
  throw new Error("Database raw execution is not supported.");
}

function passwordMatches(input: unknown): boolean {
  return _passwordMatches(input, ADMIN_PASSWORD);
}

const loginFails = new Map<string, { count: number; first: number }>();
function clientIp(c: any): string {
  return clientIpFrom(
    c.req.header("x-forwarded-for"),
    c.req.header("x-real-ip"),
  );
}

function isHttps(c: any): boolean {
  return isHttpsRequest(c.req.header("x-forwarded-proto"), c.req.url);
}

// Auth middleware
const requireAdmin = async (c: any, next: any) => {
  const session = getCookie(c, SESSION_KEY);
  if (session !== SESSION_VALUE) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};

const app = new Hono()
  .basePath("api")
  .onError((err, c) => {
    if (err.message?.includes("JSON")) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    console.error("[api] unhandled error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  })
  .use(
    cors({
      // Same-origin requests (no Origin header) need no ACAO; cross-origin is allowed
      // only for known origins. Everything else gets no CORS grant.
      origin: (origin) => (isAllowedOrigin(origin) ? origin : ""),
      credentials: true,
    }),
  )
  // Stop browsers MIME-sniffing JSON/error bodies into something executable.
  // no-store keeps proxies from ever caching API JSON — during the 06-13 gzip
  // incident the edge cached compressed bodies and replayed them post-fix, so
  // dynamic responses must stay uncacheable. Images keep their own immutable
  // caching (they were never compressed).
  .use(async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    if (!c.req.path.startsWith("/api/images/"))
      c.header("Cache-Control", "no-store");
  })

  // ── Health ──────────────────────────────────────────────
  .get("/health", (c) => {
    const rss = process.memoryUsage.rss();
    return c.json(
      {
        status: "ok",
        build: BUILD_ID,
        mem: {
          rssMB: Math.round(rss / 1024 / 1024),
          resizeCacheMB: Math.round(resizeBytes / 1024 / 1024),
          resizeCacheEntries: resizeCache.size,
          origCacheMB: Math.round(origBytes / 1024 / 1024),
          origCacheEntries: origCache.size,
        },
      },
      200,
    );
  })

  // ── Image proxy (storage → optional thumbnail resize → cache) ─
  // Storage holds UPLOAD_MAX_PX (3200px) optimised images (~1-3MB), so
  // on-the-fly resize works from an already-small source and is fast
  // (resizing a few MB, not a ~60MB camera original).
  .get("/images/*", async (c) => {
    const key = c.req.path.replace("/api/images/", "");
    const decodedKey = decodeURIComponent(key);
    if (!isAllowedImageKey(decodedKey)) {
      return c.json({ error: "Not found" }, 404);
    }
    const width = clampImageWidth(c.req.query("w"));
    const quality = clampImageQuality(c.req.query("q"));
    const rotationDeg = parseRotationDeg(c.req.query("rot"));
    if (rotationDeg === null) {
      return c.json({ error: "Invalid rotation" }, 400);
    }

    // Format selection: explicit `fmt` query param (for <picture> sources) takes
    // priority; otherwise Accept-header negotiation picks the best the browser
    // supports. Always on — the old env-var gate was a Runable-era precaution.
    const fmtParam = c.req.query("fmt");
    const fmt: "jpeg" | "webp" | "avif" =
      fmtParam === "avif"
        ? "avif"
        : fmtParam === "webp"
          ? "webp"
          : fmtParam === "jpeg"
            ? "jpeg"
            : (() => {
                const accept = c.req.header("accept") ?? "";
                return accept.includes("image/avif")
                  ? ("avif" as const)
                  : accept.includes("image/webp")
                    ? ("webp" as const)
                    : ("jpeg" as const);
              })();
    const ctypeOf: Record<string, string> = {
      jpeg: "image/jpeg",
      webp: "image/webp",
      avif: "image/avif",
    };

    const cacheKey = `${decodedKey}__w${width ?? "orig"}__q${quality}__${fmt}__rot${rotationDeg}`;
    const etag = `"${createHash("md5").update(cacheKey).digest("hex")}"`;

    const ifNoneMatch = c.req.header("if-none-match");
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const cached = cacheGet(cacheKey);
    if (cached) {
      return new Response(asBody(cached.buf), {
        headers: {
          "Content-Type": cached.type,
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: etag,
          ...(!fmtParam ? { Vary: "Accept" } : {}),
          "X-Cache": "HIT",
        },
      });
    }

    try {
      const original = await getOriginal(decodedKey);

      if (!width && rotationDeg === 0) {
        // No resize — return the (already optimised) original
        return new Response(asBody(original.buf), {
          headers: {
            "Content-Type": original.type,
            "Cache-Control": "public, max-age=31536000, immutable",
            ETag: etag,
          },
        });
      }

      let base = sharp(original.buf).rotate();
      if (rotationDeg !== 0) base = base.rotate(rotationDeg);
      if (width) {
        base = base.resize({
          width,
          withoutEnlargement: true,
        });
      }
      let out: Buffer;
      if (fmt === "avif") {
        // AVIF quality scale runs ~10-20 points lower than JPEG for equivalent
        // perceptual quality; effort bounded to avoid blocking the request.
        out = await base
          .avif({ quality: Math.max(40, quality - 10), effort: 4 })
          .toBuffer();
      } else if (fmt === "webp") {
        out = await base.webp({ quality }).toBuffer();
      } else {
        // Full chroma for large/focal renders (gallery tiles, hero, lightbox);
        // 4:2:0 is fine for small thumbnails and keeps their bytes down.
        out = await base
          .jpeg({
            quality,
            mozjpeg: true,
            chromaSubsampling: !width || width >= 1000 ? "4:4:4" : "4:2:0",
          })
          .toBuffer();
      }

      cacheSet(cacheKey, out, ctypeOf[fmt]);

      return new Response(asBody(out), {
        headers: {
          "Content-Type": ctypeOf[fmt],
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: etag,
          ...(!fmtParam ? { Vary: "Accept" } : {}),
          "X-Cache": "MISS",
        },
      });
    } catch {
      return c.json({ error: "Not found" }, 404);
    }
  })

  // ── Admin Auth ──────────────────────────────────────────
  .post("/admin/login", async (c) => {
    if (!ADMIN_PASSWORD) {
      return c.json(
        { error: "サーバー設定エラー (ADMIN_PASSWORD 未設定)" },
        500,
      );
    }
    const ip = clientIp(c);
    const rec = loginFails.get(ip);
    const now = Date.now();
    // Drop the record once its window has elapsed.
    if (rec && now - rec.first >= LOGIN_WINDOW_MS) loginFails.delete(ip);
    const active = loginFails.get(ip);
    if (active && active.count >= LOGIN_MAX_FAILS) {
      return c.json(
        { error: "試行回数が多すぎます。しばらくしてから再度お試しください。" },
        429,
      );
    }

    const { password } = await c.req
      .json()
      .catch(() => ({ password: undefined }));
    if (!passwordMatches(password)) {
      const cur = loginFails.get(ip);
      if (cur) cur.count += 1;
      else loginFails.set(ip, { count: 1, first: now });
      return c.json({ error: "パスワードが違います" }, 401);
    }
    loginFails.delete(ip); // success clears the counter
    setCookie(c, SESSION_KEY, SESSION_VALUE, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "Lax",
      secure: isHttps(c), // Secure over HTTPS (prod); off for http://localhost (dev)
    });
    return c.json({ ok: true }, 200);
  })

  .post("/admin/logout", async (c) => {
    deleteCookie(c, SESSION_KEY, { path: "/" });
    return c.json({ ok: true }, 200);
  })

  .get("/admin/me", async (c) => {
    const session = getCookie(c, SESSION_KEY);
    return c.json({ authenticated: session === SESSION_VALUE }, 200);
  })

  // ── Site Settings ───────────────────────────────────────
  .get("/settings", async (c) => {
    const rows = await withRetry(() => db.select().from(schema.siteSettings));
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return c.json(
      {
        siteName: settings.siteName ?? displayNameFrom(settings),
        siteNameEn: settings.siteNameEn ?? displayNameEnFrom(settings),
        heroSubtitle: settings.heroSubtitle ?? "Photography",
        heroPhotoUrl: settings.heroPhotoUrl ?? "",
        profilePhotoUrl: settings.profilePhotoUrl ?? "",
        siteDescription:
          settings.siteDescription ?? siteDescriptionFrom(settings),
        profileName: settings.profileName ?? displayNameFrom(settings),
        profileNameKata:
          settings.profileNameKata ?? SITE_DEFAULTS.profileNameKata,
        profileNameEn: settings.profileNameEn ?? displayNameEnFrom(settings),
        profileBio: settings.profileBio ?? SITE_DEFAULTS.profileBio,
        profileInstagram: settings.profileInstagram ?? "",
        profileTwitter: settings.profileTwitter ?? "",
        profileNote: settings.profileNote ?? "",
        themeBg: settings.themeBg ?? "",
        themeText: settings.themeText ?? "",
        navOpacity: settings.navOpacity ?? "",
        navSize: settings.navSize ?? "",
        bodySize: settings.bodySize ?? "",
        headingSize: settings.headingSize ?? "",
        sectionLabelSize: settings.sectionLabelSize ?? "",
        sectionLabelOpacity: settings.sectionLabelOpacity ?? "",
        heroNameSize: settings.heroNameSize ?? "",
        heroNameColor: settings.heroNameColor ?? "",
        heroNameEnSize: settings.heroNameEnSize ?? "",
        heroNameEnColor: settings.heroNameEnColor ?? "",
        heroSubSize: settings.heroSubSize ?? "",
        heroSubColor: settings.heroSubColor ?? "",
        footerOpacity: settings.footerOpacity ?? "",
        footerSize: settings.footerSize ?? "",
        snsOpacity: settings.snsOpacity ?? "",
        fontJa: settings.fontJa ?? "Shippori Mincho",
        fontEn: settings.fontEn ?? "Cormorant Garamond",
        customFontJaName: settings.customFontJaName ?? "",
        customFontJaUrl: settings.customFontJaUrl ?? "",
        customFontEnName: settings.customFontEnName ?? "",
        customFontEnUrl: settings.customFontEnUrl ?? "",
        customFontJaCategory: settings.customFontJaCategory ?? "",
        customFontEnCategory: settings.customFontEnCategory ?? "",
        // ── A3: font weights（"" = CSS 既定: ヒーロー名700 / 本文400）──
        heroNameWeight: settings.heroNameWeight ?? "",
        bodyWeight: settings.bodyWeight ?? "",
        // ── A1: letter-spacing ──
        heroNameTracking: settings.heroNameTracking ?? "",
        heroNameEnTracking: settings.heroNameEnTracking ?? "",
        navTracking: settings.navTracking ?? "",
        sectionLabelTracking: settings.sectionLabelTracking ?? "",
        bodyTracking: settings.bodyTracking ?? "",
        // ── A2: line-height ──
        bodyLeading: settings.bodyLeading ?? "",
        sectionLeading: settings.sectionLeading ?? "",
        // ── D4: global scale + link styling ──
        globalFontScale: settings.globalFontScale ?? "",
        linkHoverColor: settings.linkHoverColor ?? "",
        linkUnderline: settings.linkUnderline ?? "",
        // ── D3: meta value presets (JSON arrays) ──
        metaPresetsCamera: settings.metaPresetsCamera ?? "",
        metaPresetsLens: settings.metaPresetsLens ?? "",
        // Empty default — Layout then renders "© <current year> <siteName>" with an
        // auto-updating year. A hardcoded default here would pin the year forever.
        footerText: settings.footerText ?? "",
        contactIntro:
          settings.contactIntro ??
          "撮影依頼・取材・コラボレーションなど、お気軽にご連絡ください。",
        contactEmail: settings.contactEmail ?? "",
        formspreeUrl: settings.formspreeUrl ?? "",
        // ── Labels / Text ──
        navLabelTop: settings.navLabelTop ?? "TOP",
        navLabelGallery: settings.navLabelGallery ?? "Gallery",
        navLabelAbout: settings.navLabelAbout ?? "About",
        navLabelContact: settings.navLabelContact ?? "Contact",
        snsLabelInstagram: settings.snsLabelInstagram ?? "Instagram",
        snsLabelTwitter: settings.snsLabelTwitter ?? "X",
        snsLabelNote: settings.snsLabelNote ?? "note",
        worksLabel: settings.worksLabel ?? "Works",
        viewAllLabel: settings.viewAllLabel ?? "View all →",
        viewAllCtaLabel: settings.viewAllCtaLabel ?? "すべての作品を見る",
        galleryLabel: settings.galleryLabel ?? "Gallery",
        filterAllLabel: settings.filterAllLabel ?? "All",
        profileLabel: settings.profileLabel ?? "Profile",
        contactLabel: settings.contactLabel ?? "Contact",
        contactSentMessage: settings.contactSentMessage ?? "Message sent.",
        contactSendAnother: settings.contactSendAnother ?? "Send another",
        contactFormName: settings.contactFormName ?? "Name",
        contactFormEmail: settings.contactFormEmail ?? "Email",
        contactFormSubject: settings.contactFormSubject ?? "Subject",
        contactSubjectOptions:
          settings.contactSubjectOptions ??
          "Shooting,Press / Media,Collaboration,Other",
        contactFormMessage: settings.contactFormMessage ?? "Message",
        contactErrorMessage:
          settings.contactErrorMessage ?? "Failed to send. Please try again.",
        contactSendButton: settings.contactSendButton ?? "Send",
        contactSendingButton: settings.contactSendingButton ?? "Sending...",
        // ── E1: hero display mode ──
        heroMode: settings.heroMode ?? "carousel", // "carousel" | "single" | "quiet-grid" | "editorial" | "immersive"
        heroHeight: settings.heroHeight ?? "", // vh number, e.g. "70"
        heroOverlay: settings.heroOverlay ?? "on", // "on" | "off"
        // EE: accent colour for hover/active/focus (empty = per-spot fallbacks)
        accentColor: settings.accentColor ?? "",
        // BB: nav position / hover effect (defaults = current look)
        navPosition: settings.navPosition ?? "top", // top | left | bottom
        navHoverEffect: settings.navHoverEffect ?? "fade", // fade | underline | dot | blur
        // DD: 紙質感テクスチャ（none = 現状どおり何も乗せない）
        bgTexture: settings.bgTexture ?? "none", // none | grain-fine | grain-coarse | paper
        bgTextureOpacity: settings.bgTextureOpacity ?? "", // 0–0.15, CSS default 0.05
        // 写真のフェードイン方式 — fade(既定) | none | rise | scale
        photoRevealEffect: settings.photoRevealEffect ?? "fade",
        // Search Console の HTML タグ検証（content 値のみ）。server の OGP 注入で出力
        googleSiteVerification: settings.googleSiteVerification ?? "",
        // 公開オリジン。sitemap/canonical/og:url/JSON-LD の基底。空 = SITE_URL/default
        siteUrl: settings.siteUrl ?? "",
        // CC: section spacing multipliers (empty = 1.0 = current rhythm)
        spacingHeroBottom: settings.spacingHeroBottom ?? "",
        spacingSectionGap: settings.spacingSectionGap ?? "",
        spacingPageTop: settings.spacingPageTop ?? "",
        spacingFooterTop: settings.spacingFooterTop ?? "",
        // AA: hero presentation — defaults keep the pre-AA look unchanged
        heroDisplayMode: settings.heroDisplayMode ?? "normal", // "normal" | "fullscreen"
        heroTitlePosition: settings.heroTitlePosition ?? "center", // center | bottom-left | bottom-right | top-left | top-right
        heroScrollEffect: settings.heroScrollEffect ?? "none", // none | fade | sink | parallax
        // ── E5: About / Profile foundation (empty-safe) ──
        profileStatement: settings.profileStatement ?? "",
        profileGear: settings.profileGear ?? "",
        // ── E6: optional, low-key contact lead-in (off when empty) ──
        footerCtaLabel: settings.footerCtaLabel ?? "",
        // ── 撮影依頼 CTA — a closing "work with me" band on Top / Gallery / Series ──
        homeCtaEnabled: settings.homeCtaEnabled ?? "off", // "on" | "off"
        homeCtaTitle: settings.homeCtaTitle ?? "撮影のご依頼",
        homeCtaText:
          settings.homeCtaText ??
          "ポートレート・作品撮り・取材など、お気軽にご相談ください。",
        homeCtaButton: settings.homeCtaButton ?? "お問い合わせ",
        // ── homeGalleryCount: トップ Works 欄の初期表示枚数 ──
        homeGalleryCount: settings.homeGalleryCount ?? "12",
        // ── G: gallery controlled-random layout (JS-driven; see lib/gallery-layout) ──
        galleryGapScale: settings.galleryGapScale ?? "1", // 0.5–2.0
        galleryEmptyRate: settings.galleryEmptyRate ?? "0.1", // 0–0.3
        gallerySizeVariation: settings.gallerySizeVariation ?? "0.5", // 0–1.0
        galleryColumns: settings.galleryColumns ?? "3", // W: max columns (1–8); actual count steps down with width
        gallerySizeScale: settings.gallerySizeScale ?? "1", // X: tile size multiplier (0.5–2)
        // X: top (Works) overrides — empty string = inherit the gallery values
        topWorksColumns: settings.topWorksColumns ?? "",
        topWorksSizeScale: settings.topWorksSizeScale ?? "",
        topWorksGapScale: settings.topWorksGapScale ?? "",
        gallerySeed: settings.gallerySeed ?? "1", // integer
        // ── P: series grid (Works series view) — JS-driven, like the gallery grid ──
        seriesGridColumns: settings.seriesGridColumns ?? "3", // 2–4 (PC)
        seriesGridColumnsMobile: settings.seriesGridColumnsMobile ?? "2", // 1–2 (mobile)
        worksDefaultView: settings.worksDefaultView ?? "photos", // "photos" | "series"
        // ── N: per-page grid layout type (JS-driven) — mosaic|grid|scroll(|…) ──
        galleryLayout: settings.galleryLayout ?? "mosaic",
        seriesLayout: settings.seriesLayout ?? "mosaic",
        topWorksLayout: settings.topWorksLayout ?? "stagger",
        // トップ Works の写真選択 — auto(並び順) | random | manual(topWorksIds)
        topWorksMode: settings.topWorksMode ?? "auto",
        topWorksIds: settings.topWorksIds ?? "",
        // ── O6: smart albums (admin-only) — JSON array of saved photo filters ──
        smartAlbums: settings.smartAlbums ?? "[]",
        // ── I: series navigation toggle (JS-driven, like gallery) ──
        // "auto" (default) = show the Series nav link iff published series exist;
        // "on" = always show; "off" = always hide. Default avoids the trap where
        // created/published series stay invisible because nav was never enabled.
        seriesNavEnabled: settings.seriesNavEnabled ?? "auto", // "auto" | "on" | "off"
        // ── 機能8: 並び順独立設定 ──
        gallerySortOrder: settings.gallerySortOrder ?? "manual", // "manual" | "date_desc" | "date_asc" | "upload_desc"
        seriesSortOrder: settings.seriesSortOrder ?? "manual", // "manual" | "date_desc" | "date_asc" | "upload_desc"
        // ── J: note RSS integration ──
        noteUsername: settings.noteUsername ?? "",
        noteShowCount: settings.noteShowCount ?? "3",
        noteEnabled: settings.noteEnabled ?? "off", // "on" | "off"
        // ── K: print sales (external store link) ──
        printStoreUrl: settings.printStoreUrl ?? "",
        printStoreLabel: settings.printStoreLabel ?? "プリントを購入する",
        printEnabled: settings.printEnabled ?? "off", // "on" | "off"
        printDescription: settings.printDescription ?? "",
      },
      200,
    );
  })

  // ── Categories ──────────────────────────────────────────
  .get("/categories", async (c) => {
    const cats = await withRetry(() =>
      db.select().from(schema.categories).orderBy(schema.categories.sortOrder),
    );
    return c.json({ categories: cats }, 200);
  })

  // ── Photos ──────────────────────────────────────────────
  // `?all=1` returns unpublished photos too (admin grid) — but only with a valid
  // admin session. For anyone else the flag is silently ignored, otherwise any
  // visitor could read unpublished/draft photos off the public API.
  .get("/photos", async (c) => {
    const isAdmin = getCookie(c, SESSION_KEY) === SESSION_VALUE;
    const includeUnpublished = isAdmin && c.req.query("all") === "1";
    const where = includeUnpublished
      ? isNull(schema.photos.deletedAt)
      : and(
          isNull(schema.photos.deletedAt),
          eq(schema.photos.isPublished, true),
        );
    // 機能8: gallerySortOrder 設定に従って並び順を変える
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
    const photos = await withRetry(() =>
      db.select().from(schema.photos).where(where).orderBy(orderExpr),
    );
    return c.json({ photos: photos.map(photoWithThumbs) }, 200);
  })

  // ── Admin: Settings update ──────────────────────────────
  .post("/admin/settings", requireAdmin, async (c) => {
    const body = await c.req.json();
    // Defensive bounds: settings are admin-only, but an unbounded key/value write
    // could bloat the DB (a stray multi-MB paste, a buggy client). Validate the
    // whole payload before writing anything so an oversized value can't leave a
    // partial update. 50KB is generous even for long bios/statements.
    const MAX_KEY_LEN = 100;
    const MAX_VALUE_LEN = 50_000;
    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== "string") continue;
      if (key.length > MAX_KEY_LEN || value.length > MAX_VALUE_LEN) {
        return c.json({ error: "設定値が大きすぎます。" }, 413);
      }
    }
    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== "string") continue;
      await withRetry(() =>
        db
          .insert(schema.siteSettings)
          .values({ key, value })
          .onConflictDoUpdate({
            target: schema.siteSettings.key,
            set: { value },
          }),
      );
    }
    return c.json({ ok: true }, 200);
  })

  // ── Admin: Server-side upload (resize → storage) ───────
  // Client sends raw file; server optimises (3200px/mozjpeg q92) and stores it. Max 60MB.
  .post("/admin/upload", requireAdmin, async (c) => {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file" }, 400);
    if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type))
      return c.json({ error: "許可されていないファイル形式です。" }, 415);
    if (file.size > IMAGE_MAX_BYTES)
      return c.json({ error: "画像は60MBまでです。" }, 413);

    const arrayBuf = await file.arrayBuffer();
    const inputBuf = Buffer.from(arrayBuf);

    const optimised = await optimiseImage(
      inputBuf,
      UPLOAD_MAX_PX,
      UPLOAD_QUALITY,
    );

    // C1: content hash of the optimised bytes (sharp is deterministic for the
    // same input/params, so the same source image re-uploads to the same hash).
    const fileHash = createHash("sha256").update(optimised).digest("hex");
    const [dup] = await withRetry(() =>
      db
        .select({ id: schema.photos.id })
        .from(schema.photos)
        .where(
          sql`${eq(schema.photos.fileHash, fileHash)} AND ${isNull(schema.photos.deletedAt)}`,
        )
        .limit(1),
    );
    if (dup) {
      // Skip storage upload + DB insert entirely; client counts it as a duplicate.
      return c.json({ duplicate: true, fileHash }, 200);
    }

    // Capture intrinsic dimensions so the client can reserve aspect-ratio (CLS)
    const { width = null, height = null } = await sharp(optimised).metadata();

    // U2: EXIF → shotAt / camera / lens. Read from *original* bytes — the
    // optimised JPEG has its metadata stripped. Datetimes are timezone-less
    // wall-clock values; exif-reader surfaces them as UTC Dates.
    let shotAt: string | null = null;
    let exifCamera: string | null = null;
    let exifLens: string | null = null;
    let exifFocalLength: string | null = null;
    let exifFNumber: string | null = null;
    let exifExposureTime: string | null = null;
    let exifIso: string | null = null;
    try {
      const { exif } = await sharp(inputBuf).metadata();
      if (exif) {
        const tags = exifReader(exif);
        const dt = tags?.Photo?.DateTimeOriginal ?? tags?.Image?.DateTime;
        if (dt instanceof Date && !Number.isNaN(dt.getTime()))
          shotAt = dt.toISOString().slice(0, 19);
        const make = (tags?.Image?.Make as string | undefined)?.trim() ?? "";
        const model = (tags?.Image?.Model as string | undefined)?.trim() ?? "";
        if (model)
          exifCamera =
            make && !model.startsWith(make) ? `${make} ${model}` : model;
        const lensModel =
          (tags?.Photo?.LensModel as string | undefined)?.trim() ?? "";
        if (lensModel) exifLens = lensModel;
        const fl = tags?.Photo?.FocalLength;
        if (fl != null && Number.isFinite(Number(fl)))
          exifFocalLength = `${Math.round(Number(fl))}mm`;
        const fn = tags?.Photo?.FNumber;
        if (fn != null && Number.isFinite(Number(fn)))
          exifFNumber = `f/${Number(fn)}`;
        const et = tags?.Photo?.ExposureTime;
        if (et != null && Number.isFinite(Number(et))) {
          const v = Number(et);
          exifExposureTime = v >= 1 ? `${v}s` : `1/${Math.round(1 / v)}s`;
        }
        const iso =
          tags?.Photo?.ISOSpeedRatings ?? tags?.Photo?.PhotographicSensitivity;
        if (iso != null) exifIso = `ISO ${Array.isArray(iso) ? iso[0] : iso}`;
      }
    } catch {
      /* EXIFなし・壊れたEXIF → null のまま（手入力可） */
    }

    const key = `photos/${Date.now()}-${file.name.replace(/\.[^.]+$/, "")}.jpg`;
    await uploadToStorage(key, optimised, "image/jpeg");

    let thumbKey: string | null = null;
    let mediumKey: string | null = null;
    try {
      const keys = await generateAndUploadThumbnails(optimised, key);
      thumbKey = keys.thumbKey;
      mediumKey = keys.mediumKey;
    } catch (e) {
      console.error("[upload] thumbnail generation failed:", e);
    }

    const proxyUrl = keyToProxyUrl(key);
    return c.json(
      {
        url: proxyUrl,
        key,
        size: optimised.length,
        width,
        height,
        fileHash,
        thumbKey,
        mediumKey,
        shotAt,
        exifCamera,
        exifLens,
        exifFocalLength,
        exifFNumber,
        exifExposureTime,
        exifIso,
      },
      201,
    );
  })

  // ── Admin: Hero image upload (resize → storage) ─────────
  .post("/admin/hero/upload", requireAdmin, async (c) => {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file" }, 400);
    if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type))
      return c.json({ error: "許可されていないファイル形式です。" }, 415);
    if (file.size > IMAGE_MAX_BYTES)
      return c.json({ error: "画像は60MBまでです。" }, 413);

    const arrayBuf = await file.arrayBuffer();
    const inputBuf = Buffer.from(arrayBuf);

    const optimised = await optimiseImage(
      inputBuf,
      UPLOAD_MAX_PX,
      UPLOAD_QUALITY,
    );

    const key = `hero/${Date.now()}-${file.name.replace(/\.[^.]+$/, "")}.jpg`;
    await uploadToStorage(key, optimised, "image/jpeg");

    const proxyUrl = keyToProxyUrl(key);
    return c.json({ url: proxyUrl, key, size: optimised.length }, 201);
  })

  // ── Admin: Profile photo upload (resize → storage) ───────
  .post("/admin/profile/upload", requireAdmin, async (c) => {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file" }, 400);
    if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type))
      return c.json({ error: "許可されていないファイル形式です。" }, 415);
    if (file.size > IMAGE_MAX_BYTES)
      return c.json({ error: "画像は60MBまでです。" }, 413);

    const arrayBuf = await file.arrayBuffer();
    const inputBuf = Buffer.from(arrayBuf);

    const optimised = await optimiseImage(
      inputBuf,
      UPLOAD_MAX_PX,
      UPLOAD_QUALITY,
    );

    const key = `profile/${Date.now()}-${file.name.replace(/\.[^.]+$/, "")}.jpg`;
    await uploadToStorage(key, optimised, "image/jpeg");

    const proxyUrl = keyToProxyUrl(key);
    return c.json({ url: proxyUrl, key, size: optimised.length }, 201);
  })

  // ── Admin: Upload custom font ────────────────────────────
  .post("/admin/fonts/upload", requireAdmin, async (c) => {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file" }, 400);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = ["woff2", "woff", "ttf", "otf"];
    if (!allowed.includes(ext))
      return c.json(
        { error: "Invalid format. Use woff2, woff, ttf, or otf." },
        400,
      );
    if (file.size > FONT_MAX_BYTES)
      return c.json({ error: "フォントは2MBまでです。" }, 413);

    const mimeMap: Record<string, string> = {
      woff2: "font/woff2",
      woff: "font/woff",
      ttf: "font/ttf",
      otf: "font/otf",
    };

    const arrayBuf = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    // Sanitise the original name before it becomes part of the storage key.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `fonts/${Date.now()}-${safeName}`;
    await uploadToStorage(key, buf, mimeMap[ext] ?? "application/octet-stream");

    const proxyUrl = keyToProxyUrl(key);
    return c.json({ url: proxyUrl, key, size: buf.length }, 201);
  })

  // ── Admin: Add photo ────────────────────────────────────
  .post("/admin/photos", requireAdmin, async (c) => {
    const body = await c.req.json();
    const [photo] = await withRetry(() =>
      db
        .insert(schema.photos)
        .values({
          filename: body.filename,
          url: body.url,
          title: body.title ?? "",
          meta: body.meta ?? "",
          category: body.category ?? "", // default to uncategorized, not a phantom slug
          camera:
            typeof body.camera === "string" && body.camera ? body.camera : null,
          lens: typeof body.lens === "string" && body.lens ? body.lens : null,
          focalLength:
            typeof body.focalLength === "string" && body.focalLength
              ? body.focalLength
              : null,
          fNumber:
            typeof body.fNumber === "string" && body.fNumber
              ? body.fNumber
              : null,
          exposureTime:
            typeof body.exposureTime === "string" && body.exposureTime
              ? body.exposureTime
              : null,
          iso: typeof body.iso === "string" && body.iso ? body.iso : null,
          filmType:
            typeof body.filmType === "string" && body.filmType
              ? body.filmType
              : null,
          width: typeof body.width === "number" ? body.width : null,
          height: typeof body.height === "number" ? body.height : null,
          fileHash: typeof body.fileHash === "string" ? body.fileHash : null,
          thumbKey:
            typeof body.thumbKey === "string" && body.thumbKey
              ? body.thumbKey
              : null,
          mediumKey:
            typeof body.mediumKey === "string" && body.mediumKey
              ? body.mediumKey
              : null,
          shotAt:
            typeof body.shotAt === "string" && body.shotAt ? body.shotAt : null,
          // Atomic next sort order — avoids duplicate values when concurrent
          // uploads insert in parallel (SQLite serializes writes).
          sortOrder: sql`(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM photos)`,
        })
        .returning(),
    );
    return c.json({ photo }, 201);
  })

  // ── Admin: Update photo ─────────────────────────────────
  .patch("/admin/photos/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.meta !== undefined) update.meta = body.meta;
    if (body.camera !== undefined)
      update.camera =
        typeof body.camera === "string" && body.camera.trim()
          ? body.camera
          : null;
    if (body.lens !== undefined)
      update.lens =
        typeof body.lens === "string" && body.lens.trim() ? body.lens : null;
    if (body.focalLength !== undefined)
      update.focalLength =
        typeof body.focalLength === "string" && body.focalLength.trim()
          ? body.focalLength
          : null;
    if (body.fNumber !== undefined)
      update.fNumber =
        typeof body.fNumber === "string" && body.fNumber.trim()
          ? body.fNumber
          : null;
    if (body.exposureTime !== undefined)
      update.exposureTime =
        typeof body.exposureTime === "string" && body.exposureTime.trim()
          ? body.exposureTime
          : null;
    if (body.iso !== undefined)
      update.iso =
        typeof body.iso === "string" && body.iso.trim() ? body.iso : null;
    if (body.filmType !== undefined)
      update.filmType =
        typeof body.filmType === "string" && body.filmType.trim()
          ? body.filmType
          : null;
    // U2: 撮影日 — "" / null clears it back to unset.
    if (body.shotAt !== undefined)
      update.shotAt =
        body.shotAt === "" || body.shotAt === null ? null : String(body.shotAt);
    if (body.description !== undefined) update.description = body.description;
    if (body.category !== undefined) update.category = body.category;
    if (body.displaySize !== undefined) update.displaySize = body.displaySize;
    if (body.rotationDeg !== undefined) {
      const rotationDeg = parseRotationDeg(body.rotationDeg);
      if (rotationDeg === null)
        return c.json({ error: "Invalid rotationDeg" }, 400);
      update.rotationDeg = rotationDeg;
    }
    if (body.focalX !== undefined) {
      const focalX = parseFocalPoint(body.focalX);
      if (focalX === null) return c.json({ error: "Invalid focalX" }, 400);
      update.focalX = focalX;
    }
    if (body.focalY !== undefined) {
      const focalY = parseFocalPoint(body.focalY);
      if (focalY === null) return c.json({ error: "Invalid focalY" }, 400);
      update.focalY = focalY;
    }
    if (body.isPublished !== undefined) update.isPublished = !!body.isPublished;
    // I1: series assignment — "" / null clears membership.
    if (body.seriesId !== undefined)
      update.seriesId =
        body.seriesId === null || body.seriesId === ""
          ? null
          : Number(body.seriesId);
    await withRetry(() =>
      db.update(schema.photos).set(update).where(eq(schema.photos.id, id)),
    );
    return c.json({ ok: true }, 200);
  })

  // ── Admin: Duplicate a photo (O1) ───────────────────────
  // New row inheriting all metadata, pointing at the SAME stored image (no copy) — so
  // one photo can live in multiple categories / series cheaply.
  .post("/admin/photos/:id/duplicate", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    const [orig] = await withRetry(() =>
      db.select().from(schema.photos).where(eq(schema.photos.id, id)),
    );
    if (!orig) return c.json({ error: "Not found" }, 404);
    const [row] = await withRetry(() =>
      db
        .insert(schema.photos)
        .values({
          filename: orig.filename,
          url: orig.url,
          title: orig.title,
          meta: orig.meta,
          camera: orig.camera,
          lens: orig.lens,
          focalLength: orig.focalLength,
          fNumber: orig.fNumber,
          exposureTime: orig.exposureTime,
          iso: orig.iso,
          filmType: orig.filmType,
          description: orig.description,
          category: orig.category,
          displaySize: orig.displaySize,
          isPublished: orig.isPublished,
          seriesId: orig.seriesId,
          width: orig.width,
          height: orig.height,
          rotationDeg: orig.rotationDeg,
          focalX: orig.focalX,
          focalY: orig.focalY,
          fileHash: orig.fileHash,
          thumbKey: orig.thumbKey,
          mediumKey: orig.mediumKey,
          sortOrder: sql`(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM photos)`,
        })
        .returning(),
    );
    return c.json({ photo: row }, 201);
  })

  // ── Admin: Soft-delete photo (moves to trash) ──────────
  .delete("/admin/photos/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    await withRetry(() =>
      db
        .update(schema.photos)
        .set({ deletedAt: new Date() })
        .where(eq(schema.photos.id, id)),
    );
    return c.json({ ok: true }, 200);
  })

  // ── Admin: Restore photo from trash ────────────────────
  .post("/admin/photos/:id/restore", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    await withRetry(() =>
      db
        .update(schema.photos)
        .set({ deletedAt: null })
        .where(eq(schema.photos.id, id)),
    );
    return c.json({ ok: true }, 200);
  })

  // ── Admin: Permanently delete photo from trash ─────────
  .delete("/admin/photos/:id/purge", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    const [photo] = await withRetry(() =>
      db.select().from(schema.photos).where(eq(schema.photos.id, id)),
    );
    if (!photo) return c.json({ error: "Not found" }, 404);
    // O1 duplicates share the same storage object — only delete the file when no
    // OTHER photo row (live or trashed) still points at the same URL.
    const [sharer] = await withRetry(() =>
      db
        .select({ id: schema.photos.id })
        .from(schema.photos)
        .where(
          sql`${eq(schema.photos.url, photo.url)} AND ${schema.photos.id} != ${id}`,
        )
        .limit(1),
    );
    if (!sharer) {
      const key = photo.url.replace("/api/images/", "");
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      } catch {
        /* ignore */
      }
    }
    await withRetry(() =>
      db.delete(schema.photos).where(eq(schema.photos.id, id)),
    );
    // Clean up any dangling hero reference to the now-deleted photo.
    await withRetry(() =>
      db.delete(schema.heroPhotos).where(eq(schema.heroPhotos.photoId, id)),
    );
    await withRetry(() =>
      db
        .update(schema.series)
        .set({ coverPhotoId: null })
        .where(eq(schema.series.coverPhotoId, id)),
    );
    return c.json({ ok: true }, 200);
  })

  // ── Admin: List trashed photos ─────────────────────────
  .get("/admin/photos/trash", requireAdmin, async (c) => {
    // Lazy retention: there is no cron in this runtime, so opportunistically
    // purge items trashed more than TRASH_RETENTION_DAYS ago whenever the trash
    // is opened. This keeps the bin (and object storage) from growing unbounded.
    const cutoff = new Date(Date.now() - TRASH_RETENTION_MS);
    const stale = await withRetry(() =>
      db
        .select({ id: schema.photos.id, url: schema.photos.url })
        .from(schema.photos)
        .where(
          and(
            isNotNull(schema.photos.deletedAt),
            lt(schema.photos.deletedAt, cutoff),
          ),
        ),
    );
    for (const p of stale) {
      // O1 duplicates share storage objects — keep the file if another row references it.
      const [sharer] = await withRetry(() =>
        db
          .select({ id: schema.photos.id })
          .from(schema.photos)
          .where(
            sql`${eq(schema.photos.url, p.url)} AND ${schema.photos.id} != ${p.id}`,
          )
          .limit(1),
      );
      if (!sharer) {
        const key = p.url.replace("/api/images/", "");
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
        } catch {
          /* ignore */
        }
      }
      await withRetry(() =>
        db.delete(schema.photos).where(eq(schema.photos.id, p.id)),
      );
      await withRetry(() =>
        db.delete(schema.heroPhotos).where(eq(schema.heroPhotos.photoId, p.id)),
      );
      await withRetry(() =>
        db
          .update(schema.series)
          .set({ coverPhotoId: null })
          .where(eq(schema.series.coverPhotoId, p.id)),
      );
    }

    const photos = await withRetry(() =>
      db
        .select()
        .from(schema.photos)
        .where(isNotNull(schema.photos.deletedAt))
        .orderBy(schema.photos.deletedAt),
    );
    return c.json({ photos, retentionDays: TRASH_RETENTION_DAYS }, 200);
  })

  // ── Admin: Reorder photos ───────────────────────────────
  .post("/admin/photos/reorder", requireAdmin, async (c) => {
    const { ids } = (await c.req.json()) as { ids: number[] };
    if (ids.length === 0) return c.json({ ok: true }, 200);
    // 1回のSQL CASE WHEN で全件まとめて更新
    const caseExpr = ids.reduce(
      (expr, id, i) => sql`${expr} WHEN ${id} THEN ${i}`,
      sql`CASE id`,
    );
    const inList = sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    );
    await withRetry(() =>
      executeRaw(
        sql`UPDATE photos SET sort_order = ${caseExpr} END WHERE id IN (${inList})`,
      ),
    );
    return c.json({ ok: true }, 200);
  })

  // ── Admin: Batch operations on photos (M2) ──────────────
  // One request for a multi-photo edit instead of N PATCHes. Operations:
  // publish / unpublish / series / category / size update the photos rows;
  // feature / unfeature add or remove hero_photos membership.
  .post("/admin/photos/batch", requireAdmin, async (c) => {
    const { ids, operation, value } = (await c.req.json()) as {
      ids: number[];
      operation: string;
      value?: string;
    };
    const cleanIds = Array.isArray(ids)
      ? ids.filter((n): n is number => Number.isInteger(n))
      : [];
    if (cleanIds.length === 0) return c.json({ error: "No valid ids" }, 400);

    switch (operation) {
      case "publish":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({ isPublished: true })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      case "unpublish":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({ isPublished: false })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      case "category":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({ category: value ?? "" })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      // O2: batch metadata edit — only the fields the caller sends are touched.
      case "camera":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({
              camera: typeof value === "string" && value.trim() ? value : null,
            })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      case "lens":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({
              lens: typeof value === "string" && value.trim() ? value : null,
            })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      case "filmType":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({
              filmType:
                typeof value === "string" && value.trim() ? value : null,
            })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      case "size": {
        const size =
          value === "S" || value === "M" || value === "L" ? value : "M";
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({ displaySize: size })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      }
      case "rotate_left":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({
              rotationDeg: sql`(${schema.photos.rotationDeg} + 270) % 360`,
            })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      case "rotate_right":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({
              rotationDeg: sql`(${schema.photos.rotationDeg} + 90) % 360`,
            })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      case "reset_rotation":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({ rotationDeg: 0 })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      case "reset_focal_point":
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({ focalX: 50, focalY: 50 })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      case "series": {
        const seriesId =
          value === undefined || value === null || value === ""
            ? null
            : Number(value);
        await withRetry(() =>
          db
            .update(schema.photos)
            .set({ seriesId })
            .where(inArray(schema.photos.id, cleanIds)),
        );
        break;
      }
      case "feature": {
        // Append any not-already-featured photo to hero_photos (atomic sort order).
        const existing = await withRetry(() =>
          db
            .select({ photoId: schema.heroPhotos.photoId })
            .from(schema.heroPhotos)
            .where(inArray(schema.heroPhotos.photoId, cleanIds)),
        );
        const have = new Set(existing.map((r) => r.photoId));
        for (const id of cleanIds.filter((id) => !have.has(id))) {
          await withRetry(() =>
            db.insert(schema.heroPhotos).values({
              photoId: id,
              sortOrder: sql`(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM hero_photos)`,
            }),
          );
        }
        break;
      }
      case "unfeature":
        await withRetry(() =>
          db
            .delete(schema.heroPhotos)
            .where(inArray(schema.heroPhotos.photoId, cleanIds)),
        );
        break;
      default:
        return c.json({ error: "Unknown operation" }, 400);
    }
    return c.json({ ok: true, count: cleanIds.length }, 200);
  })

  // ── Admin: Categories CRUD ──────────────────────────────
  .post("/admin/categories", requireAdmin, async (c) => {
    const { slug, label } = await c.req.json();
    const existing = await withRetry(() => db.select().from(schema.categories));
    const [cat] = await withRetry(() =>
      db
        .insert(schema.categories)
        .values({
          slug,
          label,
          sortOrder: existing.length,
        })
        .returning(),
    );
    return c.json({ category: cat }, 201);
  })

  .delete("/admin/categories/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    // Reassign this category's photos to "uncategorized" so they don't become
    // orphans (a category slug that no longer exists = unfilterable on the site).
    const [cat] = await withRetry(() =>
      db
        .select({ slug: schema.categories.slug })
        .from(schema.categories)
        .where(eq(schema.categories.id, id))
        .limit(1),
    );
    await withRetry(() =>
      db.delete(schema.categories).where(eq(schema.categories.id, id)),
    );
    if (cat) {
      await withRetry(() =>
        db
          .update(schema.photos)
          .set({ category: "" })
          .where(eq(schema.photos.category, cat.slug)),
      );
    }
    return c.json({ ok: true }, 200);
  })

  // ── Admin: Reorder categories (controls gallery filter order) ──
  .post("/admin/categories/reorder", requireAdmin, async (c) => {
    const { ids } = (await c.req.json()) as { ids: number[] };
    if (ids.length === 0) return c.json({ ok: true }, 200);
    const caseExpr = ids.reduce(
      (expr, id, i) => sql`${expr} WHEN ${id} THEN ${i}`,
      sql`CASE id`,
    );
    const inList = sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    );
    await withRetry(() =>
      executeRaw(
        sql`UPDATE categories SET sort_order = ${caseExpr} END WHERE id IN (${inList})`,
      ),
    );
    return c.json({ ok: true }, 200);
  })

  // ── Series (public) — I1 ────────────────────────────────
  // Published series only, in sortOrder. Resolves each cover photo's URL so the
  // list page can render thumbnails without an extra round-trip.
  .get("/series", async (c) => {
    const rows = await withRetry(() =>
      db
        .select()
        .from(schema.series)
        .where(eq(schema.series.isPublished, true))
        .orderBy(schema.series.sortOrder),
    );
    const coverIds = rows
      .map((s) => s.coverPhotoId)
      .filter((v): v is number => typeof v === "number");
    const covers = coverIds.length
      ? await withRetry(() =>
          db
            .select({
              id: schema.photos.id,
              url: schema.photos.url,
              rotationDeg: schema.photos.rotationDeg,
              focalX: schema.photos.focalX,
              focalY: schema.photos.focalY,
            })
            .from(schema.photos)
            .where(
              sql`${inArray(schema.photos.id, coverIds)} AND ${isNull(schema.photos.deletedAt)}`,
            ),
        )
      : [];
    const coverMap = new Map(covers.map((p) => [p.id, p]));
    // P5: a series whose cover is unset (or points at a deleted photo) falls back
    // to its first published photo so the grid tile is never blank. One query
    // grabs the lead photo for every series; we read it only when the cover misses.
    const needFallback = rows.filter(
      (s) => !s.coverPhotoId || !coverMap.get(s.coverPhotoId),
    );
    const firstBySeries = new Map<
      number,
      {
        url: string;
        rotationDeg: number;
        focalX: number;
        focalY: number;
      }
    >();
    if (needFallback.length) {
      const leadPhotos = await withRetry(() =>
        db
          .select({
            url: schema.photos.url,
            rotationDeg: schema.photos.rotationDeg,
            focalX: schema.photos.focalX,
            focalY: schema.photos.focalY,
            seriesId: schema.photos.seriesId,
            sortOrder: schema.photos.sortOrder,
          })
          .from(schema.photos)
          .where(
            sql`${inArray(
              schema.photos.seriesId,
              needFallback.map((s) => s.id),
            )} AND ${isNull(schema.photos.deletedAt)} AND ${eq(schema.photos.isPublished, true)}`,
          )
          .orderBy(schema.photos.sortOrder),
      );
      // orderBy sortOrder asc → the first row seen per series is its lead photo.
      for (const p of leadPhotos)
        if (p.seriesId != null && !firstBySeries.has(p.seriesId))
          firstBySeries.set(p.seriesId, p);
    }
    const list = rows.map((s) => {
      const cover =
        (s.coverPhotoId ? coverMap.get(s.coverPhotoId) : undefined) ??
        firstBySeries.get(s.id) ??
        null;
      return {
        ...s,
        coverUrl: cover?.url ?? null,
        coverRotationDeg: cover?.rotationDeg ?? 0,
        coverFocalX: cover?.focalX ?? 50,
        coverFocalY: cover?.focalY ?? 50,
      };
    });
    return c.json({ series: list }, 200);
  })

  // Single published series + its (non-deleted) photos.
  .get("/series/:slug", async (c) => {
    const slug = c.req.param("slug");
    const [s] = await withRetry(() =>
      db
        .select()
        .from(schema.series)
        .where(
          sql`${eq(schema.series.slug, slug)} AND ${eq(schema.series.isPublished, true)}`,
        )
        .limit(1),
    );
    if (!s) return c.json({ error: "Not found" }, 404);
    // 機能8: seriesSortOrder に従ってシリーズ内写真を並べる。
    // themeConfig に上書き値があればそちらを優先。
    let sortKey = "manual";
    try {
      const tc = s.themeConfig
        ? (JSON.parse(s.themeConfig) as Record<string, string>)
        : null;
      sortKey = tc?.photoOrder ?? "inherit";
    } catch {
      /* ignore malformed JSON */
    }
    if (sortKey === "inherit" || sortKey === "manual_inherit") {
      const [[row]] = [
        await withRetry(() =>
          db
            .select({ value: schema.siteSettings.value })
            .from(schema.siteSettings)
            .where(eq(schema.siteSettings.key, "seriesSortOrder"))
            .limit(1),
        ),
      ];
      sortKey = row?.value ?? "manual";
    }
    const seriesOrderExpr =
      sortKey === "date_desc"
        ? sql`${schema.photos.shotAt} DESC NULLS LAST, ${schema.photos.sortOrder} ASC`
        : sortKey === "date_asc"
          ? sql`${schema.photos.shotAt} ASC NULLS LAST, ${schema.photos.sortOrder} ASC`
          : sortKey === "upload_desc"
            ? sql`${schema.photos.createdAt} DESC`
            : schema.photos.sortOrder;
    const photos = await withRetry(() =>
      db
        .select()
        .from(schema.photos)
        .where(
          sql`${eq(schema.photos.seriesId, s.id)} AND ${isNull(schema.photos.deletedAt)} AND ${eq(schema.photos.isPublished, true)}`,
        )
        .orderBy(seriesOrderExpr),
    );
    return c.json({ series: s, photos: photos.map(photoWithThumbs) }, 200);
  })

  // ── Admin: Series ───────────────────────────────────────
  // Full list incl. drafts, for the admin tab.
  .get("/admin/series", requireAdmin, async (c) => {
    const rows = await withRetry(() =>
      db.select().from(schema.series).orderBy(schema.series.sortOrder),
    );
    return c.json({ series: rows }, 200);
  })

  .post("/admin/series", requireAdmin, async (c) => {
    const body = await c.req.json();
    const [row] = await withRetry(() =>
      db
        .insert(schema.series)
        .values({
          slug: body.slug,
          title: body.title ?? "",
          subtitle: body.subtitle ?? "",
          statement: body.statement ?? "",
          coverPhotoId:
            typeof body.coverPhotoId === "number" ? body.coverPhotoId : null,
          isPublished:
            body.isPublished === undefined ? true : !!body.isPublished,
          // Atomic next sort order — avoids duplicates on concurrent inserts.
          sortOrder: sql`(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM series)`,
        })
        .returning(),
    );
    return c.json({ series: row }, 201);
  })

  .patch("/admin/series/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const update: Record<string, unknown> = {};
    if (body.slug !== undefined) update.slug = body.slug;
    if (body.title !== undefined) update.title = body.title;
    if (body.subtitle !== undefined) update.subtitle = body.subtitle;
    if (body.statement !== undefined) update.statement = body.statement;
    if (body.coverPhotoId !== undefined)
      update.coverPhotoId =
        body.coverPhotoId === null || body.coverPhotoId === ""
          ? null
          : Number(body.coverPhotoId);
    if (body.isPublished !== undefined) update.isPublished = !!body.isPublished;
    // 機能9: themeConfig (JSON string | null)
    if (body.themeConfig !== undefined)
      update.themeConfig = body.themeConfig === "" ? null : body.themeConfig;
    await withRetry(() =>
      db.update(schema.series).set(update).where(eq(schema.series.id, id)),
    );
    return c.json({ ok: true }, 200);
  })

  .delete("/admin/series/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    await withRetry(() =>
      db.delete(schema.series).where(eq(schema.series.id, id)),
    );
    // Detach photos from the now-deleted series so they don't point at a ghost.
    await withRetry(() =>
      db
        .update(schema.photos)
        .set({ seriesId: null })
        .where(eq(schema.photos.seriesId, id)),
    );
    return c.json({ ok: true }, 200);
  })

  .post("/admin/series/reorder", requireAdmin, async (c) => {
    const { ids } = (await c.req.json()) as { ids: number[] };
    if (ids.length === 0) return c.json({ ok: true }, 200);
    const caseExpr = ids.reduce(
      (expr, id, i) => sql`${expr} WHEN ${id} THEN ${i}`,
      sql`CASE id`,
    );
    const inList = sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    );
    await withRetry(() =>
      executeRaw(
        sql`UPDATE series SET sort_order = ${caseExpr} END WHERE id IN (${inList})`,
      ),
    );
    return c.json({ ok: true }, 200);
  })

  // ── Pricing plans (public) — H1 ─────────────────────────
  .get("/pricing", async (c) => {
    const rows = await withRetry(() =>
      db
        .select()
        .from(schema.pricingPlans)
        .where(eq(schema.pricingPlans.isPublished, true))
        .orderBy(schema.pricingPlans.sortOrder),
    );
    return c.json({ plans: rows }, 200);
  })

  // ── Admin: Pricing plans ────────────────────────────────
  .get("/admin/pricing", requireAdmin, async (c) => {
    const rows = await withRetry(() =>
      db
        .select()
        .from(schema.pricingPlans)
        .orderBy(schema.pricingPlans.sortOrder),
    );
    return c.json({ plans: rows }, 200);
  })

  .post("/admin/pricing", requireAdmin, async (c) => {
    const body = await c.req.json();
    const [row] = await withRetry(() =>
      db
        .insert(schema.pricingPlans)
        .values({
          title: body.title ?? "",
          price: body.price ?? "",
          description: body.description ?? "",
          features: body.features ?? "",
          note: body.note ?? "",
          isPublished:
            body.isPublished === undefined ? true : !!body.isPublished,
          sortOrder: sql`(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM pricing_plans)`,
        })
        .returning(),
    );
    return c.json({ plan: row }, 201);
  })

  .patch("/admin/pricing/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const update: Record<string, unknown> = {};
    for (const k of [
      "title",
      "price",
      "description",
      "features",
      "note",
    ] as const) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    if (body.isPublished !== undefined) update.isPublished = !!body.isPublished;
    await withRetry(() =>
      db
        .update(schema.pricingPlans)
        .set(update)
        .where(eq(schema.pricingPlans.id, id)),
    );
    return c.json({ ok: true }, 200);
  })

  .delete("/admin/pricing/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    await withRetry(() =>
      db.delete(schema.pricingPlans).where(eq(schema.pricingPlans.id, id)),
    );
    return c.json({ ok: true }, 200);
  })

  .post("/admin/pricing/reorder", requireAdmin, async (c) => {
    const { ids } = (await c.req.json()) as { ids: number[] };
    if (ids.length === 0) return c.json({ ok: true }, 200);
    const caseExpr = ids.reduce(
      (expr, id, i) => sql`${expr} WHEN ${id} THEN ${i}`,
      sql`CASE id`,
    );
    const inList = sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    );
    await withRetry(() =>
      executeRaw(
        sql`UPDATE pricing_plans SET sort_order = ${caseExpr} END WHERE id IN (${inList})`,
      ),
    );
    return c.json({ ok: true }, 200);
  })

  // ── note posts (public, cached RSS) — J1 ────────────────
  .get("/note-posts", async (c) => {
    const rows = await withRetry(() =>
      db
        .select()
        .from(schema.siteSettings)
        .where(
          inArray(schema.siteSettings.key, [
            "noteUsername",
            "noteEnabled",
            "noteShowCount",
          ]),
        ),
    );
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    const enabled = (map.noteEnabled ?? "off") === "on";
    const username = (map.noteUsername ?? "").trim();
    const count = Math.max(
      1,
      Math.min(12, parseInt(map.noteShowCount ?? "3", 10) || 3),
    );
    if (!enabled || !username) return c.json({ posts: [] }, 200);
    const posts = await fetchNotePosts(username, count);
    return c.json({ posts }, 200);
  })

  // ── Hero Photos (public) ────────────────────────────────
  .get("/hero-photos", async (c) => {
    const rows = await withRetry(() =>
      db.select().from(schema.heroPhotos).orderBy(schema.heroPhotos.sortOrder),
    );
    // Join with photos table to get URL etc — fetch only the referenced rows
    const photoIds = rows.map((r) => r.photoId);
    if (photoIds.length === 0) return c.json({ heroPhotos: [] }, 200);
    const heroRows = await withRetry(() =>
      db
        .select()
        .from(schema.photos)
        .where(
          sql`${inArray(schema.photos.id, photoIds)} AND ${isNull(schema.photos.deletedAt)} AND ${eq(schema.photos.isPublished, true)}`,
        ),
    );
    const photoMap = new Map(heroRows.map((p) => [p.id, photoWithThumbs(p)]));
    const result = rows.map((r) => photoMap.get(r.photoId)).filter(Boolean);
    return c.json({ heroPhotos: result }, 200);
  })

  // ── Admin: Hero Photos CRUD ─────────────────────────────
  .get("/admin/hero-photos", requireAdmin, async (c) => {
    const rows = await withRetry(() =>
      db.select().from(schema.heroPhotos).orderBy(schema.heroPhotos.sortOrder),
    );
    return c.json({ heroPhotos: rows }, 200);
  })

  .post("/admin/hero-photos", requireAdmin, async (c) => {
    const { photoId } = (await c.req.json()) as { photoId: number };
    // Idempotent: a fast double-click (or two tabs) must not add the same photo
    // twice, which would make it appear twice in the carousel.
    const [existing] = await withRetry(() =>
      db
        .select({ id: schema.heroPhotos.id })
        .from(schema.heroPhotos)
        .where(eq(schema.heroPhotos.photoId, photoId))
        .limit(1),
    );
    if (existing) return c.json({ ok: true, duplicate: true }, 200);
    await withRetry(() =>
      db.insert(schema.heroPhotos).values({
        photoId,
        // Atomic next sort order — avoids duplicate values on concurrent adds
        sortOrder: sql`(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM hero_photos)`,
      }),
    );
    return c.json({ ok: true }, 201);
  })

  .delete("/admin/hero-photos/:id", requireAdmin, async (c) => {
    const photoId = Number(c.req.param("id"));
    await withRetry(() =>
      db
        .delete(schema.heroPhotos)
        .where(eq(schema.heroPhotos.photoId, photoId)),
    );
    return c.json({ ok: true }, 200);
  })

  // Batch-remove dangling hero references (e.g. photos trashed/purged after
  // being picked). Accepts any photoIds regardless of whether those photos
  // still exist in the photos table — no existence check, no 404.
  .post("/admin/hero-photos/cleanup", requireAdmin, async (c) => {
    const { photoIds } = (await c.req.json()) as { photoIds: number[] };
    const cleanIds = Array.isArray(photoIds)
      ? photoIds.filter((n): n is number => Number.isInteger(n) && n > 0)
      : [];
    if (cleanIds.length > 0) {
      await withRetry(() =>
        db
          .delete(schema.heroPhotos)
          .where(inArray(schema.heroPhotos.photoId, cleanIds)),
      );
    }
    return c.json({ ok: true }, 200);
  })

  .post("/admin/hero-photos/reorder", requireAdmin, async (c) => {
    const { photoIds } = (await c.req.json()) as { photoIds: number[] };
    if (photoIds.length === 0) return c.json({ ok: true }, 200);
    // 1回のSQL CASE WHEN で全件まとめて更新
    const caseExpr = photoIds.reduce(
      (expr, id, i) => sql`${expr} WHEN ${id} THEN ${i}`,
      sql`CASE photo_id`,
    );
    const inList = sql.join(
      photoIds.map((id) => sql`${id}`),
      sql`, `,
    );
    await withRetry(() =>
      executeRaw(
        sql`UPDATE hero_photos SET sort_order = ${caseExpr} END WHERE photo_id IN (${inList})`,
      ),
    );
    return c.json({ ok: true }, 200);
  })

  // ── Admin: Batch-generate thumbnails for existing photos ──
  .post("/admin/generate-thumbnails", requireAdmin, async (c) => {
    const rawVariant = c.req.query("variant");
    const variant =
      rawVariant === "thumb" || rawVariant === "medium" ? rawVariant : "all";
    const limitParam = Number(c.req.query("limit") ?? "25");
    const limit = Math.min(
      50,
      Math.max(1, Number.isFinite(limitParam) ? Math.floor(limitParam) : 25),
    );
    const photos = await withRetry(() =>
      db
        .select({
          id: schema.photos.id,
          url: schema.photos.url,
          thumbKey: schema.photos.thumbKey,
          mediumKey: schema.photos.mediumKey,
        })
        .from(schema.photos)
        .where(isNull(schema.photos.deletedAt))
        .orderBy(schema.photos.sortOrder),
    );
    const pending = photos.filter((p) => {
      if (variant === "thumb") return !p.thumbKey;
      if (variant === "medium") return !p.mediumKey;
      return !p.thumbKey || !p.mediumKey;
    });
    if (pending.length === 0)
      return c.json(
        { ok: true, processed: 0, failed: 0, remaining: 0, total: photos.length },
        200,
      );

    let processed = 0;
    let failed = 0;
    for (const p of pending.slice(0, limit)) {
      const r2Key = p.url.replace("/api/images/", "");
      try {
        const obj = await s3.send(
          new GetObjectCommand({ Bucket: BUCKET, Key: r2Key }),
        );
        const buf = Buffer.from(await obj.Body!.transformToByteArray());
        if (variant === "thumb") {
          const keys = await generateAndUploadThumb(buf, r2Key);
          await withRetry(() =>
            db
              .update(schema.photos)
              .set({ thumbKey: keys.thumbKey })
              .where(eq(schema.photos.id, p.id)),
          );
        } else if (variant === "medium") {
          const keys = await generateAndUploadMedium(buf, r2Key);
          await withRetry(() =>
            db
              .update(schema.photos)
              .set({ mediumKey: keys.mediumKey })
              .where(eq(schema.photos.id, p.id)),
          );
        } else {
          const keys = await generateAndUploadThumbnails(buf, r2Key);
          await withRetry(() =>
            db
              .update(schema.photos)
              .set({ thumbKey: keys.thumbKey, mediumKey: keys.mediumKey })
              .where(eq(schema.photos.id, p.id)),
          );
        }
        processed++;
        console.log(
          `[thumbnails] ${processed}/${pending.length} done: id=${p.id}`,
        );
      } catch (e) {
        failed++;
        console.error(`[thumbnails] failed id=${p.id}:`, e);
      }
    }
    return c.json(
      {
        ok: true,
        processed,
        failed,
        remaining: Math.max(0, pending.length - processed),
        total: photos.length,
      },
      200,
    );
  });

export type AppType = typeof app;
export default app;
