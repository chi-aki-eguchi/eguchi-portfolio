import {
  DEFAULT_SITE_URL as SITE_URL_DEFAULT,
  displayNameEnFrom,
  displayNameFrom,
  gaMeasurementIdForSite,
  siteDescriptionFrom,
} from "./site-defaults";
import { imageUrlWithParams } from "../shared/image-url";
import { heroImageSizes } from "../shared/hero-responsive";
import {
  analyticsPagePath,
  isAnalyticsDynamicPath,
} from "../shared/analytics-path";
import {
  composeBaseTitle,
  composeHomeTitle,
  PAGE_TITLE,
} from "../shared/site-title";
import { resolveServiceVisibility } from "../shared/service-visibility";
import { OWNER_SERVICE_FAQ } from "../shared/portfolio-service-copy";
import { hasPublicEnglishContent } from "../shared/public-english";
import { resolveContactText } from "../shared/contact-defaults";
import {
  DEFAULT_SERVICE_FAQ,
  DEFAULT_SERVICE_PLANS,
  DEFAULT_SERVICE_PRICE_JPY,
} from "../shared/service-defaults";
import {
  policyDocument,
  policyPath,
  policyRoute,
} from "../shared/policy-content";
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
  "/portfolio-kit/consult": "ポートフォリオ制作の無料相談",
  "/gallery": PAGE_TITLE.gallery,
  "/series": PAGE_TITLE.series,
  // Work の棚（2026-08-31）。**ここに足さないと `/work` が Not Found 扱いになり、
  // 画面は出るのに HTTP 404 を返す**（実測。共有カードも「Not Found」になる）。
  "/work": PAGE_TITLE.work,
  "/about": PAGE_TITLE.about,
  "/profile": PAGE_TITLE.about,
  "/contact": PAGE_TITLE.contact,
  // i18n Phase 3 スライス1: /en/about・/en/contact の英語URL
  "/en/about": PAGE_TITLE.about,
  "/en/contact": PAGE_TITLE.contactEn,
  "/privacy": PAGE_TITLE.privacy,
  "/privacy/en": PAGE_TITLE.privacyEn,
  "/terms": PAGE_TITLE.terms,
  "/terms/en": PAGE_TITLE.termsEn,
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

/**
 * そのページの説明文。**英語URLに日本語の説明文を出さない。**
 *
 * `<html lang="en">` と中身の言語が食い違うと、対になっている日本語ページの
 * 重複として扱われやすく、英語ページが出なくなる（2026-09-01 実測: /en/about は
 * lang="en" を名乗りながら `metaDescriptionAbout` の日本語文を出していた）。
 * 英語専用の説明キーはまだ無いので、英語の定型文へ落とす。手で書いた英文を
 * 入れたくなったら、ここに `metaDescriptionAboutEn` 等を足す。
 */
function pageDescriptionFor(
  settings: Record<string, string>,
  pathname: string,
  name: string,
): string {
  if (pathname === "/portfolio-kit/consult") return "江口秋のポートフォリオ制作へ無料相談。公開設定30,000円、写真・文章編集付き69,800円。相談送信だけでは購入になりません。";
  const policy = policyRoute(pathname);
  if (policy) return policyDocument(policy.kind, policy.language).description;
  if (ENGLISH_PUBLIC_PATHS.has(pathname)) {
    // 英語の設定キーは増やさない（i18n Phase 3 の判断のまま）。代わりに、
    // **既に入力されている英語の本文**から説明文を作る。定型文より中身があり、
    // 日本語を英語ページに出すことにもならない。無ければ英語の定型文へ。
    const fromEnglishBody =
      pathname === "/en/about"
        ? firstParagraphOf(settings.profileBioEn)
        : (settings.contactIntroEn || "").trim();
    return fromEnglishBody || genericPageDescription(pathname, name, settings);
  }
  return (
    settings[META_DESCRIPTION_KEYS[pathname] ?? ""] ||
    genericPageDescription(pathname, name, settings)
  );
}

/**
 * <noscript> の中に置く、そのページ自身の言葉。JS を実行しないクローラには
 * これが本文になる（`spa-fallback.ts` の頭のコメントに経緯）。
 *
 * 説明文は `injectOgp` の `desc` と**同じ順序で**決める。片方だけ直すと、
 * 検索結果に出る文と本文が食い違うので、規則はこの関数に寄せる。
 */
export function publicPageFallbackText(
  settings: Record<string, string>,
  pathname: string,
  override?: {
    title?: string;
    desc?: string;
    body?: string;
    /** 段落を呼び出し側が組み立て済みのとき（写真ページ）。 */
    bodyParagraphs?: string[];
  },
  fallbackOrigin = "",
): { heading: string; description: string; paragraphs: string[] } {
  const name = displayNameFrom(settings);
  if (SERVICE_LP_PATHS.has(pathname)) {
    const og = pathname === "/portfolio-kit/en" ? SERVICE_OG_EN : SERVICE_OG;
    // 題は「見出し | 説明的な語」で組んである。見出しに要るのは前半だけ。
    return {
      heading: og.title.split(" | ")[0] ?? og.title,
      description: og.desc,
      // 売っているものの中身を、説明文1行で終わらせない。プランに何が
      // 含まれるかは、買う前に探している人がいちばん読みたい所。
      paragraphs:
        pathname === "/portfolio-kit" ? servicePlanParagraphs(settings) : [],
    };
  }
  const policy = policyRoute(pathname);
  if (policy) {
    const doc = policyDocument(policy.kind, policy.language);
    const includeService = resolveServiceVisibility(
      settings.servicePageMode,
      siteUrlFrom(settings, fallbackOrigin),
      "",
    );
    const paragraphs = [
      doc.lead,
      ...doc.sections
        .filter((section) => !section.serviceOnly || includeService)
        .flatMap((section) => [
          section.heading,
          ...(section.paragraphs ?? []),
          ...(section.bullets ?? []),
          ...(section.rows?.map((row) => `${row.label}: ${row.value}`) ?? []),
        ]),
    ];
    return {
      heading: doc.title,
      description: doc.description,
      paragraphs,
    };
  }
  // 撮影依頼のページ。設定にある依頼の流れと但し書きは、**頼もうとしている人が
  // 探している言葉そのもの**なのに、これまで HTML に一文字も出ていなかった。
  if (pathname === "/contact" || pathname === "/en/contact") {
    const isEn = pathname === "/en/contact";
    // Service ノードと同じ扱い。日本語は既定値まで解決し、英語は英語の設定
    // だけを使う（無ければ段落を作らない）。
    const resolved = resolveContactText(settings, siteUrlFrom(settings));
    const paragraphs = (
      isEn
        ? [
            settings.contactIntroEn,
            settings.contactAreasEn,
            settings.contactFlowEn,
            settings.contactNoteEn,
          ]
        : [
            resolved.intro,
            settings.contactAreas,
            resolved.flow,
            resolved.note,
          ]
    )
      .map((t) => (t || "").trim())
      .filter(Boolean);
    return {
      // 英語ページの見出しに日本語の表記名を出さない（説明文と同じ規則）。
      heading: `${PAGE_TITLES[pathname] ?? "Contact"} — ${
        isEn ? displayNameEnFrom(settings) : name
      }`,
      description: pageDescriptionFor(settings, pathname, name),
      paragraphs,
    };
  }
  if (override?.title) {
    // 写真1枚ぶんのページ。段落は `photo-page-text.ts` が事実だけで組んである
    // ので、ここでは触らずそのまま渡す。
    if (override.bodyParagraphs?.length) {
      return {
        heading: override.title,
        description:
          override.desc || seriesFallbackDescription(override.title, name),
        paragraphs: override.bodyParagraphs.filter((t) => t.trim()),
      };
    }
    // 作家の言葉（statement）の**全文**をここへ流す。
    //
    // `override.desc` は検索結果に出る一文なので `server.ts` で 200 字に
    // 切ってある。**本文まで同じ 200 字を使っていたため、シリーズページに
    // 書いた文章は、最初に返す HTML に先頭 200 字しか入らなかった**
    // （2026-09-02 実測。残りは JavaScript を実行した後にしか存在しない）。
    // シリーズページは「人が書いた文」が載る数少ない場所なので、書いたぶんが
    // 検索側に届かないと、書く作業そのものが空振りする。
    //
    // **`description` は「1段落目」であって、`paragraphs` とは別に積まれる**
    // （`spa-fallback.ts` の `buildNoscriptFallback` が `[description,
    // ...paragraphs]` として並べる）。ここへ 200 字版と全文の両方を渡すと、
    // 同じ文が二重に出る（実際に一度そうなった）。先頭の段落を
    // `description` に充て、残りを `paragraphs` にする。
    const body = splitParagraphs(override.body);
    if (body.length) {
      return {
        heading: override.title,
        description: body[0],
        paragraphs: body.slice(1),
      };
    }
    return {
      heading: override.title,
      description: override.desc || seriesFallbackDescription(override.title, name),
      paragraphs: [],
    };
  }
  const description = pageDescriptionFor(settings, pathname, name);
  const page = PAGE_TITLES[pathname];
  // 英語ページの見出しに日本語の表記名を出さない（説明文と同じ理由）。
  const headingName = ENGLISH_PUBLIC_PATHS.has(pathname)
    ? displayNameEnFrom(settings)
    : name;
  const heading = page ? `${page} — ${headingName}` : headingName;
  // プロフィールは、このサイトで唯一まとまった量の文章があるページ。
  // 英語URLには英語の経歴を出す。**ここを見落として `/en/about` だけ本文が
  // 空だった**（他のページには本文を出しておきながら）。
  const bioKey =
    pathname === "/en/about"
      ? "profileBioEn"
      : pathname === "/about" || pathname === "/profile"
        ? "profileBio"
        : "";
  const paragraphs = bioKey ? splitParagraphs(settings[bioKey]) : [];
  return { heading, description, paragraphs };
}

/**
 * 空行で段落に割る。settings の本文欄（profileBio / series.statement）は
 * どれもこの形で書かれていて、画面側も `whitespace-pre-line` で同じに読む。
 */
function splitParagraphs(text: string | undefined | null): string[] {
  return (text || "")
    .trim()
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
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
  desc: "写真の入れ替えも、文章も、レイアウトも自分で。わかりやすく機能のそろった管理画面で、コードを書かずに更新できる写真家のポートフォリオサイト。初期設定・公開込み、買い切り¥30,000（Aki Eguchi Portfolio Kit）。",
  image: "/og-service.jpg",
};

const SERVICE_START_OG = {
  title: "Aki Eguchi Portfolio Kit — Start",
  desc: "購入後に必要なことだけをまとめた、Aki Eguchi Portfolio Kit のスタートページ。",
  image: "/og-service.jpg",
};

const SERVICE_OG_EN = {
  title: "A Place to Keep Your Photographs | Portfolio Websites for Photographers",
  desc: "Update photographs, text, and layouts yourself in a clear, fully featured admin panel. A portfolio website for photographers, without coding for everyday updates. Setup and launch included — ¥30,000 one-time (Aki Eguchi Portfolio Kit).",
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
const ENGLISH_PUBLIC_PATHS = new Set([
  "/en/about",
  "/en/contact",
  "/privacy/en",
  "/terms/en",
]);

function publicPageLanguageAlternates(
  pathname: string,
): { ja: string; en: string } | null {
  const policy = policyRoute(pathname);
  if (policy) {
    return {
      ja: policyPath(policy.kind, "ja"),
      en: policyPath(policy.kind, "en"),
    };
  }
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
    /** False keeps a real, shareable page out of search without treating it as 404. */
    indexable?: boolean;
  },
  fallbackOrigin = "",
  heroRotationDeg?: number | null,
  heroPreloadUrl?: string,
  heroPreloadSrcSet?: string,
  heroPreloadEnabled = true,
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
    "/privacy",
    "/privacy/en",
    "/terms",
    "/terms/en",
    "/portfolio-kit",
    "/portfolio-kit/consult",
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
  const isPhotoDetail = /^\/photo\/\d+$/.test(pathname);
  const isKnown =
    KNOWN_ROUTES.includes(pathname) ||
    ((pathname.startsWith("/series/") || pathname.startsWith("/work/")) &&
      !!override?.title) ||
    (isPhotoDetail && !!override?.title);
  const serviceUnavailable =
    isServicePath && !isServiceSite;
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
      ? serviceOg.desc + (isServiceHost && !isBuyerStartPath ? (isEnglishServicePath ? " Photo selection and Japanese text editing with publishing: ¥69,800 total. Free consultation before payment." : " 写真の選定・日本語文章の整理も含む編集付き公開は総額69,800円。無料相談で内容を確認してからお支払い。") : "")
      : override?.desc
        ? override.desc
        : override?.title
          ? seriesFallbackDescription(override.title, name)
          : pageDescriptionFor(settings, pathname, name);
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
  const explicitNoindex = override?.indexable === false;
  const realPageNoindex = explicitNoindex;
  if (
    pathname.startsWith("/admin") ||
    !isKnown ||
    serviceUnavailable ||
    isBuyerStartPath || pathname === "/portfolio-kit/consult" ||
    realPageNoindex
  ) {
    out = setAttr(
      out,
      /(<meta\s+name="robots"\s+content=")[^"]*(")/,
      realPageNoindex && isKnown && !serviceUnavailable
        ? "noindex, follow"
        : "noindex, nofollow",
    );
  }
  // Negation of the noindex condition above — pages we actually advertise.
  // Structured data stays limited to this set.
  const indexable =
    !pathname.startsWith("/admin") &&
    isKnown &&
    !serviceUnavailable &&
    !isBuyerStartPath &&
    !realPageNoindex;
  // Analytics may cover real purchase/support steps that intentionally use
  // noindex. Admin, unavailable service routes, and genuine 404s stay excluded.
  const analyticsEnabled =
    !pathname.startsWith("/admin") && isKnown && !serviceUnavailable;
  // A detail lookup can fail transiently while the browser's API retry later
  // succeeds. Bootstrap GA (without a hit) for syntactically valid detail URLs
  // so the client can recover that initial page view after the real record is
  // confirmed. Genuine 404s never dispatch the ready event and remain uncounted.
  const analyticsBootstrapEnabled =
    !pathname.startsWith("/admin") &&
    !serviceUnavailable &&
    (isKnown || isAnalyticsDynamicPath(pathname));
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
  const alternates = serviceUnavailable
    ? null
    : policyRoute(pathname)
      ? publicPageLanguageAlternates(pathname)
      : isService
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
  if (pathname === "/" && heroImg && heroPreloadEnabled) {
    // Must match HERO_WIDTHS in lib/picture.ts exactly — a mismatched URL
    // makes the preload useless and the hero downloads twice.
    const heroSizes = heroImageSizes(
      settings.heroMode,
      settings.heroDisplayMode,
    );
    if (heroPreloadUrl && heroPreloadSrcSet) {
      headInjection += `\n  <link rel="preload" as="image" fetchpriority="high" href="${escapeHtml(heroPreloadUrl)}" imagesrcset="${escapeHtml(heroPreloadSrcSet)}" imagesizes="${escapeHtml(heroSizes)}">`;
    } else if (heroPreloadUrl) {
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
  // GA4 — real public pages only (don't track the admin app or soft-404s).
  // インライン <script> の JS 文字列リテラルに埋め込むため、escapeHtml では
  // 防げない値(改行・バックスラッシュ等)を形式チェックで締め出す。
  // 実在の GA4 ID は G-XXXXXXXXXX 形式のみ。
  const rawGaId = gaMeasurementIdForSite(siteUrl);
  const gaMeasurementId = /^G-[A-Z0-9]+$/.test(rawGaId) ? rawGaId : "";
  if (analyticsBootstrapEnabled && gaMeasurementId) {
    const safeGaId = escapeHtml(gaMeasurementId);
    const analyticsPath = analyticsPagePath(canonPath);
    const inlineJson = (value: string) =>
      JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
    const safePath = inlineJson(analyticsPath);
    const safeLocation = inlineJson(`${siteUrl}${analyticsPath}`);
    const initialPageView = analyticsEnabled
      ? `window.__portfolioInitialPageViewSent=true;gtag('event','page_view',{page_path:${safePath},page_location:${safeLocation},page_title:document.title});`
      : "window.__portfolioInitialPageViewSent=false;";
    // Disable GA's implicit hit: it would include the raw query string and a
    // concrete `/photo/123` id. Send one explicit, sanitized page view instead.
    headInjection += `\n  <script async src="https://www.googletagmanager.com/gtag/js?id=${safeGaId}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${safeGaId}',{send_page_view:false});${initialPageView}</script>`;
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

/** 段落の1つ目だけ。説明文に使うので、複数言語のブロックを連ねない。 */
function firstParagraphOf(text: string | undefined): string {
  return (text || "").trim().split(/\n\s*\n/)[0]?.trim() ?? "";
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

/**
 * 「東京・福岡・台北を中心に。その他はご相談ください。」のような一文から、
 * 地名だけを拾う。区切りは「・、,」と読点。
 *
 * 文そのものは `description` 側に出るので、ここは `areaServed` に入れる
 * 地名の粒だけを取る。**文を丸ごと1つの Place にしない**——「東京・福岡・台北を
 * 中心に。その他はご相談ください。」という名前の場所は存在しない。
 * 句点から後ろ（「その他はご相談ください」等の但し書き）は落とす。
 */
export function contactAreaNames(raw: string | undefined): string[] {
  const head = (raw || "").split(/[。.\n]/)[0] ?? "";
  return head
    .split(/[・、,／/]/)
    .map((t) => t.replace(/を中心に|周辺|など|ほか|中心/g, "").trim())
    .filter((t) => t.length > 0 && t.length <= 20);
}

// サービスLPの構造化データに使う値だけを servicePageConfig から取り出す。
// 画面側の parseServicePageConfig は web/lib にあり、API層から web/ を import
// すると層が混ざるので、ここでは必要な2つ(値段・FAQ)だけを自前で読む。
// 壊れたJSON・未設定は既定値へ落とし、決して throw しない（<head> の組み立て
// 途中で例外が出ると、そのページ全体が返らなくなる）。
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
  if (!Array.isArray(plans)) return DEFAULT_SERVICE_PRICE_JPY;
  const rows = plans.filter(
    (p): p is { price: string; primary?: boolean } =>
      !!p && typeof p === "object" && typeof (p as { price?: unknown }).price === "string",
  );
  const chosen = rows.find((p) => p.primary) ?? rows[0];
  const match = chosen?.price.match(/[¥￥]\s*([0-9][0-9,]*)|([0-9][0-9,]*)\s*円/);
  const digits = match?.[1] ?? match?.[2];
  const value = digits ? Number(digits.replace(/,/g, "")) : NaN;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SERVICE_PRICE_JPY;
}

// 未保存なら既定のFAQを使う。**画面は `servicePageConfig` が空でも既定の
// FAQ を出す**ので、ここで空を返すと「画面には出ているのに構造化データには
// 無い」食い違いになる（2026-09-01、本番で実際にそうなっていた）。
// プランの名前と、そこに含まれるものを段落にする。未保存なら既定のプランを
// 使う——FAQ と同じ理由で、**画面は既定値を描いているのにサーバだけ空**という
// 食い違いを作らないため。
function servicePlanParagraphs(settings: Record<string, string>): string[] {
  const pricing = serviceConfigObject(settings).pricing;
  const configured =
    pricing && typeof pricing === "object"
      ? (pricing as { plans?: unknown }).plans
      : undefined;
  const plans: unknown[] = Array.isArray(configured)
    ? configured
    : [...DEFAULT_SERVICE_PLANS];
  return plans.flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const plan = p as { name?: unknown; sub?: unknown; points?: unknown };
    const name = typeof plan.name === "string" ? plan.name.trim() : "";
    const sub = typeof plan.sub === "string" ? plan.sub.trim() : "";
    const points = Array.isArray(plan.points)
      ? plan.points.filter((x): x is string => typeof x === "string" && !!x.trim())
      : [];
    const line = [name, sub].filter(Boolean).join("：");
    return [line, ...points].filter(Boolean);
  });
}

function serviceFaqItems(
  settings: Record<string, string>,
): { q: string; a: string }[] {
  const faq = serviceConfigObject(settings).faq;
  const items =
    faq && typeof faq === "object" ? (faq as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) return [...DEFAULT_SERVICE_FAQ];
  const parsed = items.filter(
    (i): i is { q: string; a: string } =>
      !!i &&
      typeof i === "object" &&
      typeof (i as { q?: unknown }).q === "string" &&
      typeof (i as { a?: unknown }).a === "string" &&
      !!(i as { q: string }).q &&
      !!(i as { a: string }).a,
  );
  return parsed.length ? parsed : [...DEFAULT_SERVICE_FAQ];
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
  // 撮影依頼のページ。**ここが無いと、この人が撮影を受けるという signal が
  // 検索側に一つも無い**（2026-09-01 実測: /contact の構造化データは
  // WebSite / Person / ImageGallery だけで、Person の jobTitle が「写真家」と
  // 言っているのみ。「写真家である」と「撮影を受ける」は別のこと）。
  // 文面は設定にあるオーナー自身の言葉をそのまま使う。こちらで書かない。
  if (pathname === "/contact" || pathname === "/en/contact") {
    const isEn = pathname === "/en/contact";
    // 日本語ページは**既定値まで解決する。**DB に行が無いキーは `settings` に
    // 載ってこないので、生の settings だけを見ると、画面には出ている文が
    // ここでは空になる（2026-09-01 に本番で実際にそうなった）。
    //
    // 英語ページは英語の設定だけを使い、**無ければ項目ごと出さない。**
    // 画面は日本語文へ退避するが（never goes blank）、`inLanguage: "en"` と
    // 名乗ったノードに日本語を入れると、言語の宣言と中身が食い違う。
    // 出さないことは食い違いにならない。
    const resolved = resolveContactText(settings, siteUrl);
    const intro = isEn
      ? (settings.contactIntroEn ?? "").trim()
      : resolved.intro;
    const flow = isEn ? (settings.contactFlowEn ?? "").trim() : resolved.flow;
    // 英語ページは英語の設定だけ。intro / flow と同じ規則を地域にも通す。
    const areas = contactAreaNames(
      isEn ? settings.contactAreasEn : settings.contactAreas,
    );
    const contactUrl = `${siteUrl}${pathname}`;
    graph.push({
      "@type": "ContactPage",
      url: contactUrl,
      name: isEn ? "Contact" : "撮影依頼・お問い合わせ",
      ...(intro ? { description: intro } : {}),
      inLanguage: isEn ? "en" : "ja",
    });
    graph.push({
      "@type": "Service",
      name: isEn ? "Photography" : "撮影依頼",
      serviceType: isEn ? "Photography" : "写真撮影",
      provider: { "@type": "Person", name, ...(image ? { image } : {}) },
      ...(intro ? { description: intro } : {}),
      // 依頼の流れも設定の文をそのまま渡す。段取りが読めることは、
      // 頼む側にとっても検索側にとっても中身のある情報。
      ...(flow ? { termsOfService: flow } : {}),
      // 撮影を受ける地域。「撮影を受ける」だけでなく「どこで」まで言えると、
      // 地名で探している人に届く。空なら出さない（作らない）。
      ...(areas.length
        ? { areaServed: areas.map((a) => ({ "@type": "Place", name: a })) }
        : {}),
      availableChannel: {
        "@type": "ServiceChannel",
        name: isEn ? "Contact form" : "問い合わせフォーム",
        serviceUrl: contactUrl,
      },
    });
  }
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
      },
    });
    // FAQ は日本語でしか書かれていない（英語化されるのは料金プランの文だけ）。
    // 英語URLに日本語のFAQを付けると、そのページの言語宣言と食い違うので出さない。
    const faq = isEnglishLp ? [] : isServiceSiteUrl(siteUrl) ? OWNER_SERVICE_FAQ : serviceFaqItems(settings);
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
  // Selected photo landing pages get an ImageObject only after the server has
  // passed the same editorial indexability gate used by robots and sitemap.
  // Unedited share pages never reach buildJsonLd because they are noindex.
  if (/^\/photo\/\d+$/.test(pathname) && series?.title && series.image) {
    graph.push({
      "@type": "ImageObject",
      name: series.title,
      ...(series.desc ? { caption: series.desc, description: series.desc } : {}),
      contentUrl: absoluteUrl(
        siteUrl,
        imageUrlWithParams(series.image, {
          w: 1600,
          q: 88,
          rotationDeg: series.imageRotationDeg,
        }),
      ),
      url: `${siteUrl}${pathname}`,
      creator: { "@type": "Person", name },
      isPartOf: { "@type": "ImageGallery", url: `${siteUrl}/gallery` },
    });
  }
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  }).replace(/</g, "\\u003c"); // guard against </script> breakout
  return `<script type="application/ld+json">${json}</script>`;
}
