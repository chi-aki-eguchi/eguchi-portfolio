import {
  DEFAULT_SITE_URL as SITE_URL_DEFAULT,
  displayNameEnFrom,
  displayNameFrom,
  gaMeasurementIdForSite,
  siteDescriptionFrom,
} from "./site-defaults";
import { imageUrlWithParams } from "../shared/image-url";
import { composeBaseTitle, composeHomeTitle } from "../shared/site-title";
import { resolveServiceVisibility } from "../shared/service-visibility";
import { hasPublicEnglishContent } from "../shared/public-english";
export const DEFAULT_SITE_URL = SITE_URL_DEFAULT;

// Pure HTML-escaping helpers for server-side OGP / meta-tag injection. Extracted
// so the (security-critical) escaping is unit-testable without importing server.ts,
// which starts the HTTP server on import.

/**
 * Escape a value before it goes into HTML text or a double-quoted attribute.
 * Settings/series text is admin-controlled, but an unescaped " or < would still
 * break the markup and be a stored-XSS vector — so always escape. `&` is replaced
 * first so the entities introduced by the later replacements aren't double-escaped.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Replace a `(prefix)(value)(suffix)` regex match, escaping the value. Uses a
 * function replacer so `$`-sequences in the value aren't treated as substitution
 * patterns.
 */
export function setAttr(html: string, re: RegExp, value: string): string {
  const safe = escapeHtml(value);
  return html.replace(re, (_m, p1, p2) => `${p1}${safe}${p2}`);
}

// ── Site constants + OGP injection (moved from server.ts for testability) ──
// Canonical public origin for sitemap / canonical / og:url / JSON-LD.
// Resolution: admin setting (siteUrl) → SITE_URL env var → the custom domain.
// The Runable hostname must never leak into these — Search Console treats it
// as a separate (duplicate) property and errors on the mismatch.
// Deploy fingerprint — Railway sets RAILWAY_GIT_COMMIT_SHA automatically.
export const BUILD_ID =
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 8) ?? "dev";

export function siteUrlFrom(
  settings: Record<string, string>,
  fallbackOrigin = "",
): string {
  return (
    settings.siteUrl ||
    process.env.SITE_URL ||
    fallbackOrigin ||
    DEFAULT_SITE_URL
  ).replace(/\/+$/, "");
}
// Per-route titles so each page is distinct for search/social, not all "home".
const PAGE_TITLES: Record<string, string> = {
  "/gallery": "Gallery",
  "/series": "Series",
  // Work の棚（2026-08-31）。**ここに足さないと `/work` が Not Found 扱いになり、
  // 画面は出るのに HTTP 404 を返す**（実測。共有カードも「Not Found」になる）。
  "/work": "Work",
  "/about": "About",
  "/profile": "About",
  "/contact": "Contact",
  // i18n Phase 3 スライス1: /en/about・/en/contact の英語URL
  "/en/about": "About",
  "/en/contact": "Contact",
  // admin は正常表示されるページなので Not Found title にしない。検索除外は
  // 下の startsWith("/admin") noindex 条件が isKnown と無関係に維持する。
  "/admin": "Admin",
  "/admin/login": "Admin Login",
};

// Per-route settings key for a distinct meta description, mirroring PAGE_TITLES
// above. Both /about and /profile map to the same key since they render the
// same page (see the canonPath handling below).
const META_DESCRIPTION_KEYS: Record<string, string> = {
  "/": "metaDescriptionHome",
  "/gallery": "metaDescriptionGallery",
  "/series": "metaDescriptionSeries",
  // Work は専用キーを増やさず、シリーズ側の説明に相乗りする（同じ「作品群を
  // 束ねたページ」なので、説明の中身も同じでよい）。
  "/work": "metaDescriptionSeries",
  "/about": "metaDescriptionAbout",
  "/profile": "metaDescriptionAbout",
  "/contact": "metaDescriptionContact",
  // i18n Phase 3 スライス1: /en/about・/en/contact は専用キーを増やさず既存の
  // metaDescriptionAbout/metaDescriptionContact に相乗り(settings未設定時は
  // genericPageDescription側で英文フォールバックを出す)。
  "/en/about": "metaDescriptionAbout",
  "/en/contact": "metaDescriptionContact",
};

// Generic per-page description used when the corresponding admin setting is
// empty. Kept template-safe: only `name` (the settings-resolved display name)
// is interpolated — no hardcoded location/subject matter — so every distributed
// site still gets distinct, non-generic text per page out of the box.
function genericPageDescription(
  pathname: string,
  name: string,
  settings: Record<string, string>,
): string {
  switch (pathname) {
    case "/gallery":
      return `${name}の作品を一覧できるギャラリーページ。`;
    case "/series":
    case "/work":
      return `${name}の作品をシリーズ単位で紹介するページ。`;
    case "/about":
    case "/profile":
      return `${name}のプロフィールページ。`;
    case "/contact":
      return `${name}への連絡先ページ。`;
    case "/en/about":
      return `${displayNameEnFrom(settings)}'s profile page.`;
    case "/en/contact":
      return `Contact ${displayNameEnFrom(settings)}.`;
    default:
      return siteDescriptionFrom(settings);
  }
}

export function isServiceSiteUrl(siteUrl: string): boolean {
  return resolveServiceVisibility("", siteUrl, "");
}

export function ogCardTitleFrom(settings: Record<string, string>): string {
  return (
    composeBaseTitle({
      nameJa: settings.siteName?.trim() ?? "",
      nameEn: settings.siteNameEn?.trim() ?? "",
      subtitle: settings.heroSubtitle?.trim() || "Photography",
    }) || "Photography"
  );
}

// 主語は作品であって、サービスではない（オーナー判断・2026-09-01）。
// 検索から来る人が打つ語（写真家 / ポートフォリオサイト）は残すが、先頭には
// 置かない。「Aki Eguchi Portfolio Kit」は、この製品を既に知っている人しか
// 打たない語なので、題の頭には置かず説明の末尾で名乗る。
const SERVICE_OG = {
  title: "写真を置く場所をつくる | 写真家のポートフォリオサイト",
  desc: "SNSに流した写真を、長く置いておける場所へ。余白と並びが整ったポートフォリオサイトを、設定ごと公開した状態でお渡しします。買い切り¥30,000（Aki Eguchi Portfolio Kit）。",
  image: "/og-service.jpg",
};

const SERVICE_START_OG = {
  title: "Aki Eguchi Portfolio Kit — Start",
  desc: "購入後に必要なことだけをまとめた、Aki Eguchi Portfolio Kit のスタートページ。",
  image: "/og-service.jpg",
};

const SERVICE_OG_EN = {
  title: "A Place to Keep Your Photographs | Portfolio Websites for Photographers",
  desc: "A lasting place for work that otherwise disappears down a feed. A portfolio website with the spacing and sequencing already resolved, set up for you and delivered published — ¥30,000 one-time (Aki Eguchi Portfolio Kit).",
  image: "/og-service.jpg",
};

const SERVICE_START_OG_EN = {
  title: "Aki Eguchi Portfolio Kit — Start Guide",
  desc: "A concise post-purchase guide to setting up and publishing the Aki Eguchi Portfolio Kit.",
  image: "/og-service.jpg",
};

const SERVICE_LP_PATHS = new Set(["/portfolio-kit", "/portfolio-kit/en"]);
const SERVICE_START_PATHS = new Set([
  "/portfolio-kit/start",
  "/start",
  "/start/en",
]);
const SERVICE_PATHS = new Set([
  ...SERVICE_LP_PATHS,
  ...SERVICE_START_PATHS,
]);
const ENGLISH_SERVICE_PATHS = new Set(["/portfolio-kit/en", "/start/en"]);

function serviceLanguageAlternates(
  pathname: string,
): { ja: string; en: string } | null {
  if (SERVICE_LP_PATHS.has(pathname)) {
    return { ja: "/portfolio-kit", en: "/portfolio-kit/en" };
  }
  if (pathname === "/start" || pathname === "/start/en") {
    return { ja: "/start", en: "/start/en" };
  }
  return null;
}

// i18n Phase 3 スライス1: /about・/contact の JA/EN 相互参照。/profile は
// /about のエイリアスなので ja 側は常に /about を正とする(canonPath と同じ扱い)。
const ENGLISH_PUBLIC_PATHS = new Set(["/en/about", "/en/contact"]);

function publicPageLanguageAlternates(
  pathname: string,
): { ja: string; en: string } | null {
  if (pathname === "/about" || pathname === "/profile" || pathname === "/en/about") {
    return { ja: "/about", en: "/en/about" };
  }
  if (pathname === "/contact" || pathname === "/en/contact") {
    return { ja: "/contact", en: "/en/contact" };
  }
  return null;
}

function socialImagePath(image: string, rotationDeg?: number | null): string {
  if (!image.startsWith("/api/images/")) return image;
  return imageUrlWithParams(image, {
    w: 1200,
    h: 630,
    q: 90,
    fmt: "jpeg",
    rotationDeg,
  });
}

function absoluteUrl(siteUrl: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export function injectOgp(
  html: string,
  settings: Record<string, string>,
  pathname = "/",
  heroImg = "",
  override?: {
    title?: string;
    desc?: string;
    image?: string;
    imageRotationDeg?: number | null;
  },
  fallbackOrigin = "",
  heroRotationDeg?: number | null,
  heroPreloadUrl?: string,
): string {
  const siteName = displayNameEnFrom(settings);
  const subtitle = settings.heroSubtitle || "Photography";
  // Bilingual base title (e.g. "Name JP | Name EN | Photography") so the JA name
  // leads for Japanese search while the EN name still reads in social cards.
  // web/hooks/usePageTitle.ts calls the same composeBaseTitle/composeHomeTitle
  // helpers (from ../shared/site-title) so the SPA tab title and the
  // server-rendered <title>/og:title always agree — a past divergence there
  // caused GA to record two different titles for the same URL.
  const siteUrl = siteUrlFrom(settings, fallbackOrigin);
  const nameJa = settings.siteName || "";
  // JA-preferring display name — used to build the per-page generic
  // description fallbacks below (distinct from `siteName`, which is EN).
  const name = displayNameFrom(settings);
  const titleParts = { nameJa, nameEn: siteName, subtitle };
  const base = composeBaseTitle(titleParts);
  // Home page only: "Name JA | Name EN Subtitle" (subtitle merges into the EN
  // name without a pipe) — see composeHomeTitle for why this differs from `base`.
  const homeTitle = composeHomeTitle(titleParts);
  const isServiceSite = resolveServiceVisibility(
    settings.servicePageMode,
    siteUrl,
    "",
  );
  const isServiceHost = isServiceSiteUrl(siteUrl);
  const isServicePath = SERVICE_PATHS.has(pathname);
  const isBuyerStartPath = SERVICE_START_PATHS.has(pathname);
  const isEnglishServicePath = ENGLISH_SERVICE_PATHS.has(pathname);
  const isService = isServicePath && isServiceSite;
  const serviceOg = isBuyerStartPath
    ? isEnglishServicePath
      ? SERVICE_START_OG_EN
      : SERVICE_START_OG
    : isEnglishServicePath
      ? SERVICE_OG_EN
      : SERVICE_OG;
  const page = PAGE_TITLES[pathname];
  const KNOWN_ROUTES = [
    "/",
    "/gallery",
    "/series",
    "/work",
    "/about",
    "/profile",
    "/contact",
    "/en/about",
    "/en/contact",
    "/portfolio-kit",
    "/portfolio-kit/en",
    "/portfolio-kit/start",
    "/start",
    "/start/en",
    "/admin",
    "/admin/login",
  ];
  // /series/:slug is indexable only when the slug resolved to a real published
  // series (override.title set by the caller). Unknown/unpublished slugs render
  // the SPA's not-found view — without this they'd look like normal share cards.
  const isKnown =
    KNOWN_ROUTES.includes(pathname) ||
    ((pathname.startsWith("/series/") || pathname.startsWith("/work/")) &&
      !!override?.title);
  const serviceUnavailable = isServicePath && !isServiceSite;
  const missingPublicPage = !isKnown || serviceUnavailable;
  // A per-page override (e.g. a specific series) wins over the static route title.
  const title = missingPublicPage
    ? `Not Found | ${base}`
    : isService
      ? serviceOg.title
      : override?.title
        ? `${override.title} | ${base}`
        : page
          ? `${page} | ${base}`
          : homeTitle;
  // Per-page description, from most to least specific:
  // 1. a series' own statement/subtitle (override.desc)
  // 2. a series with no statement/subtitle configured — still name the series
  //    (override.title, set only by the /series/:slug caller) rather than
  //    falling all the way through to the generic site description
  // 3. a static route's admin-configured meta description setting
  // 4. that route's generic (template-safe) fallback sentence
  const desc = missingPublicPage
    ? "お探しのページは見つかりませんでした。"
    : isService
      ? serviceOg.desc
      : override?.desc
        ? override.desc
        : override?.title
          ? seriesFallbackDescription(override.title, name)
          : settings[META_DESCRIPTION_KEYS[pathname] ?? ""] ||
            genericPageDescription(pathname, name, settings);
  // Owner-branded flat files remain exclusive to akieguchi.com; distributed sites
  // without a photo use their settings-derived card instead.
  const imgBase = isService
    ? isServiceHost
      ? serviceOg.image
      : "/og-default.png"
    : override?.image ||
      heroImg ||
      settings.heroPhotoUrl ||
      settings.profilePhotoUrl ||
      (isServiceHost ? "/og-image.jpg" : "/og-default.png");
  const imgRotationDeg = override?.image
    ? override.imageRotationDeg
    : heroImg && imgBase === heroImg
      ? heroRotationDeg
      : 0;
  const ogImage = socialImagePath(imgBase, imgRotationDeg);
  // /profile and /about render the same page — canonicalise /profile → /about so
  // search engines don't treat them as duplicate content.
  const canonPath = pathname === "/profile" ? "/about" : pathname;
  const canonical = `${siteUrl}${canonPath === "/" ? "/" : canonPath}`;

  let out = html;
  // i18n Phase 3 スライス1: サービスLP(/portfolio-kit/en 等)だけでなく、
  // /en/about・/en/contact も同じ英語ページ扱いで lang/og:locale を切り替える。
  if ((isService && isEnglishServicePath) || ENGLISH_PUBLIC_PATHS.has(pathname)) {
    out = out.replace(/<html\s+lang="[^"]*"/, '<html lang="en"');
    out = setAttr(
      out,
      /(<meta\s+property="og:locale"\s+content=")[^"]*(")/,
      "en_US",
    );
  }
  // Title (escaped; the <title> body can't contain raw < anyway)
  out = out.replace(
    /<title>[^<]*<\/title>/,
    () => `<title>${escapeHtml(title)}</title>`,
  );
  // Meta description / author
  out = setAttr(out, /(<meta\s+name="description"\s+content=")[^"]*(")/, desc);
  out = setAttr(out, /(<meta\s+name="author"\s+content=")[^"]*(")/, siteName);
  // Keep the admin app and unknown (404 fallback) paths out of search indexes so
  // junk URLs aren't indexed with the homepage's title (defence in depth with robots.txt).
  if (
    pathname.startsWith("/admin") ||
    !isKnown ||
    serviceUnavailable ||
    isBuyerStartPath
  ) {
    out = setAttr(
      out,
      /(<meta\s+name="robots"\s+content=")[^"]*(")/,
      "noindex, nofollow",
    );
  }
  // Negation of the noindex condition above — pages we actually advertise. Used to
  // skip JSON-LD + GA4 on /admin and soft-404s (no analytics pollution from the
  // admin app; no structured data on pages marked noindex).
  const indexable =
    !pathname.startsWith("/admin") &&
    isKnown &&
    !serviceUnavailable &&
    !isBuyerStartPath;
  // Canonical + og:url — per route, not always the homepage
  out = setAttr(out, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, canonical);
  out = setAttr(
    out,
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    canonical,
  );
  // OGP
  out = setAttr(
    out,
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    title,
  );
  out = setAttr(
    out,
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    desc,
  );
  out = setAttr(
    out,
    /(<meta\s+property="og:site_name"\s+content=")[^"]*(")/,
    `${siteName} Photography`,
  );
  const absoluteOgImage = absoluteUrl(siteUrl, ogImage);
  out = setAttr(
    out,
    /(<meta\s+property="og:image"\s+content=")[^"]*(")/,
    absoluteOgImage,
  );
  out = setAttr(
    out,
    /(<meta\s+property="og:image:secure_url"\s+content=")[^"]*(")/,
    absoluteOgImage,
  );
  out = setAttr(
    out,
    /(<meta\s+property="og:image:type"\s+content=")[^"]*(")/,
    imgBase === "/og-default.png" ? "image/png" : "image/jpeg",
  );
  out = setAttr(
    out,
    /(<meta\s+property="og:image:width"\s+content=")[^"]*(")/,
    "1200",
  );
  out = setAttr(
    out,
    /(<meta\s+property="og:image:height"\s+content=")[^"]*(")/,
    "630",
  );
  out = setAttr(
    out,
    /(<meta\s+name="twitter:image"\s+content=")[^"]*(")/,
    absoluteOgImage,
  );
  out = setAttr(
    out,
    /(<meta\s+name="twitter:image:alt"\s+content=")[^"]*(")/,
    title,
  );
  out = setAttr(
    out,
    /(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/,
    title,
  );
  // Twitter
  out = setAttr(
    out,
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    title,
  );
  out = setAttr(
    out,
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    desc,
  );

  // Mobile browser chrome: reflect the admin-configured background from the first
  // server paint. index.html ships a static light theme-color (#f7f7f7); without
  // this, a dark themeBg shows a light status bar until provider.tsx's client-side
  // sync runs (provider.tsx ~L147). setAttr replaces the meta in place (no duplicate).
  out = setAttr(
    out,
    /(<meta\s+name="theme-color"\s+content=")[^"]*(")/,
    settings.themeBg || "#f7f7f7",
  );

  // F: structured data (JSON-LD) for search engines — indexable pages only.
  let headInjection = indexable
    ? buildJsonLd(settings, pathname, override, fallbackOrigin)
    : "";
  // 英語文が一つも入力されていないサイト(配布テンプレート既定)では hreflang を
  // 出さない — 内容が日本語のままの /en/* を「英語版」と主張しないため。
  const alternates = isService
    ? serviceLanguageAlternates(pathname)
    : hasPublicEnglishContent(settings)
      ? publicPageLanguageAlternates(pathname)
      : null;
  if (alternates) {
    headInjection += `\n  <link rel="alternate" hreflang="ja" href="${escapeHtml(`${siteUrl}${alternates.ja}`)}">`;
    headInjection += `\n  <link rel="alternate" hreflang="en" href="${escapeHtml(`${siteUrl}${alternates.en}`)}">`;
  }
  // Search Console site verification — paste the `content` value of Google's
  // HTML-tag method into admin settings; without this, every verification
  // attempt would need a rebuild+redeploy cycle.
  if (settings.googleSiteVerification) {
    headInjection += `\n  <meta name="google-site-verification" content="${escapeHtml(settings.googleSiteVerification)}">`;
  }
  // LCP: the homepage hero image URL is otherwise only known after JS runs and an
  // /api/hero-photos round-trip — too late for the largest paint. Inject a preload
  // (imagesrcset/imagesizes matched to <HeroCarousel>/<HeroSingle> exactly) so the
  // browser starts the hero download straight from the HTML, parallel to the JS.
  if (pathname === "/" && heroImg) {
    // Must match HERO_WIDTHS in lib/picture.ts exactly — a mismatched URL
    // makes the preload useless and the hero downloads twice.
    const heroSizes =
      settings.heroMode === "single"
        ? "100vw"
        : "(min-width: 1200px) 1152px, 100vw";
    if (heroPreloadUrl) {
      headInjection += `\n  <link rel="preload" as="image" fetchpriority="high" href="${escapeHtml(heroPreloadUrl)}">`;
    } else {
      const heroHref = imageUrlWithParams(heroImg, {
        w: 1536,
        q: 88,
        rotationDeg: heroRotationDeg,
      });
      const heroSrcset = [640, 1024, 1536, 2400]
        .map(
          (w) =>
            `${imageUrlWithParams(heroImg, { w, q: 88, rotationDeg: heroRotationDeg })} ${w}w`,
        )
        .join(", ");
      headInjection += `\n  <link rel="preload" as="image" fetchpriority="high" href="${escapeHtml(heroHref)}" imagesrcset="${escapeHtml(heroSrcset)}" imagesizes="${escapeHtml(heroSizes)}">`;
    }
  }
  // GA4 — only on indexable public pages (don't track the admin app or soft-404s).
  // インライン <script> の JS 文字列リテラルに埋め込むため、escapeHtml では
  // 防げない値(改行・バックスラッシュ等)を形式チェックで締め出す。
  // 実在の GA4 ID は G-XXXXXXXXXX 形式のみ。
  const rawGaId = gaMeasurementIdForSite(siteUrl);
  const gaMeasurementId = /^G-[A-Z0-9]+$/.test(rawGaId) ? rawGaId : "";
  if (indexable && gaMeasurementId) {
    const safeGaId = escapeHtml(gaMeasurementId);
    headInjection += `\n  <script async src="https://www.googletagmanager.com/gtag/js?id=${safeGaId}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${safeGaId}');</script>`;
  }
  // Use a function replacement so `$` in the injected markup isn't treated as a special pattern.
  out = out.replace("</head>", () => `${headInjection}\n  </head>`);
  return out;
}

// Automatic fallback description for a /series/:slug page whose series has no
// statement/subtitle configured in the DB. Still names the series (rather than
// falling through to the fully generic site description) so shared links /
// search results distinguish one series from another.
function seriesFallbackDescription(title: string, name: string): string {
  return `写真シリーズ「${title}」の作品ページ。${name}が撮影。`;
}

// profileBio repeats the same self-intro across JA/EN/中文 paragraph blocks —
// take just the first (JA) paragraph so the Person description stays a
// natural 1-2 sentences in one language, matching the graph's inLanguage: "ja".
function personDescriptionFrom(
  settings: Record<string, string>,
  fallback: string,
): string {
  const firstParagraph = (settings.profileBio || "")
    .trim()
    .split(/\n\s*\n/)[0]
    ?.trim();
  return firstParagraph || fallback;
}

// サービスLPの構造化データに使う値だけを servicePageConfig から取り出す。
// 画面側の parseServicePageConfig は web/lib にあり、API層から web/ を import
// すると層が混ざるので、ここでは必要な2つ(値段・FAQ)だけを自前で読む。
// 壊れたJSON・未設定は既定値へ落とし、決して throw しない（<head> の組み立て
// 途中で例外が出ると、そのページ全体が返らなくなる）。
const SERVICE_DEFAULT_PRICE_JPY = 30000;

function serviceConfigObject(
  settings: Record<string, string>,
): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(settings.servicePageConfig || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** "¥30,000" / "30,000円" → 30000。読めなければ既定の買い切り価格。 */
function servicePriceJpy(settings: Record<string, string>): number {
  const pricing = serviceConfigObject(settings).pricing;
  const plans =
    pricing && typeof pricing === "object"
      ? (pricing as { plans?: unknown }).plans
      : undefined;
  if (!Array.isArray(plans)) return SERVICE_DEFAULT_PRICE_JPY;
  const rows = plans.filter(
    (p): p is { price: string; primary?: boolean } =>
      !!p && typeof p === "object" && typeof (p as { price?: unknown }).price === "string",
  );
  const chosen = rows.find((p) => p.primary) ?? rows[0];
  const match = chosen?.price.match(/[¥￥]\s*([0-9][0-9,]*)|([0-9][0-9,]*)\s*円/);
  const digits = match?.[1] ?? match?.[2];
  const value = digits ? Number(digits.replace(/,/g, "")) : NaN;
  return Number.isFinite(value) && value > 0 ? value : SERVICE_DEFAULT_PRICE_JPY;
}

function serviceFaqItems(
  settings: Record<string, string>,
): { q: string; a: string }[] {
  const faq = serviceConfigObject(settings).faq;
  const items =
    faq && typeof faq === "object" ? (faq as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i): i is { q: string; a: string } =>
      !!i &&
      typeof i === "object" &&
      typeof (i as { q?: unknown }).q === "string" &&
      typeof (i as { a?: unknown }).a === "string" &&
      !!(i as { q: string }).q &&
      !!(i as { a: string }).a,
  );
}

// F: JSON-LD — WebSite (the domain itself) + Person (the photographer) +
// ImageGallery (the site), plus a per-series ImageGallery on /series/:slug so
// each body of work is its own recognised collection in search / social.
function buildJsonLd(
  settings: Record<string, string>,
  pathname = "/",
  series?: {
    title?: string;
    desc?: string;
    image?: string;
    imageRotationDeg?: number | null;
  },
  fallbackOrigin = "",
): string {
  const siteUrl = siteUrlFrom(settings, fallbackOrigin);
  const name = displayNameFrom(settings);
  const nameEn = displayNameEnFrom(settings);
  const desc = siteDescriptionFrom(settings);
  const sameAs = [
    settings.profileInstagram,
    settings.profileTwitter,
    settings.profileNote,
  ].filter(Boolean);
  const image = settings.profilePhotoUrl
    ? `${siteUrl}${imageUrlWithParams(settings.profilePhotoUrl, { w: 800, q: 85 })}`
    : undefined;
  const personDesc = personDescriptionFrom(settings, desc);

  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      url: siteUrl,
      name: nameEn,
      ...(name && name !== nameEn ? { alternateName: name } : {}),
      inLanguage: "ja",
      description: desc,
      publisher: { "@type": "Person", name },
    },
    {
      "@type": "Person",
      name,
      alternateName: nameEn,
      url: siteUrl,
      jobTitle: "写真家",
      description: personDesc,
      ...(image ? { image } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      "@type": "ImageGallery",
      name: `${nameEn} | Photography`,
      url: `${siteUrl}/gallery`,
      description: desc,
      author: { "@type": "Person", name },
    },
  ];
  // 販売ページ。値段と申込先を、文章ではなく機械が読める形で宣言する。
  // ここが無いと、検索側は「¥30,000」が値段だと分からない（本文の数字は
  // ただの文字列）。呼ばれるのは indexable なときだけで、非公開ホストや
  // servicePageMode off のときは serviceUnavailable → 呼ばれない。
  if (SERVICE_LP_PATHS.has(pathname)) {
    const isEnglishLp = pathname === "/portfolio-kit/en";
    const lpUrl = `${siteUrl}${pathname}`;
    graph.push({
      "@type": "Product",
      name: "Aki Eguchi Portfolio Kit",
      description: isEnglishLp ? SERVICE_OG_EN.desc : SERVICE_OG.desc,
      category: isEnglishLp
        ? "Portfolio website for photographers"
        : "写真家向けポートフォリオサイト制作",
      // 屋号入りの平打ち画像は akieguchi.com だけのもの、という既存の線を
      // ここでも守る（og:image と同じ判断）。配布先では画像を名乗らない。
      ...(isServiceSiteUrl(siteUrl)
        ? { image: `${siteUrl}${SERVICE_OG.image}` }
        : {}),
      url: lpUrl,
      brand: { "@type": "Brand", name: "Aki Eguchi Portfolio Kit" },
      offers: {
        "@type": "Offer",
        price: String(servicePriceJpy(settings)),
        priceCurrency: "JPY",
        availability: "https://schema.org/InStock",
        url: lpUrl,
        seller: { "@type": "Person", name },
      },
    });
    // FAQ は日本語でしか書かれていない（英語化されるのは料金プランの文だけ）。
    // 英語URLに日本語のFAQを付けると、そのページの言語宣言と食い違うので出さない。
    const faq = isEnglishLp ? [] : serviceFaqItems(settings);
    if (faq.length) {
      graph.push({
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      });
    }
  }
  // 作品ページ。`/series/:slug` と `/work/:slug` は同じ「1本の作品群」で、
  // sitemap にも両方載せている。ここが `/series/` だけを見ていたので、
  // **Work 棚に置いた1本には構造化データが一つも付かない**状態だった。
  // 棚が変わっただけで検索側の扱いが変わる理由は無い。
  const workSection = pathname.startsWith("/work/")
    ? { label: "Work", path: "/work" }
    : pathname.startsWith("/series/")
      ? { label: "Series", path: "/series" }
      : null;
  if (workSection && series?.title) {
    graph.push({
      "@type": "ImageGallery",
      name: series.title,
      url: `${siteUrl}${pathname}`,
      ...(series.desc ? { description: series.desc } : {}),
      ...(series.image
        ? {
            image: `${siteUrl}${imageUrlWithParams(series.image, {
              w: 1200,
              q: 85,
              rotationDeg: series.imageRotationDeg,
            })}`,
          }
        : {}),
      author: { "@type": "Person", name },
      isPartOf: {
        "@type": "ImageGallery",
        name: `${nameEn} | Photography`,
        url: `${siteUrl}/gallery`,
      },
    });
    // Home › Series › <title> trail so series pages can show breadcrumb rich
    // results instead of a bare URL. All three items resolve to real routes.
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: nameEn, item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: workSection.label,
          item: `${siteUrl}${workSection.path}`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: series.title,
          item: `${siteUrl}${pathname}`,
        },
      ],
    });
  }
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  }).replace(/</g, "\\u003c"); // guard against </script> breakout
  return `<script type="application/ld+json">${json}</script>`;
}
