/**
 * 未設定の文字の設定が「今いくつで表示されているか」を、管理画面のプレビューから読む
 * （2026-09-30）。
 *
 * 管理画面の大きさ・字間・濃さの欄は、未設定のとき決め打ちの数字（名前の大きさ 60、
 * 本文 16、濃さ 30% など）を出していた。実際のサイトはデザインごとの既定で描かれていて
 * （名前 24px、本文 14〜15px、濃さ 35〜100%）、欄を少し動かしただけで見た目が倍に
 * 跳ねていた（オーナー「不具合みたいな仕様」）。プレビューは同じオリジンの iframe なので、
 * そこに描かれている要素の計算済みスタイルを読めば、今の値から動かし始められる。
 *
 * 見ているページにその部分が無いとき（トップにしか無い名前を About で見ている等）は
 * null を返し、欄は「自動」とだけ出す。
 */

type Probe = {
  /** 前から順に探す。写真中心の構成といつもの構成の両方の要素を並べる。 */
  selectors: string[];
  read: (style: CSSStyleDeclaration, scale: number) => number | null;
};

/** 大きさの設定は「全体の文字の倍率」を掛けて描かれるので、倍率で割って設定の単位へ戻す。 */
const px = (style: CSSStyleDeclaration, scale: number) => {
  const v = parseFloat(style.fontSize);
  return Number.isFinite(v) ? v / (scale > 0 ? scale : 1) : null;
};
const em = (style: CSSStyleDeclaration) => {
  if (style.letterSpacing === "normal") return 0;
  const ls = parseFloat(style.letterSpacing);
  const fs = parseFloat(style.fontSize);
  return Number.isFinite(ls) && fs > 0 ? ls / fs : null;
};
const leading = (style: CSSStyleDeclaration) => {
  const lh = parseFloat(style.lineHeight);
  const fs = parseFloat(style.fontSize);
  return Number.isFinite(lh) && fs > 0 ? lh / fs : null;
};
const weight = (style: CSSStyleDeclaration) => {
  const w = parseFloat(style.fontWeight);
  return Number.isFinite(w) ? w : null;
};
/** rgba(r, g, b, a) の a。濃さの設定は文字色の透明度として効く。 */
const alpha = (style: CSSStyleDeclaration) => {
  const parts = style.color.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  return parts.length > 3 ? Number(parts[3]) : 1;
};

const NAV = [".ps-nav__link:not([aria-current]):not(.ps-nav__theme)", "header nav ul a:not([aria-current])"];
const HERO_NAME = [".ps-top-name__main", '[data-hero-name-part="primary"]'];
const HERO_NAME_EN = [".ps-top-name__en", '[data-hero-name-part="english"]'];
const HERO_SUB = [".ps-top-name__role", '[data-hero-name-part="subtitle"]'];
const HEADING = [".ps-page-head__title", ".ps-series-head__title", "main h1:not(.sr-only)"];
const SECTION_LABEL = [".ps-series-group__label", ".ps-filters a", '[style*="section-label-size-eff"]'];
const BODY = [".profile-bio__text", ".ps-series-head__statement", "main .ja-prose"];
const FOOTER = [".ps-footer__copy", "footer p"];
const SNS = ['.ps-footer__links[aria-label="SNS"] a', "footer .footer-sns-nav a"];

const PROBES: Record<string, Probe> = {
  navSize: { selectors: NAV, read: px },
  navTracking: { selectors: NAV, read: em },
  navOpacity: { selectors: NAV, read: alpha },
  heroNameSize: { selectors: HERO_NAME, read: px },
  heroNameTracking: { selectors: HERO_NAME, read: em },
  heroNameWeight: { selectors: HERO_NAME, read: weight },
  heroNameEnSize: { selectors: HERO_NAME_EN, read: px },
  heroNameEnTracking: { selectors: HERO_NAME_EN, read: em },
  heroSubSize: { selectors: HERO_SUB, read: px },
  headingSize: { selectors: HEADING, read: px },
  sectionLabelSize: { selectors: SECTION_LABEL, read: px },
  sectionLabelTracking: { selectors: SECTION_LABEL, read: em },
  sectionLabelOpacity: { selectors: SECTION_LABEL, read: alpha },
  sectionLeading: { selectors: HEADING, read: leading },
  bodySize: { selectors: BODY, read: px },
  bodyTracking: { selectors: BODY, read: em },
  bodyLeading: { selectors: BODY, read: leading },
  bodyWeight: { selectors: BODY, read: weight },
  footerSize: { selectors: FOOTER, read: px },
  footerOpacity: { selectors: FOOTER, read: alpha },
  snsOpacity: { selectors: SNS, read: alpha },
};

export function hasSettingProbe(key: string): boolean {
  return key in PROBES;
}

/** 管理画面のプレビュー（同じオリジンの iframe）の文書。無ければ null。 */
function previewDocument(): Document | null {
  if (typeof document === "undefined") return null;
  const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Site Preview"]');
  try {
    return frame?.contentDocument ?? null;
  } catch {
    return null;
  }
}

/** 見えている要素を先に読む（読み上げ用に隠した見出しなどは飛ばす）。スマホの
 *  「編集」ではプレビューごと隠れて大きさが 0 になるので、そのときは隠していない
 *  要素の計算済みスタイルを読む（計算は描かれていなくてもできる）。 */
function firstVisible(doc: Document, selectors: string[]): Element | null {
  for (const selector of selectors) {
    for (const el of Array.from(doc.querySelectorAll(selector))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return el;
    }
  }
  const view = doc.defaultView;
  for (const selector of selectors) {
    for (const el of Array.from(doc.querySelectorAll(selector))) {
      if (el.closest(".sr-only, [hidden], [aria-hidden='true']")) continue;
      if (view && view.getComputedStyle(el).display !== "none") return el;
    }
  }
  return null;
}

/** 今プレビューに描かれている値。読めなければ null。 */
export function probeSettingValue(key: string): number | null {
  const probe = PROBES[key];
  if (!probe) return null;
  const doc = previewDocument();
  const view = doc?.defaultView;
  if (!doc || !view) return null;
  const el = firstVisible(doc, probe.selectors);
  if (!el) return null;
  const scale = parseFloat(view.getComputedStyle(doc.documentElement).getPropertyValue("--global-font-scale")) || 1;
  const value = probe.read(view.getComputedStyle(el), scale);
  return value != null && Number.isFinite(value) ? value : null;
}
