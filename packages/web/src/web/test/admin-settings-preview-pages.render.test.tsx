/**
 * 設定プレビューの「確認するページ」に、Work の一覧と作品ごとの詳細が並ぶ。
 *
 * ブラウザーの操作は scripts/smoke/admin-settings-preview.spec.ts が見る。
 * ここでは、実データで作りにくい状態——作品0件、一覧の取得失敗、選んでいた
 * 作品の削除・非公開化、長い名前——を人工の一覧で確かめる。どの状態でも、
 * 選択を黙ってトップへ戻さず、理由を出す。
 */
import { afterEach, describe, expect, test } from "bun:test";
import { flush, setupDom } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { AdminSettingsPreviewPane } = await import("../pages/admin-settings-preview-pane");
const { buildPublicSiteHref } = await import("../pages/admin-shared");
type PreviewWork = import("../lib/admin-preview-pages").PreviewWork;

const doc = dom.window.document;
const noop = () => {};
const COPY = {
  title: "プレビュー", desktop: "PC", desktopTitle: "PC", mobile: "スマホ幅", mobileTitle: "スマホ幅",
  syncOn: "", syncOff: "", syncOnTitle: "", syncOffTitle: "", reload: "再読み込み", expand: "大きく表示",
  collapse: "戻す", expandTitle: "", openInNewTab: "", openInNewTabTitle: "別のタブで開く",
  resetWidth: "", resetWidthTitle: "", unsavedWhileExpanded: (n: number) => `${n}件未保存`,
};

const LONG_TITLE = "とても長い作品名".repeat(12);
const WORKS: PreviewWork[] = [
  { id: 1, slug: "harbour", title: "港の記録", kind: "series", isPublished: true },
  { id: 2, slug: "draft", title: "下書きの作品", kind: "series", isPublished: false },
  { id: 3, slug: "港 2026", title: LONG_TITLE, kind: "work", isPublished: true },
];

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

async function mount(props: {
  page: string;
  works?: PreviewWork[];
  worksFailed?: boolean;
  onRetryWorks?: () => void;
  onPageChange?: (page: string) => void;
}) {
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  const href = buildPublicSiteHref(null, props.page);
  root.render(
    createElement(AdminSettingsPreviewPane, {
      device: "desktop", onDeviceChange: noop, liveSync: true, onLiveSyncChange: noop,
      src: href, publicHref: href, onIframeLoad: noop, onReload: noop,
      expanded: false, onToggleExpanded: noop, unsavedCount: 0,
      onSave: noop, onEdit: noop, pending: false, saveLabel: "保存", editLabel: "編集へ戻る",
      copy: COPY, language: "ja", workLabel: "Commissions",
      onPageChange: props.onPageChange ?? noop,
      page: props.page, works: props.works, worksFailed: props.worksFailed, onRetryWorks: props.onRetryWorks,
    }),
  );
  await flush(20);
  cleanup = () => {
    root.unmount();
    host.remove();
  };
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="確認するページ"]')!;
  return {
    host,
    select,
    option: (value: string) =>
      Array.from(select.options).find((o) => o.value === value),
    selectedText: () => select.options[select.selectedIndex]?.textContent ?? "",
    note: () => host.querySelector(".studio-preview-note")?.textContent ?? "",
    link: () => host.querySelector<HTMLElement>(".studio-preview-status .studio-preview-public")!,
    iframeSrc: () => host.querySelector("iframe")!.getAttribute("src"),
  };
}

describe("設定プレビューのページ選択", () => {
  test("固定ページに Work、作品ごとの詳細が棚ごとに並ぶ", async () => {
    const m = await mount({ page: "/", works: WORKS });
    expect(m.option("/work")?.textContent).toBe("Commissions");
    const groups = Array.from(m.select.querySelectorAll("optgroup")).map((g) => [
      g.label,
      Array.from(g.querySelectorAll("option")).map((o) => o.value),
    ]);
    expect(groups).toEqual([
      ["作品（Series）", ["/series/harbour", "/series/draft"]],
      ["作品（Commissions）", ["/work/%E6%B8%AF%202026"]],
    ]);
    // 長い題名は省略せずに選択肢へ入れる（見た目の幅は CSS の上限で抑える）。
    expect(m.option("/work/%E6%B8%AF%202026")?.textContent).toBe(LONG_TITLE);
    expect(m.note()).toBe("");
  });

  test("作品を選ぶと、そのURLを親へ渡す", async () => {
    const picked: string[] = [];
    const m = await mount({ page: "/", works: WORKS, onPageChange: (p) => picked.push(p) });
    m.select.value = "/work/%E6%B8%AF%202026";
    m.select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(picked).toEqual(["/work/%E6%B8%AF%202026"]);
  });

  test("作品ページを選んでいれば、プレビューと公開リンクは同じ作品を指す", async () => {
    const m = await mount({ page: "/work/%E6%B8%AF%202026", works: WORKS });
    expect(m.select.value).toBe("/work/%E6%B8%AF%202026");
    expect(m.iframeSrc()).toBe("/work/%E6%B8%AF%202026");
    expect(m.link().getAttribute("href")).toBe("/work/%E6%B8%AF%202026");
    expect(m.link().getAttribute("target")).toBe("_blank");
  });

  test("非公開の作品は理由付きで選べない", async () => {
    const m = await mount({ page: "/", works: WORKS });
    const draft = m.option("/series/draft")!;
    expect(draft.disabled).toBe(true);
    expect(draft.textContent).toBe("下書きの作品（非公開・確認不可）");
  });

  test("選んでいた作品が非公開になったら、選択を保ったまま理由を出し、公開リンクを止める", async () => {
    const m = await mount({ page: "/series/draft", works: WORKS });
    expect(m.select.value).toBe("/series/draft");
    expect(m.note()).toContain("「下書きの作品」は非公開のため");
    expect(m.link().tagName).toBe("SPAN");
    expect(m.link().hasAttribute("href")).toBe(false);
    expect(m.link().getAttribute("aria-disabled")).toBe("true");
  });

  test("選んでいた作品が削除されたら、トップへ戻さずに伝える", async () => {
    const m = await mount({ page: "/series/gone", works: WORKS });
    expect(m.select.value).toBe("/series/gone");
    expect(m.selectedText()).toBe("選んでいた作品（見つかりません）");
    expect(m.note()).toContain("選んでいた作品が見つかりません");
    expect(m.iframeSrc()).toBe("/series/gone");
    expect(m.link().hasAttribute("href")).toBe(false);
  });

  test("作品が1つもなければ、その旨を出す。Work は Series へ移るので選べない", async () => {
    const m = await mount({ page: "/", works: [] });
    const empty = Array.from(m.select.querySelectorAll("optgroup option")).map((o) => o.textContent);
    expect(empty).toEqual(["作品はまだありません", "作品はまだありません"]);
    expect(m.option("/work")?.disabled).toBe(true);
    expect(m.option("/work")?.textContent).toBe("Commissions（公開中の作品なし）");
  });

  test("Work を選んでいる間に公開中の Work がなくなったら、移動先を伝える", async () => {
    const m = await mount({ page: "/work", works: WORKS.filter((w) => w.kind === "series") });
    expect(m.select.value).toBe("/work");
    expect(m.note()).toContain("公開中のCommissionsがないため、このページはSeriesへ移動します。");
  });

  test("読み込み中は作品ページの可否を決めない", async () => {
    const m = await mount({ page: "/series/harbour", works: undefined });
    expect(m.select.value).toBe("/series/harbour");
    expect(m.selectedText()).toBe("選んでいた作品");
    expect(m.option("")?.textContent).toBe("作品を読み込み中…");
    expect(m.note()).toBe("");
    expect(m.link().getAttribute("href")).toBe("/series/harbour");
  });

  test("一覧の取得に失敗したら、再読み込みを出す", async () => {
    let retried = 0;
    const m = await mount({ page: "/", works: undefined, worksFailed: true, onRetryWorks: () => retried++ });
    expect(m.option("")?.textContent).toBe("作品の一覧を読み込めませんでした");
    expect(m.note()).toContain("作品の一覧を読み込めませんでした。");
    const retry = Array.from(m.host.querySelectorAll(".studio-preview-note button"))[0] as HTMLButtonElement;
    retry.click();
    expect(retried).toBe(1);
    // 固定ページはそのまま使える。
    expect(m.link().getAttribute("href")).toBe("/");
  });
});
