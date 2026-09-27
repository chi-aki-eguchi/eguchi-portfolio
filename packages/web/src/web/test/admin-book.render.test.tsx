/**
 * 写真中心の管理画面（siteDesign = "book"、2026-09-26 作り直し）。
 *
 * 縛るのは3点。
 *  1. 写真中心のときだけ新しい器（写真・シリーズ・サイト）になり、いつもの構成
 *     （配布版の既定）は今までの左メニューのまま
 *  2. 最初は「写真」。シリーズに入っていない写真を数え、絞り込める
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

const MEMBERSHIPS = [
  { seriesId: 4, photoId: 1, sortOrder: 0 },
  { seriesId: 4, photoId: 2, sortOrder: 1 },
  { seriesId: 4, photoId: 3, sortOrder: 2 },
];

async function mountAdmin(settings: Record<string, string>) {
  canned["/api/admin/me"] = { authenticated: true };
  canned["/api/admin/series-photos"] = { memberships: MEMBERSHIPS };
  canned["/api/admin/hero-photos"] = { heroPhotos: [] };
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
  qc.setQueryData(["admin-series-photos"], { memberships: MEMBERSHIPS });
  qc.setQueryData(["admin-hero-photos"], { heroPhotos: [] });
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
  memberships: canned["/api/admin/series-photos"],
  hero: canned["/api/admin/hero-photos"],
};
// jsdom には幅が無いので、写真の段を組めるよう幅を与える（後で必ず外す）。
const elementProto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
afterEach(() => {
  globalThis.fetch = prevFetch;
  canned["/api/settings"] = saved.settings;
  canned["/api/photos"] = saved.photos;
  canned["/api/admin/me"] = saved.me;
  if (saved.adminSeries === undefined) delete canned["/api/admin/series"];
  else canned["/api/admin/series"] = saved.adminSeries;
  if (saved.memberships === undefined) delete canned["/api/admin/series-photos"];
  else canned["/api/admin/series-photos"] = saved.memberships;
  if (saved.hero === undefined) delete canned["/api/admin/hero-photos"];
  else canned["/api/admin/hero-photos"] = saved.hero;
  delete elementProto.clientWidth;
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

  test("写真中心では「写真」から始まり、シリーズに入っていない写真を数える", async () => {
    Object.defineProperty(elementProto, "clientWidth", { configurable: true, get: () => 900 });
    const m = await mountAdmin({ siteDesign: "book" });
    try {
      expect(m.host.querySelector("aside.admin-sidebar")).toBeNull();
      const tabs = Array.from(m.host.querySelectorAll(".admin-book__tab")).map((b) => b.textContent);
      expect(tabs).toEqual(["写真", "シリーズ", "サイト"]);
      const loose = Array.from(m.host.querySelectorAll(".st-side__item")).find((b) =>
        b.textContent?.includes("シリーズに入っていない"),
      ) as HTMLButtonElement;
      expect(loose.querySelector(".st-side__count")?.textContent).toBe("1");
      expect(m.host.querySelectorAll(".st-tile").length).toBe(4);
      loose.click();
      await flush(40);
      expect(Array.from(m.host.querySelectorAll(".st-tile")).map((t) => t.getAttribute("data-photo-id"))).toEqual(["9"]);
    } finally {
      m.cleanup();
    }
  });

  test("非公開にすると一括の要求を1回送り、元に戻す入口が出る", async () => {
    Object.defineProperty(elementProto, "clientWidth", { configurable: true, get: () => 900 });
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
      (m.host.querySelector('.st-tile[data-photo-id="1"]') as HTMLButtonElement).click();
      await flush(20);
      const privateBtn = Array.from(m.host.querySelectorAll(".st-inspector .st-seg__item")).find(
        (b) => b.textContent === "非公開",
      ) as HTMLButtonElement;
      privateBtn.click();
      await flush(60);
      const writes = calls.filter((c) => c.method !== "GET");
      expect(writes).toHaveLength(1);
      expect(writes[0]!.url).toContain("/api/admin/photos/batch");
      expect(JSON.parse(writes[0]!.body)).toEqual({ ids: [1], operation: "unpublish" });
      expect(dom.window.document.querySelector(".st-toast__undo")?.textContent).toBe("元に戻す");
    } finally {
      m.cleanup();
    }
  });
});
