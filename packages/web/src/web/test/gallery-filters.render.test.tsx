/**
 * Gallery filter state regression coverage.
 *
 * The public page inherits the site's configurable body weight. Keep the
 * inactive filter weight explicit so a bold site body cannot make inactive
 * labels heavier than the active label.
 */
import { test, expect } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } =
  await import("@tanstack/react-query");

const photo = (id: number, category: string, filmType: string | null) => ({
  id, filename: `${id}.jpg`, url: `/api/images/photos/${id}.jpg`, title: "", meta: "",
  camera: null, lens: null, filmType, shotAt: null, description: "", category,
  displaySize: "M", isPublished: true, seriesId: null, width: 3000, height: 2000,
  fileHash: `h${id}`, sortOrder: id, deletedAt: null, createdAt: null,
});

test("Gallery filters keep active medium and inactive weight distinct", async () => {
  const previousSettings = canned["/api/settings"];
  const previousCategories = canned["/api/categories"];
  const previousPhotos = canned["/api/photos"];
  const previousSearch = dom.window.location.search;
  canned["/api/settings"] = { bodyWeight: "700", filterAllLabel: "All" };
  canned["/api/categories"] = {
    categories: [
      { id: 1, slug: "portrait", label: "Portrait", sortOrder: 0 },
      { id: 2, slug: "nature", label: "Nature", sortOrder: 1 },
    ],
  };
  // 分類も撮り方も、押すと一覧が変わる組み合わせ（どの項目も1枚以上・全部ではない）。
  canned["/api/photos"] = {
    photos: [
      photo(11, "portrait", "フィルム"),
      photo(12, "nature", "デジタル"),
      photo(13, "portrait", "デジタル"),
      photo(14, "", "フィルム"),
    ],
  };
  dom.reconfigure({ url: "http://localhost/gallery" });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  try {
    const GalleryPage = (await import("../pages/gallery")).default;
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(GalleryPage),
      ),
    );
    await flush(120);

    const rows = host.querySelectorAll<HTMLElement>(".gallery-filter-row");
    expect(rows).toHaveLength(2);

    const categoryActive = rows[0]!.querySelector(
      'button[aria-pressed="true"]',
    );
    const categoryInactive = rows[0]!.querySelector(
      'button[aria-pressed="false"]',
    );
    expect(categoryActive?.className).toContain("font-medium");
    expect(categoryActive?.className).not.toContain("font-normal");
    expect(categoryInactive?.className).toContain("font-normal");
    expect(categoryInactive?.className).not.toContain("font-medium");

    const mediumActive = rows[1]!.querySelector(
      'button[aria-pressed="true"]',
    );
    const mediumInactive = rows[1]!.querySelector(
      'button[aria-pressed="false"]',
    );
    expect(mediumActive?.textContent?.trim()).toBe("All");
    expect(mediumActive?.className).toContain("font-medium");
    expect(mediumInactive?.className).toContain("font-normal");

    categoryInactive?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await flush(40);
    expect(dom.window.location.search).toContain("c=portrait");

    const film = Array.from(rows[1]!.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Film",
    );
    film?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await flush(40);
    expect(dom.window.location.search).toContain("c=portrait");
    expect(dom.window.location.search).toContain("medium=film");
  } finally {
    root.unmount();
    host.remove();
    queryClient.clear();
    canned["/api/settings"] = previousSettings;
    canned["/api/categories"] = previousCategories;
    canned["/api/photos"] = previousPhotos;
    dom.reconfigure({ url: `http://localhost/gallery${previousSearch}` });
  }
});

// 2026-10-01 本番: 分類の付いた写真は全部シリーズの中、単発の写真は全部デジタル。
// どの分類・Film を押しても「写真が見つかりませんでした」だった。
test("Gallery hides filters that would show no photos or change nothing", async () => {
  const previousSettings = canned["/api/settings"];
  const previousCategories = canned["/api/categories"];
  const previousPhotos = canned["/api/photos"];
  const previousSearch = dom.window.location.search;
  canned["/api/settings"] = { filterAllLabel: "All" };
  canned["/api/categories"] = {
    categories: [
      { id: 1, slug: "portrait", label: "portrait", sortOrder: 0 },
      { id: 4, slug: "street", label: "street", sortOrder: 1 },
    ],
  };
  canned["/api/photos"] = {
    photos: [photo(21, "", "デジタル"), photo(22, "", "デジタル")],
  };
  // 共有されたリンクなどで、写真の無い分類を指して入ってきた場合。
  dom.reconfigure({ url: "http://localhost/gallery?c=street" });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  try {
    const GalleryPage = (await import("../pages/gallery")).default;
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(GalleryPage),
      ),
    );
    await flush(160);

    expect(host.querySelectorAll(".gallery-filter-row")).toHaveLength(0);
    // スマホの帯（枚数と「写真を探す」）も、押して変わる物が無ければ出さない。
    expect(host.querySelector(".gallery-mobile-filters")).toBeNull();
    // 写真の無い分類からは All へ戻す（「見つかりませんでした」で止めない）。
    expect(dom.window.location.search).not.toContain("c=street");
    expect(host.textContent).not.toContain("写真が見つかりませんでした");
  } finally {
    root.unmount();
    host.remove();
    queryClient.clear();
    canned["/api/settings"] = previousSettings;
    canned["/api/categories"] = previousCategories;
    canned["/api/photos"] = previousPhotos;
    dom.reconfigure({ url: `http://localhost/gallery${previousSearch}` });
  }
});
