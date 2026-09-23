/**
 * 写真集の管理画面（siteDesign = "book"、2026-09-23 試作）。
 *
 * 縛るのは3点。
 *  1. 写真集のときだけ作業台の器になり、いつもの構成（配布版の既定）は
 *     今までの左メニューのまま
 *  2. 作業台のベタ焼きは写真1枚ずつの媒体どおり（フィルムを黒い帯に）
 *  3. 公開／非公開の切り替えはまとめて扱う要求（/admin/photos/batch）を1回送り、
 *     元に戻す入口を出す
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";

const dom = setupDom();
const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");

const photo = (id: number, seriesId: number | null, filmType: string, sortOrder: number) => ({
  id,
  url: `/api/images/photos/p${id}.jpg`,
  thumbUrl: `/api/images/thumbs/p${id}.webp`,
  title: "",
  meta: "",
  description: "",
  category: "",
  filename: `p${id}.jpg`,
  filmType,
  camera: filmType === "フィルム" ? "PENTAX 67" : "SONY ILCE-1",
  shotAt: "2026-03-11T00:00:00",
  isPublished: true,
  seriesId,
  width: 2560,
  height: 3200,
  sortOrder,
});
const PHOTOS = [
  photo(1, 4, "フィルム", 0),
  photo(2, 4, "フィルム", 1),
  photo(3, 4, "デジタル", 2),
  photo(9, null, "デジタル", 3),
];
const SERIES = [
  { id: 4, slug: "sea", title: "海の記憶", kind: "series", isPublished: true, sortOrder: 0, coverPhotoId: null },
];

async function mountAdmin(settings: Record<string, string>) {
  canned["/api/admin/me"] = { authenticated: true };
  canned["/api/settings"] = { setupCompleted: "true", ...settings };
  canned["/api/admin/series"] = { series: SERIES };
  canned["/api/photos"] = { photos: PHOTOS };
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["settings"], { setupCompleted: "true", ...settings });
  qc.setQueryData(["admin-me"], { authenticated: true });
  qc.setQueryData(["photos", "all"], { photos: PHOTOS });
  qc.setQueryData(["admin-series"], { series: SERIES });
  const Admin = (await import("../pages/admin")).default;
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(QueryClientProvider, { client: qc }, createElement(Admin)));
  await flush(60);
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

const prevFetch = globalThis.fetch;
// 見本データはほかのテストファイルと共有している。書き換えた分は必ず戻す。
const saved = {
  settings: canned["/api/settings"],
  photos: canned["/api/photos"],
  me: canned["/api/admin/me"],
  adminSeries: canned["/api/admin/series"],
};
afterEach(() => {
  globalThis.fetch = prevFetch;
  canned["/api/settings"] = saved.settings;
  canned["/api/photos"] = saved.photos;
  canned["/api/admin/me"] = saved.me;
  if (saved.adminSeries === undefined) delete canned["/api/admin/series"];
  else canned["/api/admin/series"] = saved.adminSeries;
  dom.window.localStorage.clear();
});

describe("写真集の管理画面", () => {
  test("いつもの構成では今までの左メニューのまま", async () => {
    const m = await mountAdmin({});
    try {
      expect(m.host.querySelector(".admin-book")).toBeNull();
      expect(m.host.querySelector("aside.admin-sidebar")).not.toBeNull();
    } finally {
      m.cleanup();
    }
  });

  test("写真集では作業台になり、媒体どおりのベタ焼きと入口3つが出る", async () => {
    const m = await mountAdmin({ siteDesign: "book" });
    try {
      expect(m.host.querySelector("aside.admin-sidebar")).toBeNull();
      const tabs = Array.from(m.host.querySelectorAll(".admin-book__tab")).map((b) => b.textContent);
      expect(tabs).toEqual(["作品", "写真の一覧", "サイト"]);
      expect(m.host.querySelector(".bench-sheet__title")?.textContent).toBe("海の記憶");
      const runs = Array.from(m.host.querySelectorAll(".bench-run")).map((r) => [
        r.getAttribute("data-medium"),
        r.querySelectorAll(".bench-frame").length,
      ]);
      expect(runs).toEqual([
        ["film", 2],
        ["digital", 1],
      ]);
      // 未整理（作品に入っていない写真）の棚も出る
      expect(m.host.textContent).toContain("未整理");
    } finally {
      m.cleanup();
    }
  });

  test("非公開にすると一括の要求を1回送り、元に戻す入口が出る", async () => {
    const calls: { url: string; method: string; body: string }[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method !== "GET") {
        calls.push({ url, method, body: String(init?.body ?? "") });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return prevFetch(input, init);
    }) as typeof fetch;
    const m = await mountAdmin({ siteDesign: "book" });
    try {
      (m.host.querySelector(".bench-frame__btn") as HTMLButtonElement).click();
      await flush(20);
      const privateBtn = Array.from(m.host.querySelectorAll(".bench-side .bench-switch button")).find(
        (b) => b.textContent === "非公開",
      ) as HTMLButtonElement;
      privateBtn.click();
      await flush(40);
      const writes = calls.filter((c) => c.method !== "GET");
      expect(writes).toHaveLength(1);
      expect(writes[0]!.url).toContain("/api/admin/photos/batch");
      expect(JSON.parse(writes[0]!.body)).toEqual({ ids: [1], operation: "unpublish" });
      expect(m.host.querySelector(".bench-notice__undo")?.textContent).toBe("元に戻す");
    } finally {
      m.cleanup();
    }
  });
});
