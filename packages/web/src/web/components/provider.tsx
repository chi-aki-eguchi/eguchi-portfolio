import { useEffect, useRef, useState, createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { JS_PREVIEW_KEYS } from "../lib/settings-preview";
import { ensureAccentContrast } from "../lib/color-contrast";
import { heroMotionCssVars } from "../lib/hero-motion";
import {
  applyThemeColors,
  themeColorsFor,
  type ThemeColorSettings,
} from "../lib/theme-colors";
import {
  resolveServiceNavVisibility,
  resolveServiceVisibility,
} from "../../shared/service-visibility";
import { useDarkMode } from "../hooks/useDarkMode";

type DarkModeCtx = ReturnType<typeof useDarkMode>;
const DarkModeContext = createContext<DarkModeCtx | null>(null);
export function useDarkModeContext() {
  return useContext(DarkModeContext);
}

type ServiceVisibilityCtx = {
  isResolved: boolean;
  showService: boolean;
  showServiceInNav: boolean;
};

const ServiceVisibilityContext = createContext<ServiceVisibilityCtx>({
  isResolved: false,
  showService: false,
  showServiceInNav: false,
});

export function useServiceVisibility() {
  return useContext(ServiceVisibilityContext);
}

export type FontDef = {
  param: string;
  category: "serif" | "sans-serif";
  weights: number[];
};

export const GOOGLE_FONTS_JA: Record<string, FontDef> = {
  "Shippori Mincho": {
    param: "Shippori+Mincho:wght@400;500;600",
    category: "serif",
    weights: [400, 500, 600],
  },
  "Noto Serif JP": {
    param: "Noto+Serif+JP:wght@400;500;600",
    category: "serif",
    weights: [400, 500, 600],
  },
  "Noto Sans JP": {
    param: "Noto+Sans+JP:wght@300;400;500",
    category: "sans-serif",
    weights: [300, 400, 500],
  },
  "Zen Kaku Gothic New": {
    param: "Zen+Kaku+Gothic+New:wght@400;500;700",
    category: "sans-serif",
    weights: [400, 500, 700],
  },
  "BIZ UDMincho": { param: "BIZ+UDMincho", category: "serif", weights: [400] },
  "Zen Old Mincho": {
    param: "Zen+Old+Mincho:wght@400;700",
    category: "serif",
    weights: [400, 700],
  },
  "M PLUS Rounded 1c": {
    param: "M+PLUS+Rounded+1c:wght@300;400;500",
    category: "sans-serif",
    weights: [300, 400, 500],
  },
};

export const GOOGLE_FONTS_EN: Record<string, FontDef> = {
  "Cormorant Garamond": {
    param: "Cormorant+Garamond:wght@300;400;500",
    category: "serif",
    weights: [300, 400, 500],
  },
  "Cormorant Infant": {
    param: "Cormorant+Infant:wght@300;400;500",
    category: "serif",
    weights: [300, 400, 500],
  },
  "EB Garamond": {
    param: "EB+Garamond:wght@400;500;600",
    category: "serif",
    weights: [400, 500, 600],
  },
  "Playfair Display": {
    param: "Playfair+Display:wght@400;500;600",
    category: "serif",
    weights: [400, 500, 600],
  },
  "Libre Baskerville": {
    param: "Libre+Baskerville:wght@400;700",
    category: "serif",
    weights: [400, 700],
  },
  Inter: {
    param: "Inter:wght@300;400;500",
    category: "sans-serif",
    weights: [300, 400, 500],
  },
  "DM Sans": {
    param: "DM+Sans:wght@300;400;500",
    category: "sans-serif",
    weights: [300, 400, 500],
  },
  Outfit: {
    param: "Outfit:wght@300;400;500",
    category: "sans-serif",
    weights: [300, 400, 500],
  },
  "Space Grotesk": {
    param: "Space+Grotesk:wght@300;400;500",
    category: "sans-serif",
    weights: [300, 400, 500],
  },
  Lora: {
    param: "Lora:wght@400;500;600",
    category: "serif",
    weights: [400, 500, 600],
  },
  Italiana: { param: "Italiana", category: "serif", weights: [400] },
  "Josefin Sans": {
    param: "Josefin+Sans:wght@300;400;500",
    category: "sans-serif",
    weights: [300, 400, 500],
  },
  "Tenor Sans": { param: "Tenor+Sans", category: "sans-serif", weights: [400] },
};

// A6: one-click 和英 pairing presets (admin Fonts section). Names must match
// GOOGLE_FONTS_JA / GOOGLE_FONTS_EN keys exactly — settings-preview tests
// validate that, so a font-map rename can't silently break a preset.
export const FONT_PAIRINGS: {
  name: string;
  ja: string;
  en: string;
  desc: string;
}[] = [
  {
    name: "Classic Mincho",
    ja: "Shippori Mincho",
    en: "Cormorant Garamond",
    desc: "端正な明朝 × 古典セリフ（既定の組み合わせ）",
  },
  {
    name: "Modern Serif",
    ja: "Noto Serif JP",
    en: "Playfair Display",
    desc: "現代的な明朝 × コントラストの強いセリフ",
  },
  {
    name: "Quiet Sans",
    ja: "Noto Sans JP",
    en: "Inter",
    desc: "静かなゴシック × ニュートラルなサンセリフ",
  },
  {
    name: "Editorial",
    ja: "Zen Old Mincho",
    en: "Libre Baskerville",
    desc: "オールド明朝 × 活版風セリフ（雑誌的）",
  },
  {
    name: "Soft Modern",
    ja: "Zen Kaku Gothic New",
    en: "DM Sans",
    desc: "やわらかゴシック × ジオメトリックサンセリフ",
  },
  {
    name: "Fashion",
    ja: "Shippori Mincho",
    en: "Josefin Sans",
    desc: "明朝 × 細身のサンセリフ（ファッション誌風）",
  },
  {
    name: "Classic Elegant",
    ja: "Noto Serif JP",
    en: "Cormorant Infant",
    desc: "明朝 × 繊細なセリフ（柔らかな品格）",
  },
  {
    name: "Geometric",
    ja: "Zen Kaku Gothic New",
    en: "Space Grotesk",
    desc: "ゴシック × テックサンセリフ（構築的）",
  },
];

function fontFallback(category: "serif" | "sans-serif"): string {
  return category === "serif"
    ? "'Hiragino Mincho ProN', serif"
    : "'Hiragino Sans', sans-serif";
}

function ensureGoogleFont(id: string, fontParam: string) {
  const existing = document.getElementById(id);
  const url = `https://fonts.googleapis.com/css2?family=${fontParam}&display=swap`;
  if (existing) {
    if (existing.getAttribute("href") !== url)
      existing.setAttribute("href", url);
    return;
  }
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.crossOrigin = "anonymous";
  link.href = url;
  document.head.appendChild(link);
}

// The name and URL come from admin free-text and are concatenated into a CSS
// string below. A quote or a brace in either one closes the @font-face rule and
// starts an attacker-chosen one, so neither is trusted verbatim.
// Font families are letters, digits, spaces and hyphens in practice.
export function safeFontFamily(name: string): string {
  return name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 64);
}
// Only same-origin paths and http(s) URLs, and never anything that could end
// the url('…') token.
export function safeFontUrl(url: string): string | null {
  const trimmed = url.trim();
  // Quotes, parens and backslashes can end the url('…') token; control
  // characters can too. Checked without a control-character class so the
  // linter's no-control-regex rule stays satisfiable.
  if (!trimmed) return null;
  if (/['"()\\]/.test(trimmed)) return null;
  // eslint-disable-next-line no-control-regex
  if ([...trimmed].some((c) => c.codePointAt(0)! < 0x20)) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? trimmed
      : null;
  } catch {
    return null;
  }
}

function ensureCustomFont(id: string, rawName: string, rawUrl: string) {
  const fontName = safeFontFamily(rawName);
  const fontUrl = safeFontUrl(rawUrl);
  if (!fontName || !fontUrl) {
    removeElement(id);
    return false;
  }
  const styleId = `${id}-style`;
  const ext = fontUrl.split(".").pop()?.toLowerCase() ?? "woff2";
  const formatMap: Record<string, string> = {
    woff2: "woff2",
    woff: "woff",
    ttf: "truetype",
    otf: "opentype",
  };
  const css = `@font-face { font-family: '${fontName}'; src: url('${fontUrl}') format('${formatMap[ext] ?? "woff2"}'); font-display: swap; }`;

  const existing = document.getElementById(styleId);
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css;
    return true;
  }
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
  return true;
}

function removeElement(id: string) {
  document.getElementById(id)?.remove();
  document.getElementById(`${id}-style`)?.remove();
}

type HeroTextColorSettings = {
  heroNameColor?: string;
  heroNameEnColor?: string;
  heroSubColor?: string;
};

/** Keep saved HERO colours readable when the visitor changes theme.
 *
 * The admin stores one colour per name part, not separate light/dark values.
 * Reusing a dark light-theme colour verbatim on #121212 made the owner's name
 * effectively disappear. Preserve the chosen colour whenever it already meets
 * AA, and only move it toward the current theme's ink/paper when necessary.
 */
function applyReadableHeroTextColors(
  settings: HeroTextColorSettings,
  background: string,
) {
  const root = document.documentElement;
  const pairs = [
    ["--hero-name-color", settings.heroNameColor],
    ["--hero-name-en-color", settings.heroNameEnColor],
    ["--hero-sub-color", settings.heroSubColor],
  ] as const;
  for (const [cssVar, raw] of pairs) {
    if (raw) {
      root.style.setProperty(cssVar, ensureAccentContrast(raw, background));
    } else {
      root.style.removeProperty(cssVar);
    }
  }
}

interface ProviderProps {
  children: React.ReactNode;
}

export function Provider({ children }: ProviderProps) {
  const qc = useQueryClient();
  const darkMode = useDarkMode();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
    staleTime: 60_000,
  });

  // Live-preview iframes: once a "preview-settings" message has been received,
  // this document is a preview surface and handlePreviewMessage below owns
  // every visual CSS var from then on. Without this guard, the real
  // /api/settings fetch that's already in flight on iframe mount resolves
  // *after* the postMessage handshake and clobbers the previewed (unsaved)
  // values back to the saved DB ones — the effects below would re-apply
  // `data` the moment that fetch's result lands in the query cache.
  const isPreviewRef = useRef(false);
  const [serviceSettings, setServiceSettings] = useState({
    mode: "",
    siteUrl: "",
    isResolved: false,
  });

  useEffect(() => {
    if (isPreviewRef.current || data === undefined) return;
    setServiceSettings({
      mode: data.servicePageMode ?? "",
      siteUrl: data.siteUrl ?? "",
      isResolved: true,
    });
  }, [data?.servicePageMode, data?.siteUrl, data]);

  // Theme colors — B-21: 明/暗それぞれに当てる色を選び直す。
  const resolvedTheme = darkMode.resolved;
  // postMessage ハンドラは登録時のクロージャで動くので、resolvedTheme を直接
  // 読むと古い値を掴む。ref 経由で常に現在のテーマを見る。
  const resolvedThemeRef = useRef(resolvedTheme);
  resolvedThemeRef.current = resolvedTheme;
  // プレビュー面では DB 適用が止まるため、直近に受け取った色をここで保持し、
  // プレビュー内で明暗を切り替えたときに当て直す。
  const previewThemeColorsRef = useRef<ThemeColorSettings>({});
  const previewHeroTextColorsRef = useRef<HeroTextColorSettings>({});
  useEffect(() => {
    if (isPreviewRef.current) return;
    previewHeroTextColorsRef.current = {
      heroNameColor: data?.heroNameColor,
      heroNameEnColor: data?.heroNameEnColor,
      heroSubColor: data?.heroSubColor,
    };
  }, [data?.heroNameColor, data?.heroNameEnColor, data?.heroSubColor]);
  useEffect(() => {
    if (!isPreviewRef.current) return;
    const { bg, text } = themeColorsFor(
      resolvedTheme,
      previewThemeColorsRef.current,
    );
    applyThemeColors(bg, text, resolvedTheme);
    applyReadableHeroTextColors(
      previewHeroTextColorsRef.current,
      getComputedStyle(document.body).backgroundColor,
    );
  }, [resolvedTheme]);
  const themeBg = data?.themeBg;
  const themeText = data?.themeText;
  const themeBgDark = data?.themeBgDark;
  const themeTextDark = data?.themeTextDark;
  useEffect(() => {
    if (isPreviewRef.current) return;
    const { bg, text } = themeColorsFor(resolvedTheme, {
      themeBg,
      themeText,
      themeBgDark,
      themeTextDark,
    });
    applyThemeColors(bg, text, resolvedTheme);
  }, [themeBg, themeText, themeBgDark, themeTextDark, resolvedTheme]);

  // ライト/ダーク切替(data-theme)で実効背景が変わるので、アクセントの
  // AA 補正をかけ直すために typography effect を再実行させるカウンタ。
  const [themeVersion, setThemeVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((v) => v + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  // Typography controls (size / opacity / tracking / leading)
  useEffect(() => {
    if (isPreviewRef.current) return;
    const root = document.documentElement;
    const set = (key: string, val: string | undefined) =>
      val ? root.style.setProperty(key, val) : root.style.removeProperty(key);
    // D4: configured px sizes are multiplied by the global scale at use-time.
    const sizePx = (v: string | undefined) =>
      v ? `calc(${v}px * var(--global-font-scale, 1))` : undefined;
    // Body copy carries the inquiry flow, prices and policy text. Preserve the
    // owner's scale above this point, but never let an old saved value shrink
    // functional reading text below 14px.
    const bodySizePx = (v: string | undefined) =>
      v ? `max(14px, ${sizePx(v)})` : undefined;

    // D4: global type scale + link styling
    set("--global-font-scale", data?.globalFontScale || undefined);
    // 2-4: リンク/アクセントは実効背景(カスタムthemeBg・ダークモード込み)に
    // 対して AA 4.5:1 を機械的に保証してから適用する — admin と同じ調整式。
    // themeVersion がテーマ切替(data-theme)で増えるたびに再計算される。
    const effectiveBg = getComputedStyle(document.body).backgroundColor;
    set(
      "--link-hover-color",
      data?.linkHoverColor
        ? ensureAccentContrast(data.linkHoverColor, effectiveBg)
        : undefined,
    );
    // EE: accent — hover/active/focus 差し色（unset時は各所が従来色にフォールバック）
    set(
      "--accent-color",
      data?.accentColor
        ? ensureAccentContrast(data.accentColor, effectiveBg)
        : undefined,
    );
    // CC: section spacing multipliers (1 = current rhythm)
    set("--spacing-hero-bottom", data?.spacingHeroBottom || undefined);
    set("--spacing-section-gap", data?.spacingSectionGap || undefined);
    set("--spacing-page-top", data?.spacingPageTop || undefined);
    set("--spacing-footer-top", data?.spacingFooterTop || undefined);
    // DD: 背景の紙質感 — body[data-texture] が styles.css のノイズ::before を点灯
    if (data?.bgTexture && data.bgTexture !== "none")
      document.body.dataset.texture = data.bgTexture;
    else delete document.body.dataset.texture;
    set("--bg-texture-opacity", data?.bgTextureOpacity || undefined);
    // 写真のフェードイン方式 — body[data-reveal] が .fade-in-item のバリアントを切替
    if (data?.photoRevealEffect && data.photoRevealEffect !== "fade")
      document.body.dataset.reveal = data.photoRevealEffect;
    else delete document.body.dataset.reveal;
    for (const [key, value] of Object.entries(
      heroMotionCssVars(data?.heroMotionSpeed, data?.heroRevealOrder),
    )) {
      set(key, value);
    }
    set(
      "--link-underline",
      data?.linkUnderline === "on"
        ? "underline"
        : data?.linkUnderline === "off"
          ? "none"
          : undefined,
    );

    set("--nav-opacity", data?.navOpacity);
    set("--nav-size", sizePx(data?.navSize));
    set("--body-size", bodySizePx(data?.bodySize));
    set("--heading-size", sizePx(data?.headingSize));
    set("--section-label-size", sizePx(data?.sectionLabelSize));
    set("--section-label-opacity", data?.sectionLabelOpacity);
    set("--footer-opacity", data?.footerOpacity);
    set("--footer-size", sizePx(data?.footerSize));
    set("--sns-opacity", data?.snsOpacity);
    set("--hero-name-size", sizePx(data?.heroNameSize));
    set("--hero-name-en-size", sizePx(data?.heroNameEnSize));
    set("--hero-sub-size", sizePx(data?.heroSubSize));
    applyReadableHeroTextColors(
      {
        heroNameColor: data?.heroNameColor,
        heroNameEnColor: data?.heroNameEnColor,
        heroSubColor: data?.heroSubColor,
      },
      effectiveBg,
    );
    // A3: font weights
    set("--hero-name-weight", data?.heroNameWeight);
    set("--body-weight", data?.bodyWeight);
    // A1: letter-spacing
    set(
      "--hero-name-tracking",
      data?.heroNameTracking ? `${data.heroNameTracking}em` : undefined,
    );
    set(
      "--hero-name-en-tracking",
      data?.heroNameEnTracking ? `${data.heroNameEnTracking}em` : undefined,
    );
    set(
      "--nav-tracking",
      data?.navTracking ? `${data.navTracking}em` : undefined,
    );
    set(
      "--section-label-tracking",
      data?.sectionLabelTracking ? `${data.sectionLabelTracking}em` : undefined,
    );
    set(
      "--body-tracking",
      data?.bodyTracking ? `${data.bodyTracking}em` : undefined,
    );
    // A2: line-height
    set("--body-leading", data?.bodyLeading);
    set("--section-leading", data?.sectionLeading);
    // E1: hero height / overlay (mode is React-driven, not a CSS var)
    set("--hero-height", data?.heroHeight ? `${data.heroHeight}vh` : undefined);
    set(
      "--hero-overlay-opacity",
      data?.heroOverlay === "off" ? "0" : undefined,
    );
  }, [
    data?.navOpacity,
    data?.navSize,
    data?.bodySize,
    data?.headingSize,
    data?.sectionLabelSize,
    data?.sectionLabelOpacity,
    data?.footerOpacity,
    data?.footerSize,
    data?.snsOpacity,
    data?.heroNameSize,
    data?.heroNameEnSize,
    data?.heroNameColor,
    data?.heroNameEnColor,
    data?.heroSubSize,
    data?.heroSubColor,
    data?.heroNameWeight,
    data?.bodyWeight,
    data?.heroNameTracking,
    data?.heroNameEnTracking,
    data?.navTracking,
    data?.sectionLabelTracking,
    data?.bodyTracking,
    data?.bodyLeading,
    data?.sectionLeading,
    data?.globalFontScale,
    data?.linkHoverColor,
    data?.linkUnderline,
    data?.accentColor,
    data?.themeBg,
    data?.themeBgDark,
    resolvedTheme,
    themeVersion,
    data?.spacingHeroBottom,
    data?.spacingSectionGap,
    data?.spacingPageTop,
    data?.spacingFooterTop,
    data?.bgTexture,
    data?.bgTextureOpacity,
    data?.photoRevealEffect,
    data?.heroMotionSpeed,
    data?.heroRevealOrder,
    data?.heroHeight,
    data?.heroOverlay,
  ]);

  // Fonts (A5: category-aware fallback)
  useEffect(() => {
    if (isPreviewRef.current) return;
    const root = document.documentElement;
    const fontJa = data?.fontJa ?? "";
    const fontEn = data?.fontEn ?? "";

    // Japanese font
    if (
      fontJa === "custom" &&
      data?.customFontJaName &&
      data?.customFontJaUrl
    ) {
      removeElement("gfont-ja");
      const okJa = ensureCustomFont(
        "cfont-ja",
        data.customFontJaName,
        data.customFontJaUrl,
      );
      const cat = (data?.customFontJaCategory ?? "sans-serif") as
        "serif" | "sans-serif";
      if (okJa)
        root.style.setProperty(
          "--font-ja",
          `'${safeFontFamily(data.customFontJaName)}', ${fontFallback(cat)}`,
        );
      else root.style.removeProperty("--font-ja");
    } else if (fontJa && GOOGLE_FONTS_JA[fontJa]) {
      removeElement("cfont-ja");
      ensureGoogleFont("gfont-ja", GOOGLE_FONTS_JA[fontJa].param);
      root.style.setProperty(
        "--font-ja",
        `'${fontJa}', ${fontFallback(GOOGLE_FONTS_JA[fontJa].category)}`,
      );
    } else {
      removeElement("gfont-ja");
      removeElement("cfont-ja");
      root.style.removeProperty("--font-ja");
    }

    // English font
    if (
      fontEn === "custom" &&
      data?.customFontEnName &&
      data?.customFontEnUrl
    ) {
      removeElement("gfont-en");
      const okEn = ensureCustomFont(
        "cfont-en",
        data.customFontEnName,
        data.customFontEnUrl,
      );
      const cat = (data?.customFontEnCategory ?? "sans-serif") as
        "serif" | "sans-serif";
      if (okEn)
        root.style.setProperty(
          "--font-en",
          `'${safeFontFamily(data.customFontEnName)}', ${fontFallback(cat)}`,
        );
      else root.style.removeProperty("--font-en");
    } else if (fontEn && GOOGLE_FONTS_EN[fontEn]) {
      removeElement("cfont-en");
      ensureGoogleFont("gfont-en", GOOGLE_FONTS_EN[fontEn].param);
      root.style.setProperty(
        "--font-en",
        `'${fontEn}', ${fontFallback(GOOGLE_FONTS_EN[fontEn].category)}`,
      );
    } else {
      removeElement("gfont-en");
      removeElement("cfont-en");
      root.style.removeProperty("--font-en");
    }

    document.body.style.fontFamily =
      getComputedStyle(root).getPropertyValue("--font-ja") || "";
  }, [
    data?.fontJa,
    data?.fontEn,
    data?.customFontJaName,
    data?.customFontJaUrl,
    data?.customFontEnName,
    data?.customFontEnUrl,
    data?.customFontJaCategory,
    data?.customFontEnCategory,
  ]);

  // Live preview: listen for postMessage from admin iframe parent
  useEffect(() => {
    function handlePreviewMessage(e: MessageEvent) {
      // Same-origin guard: the only legitimate sender is the admin page embedding
      // this site in a same-origin iframe. Ignore messages from any other origin.
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "preview-settings") return;
      const s = e.data.settings as Record<string, string>;
      const root = document.documentElement;

      // From here on this document is a preview surface: stop the DB-driven
      // effects above from re-applying `data` if the initial /api/settings
      // fetch resolves after this message (see isPreviewRef declaration).
      isPreviewRef.current = true;

      if (s.servicePageMode !== undefined || s.siteUrl !== undefined) {
        setServiceSettings((previous) => ({
          mode: s.servicePageMode ?? previous.mode,
          siteUrl: s.siteUrl ?? previous.siteUrl,
          isResolved: true,
        }));
      }

      // We're now a live-preview surface: pin the settings cache so a background
      // refetch (staleTime elapsing while navigating between pages inside the
      // iframe) can't overwrite the previewed values with the saved DB ones.
      qc.setQueryDefaults(["settings"], { staleTime: Infinity });

      // Bridge settings into the iframe's query cache so React-rendered labels,
      // contact/profile fields, gallery toggles, and CSS-variable controls all
      // preview from the same payload.
      if (JS_PREVIEW_KEYS.some((k) => s[k] !== undefined)) {
        qc.setQueryData(
          ["settings"],
          (old: Record<string, string> | undefined) => {
            const next = { ...old };
            for (const k of JS_PREVIEW_KEYS)
              if (s[k] !== undefined) next[k] = s[k];
            return next;
          },
        );
      }

      // Mirror the DB-apply path exactly: an empty value means "use the default",
      // so we removeProperty (falling back to the same CSS :root / inline defaults
      // the live site uses) rather than injecting a different hardcoded default.
      // Previously the preview used its own defaults (e.g. nav-opacity 0.30 vs the
      // real 0.50), so clearing a field showed a value the published site never had.
      const applyVar = (
        key: string,
        raw: string | undefined,
        transform?: (v: string) => string,
      ) => {
        if (raw === undefined) return; // key absent from this payload
        if (raw === "") {
          root.style.removeProperty(key);
          return;
        }
        root.style.setProperty(key, transform ? transform(raw) : raw);
      };
      const sizePx = (v: string) =>
        `calc(${v}px * var(--global-font-scale, 1))`;
      const bodySizePx = (v: string) => `max(14px, ${sizePx(v)})`;
      const em = (v: string) => `${v}em`;

      // Colors — B-21: DB適用側と同じ規則で、テーマごとに当てる色を選ぶ。
      // プレビュー内で明暗を切り替えたときにも当て直せるよう、直近の指定を憶える。
      if (
        s.themeBg !== undefined ||
        s.themeText !== undefined ||
        s.themeBgDark !== undefined ||
        s.themeTextDark !== undefined
      ) {
        previewThemeColorsRef.current = {
          themeBg: s.themeBg ?? previewThemeColorsRef.current.themeBg,
          themeText: s.themeText ?? previewThemeColorsRef.current.themeText,
          themeBgDark:
            s.themeBgDark ?? previewThemeColorsRef.current.themeBgDark,
          themeTextDark:
            s.themeTextDark ?? previewThemeColorsRef.current.themeTextDark,
        };
        const resolved = resolvedThemeRef.current;
        const { bg, text } = themeColorsFor(
          resolved,
          previewThemeColorsRef.current,
        );
        applyThemeColors(bg, text, resolved);
      }

      if (
        s.heroNameColor !== undefined ||
        s.heroNameEnColor !== undefined ||
        s.heroSubColor !== undefined
      ) {
        previewHeroTextColorsRef.current = {
          heroNameColor:
            s.heroNameColor ?? previewHeroTextColorsRef.current.heroNameColor,
          heroNameEnColor:
            s.heroNameEnColor ??
            previewHeroTextColorsRef.current.heroNameEnColor,
          heroSubColor:
            s.heroSubColor ?? previewHeroTextColorsRef.current.heroSubColor,
        };
      }

      // D4: global type scale + link styling
      applyVar("--global-font-scale", s.globalFontScale);
      // 2-4: DB適用側と同じ AA 保証をプレビューにもかける(実効背景基準)
      const accentBg = () => getComputedStyle(document.body).backgroundColor;
      applyVar("--link-hover-color", s.linkHoverColor, (v) =>
        ensureAccentContrast(v, accentBg()),
      );
      applyVar("--accent-color", s.accentColor, (v) =>
        ensureAccentContrast(v, accentBg()),
      );
      applyVar("--spacing-hero-bottom", s.spacingHeroBottom);
      applyVar("--spacing-section-gap", s.spacingSectionGap);
      applyVar("--spacing-page-top", s.spacingPageTop);
      applyVar("--spacing-footer-top", s.spacingFooterTop);
      if (s.bgTexture !== undefined) {
        if (s.bgTexture && s.bgTexture !== "none")
          document.body.dataset.texture = s.bgTexture;
        else delete document.body.dataset.texture;
      }
      applyVar("--bg-texture-opacity", s.bgTextureOpacity);
      if (s.photoRevealEffect !== undefined) {
        if (s.photoRevealEffect && s.photoRevealEffect !== "fade")
          document.body.dataset.reveal = s.photoRevealEffect;
        else delete document.body.dataset.reveal;
      }
      if (
        s.heroMotionSpeed !== undefined ||
        s.heroRevealOrder !== undefined
      ) {
        for (const [key, value] of Object.entries(
          heroMotionCssVars(s.heroMotionSpeed, s.heroRevealOrder),
        )) {
          if (value) root.style.setProperty(key, value);
          else root.style.removeProperty(key);
        }
      }
      if (s.linkUnderline !== undefined) {
        if (s.linkUnderline === "on")
          root.style.setProperty("--link-underline", "underline");
        else root.style.removeProperty("--link-underline"); // "off"/"" → CSS default (none)
      }

      // Typography — px sizes multiplied by the global scale at use-time
      applyVar("--nav-opacity", s.navOpacity);
      applyVar("--nav-size", s.navSize, sizePx);
      applyVar("--body-size", s.bodySize, bodySizePx);
      applyVar("--heading-size", s.headingSize, sizePx);
      applyVar("--section-label-size", s.sectionLabelSize, sizePx);
      applyVar("--section-label-opacity", s.sectionLabelOpacity);
      applyVar("--footer-opacity", s.footerOpacity);
      applyVar("--footer-size", s.footerSize, sizePx);
      applyVar("--sns-opacity", s.snsOpacity);
      applyVar("--hero-name-size", s.heroNameSize, sizePx);
      applyVar("--hero-name-en-size", s.heroNameEnSize, sizePx);
      applyVar("--hero-sub-size", s.heroSubSize, sizePx);
      applyReadableHeroTextColors(
        previewHeroTextColorsRef.current,
        getComputedStyle(document.body).backgroundColor,
      );
      // A3: font weights
      applyVar("--hero-name-weight", s.heroNameWeight);
      applyVar("--body-weight", s.bodyWeight);
      // A1: letter-spacing
      applyVar("--hero-name-tracking", s.heroNameTracking, em);
      applyVar("--hero-name-en-tracking", s.heroNameEnTracking, em);
      applyVar("--nav-tracking", s.navTracking, em);
      applyVar("--section-label-tracking", s.sectionLabelTracking, em);
      applyVar("--body-tracking", s.bodyTracking, em);
      // A2: line-height
      applyVar("--body-leading", s.bodyLeading);
      applyVar("--section-leading", s.sectionLeading);
      // E1: hero height / overlay
      applyVar("--hero-height", s.heroHeight, (v) => `${v}vh`);
      if (s.heroOverlay !== undefined) {
        if (s.heroOverlay === "off")
          root.style.setProperty("--hero-overlay-opacity", "0");
        else root.style.removeProperty("--hero-overlay-opacity"); // on/"" → CSS default (0.38)
      }

      // Fonts (A5: category-aware fallback)
      if (s.fontJa !== undefined) {
        const fontJa = s.fontJa;
        if (fontJa === "custom" && s.customFontJaName && s.customFontJaUrl) {
          removeElement("gfont-ja");
          const okJa = ensureCustomFont(
            "cfont-ja",
            s.customFontJaName,
            s.customFontJaUrl,
          );
          const cat = (s.customFontJaCategory || "sans-serif") as
            "serif" | "sans-serif";
          if (okJa)
            root.style.setProperty(
              "--font-ja",
              `'${safeFontFamily(s.customFontJaName)}', ${fontFallback(cat)}`,
            );
          else root.style.removeProperty("--font-ja");
        } else if (fontJa && GOOGLE_FONTS_JA[fontJa]) {
          removeElement("cfont-ja");
          ensureGoogleFont("gfont-ja", GOOGLE_FONTS_JA[fontJa].param);
          root.style.setProperty(
            "--font-ja",
            `'${fontJa}', ${fontFallback(GOOGLE_FONTS_JA[fontJa].category)}`,
          );
        } else {
          removeElement("gfont-ja");
          removeElement("cfont-ja");
          root.style.removeProperty("--font-ja");
        }
        document.body.style.fontFamily =
          getComputedStyle(root).getPropertyValue("--font-ja") || "";
      }
      if (s.fontEn !== undefined) {
        const fontEn = s.fontEn;
        if (fontEn === "custom" && s.customFontEnName && s.customFontEnUrl) {
          removeElement("gfont-en");
          const okEn = ensureCustomFont(
            "cfont-en",
            s.customFontEnName,
            s.customFontEnUrl,
          );
          const cat = (s.customFontEnCategory || "sans-serif") as
            "serif" | "sans-serif";
          if (okEn)
            root.style.setProperty(
              "--font-en",
              `'${safeFontFamily(s.customFontEnName)}', ${fontFallback(cat)}`,
            );
          else root.style.removeProperty("--font-en");
        } else if (fontEn && GOOGLE_FONTS_EN[fontEn]) {
          removeElement("cfont-en");
          ensureGoogleFont("gfont-en", GOOGLE_FONTS_EN[fontEn].param);
          root.style.setProperty(
            "--font-en",
            `'${fontEn}', ${fontFallback(GOOGLE_FONTS_EN[fontEn].category)}`,
          );
        } else {
          removeElement("gfont-en");
          removeElement("cfont-en");
          root.style.removeProperty("--font-en");
        }
      }
    }

    window.addEventListener("message", handlePreviewMessage);
    // Handshake: announce readiness to the embedding admin page. The parent's
    // first postMessage can fire before this listener exists (iframe just
    // mounted / reloaded) and silently vanish — the parent replies to this
    // ping with the current payload, so the initial state always arrives.
    if (window.parent !== window)
      window.parent.postMessage(
        { type: "preview-ready" },
        window.location.origin,
      );
    return () => window.removeEventListener("message", handlePreviewMessage);
  }, [qc]);

  const serviceVisibility = {
    isResolved: serviceSettings.isResolved,
    showService: resolveServiceVisibility(
      serviceSettings.mode,
      serviceSettings.siteUrl,
      typeof window === "undefined" ? "" : window.location.hostname,
    ),
    showServiceInNav: resolveServiceNavVisibility(serviceSettings.mode),
  };

  return (
    <DarkModeContext.Provider value={darkMode}>
      <ServiceVisibilityContext.Provider value={serviceVisibility}>
        {children}
      </ServiceVisibilityContext.Provider>
    </DarkModeContext.Provider>
  );
}
