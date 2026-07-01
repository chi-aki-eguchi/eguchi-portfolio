import {
  DEFAULT_SITE_URL as SITE_URL_DEFAULT,
  displayNameEnFrom,
  displayNameFrom,
  gaMeasurementIdForSite,
  siteDescriptionFrom,
} from "./site-defaults";
import { imageUrlWithParams } from "../shared/image-url";
import { composeBaseTitle, composeHomeTitle } from "../shared/site-title";
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
  "/about": "About",
  "/profile": "About",
  "/contact": "Contact",
};

// Per-route settings key for a distinct meta description, mirroring PAGE_TITLES
// above. Both /about and /profile map to the same key since they render the
// same page (see the canonPath handling below).
const META_DESCRIPTION_KEYS: Record<string, string> = {
  "/": "metaDescriptionHome",
  "/gallery": "metaDescriptionGallery",
  "/series": "metaDescriptionSeries",
  "/about": "metaDescriptionAbout",
  "/profile": "metaDescriptionAbout",
  "/contact": "metaDescriptionContact",
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
      return `${name}の作品をシリーズ単位で紹介するページ。`;
    case "/about":
    case "/profile":
      return `${name}のプロフィールページ。`;
    case "/contact":
      return `${name}への連絡先ページ。`;
    default:
      return siteDescriptionFrom(settings);
  }
}

const SERVICE_HOST = "akieguchi.com";

export function isServiceSiteUrl(siteUrl: string): boolean {
  try {
    return (
      new URL(siteUrl).hostname.replace(/^www\./, "").toLowerCase() ===
      SERVICE_HOST
    );
  } catch {
    return false;
  }
}

const SERVICE_OG = {
  title: "写真家のためのポートフォリオサイト",
  desc: "写真を上げて並べるだけで、雑誌のように見える、あなただけのポートフォリオ。自分で立てる ¥10,000 ／ 公開おまかせ ¥30,000。",
  image: "/og-service.jpg",
};

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
  const isServiceSite = isServiceSiteUrl(siteUrl);
  const isService = pathname === "/service" && isServiceSite;
  const page = PAGE_TITLES[pathname];
  const KNOWN_ROUTES = [
    "/",
    "/gallery",
    "/series",
    "/about",
    "/profile",
    "/contact",
    "/service",
  ];
  // /series/:slug is indexable only when the slug resolved to a real published
  // series (override.title set by the caller). Unknown/unpublished slugs render
  // the SPA's not-found view — without this they'd look like normal share cards.
  const isKnown =
    KNOWN_ROUTES.includes(pathname) ||
    (pathname.startsWith("/series/") && !!override?.title);
  const serviceOnOtherHost = pathname === "/service" && !isServiceSite;
  const missingPublicPage = !isKnown || serviceOnOtherHost;
  // A per-page override (e.g. a specific series) wins over the static route title.
  const title = missingPublicPage
    ? `Not Found | ${base}`
    : isService
      ? SERVICE_OG.title
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
      ? SERVICE_OG.desc
      : override?.desc
        ? override.desc
        : override?.title
          ? seriesFallbackDescription(override.title, name)
          : settings[META_DESCRIPTION_KEYS[pathname] ?? ""] ||
            genericPageDescription(pathname, name, settings);
  // Prefer an override image (series cover), then the hero photo, then profile, then
  // the static default already in index.html. /service uses its own fixed card image
  // (a flat file, so no /api/images resize query is appended).
  const imgBase = isService
    ? SERVICE_OG.image
    : override?.image ||
      heroImg ||
      settings.heroPhotoUrl ||
      settings.profilePhotoUrl ||
      "/og-image.jpg";
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
  if (pathname.startsWith("/admin") || !isKnown || serviceOnOtherHost) {
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
    !pathname.startsWith("/admin") && isKnown && !serviceOnOtherHost;
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
    "image/jpeg",
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
  const gaMeasurementId = gaMeasurementIdForSite(siteUrl);
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
  const firstParagraph = (settings.profileBio || "").trim().split(/\n\s*\n/)[0]?.trim();
  return firstParagraph || fallback;
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
  if (pathname.startsWith("/series/") && series?.title) {
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
          name: "Series",
          item: `${siteUrl}/series`,
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
