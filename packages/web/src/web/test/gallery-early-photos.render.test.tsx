/**
 * Gallery の HTML が先に始めた写真一覧の取り寄せ（`shared/early-photos.ts`）を、
 * 一覧が使うか。無い・失敗したときは、ふだんどおり自分で取り寄せるか。
 *
 * 写真は固定の検証データ。本番の写真・設定には依存しない。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush, samplePhotos } from "./jsdom-setup";
import { EARLY_PHOTOS_GLOBAL } from "../../shared/early-photos";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const GalleryPage = (await import("../pages/gallery")).default;

const doc = dom.window.document;
const holder = dom.window as unknown as Record<string, unknown>;

// canned の /api/photos（samplePhotos、3枚）とは別の5枚。
const EARLY = Array.from({ length: 5 }, (_, i) => ({
  ...samplePhotos[0],
  id: 100 + i,
  filename: `early${i}.jpg`,
  url: `/api/images/photos/early${i}.jpg`,
  title: `先に届いた${i}`,
  seriesId: null,
}));

async function mountGallery() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(QueryClientProvider, { client: qc }, createElement(GalleryPage)));
  await flush(220);
  return { host, cleanup: () => { root.unmount(); host.remove(); } };
}

afterEach(() => {
  holder[EARLY_PHOTOS_GLOBAL] = undefined;
  canned["/api/settings"] = {};
  canned["/api/photos"] = { photos: samplePhotos };
});

describe("HTML が先に始めた写真一覧の取り寄せ", () => {
  test("届いていれば、その一覧で並べ、受け取ったら手放す", async () => {
    holder[EARLY_PHOTOS_GLOBAL] = Promise.resolve({ photos: EARLY });
    const m = await mountGallery();
    try {
      expect(m.host.querySelectorAll("[data-photo-tile]").length).toBe(EARLY.length);
      expect(holder[EARLY_PHOTOS_GLOBAL]).toBeUndefined();
    } finally {
      m.cleanup();
    }
  });

  test("失敗（null）なら、ふだんどおり自分で取り寄せる", async () => {
    holder[EARLY_PHOTOS_GLOBAL] = Promise.resolve(null);
    const m = await mountGallery();
    try {
      expect(m.host.querySelectorAll("[data-photo-tile]").length).toBe(samplePhotos.length);
    } finally {
      m.cleanup();
    }
  });

  test("無ければ、ふだんどおり自分で取り寄せる", async () => {
    const m = await mountGallery();
    try {
      expect(m.host.querySelectorAll("[data-photo-tile]").length).toBe(samplePhotos.length);
    } finally {
      m.cleanup();
    }
  });
});
