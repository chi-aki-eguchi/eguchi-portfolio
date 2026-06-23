import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { JS_PREVIEW_KEYS } from "../lib/settings-preview";

export type FontDef = {
  param: string;
  category: "serif" | "sans-serif";
  weights: number[];
};

export const GOOGLE_FONTS_JA: Record<string, FontDef> = {
  "Shippori Mincho":    { param: "Shippori+Mincho:wght@400;500;600",          category: "serif",      weights: [400, 500, 600] },
  "Noto Serif JP":      { param: "Noto+Serif+JP:wght@400;500;600",            category: "serif",      weights: [400, 500, 600] },
  "Noto Sans JP":       { param: "Noto+Sans+JP:wght@300;400;500",             category: "sans-serif", weights: [300, 400, 500] },
  "Zen Kaku Gothic New":{ param: "Zen+Kaku+Gothic+New:wght@400;500;700",      category: "sans-serif", weights: [400, 500, 700] },
  "BIZ UDMincho":       { param: "BIZ+UDMincho",                              category: "serif",      weights: [400] },
  "Zen Old Mincho":     { param: "Zen+Old+Mincho:wght@400;700",               category: "serif",      weights: [400, 700] },
  "M PLUS Rounded 1c":  { param: "M+PLUS+Rounded+1c:wght@300;400;500",       category: "sans-serif", weights: [300, 400, 500] },
};

export const GOOGLE_FONTS_EN: Record<string, FontDef> = {
  "Cormorant Garamond": { param: "Cormorant+Garamond:wght@300;400;500",       category: "serif",      weights: [300, 400, 500] },
  "Cormorant Infant":   { param: "Cormorant+Infant:wght@300;400;500",         category: "serif",      weights: [300, 400, 500] },
  "EB Garamond":        { param: "EB+Garamond:wght@400;500;600",              category: "serif",      weights: [400, 500, 600] },
  "Playfair Display":   { param: "Playfair+Display:wght@400;500;600",         category: "serif",      weights: [400, 500, 600] },
  "Libre Baskerville":  { param: "Libre+Baskerville:wght@400;700",            category: "serif",      weights: [400, 700] },
  "Inter":              { param: "Inter:wght@300;400;500",                    category: "sans-serif", weights: [300, 400, 500] },
  "DM Sans":            { param: "DM+Sans:wght@300;400;500",                  category: "sans-serif", weights: [300, 400, 500] },
  "Outfit":             { param: "Outfit:wght@300;400;500",                   category: "sans-serif", weights: [300, 400, 500] },
  "Space Grotesk":      { param: "Space+Grotesk:wght@300;400;500",            category: "sans-serif", weights: [300, 400, 500] },
  "Lora":               { param: "Lora:wght@400;500;600",                     category: "serif",      weights: [400, 500, 600] },
  "Italiana":           { param: "Italiana",                                  category: "serif",      weights: [400] },
  "Josefin Sans":       { param: "Josefin+Sans:wght@300;400;500",             category: "sans-serif", weights: [300, 400, 500] },
  "Tenor Sans":         { param: "Tenor+Sans",                                category: "sans-serif", weights: [400] },
};

// A6: one-click 和英 pairing presets (admin Fonts section). Names must match
// GOOGLE_FONTS_JA / GOOGLE_FONTS_EN keys exactly — settings-preview tests
// validate that, so a font-map rename can't silently break a preset.
export const FONT_PAIRINGS: { name: string; ja: string; en: string; desc: string }[] = [
  { name: "Classic Mincho", ja: "Shippori Mincho", en: "Cormorant Garamond", desc: "端正な明朝 × 古典セリフ（既定の組み合わせ）" },
  { name: "Modern Serif",   ja: "Noto Serif JP",   en: "Playfair Display",   desc: "現代的な明朝 × コントラストの強いセリフ" },
  { name: "Quiet Sans",     ja: "Noto Sans JP",    en: "Inter",              desc: "静かなゴシック × ニュートラルなサンセリフ" },
  { name: "Editorial",      ja: "Zen Old Mincho",  en: "Libre Baskerville",  desc: "オールド明朝 × 活版風セリフ（雑誌的）" },
  { name: "Soft Modern",    ja: "Zen Kaku Gothic New", en: "DM Sans",        desc: "やわらかゴシック × ジオメトリックサンセリフ" },
  { name: "Fashion",        ja: "Shippori Mincho", en: "Josefin Sans",       desc: "明朝 × 細身のサンセリフ（ファッション誌風）" },
  { name: "Classic Elegant", ja: "Noto Serif JP",  en: "Cormorant Infant",   desc: "明朝 × 繊細なセリフ（柔らかな品格）" },
  { name: "Geometric",      ja: "Zen Kaku Gothic New", en: "Space Grotesk",  desc: "ゴシック × テックサンセリフ（構築的）" },
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
    if (existing.getAttribute("href") !== url) existing.setAttribute("href", url);
    return;
  }
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

function ensureCustomFont(id: string, fontName: string, fontUrl: string) {
  const styleId = `${id}-style`;
  const ext = fontUrl.split(".").pop()?.toLowerCase() ?? "woff2";
  const formatMap: Record<string, string> = {
    woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype",
  };
  const css = `@font-face { font-family: '${fontName}'; src: url('${fontUrl}') format('${formatMap[ext] ?? "woff2"}'); font-display: swap; }`;

  const existing = document.getElementById(styleId);
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

function removeElement(id: string) {
  document.getElementById(id)?.remove();
  document.getElementById(`${id}-style`)?.remove();
}

// DD: the grain blends with `multiply`, which is near-invisible over a dark
// background (dark × noise ≈ dark) — the texture would silently vanish on dark
// themes. Flip to `screen` (which lightens) when the chosen bg is dark.
// undefined = no/invalid themeBg → CSS default (multiply, matches light default bg).
function textureBlendFor(bgHex: string | undefined): string | undefined {
  const hex = (bgHex || "").replace("#", "");
  if (hex.length < 6) return undefined;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return undefined;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128 ? "screen" : "multiply";
}

interface ProviderProps {
  children: React.ReactNode;
}

export function Provider({ children }: ProviderProps) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.settings.$get()).json(),
    staleTime: 60_000,
  });

  // Theme colors
  useEffect(() => {
    const root = document.documentElement;
    if (data?.themeBg) {
      root.style.setProperty("--background", data.themeBg);
      document.body.style.backgroundColor = data.themeBg;
    } else {
      root.style.removeProperty("--background");
      document.body.style.removeProperty("background-color");
    }
    if (data?.themeText) {
      root.style.setProperty("--foreground", data.themeText);
      document.body.style.color = data.themeText;
      const hex = data.themeText.replace("#", "");
      const r = parseInt(hex.slice(0,2), 16);
      const g = parseInt(hex.slice(2,4), 16);
      const b = parseInt(hex.slice(4,6), 16);
      if (!isNaN(r)) root.style.setProperty("--foreground-rgb", `${r},${g},${b}`);
    } else {
      root.style.removeProperty("--foreground");
      root.style.removeProperty("--foreground-rgb");
      document.body.style.removeProperty("color");
    }
    if (data?.themeBg) {
      const hex = (data.themeBg || "").replace("#", "");
      const r = parseInt(hex.slice(0,2), 16);
      const g = parseInt(hex.slice(2,4), 16);
      const b = parseInt(hex.slice(4,6), 16);
      if (!isNaN(r)) root.style.setProperty("--background-rgb", `${r},${g},${b}`);
    } else {
      root.style.removeProperty("--background-rgb");
    }
    const blend = textureBlendFor(data?.themeBg);
    if (blend) root.style.setProperty("--bg-texture-blend", blend);
    else root.style.removeProperty("--bg-texture-blend");
    // Keep the mobile browser chrome (theme-color) in sync with the chosen
    // background so a dark theme doesn't show a light status bar.
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", data?.themeBg || "#f7f7f7");
  }, [data?.themeBg, data?.themeText]);

  // Typography controls (size / opacity / tracking / leading)
  useEffect(() => {
    const root = document.documentElement;
    const set = (key: string, val: string | undefined) =>
      val ? root.style.setProperty(key, val) : root.style.removeProperty(key);
    // D4: configured px sizes are multiplied by the global scale at use-time.
    const sizePx = (v: string | undefined) =>
      v ? `calc(${v}px * var(--global-font-scale, 1))` : undefined;

    // D4: global type scale + link styling
    set("--global-font-scale", data?.globalFontScale || undefined);
    set("--link-hover-color",  data?.linkHoverColor || undefined);
    // EE: accent — hover/active/focus 差し色（unset時は各所が従来色にフォールバック）
    set("--accent-color",      data?.accentColor || undefined);
    // CC: section spacing multipliers (1 = current rhythm)
    set("--spacing-hero-bottom", data?.spacingHeroBottom || undefined);
    set("--spacing-section-gap", data?.spacingSectionGap || undefined);
    set("--spacing-page-top",    data?.spacingPageTop || undefined);
    set("--spacing-footer-top",  data?.spacingFooterTop || undefined);
    // DD: 背景の紙質感 — body[data-texture] が styles.css のノイズ::before を点灯
    if (data?.bgTexture && data.bgTexture !== "none") document.body.dataset.texture = data.bgTexture;
    else delete document.body.dataset.texture;
    set("--bg-texture-opacity", data?.bgTextureOpacity || undefined);
    // 写真のフェードイン方式 — body[data-reveal] が .fade-in-item のバリアントを切替
    if (data?.photoRevealEffect && data.photoRevealEffect !== "fade") document.body.dataset.reveal = data.photoRevealEffect;
    else delete document.body.dataset.reveal;
    set("--link-underline",    data?.linkUnderline === "on" ? "underline" : data?.linkUnderline === "off" ? "none" : undefined);

    set("--nav-opacity",    data?.navOpacity);
    set("--nav-size",       sizePx(data?.navSize));
    set("--body-size",      sizePx(data?.bodySize));
    set("--heading-size",   sizePx(data?.headingSize));
    set("--section-label-size",    sizePx(data?.sectionLabelSize));
    set("--section-label-opacity", data?.sectionLabelOpacity);
    set("--footer-opacity", data?.footerOpacity);
    set("--footer-size",    sizePx(data?.footerSize));
    set("--sns-opacity",    data?.snsOpacity);
    set("--hero-name-size",    sizePx(data?.heroNameSize));
    set("--hero-name-en-size", sizePx(data?.heroNameEnSize));
    set("--hero-name-color",   data?.heroNameColor);
    set("--hero-name-en-color", data?.heroNameEnColor);
    set("--hero-sub-size",     sizePx(data?.heroSubSize));
    set("--hero-sub-color",    data?.heroSubColor);
    // A3: font weights
    set("--hero-name-weight", data?.heroNameWeight);
    set("--body-weight",      data?.bodyWeight);
    // A1: letter-spacing
    set("--hero-name-tracking",     data?.heroNameTracking ? `${data.heroNameTracking}em` : undefined);
    set("--hero-name-en-tracking",  data?.heroNameEnTracking ? `${data.heroNameEnTracking}em` : undefined);
    set("--nav-tracking",           data?.navTracking ? `${data.navTracking}em` : undefined);
    set("--section-label-tracking", data?.sectionLabelTracking ? `${data.sectionLabelTracking}em` : undefined);
    set("--body-tracking",          data?.bodyTracking ? `${data.bodyTracking}em` : undefined);
    // A2: line-height
    set("--body-leading",     data?.bodyLeading);
    set("--section-leading",  data?.sectionLeading);
    // E1: hero height / overlay (mode is React-driven, not a CSS var)
    set("--hero-height", data?.heroHeight ? `${data.heroHeight}vh` : undefined);
    set("--hero-overlay-opacity", data?.heroOverlay === "off" ? "0" : undefined);
  }, [
    data?.navOpacity, data?.navSize, data?.bodySize, data?.headingSize,
    data?.sectionLabelSize, data?.sectionLabelOpacity, data?.footerOpacity,
    data?.footerSize, data?.snsOpacity, data?.heroNameSize, data?.heroNameEnSize,
    data?.heroNameColor, data?.heroNameEnColor, data?.heroSubSize, data?.heroSubColor,
    data?.heroNameWeight, data?.bodyWeight,
    data?.heroNameTracking, data?.heroNameEnTracking, data?.navTracking,
    data?.sectionLabelTracking, data?.bodyTracking, data?.bodyLeading, data?.sectionLeading,
    data?.globalFontScale, data?.linkHoverColor, data?.linkUnderline, data?.accentColor,
    data?.spacingHeroBottom, data?.spacingSectionGap, data?.spacingPageTop, data?.spacingFooterTop,
    data?.bgTexture, data?.bgTextureOpacity, data?.photoRevealEffect,
    data?.heroHeight, data?.heroOverlay,
  ]);

  // Fonts (A5: category-aware fallback)
  useEffect(() => {
    const root = document.documentElement;
    const fontJa = data?.fontJa ?? "";
    const fontEn = data?.fontEn ?? "";

    // Japanese font
    if (fontJa === "custom" && data?.customFontJaName && data?.customFontJaUrl) {
      removeElement("gfont-ja");
      ensureCustomFont("cfont-ja", data.customFontJaName, data.customFontJaUrl);
      const cat = (data?.customFontJaCategory ?? "sans-serif") as "serif" | "sans-serif";
      root.style.setProperty("--font-ja", `'${data.customFontJaName}', ${fontFallback(cat)}`);
    } else if (fontJa && GOOGLE_FONTS_JA[fontJa]) {
      removeElement("cfont-ja");
      ensureGoogleFont("gfont-ja", GOOGLE_FONTS_JA[fontJa].param);
      root.style.setProperty("--font-ja", `'${fontJa}', ${fontFallback(GOOGLE_FONTS_JA[fontJa].category)}`);
    } else {
      removeElement("gfont-ja");
      removeElement("cfont-ja");
      root.style.removeProperty("--font-ja");
    }

    // English font
    if (fontEn === "custom" && data?.customFontEnName && data?.customFontEnUrl) {
      removeElement("gfont-en");
      ensureCustomFont("cfont-en", data.customFontEnName, data.customFontEnUrl);
      const cat = (data?.customFontEnCategory ?? "sans-serif") as "serif" | "sans-serif";
      root.style.setProperty("--font-en", `'${data.customFontEnName}', ${fontFallback(cat)}`);
    } else if (fontEn && GOOGLE_FONTS_EN[fontEn]) {
      removeElement("cfont-en");
      ensureGoogleFont("gfont-en", GOOGLE_FONTS_EN[fontEn].param);
      root.style.setProperty("--font-en", `'${fontEn}', ${fontFallback(GOOGLE_FONTS_EN[fontEn].category)}`);
    } else {
      removeElement("gfont-en");
      removeElement("cfont-en");
      root.style.removeProperty("--font-en");
    }

    document.body.style.fontFamily = getComputedStyle(root).getPropertyValue("--font-ja") || "";
  }, [data?.fontJa, data?.fontEn, data?.customFontJaName, data?.customFontJaUrl, data?.customFontEnName, data?.customFontEnUrl, data?.customFontJaCategory, data?.customFontEnCategory]);

  // Live preview: listen for postMessage from admin iframe parent
  useEffect(() => {
    function handlePreviewMessage(e: MessageEvent) {
      // Same-origin guard: the only legitimate sender is the admin page embedding
      // this site in a same-origin iframe. Ignore messages from any other origin.
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "preview-settings") return;
      const s = e.data.settings as Record<string, string>;
      const root = document.documentElement;

      // We're now a live-preview surface: pin the settings cache so a background
      // refetch (staleTime elapsing while navigating between pages inside the
      // iframe) can't overwrite the previewed values with the saved DB ones.
      qc.setQueryDefaults(["settings"], { staleTime: Infinity });

      // G/I: bridge JS-driven settings into the query cache so the gallery /
      // series pages (when navigated to in the preview iframe) reflect edits live.
      if (JS_PREVIEW_KEYS.some((k) => s[k] !== undefined)) {
        qc.setQueryData(["settings"], (old: Record<string, string> | undefined) => {
          const next = { ...old };
          for (const k of JS_PREVIEW_KEYS) if (s[k] !== undefined) next[k] = s[k];
          return next;
        });
      }

      // Mirror the DB-apply path exactly: an empty value means "use the default",
      // so we removeProperty (falling back to the same CSS :root / inline defaults
      // the live site uses) rather than injecting a different hardcoded default.
      // Previously the preview used its own defaults (e.g. nav-opacity 0.30 vs the
      // real 0.50), so clearing a field showed a value the published site never had.
      const applyVar = (key: string, raw: string | undefined, transform?: (v: string) => string) => {
        if (raw === undefined) return;                 // key absent from this payload
        if (raw === "") { root.style.removeProperty(key); return; }
        root.style.setProperty(key, transform ? transform(raw) : raw);
      };
      const sizePx = (v: string) => `calc(${v}px * var(--global-font-scale, 1))`;
      const em = (v: string) => `${v}em`;

      // Colors
      if (s.themeBg !== undefined) {
        if (s.themeBg) {
          root.style.setProperty("--background", s.themeBg);
          document.body.style.backgroundColor = s.themeBg;
          const hex = s.themeBg.replace("#", "");
          const r = parseInt(hex.slice(0,2), 16), g = parseInt(hex.slice(2,4), 16), b = parseInt(hex.slice(4,6), 16);
          if (!isNaN(r)) root.style.setProperty("--background-rgb", `${r},${g},${b}`);
        } else {
          root.style.removeProperty("--background");
          root.style.removeProperty("--background-rgb");
          document.body.style.removeProperty("background-color");
        }
        const blend = textureBlendFor(s.themeBg);
        if (blend) root.style.setProperty("--bg-texture-blend", blend);
        else root.style.removeProperty("--bg-texture-blend");
      }
      if (s.themeText !== undefined) {
        if (s.themeText) {
          root.style.setProperty("--foreground", s.themeText);
          document.body.style.color = s.themeText;
          const hex = s.themeText.replace("#", "");
          const r = parseInt(hex.slice(0,2), 16), g = parseInt(hex.slice(2,4), 16), b = parseInt(hex.slice(4,6), 16);
          if (!isNaN(r)) root.style.setProperty("--foreground-rgb", `${r},${g},${b}`);
        } else {
          root.style.removeProperty("--foreground");
          root.style.removeProperty("--foreground-rgb");
          document.body.style.removeProperty("color");
        }
      }

      // D4: global type scale + link styling
      applyVar("--global-font-scale", s.globalFontScale);
      applyVar("--link-hover-color", s.linkHoverColor);
      applyVar("--accent-color", s.accentColor);
      applyVar("--spacing-hero-bottom", s.spacingHeroBottom);
      applyVar("--spacing-section-gap", s.spacingSectionGap);
      applyVar("--spacing-page-top", s.spacingPageTop);
      applyVar("--spacing-footer-top", s.spacingFooterTop);
      if (s.bgTexture !== undefined) {
        if (s.bgTexture && s.bgTexture !== "none") document.body.dataset.texture = s.bgTexture;
        else delete document.body.dataset.texture;
      }
      applyVar("--bg-texture-opacity", s.bgTextureOpacity);
      if (s.photoRevealEffect !== undefined) {
        if (s.photoRevealEffect && s.photoRevealEffect !== "fade") document.body.dataset.reveal = s.photoRevealEffect;
        else delete document.body.dataset.reveal;
      }
      if (s.linkUnderline !== undefined) {
        if (s.linkUnderline === "on") root.style.setProperty("--link-underline", "underline");
        else root.style.removeProperty("--link-underline"); // "off"/"" → CSS default (none)
      }

      // Typography — px sizes multiplied by the global scale at use-time
      applyVar("--nav-opacity", s.navOpacity);
      applyVar("--nav-size", s.navSize, sizePx);
      applyVar("--body-size", s.bodySize, sizePx);
      applyVar("--heading-size", s.headingSize, sizePx);
      applyVar("--section-label-size", s.sectionLabelSize, sizePx);
      applyVar("--section-label-opacity", s.sectionLabelOpacity);
      applyVar("--footer-opacity", s.footerOpacity);
      applyVar("--footer-size", s.footerSize, sizePx);
      applyVar("--sns-opacity", s.snsOpacity);
      applyVar("--hero-name-size", s.heroNameSize, sizePx);
      applyVar("--hero-name-en-size", s.heroNameEnSize, sizePx);
      applyVar("--hero-name-color", s.heroNameColor);
      applyVar("--hero-name-en-color", s.heroNameEnColor);
      applyVar("--hero-sub-size", s.heroSubSize, sizePx);
      applyVar("--hero-sub-color", s.heroSubColor);
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
        if (s.heroOverlay === "off") root.style.setProperty("--hero-overlay-opacity", "0");
        else root.style.removeProperty("--hero-overlay-opacity"); // on/"" → CSS default (0.38)
      }

      // Fonts (A5: category-aware fallback)
      if (s.fontJa !== undefined) {
        const fontJa = s.fontJa;
        if (fontJa === "custom" && s.customFontJaName && s.customFontJaUrl) {
          removeElement("gfont-ja");
          ensureCustomFont("cfont-ja", s.customFontJaName, s.customFontJaUrl);
          const cat = (s.customFontJaCategory || "sans-serif") as "serif" | "sans-serif";
          root.style.setProperty("--font-ja", `'${s.customFontJaName}', ${fontFallback(cat)}`);
        } else if (fontJa && GOOGLE_FONTS_JA[fontJa]) {
          removeElement("cfont-ja");
          ensureGoogleFont("gfont-ja", GOOGLE_FONTS_JA[fontJa].param);
          root.style.setProperty("--font-ja", `'${fontJa}', ${fontFallback(GOOGLE_FONTS_JA[fontJa].category)}`);
        } else {
          removeElement("gfont-ja");
          removeElement("cfont-ja");
          root.style.removeProperty("--font-ja");
        }
        document.body.style.fontFamily = getComputedStyle(root).getPropertyValue("--font-ja") || "";
      }
      if (s.fontEn !== undefined) {
        const fontEn = s.fontEn;
        if (fontEn === "custom" && s.customFontEnName && s.customFontEnUrl) {
          removeElement("gfont-en");
          ensureCustomFont("cfont-en", s.customFontEnName, s.customFontEnUrl);
          const cat = (s.customFontEnCategory || "sans-serif") as "serif" | "sans-serif";
          root.style.setProperty("--font-en", `'${s.customFontEnName}', ${fontFallback(cat)}`);
        } else if (fontEn && GOOGLE_FONTS_EN[fontEn]) {
          removeElement("cfont-en");
          ensureGoogleFont("gfont-en", GOOGLE_FONTS_EN[fontEn].param);
          root.style.setProperty("--font-en", `'${fontEn}', ${fontFallback(GOOGLE_FONTS_EN[fontEn].category)}`);
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
    if (window.parent !== window) window.parent.postMessage({ type: "preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", handlePreviewMessage);
  }, [qc]);

  return <>{children}</>;
}
