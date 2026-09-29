/**
 * 管理画面「サイト」のプレビュー（同じオリジンの iframe）の中で、変えられる所を
 * 押せるようにする（2026-09-29）。公開サイトの部品には手を入れず、ここに
 * 「どの要素がどの部分か」をまとめて持つ。要素に `data-edit` を付け、
 * 上に乗ると点線の枠と「名前を変える」の札を出し、押すとその部分の設定を開く。
 *
 * 公開サイトの class 名を変えたら、ここも直す。各ページの部分が見つかることは
 * smoke の `admin-site-editor.spec.ts` が両方の骨格で確かめる。
 */

/** 部分の id → 公開サイトの要素（写真中心と、いつもの構成の両方）。 */
export const PREVIEW_PART_SELECTORS: Readonly<Record<string, readonly string[]>> = {
  // いつもの構成の名前は、トップの写真の下の大きな文字（上の帯の左端は「TOP」の入口）。
  name: [".ps-top-name", ".ps-name", ".top-page .hero-text-reveal-1"],
  menu: [".ps-nav", ".ps-menu-button", "header[data-header-bg] nav"],
  footer: [".ps-footer", "footer[data-footer-layout]"],
  "top-photos": [".ps-home .ps-stream", ".top-page > section:first-of-type"],
  statement: [".ps-statement", "[data-home-statement]"],
  works: [".top-page .filter-grid-animated"],
  "series-strip": [".top-page .series-stream"],
  cta: [".ps-inquiry", "section.inquiry-note"],
  "page-title": [".ps-page-head__title", ".site-page > h1"],
  "gallery-photos": [".site-page .filter-grid-animated"],
  order: [".ps-all .ps-stream", ".ps-series-index .ps-series-list", ".site-page .filter-grid-animated", ".site-page-top > div:has(> a.group)"],
  "series-cards": [".site-page-top > div:has(> a.group)"],
  about: [".profile-page [data-profile-layout]"],
  "contact-info": [".contact-page > div"],
  "contact-words": [".contact-page form"],
};

const STYLE_ID = "admin-preview-pick-style";
const CHIP_ID = "admin-preview-pick-chip";

/** ページにある部分へ `data-edit` を付ける。先に並べた部分が優先（同じ要素は上書きしない）。 */
export function markPreviewParts(doc: Document, partIds: readonly string[]): string[] {
  const found: string[] = [];
  for (const id of partIds) {
    for (const selector of PREVIEW_PART_SELECTORS[id] ?? []) {
      let elements: NodeListOf<Element>;
      try {
        elements = doc.querySelectorAll(selector);
      } catch {
        continue; // :has() に対応しない古いブラウザ
      }
      elements.forEach((element) => {
        if (element.getAttribute("data-edit")) return;
        element.setAttribute("data-edit", id);
        if (!found.includes(id)) found.push(id);
      });
    }
  }
  return found;
}

export type PreviewPickOptions = {
  /** このページで押せる部分（上から優先） */
  partIds: readonly string[];
  /** 札の言葉（「名前を変える」） */
  chipLabel: (partId: string) => string;
  onPick: (partId: string) => void;
  /** 見つかった部分が変わったとき（押せる所の一覧に印を付けるため） */
  onFound?: (partIds: string[]) => void;
};

/** iframe の中に押せる所を用意する。戻り値で片付ける。読み込み直すたびに呼ぶ。 */
export function attachPreviewPicking(iframe: HTMLIFrameElement, options: PreviewPickOptions): () => void {
  try {
    return attachPreviewPickingUnsafe(iframe, options);
  } catch {
    // プレビューの中の都合で管理画面を止めない。押せないだけで、右の一覧から選べる。
    return () => {};
  }
}

function attachPreviewPickingUnsafe(iframe: HTMLIFrameElement, options: PreviewPickOptions): () => void {
  let doc: Document | null = null;
  try {
    doc = iframe.contentDocument;
  } catch {
    return () => {};
  }
  if (!doc?.body) return () => {};
  const view = doc.defaultView;

  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-edit] { cursor: pointer; transition: outline-color 160ms ease; }
      html[data-admin-picking] [data-edit]:not([data-admin-hover]):not([data-admin-selected]) {
        outline: 1px dashed rgba(63, 96, 126, 0.32); outline-offset: 6px;
      }
      [data-edit][data-admin-hover] { outline: 1.5px dashed rgba(63, 96, 126, 0.9); outline-offset: 6px; }
      [data-edit][data-admin-selected] { outline: 2px solid rgba(63, 96, 126, 0.95); outline-offset: 6px; }
      #${CHIP_ID} {
        position: fixed; z-index: 2147483647; pointer-events: none;
        padding: 5px 10px; border-radius: 999px;
        font: 500 13px/1.2 system-ui, -apple-system, "Hiragino Sans", sans-serif;
        letter-spacing: 0.02em; color: #fff; background: rgba(34, 48, 62, 0.92);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18); white-space: nowrap;
        opacity: 0; transform: translateY(2px); transition: opacity 120ms ease, transform 120ms ease;
      }
      #${CHIP_ID}[data-show] { opacity: 1; transform: none; }
    `;
    doc.head.appendChild(style);
  }
  let chip = doc.getElementById(CHIP_ID);
  if (!chip) {
    chip = doc.createElement("div");
    chip.id = CHIP_ID;
    chip.setAttribute("aria-hidden", "true");
    doc.body.appendChild(chip);
  }

  let lastFound = "";
  const mark = () => {
    if (!doc) return;
    const found = markPreviewParts(doc, options.partIds);
    const all = Array.from(new Set(Array.from(doc.querySelectorAll("[data-edit]")).map((el) => el.getAttribute("data-edit") ?? "")));
    const key = all.sort().join(" ");
    if (key !== lastFound) {
      lastFound = key;
      options.onFound?.(all.filter(Boolean));
    }
    return found;
  };
  mark();
  // 公開サイトはデータを読んでから描くので、描き足されたら印を付け直す。
  let timer: number | undefined;
  const observer = new (view?.MutationObserver ?? MutationObserver)(() => {
    if (timer !== undefined) view?.clearTimeout(timer);
    timer = view?.setTimeout(mark, 120);
  });
  observer.observe(doc.body, { childList: true, subtree: true });

  let hovered: Element | null = null;
  const hideChip = () => {
    hovered?.removeAttribute("data-admin-hover");
    hovered = null;
    chip?.removeAttribute("data-show");
  };
  const onOver = (event: Event) => {
    const target = (event.target as Element | null)?.closest?.("[data-edit]") ?? null;
    if (target === hovered) return;
    hovered?.removeAttribute("data-admin-hover");
    hovered = target;
    if (!target || !chip) {
      chip?.removeAttribute("data-show");
      return;
    }
    target.setAttribute("data-admin-hover", "");
    chip.textContent = options.chipLabel(target.getAttribute("data-edit") ?? "");
    const rect = target.getBoundingClientRect();
    const top = Math.max(8, rect.top - 34);
    const left = Math.min(Math.max(8, rect.left), (view?.innerWidth ?? 1000) - 200);
    chip.style.top = `${top}px`;
    chip.style.left = `${left}px`;
    chip.setAttribute("data-show", "");
  };
  const onClick = (event: Event) => {
    const target = (event.target as Element | null)?.closest?.("[data-edit]") ?? null;
    const link = (event.target as Element | null)?.closest?.("a");
    if (!target && !link) return;
    // プレビューの中ではページを移らない（ページは上の「トップ・Gallery…」で選ぶ）。
    event.preventDefault();
    event.stopPropagation();
    if (target) options.onPick(target.getAttribute("data-edit") ?? "");
  };
  // プレビューに乗っている間は、押せる所すべてに薄い点線を出す（どこが変えられるか見える）。
  const root = doc.documentElement;
  const showPicking = () => root.setAttribute("data-admin-picking", "");
  const hidePicking = () => root.removeAttribute("data-admin-picking");
  root.addEventListener("mouseenter", showPicking);
  root.addEventListener("mouseleave", hidePicking);
  doc.addEventListener("mouseover", onOver, true);
  doc.addEventListener("mouseleave", hideChip, true);
  doc.addEventListener("click", onClick, true);
  view?.addEventListener("scroll", hideChip, { passive: true });

  return () => {
    observer.disconnect();
    if (timer !== undefined) view?.clearTimeout(timer);
    root.removeEventListener("mouseenter", showPicking);
    root.removeEventListener("mouseleave", hidePicking);
    hidePicking();
    doc?.removeEventListener("mouseover", onOver, true);
    doc?.removeEventListener("mouseleave", hideChip, true);
    doc?.removeEventListener("click", onClick, true);
    view?.removeEventListener("scroll", hideChip);
    hideChip();
  };
}

/** 選んでいる部分に実線の枠を付け、見える所まで送る（一覧から選んだとき）。 */
export function selectPreviewPart(iframe: HTMLIFrameElement, partId: string | null, scroll = false): void {
  let doc: Document | null = null;
  try {
    doc = iframe.contentDocument;
  } catch {
    return;
  }
  if (!doc) return;
  // プレビューの中の都合で管理画面を止めない（読み込み途中の文書・古いブラウザ）。
  try {
    doc.querySelectorAll("[data-admin-selected]").forEach((el) => el.removeAttribute("data-admin-selected"));
    if (!partId) return;
    const value = partId.replace(/["\\]/g, "\\$&");
    const elements = Array.from(doc.querySelectorAll(`[data-edit="${value}"]`));
    elements.forEach((el) => el.setAttribute("data-admin-selected", ""));
    if (scroll && elements[0]) {
      elements[0].scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
  } catch {
    /* 印を付けられなくても、設定はそのまま使える */
  }
}
