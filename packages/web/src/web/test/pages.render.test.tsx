/**
 * Page-level render smoke tests (壊れにくさの砦):
 * every public page + admin login + the shared viewer components must mount
 * without crashing, in BOTH a populated state (canned API) and the empty
 * state (0 photos / empty settings). A throw inside any component leaves the
 * host empty or rejects — either fails here before a ZIP can be built.
 */
import { test, expect, describe } from "bun:test";
import { setupDom, canned, samplePhotos, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement, StrictMode } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");

function seedAdminPhotos(qc: InstanceType<typeof QueryClient>) {
  qc.setQueryData(["photos", "all"], { photos: samplePhotos });
}

function makeLargeAdminPhotos(count = 445) {
  return Array.from({ length: count }, (_, index) => ({
    ...samplePhotos[index % samplePhotos.length],
    id: index + 1,
    filename: `p-${String(index).padStart(3, "0")}.jpg`,
    url: `/api/images/photos/p-${String(index).padStart(3, "0")}.jpg`,
    thumbUrl: `/api/images/thumbs/p-${String(index).padStart(3, "0")}.webp`,
    mediumUrl: `/api/images/medium/p-${String(index).padStart(3, "0")}.webp`,
    title: `P${String(index).padStart(3, "0")}`,
    sortOrder: index,
    fileHash: `large-${index}`,
  }));
}

async function mount(node: unknown, setupQueryClient?: (qc: InstanceType<typeof QueryClient>) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setupQueryClient?.(qc);
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(StrictMode, null,
      createElement(QueryClientProvider, { client: qc }, node as never))
  );
  await flush(30); // let queries resolve against the canned fetch and re-render
  return {
    qc,
    host,
    cleanup: () => { root.unmount(); host.remove(); },
  };
}

function buttonWithText(host: Element, text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll("button")).find(
    (el) => el.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function inputByLabel(host: Element, label: string): HTMLInputElement {
  const input = host.querySelector(
    `input[aria-label="${label}"]`,
  ) as HTMLInputElement | null;
  if (!input) throw new Error(`Input not found: ${label}`);
  return input;
}

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function setupOpenButton(host: Element, rowTitle: string): HTMLButtonElement {
  const row = Array.from(host.querySelectorAll("div"))
    .filter(
      (el) =>
        el.textContent?.includes(rowTitle) &&
        Array.from(el.querySelectorAll("button")).some(
          (button) => button.textContent?.trim() === "開く",
        ),
    )
    .sort(
      (a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0),
    )[0];
  const button = row?.querySelector("button") as HTMLButtonElement | null;
  if (!button) throw new Error(`Setup row button not found: ${rowTitle}`);
  return button;
}

async function waitForText(host: Element, text: string, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    if (host.textContent?.includes(text)) return;
    await flush(50);
  }
  expect(host.textContent).toContain(text);
}

const pages: [string, () => Promise<{ default: React.ComponentType }>][] = [
  ["top", () => import("../pages/top")],
  ["gallery", () => import("../pages/gallery")],
  ["series", () => import("../pages/series")],
  ["series-detail", () => import("../pages/series-detail")],
  ["profile", () => import("../pages/profile")],
  ["contact", () => import("../pages/contact")],
  ["service", () => import("../pages/service")],
  ["admin-login", () => import("../pages/admin-login")],
];

describe("public pages render (populated API)", () => {
  for (const [name, load] of pages) {
    test(name, async () => {
      const Page = (await load()).default;
      const { host, cleanup } = await mount(createElement(Page));
      expect(host.innerHTML.length).toBeGreaterThan(0);
      cleanup();
    });
  }

  test("top random works fetches a limited random photo payload", async () => {
    const prevSettings = canned["/api/settings"];
    const prevFetch = globalThis.fetch;
    const seen: string[] = [];
    canned["/api/settings"] = {
      topWorksMode: "random",
      homeGalleryCount: "12",
    };
    globalThis.fetch = (async (input: string | URL | Request) => {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const u = new URL(raw, "http://localhost/");
      seen.push(`${u.pathname}${u.search}`);
      return prevFetch(input);
    }) as typeof fetch;
    try {
      const Top = (await import("../pages/top")).default;
      const { cleanup } = await mount(createElement(Top));
      await flush(60);

      expect(
        seen.some((url) =>
          url.startsWith("/api/photos?") &&
          url.includes("limit=48") &&
          url.includes("order=random"),
        ),
      ).toBe(true);
      expect(seen).not.toContain("/api/photos");
      cleanup();
    } finally {
      canned["/api/settings"] = prevSettings;
      globalThis.fetch = prevFetch;
    }
  });
});

describe("public pages render (empty state: 写真0枚・設定空)", () => {
  test("all pages survive an empty site", async () => {
    const prevPhotos = canned["/api/photos"];
    canned["/api/photos"] = { photos: [] };
    try {
      for (const [, load] of pages) {
        const Page = (await load()).default;
        const { host, cleanup } = await mount(createElement(Page));
        expect(host.innerHTML.length).toBeGreaterThan(0);
        cleanup();
      }
    } finally {
      canned["/api/photos"] = prevPhotos;
    }
  });

  test("empty public pages do not fall back to production identity", async () => {
    const prevPhotos = canned["/api/photos"];
    canned["/api/photos"] = { photos: [] };
    try {
      for (const [, load] of pages) {
        const Page = (await load()).default;
        const { host, cleanup } = await mount(createElement(Page));
        expect(host.textContent).not.toContain("江口秋");
        expect(host.textContent).not.toContain("Aki Eguchi");
        cleanup();
      }
    } finally {
      canned["/api/photos"] = prevPhotos;
    }
  });
});

describe("shared components", () => {
  test("SeriesGrid renders its empty state", async () => {
    const { SeriesGrid } = await import("../components/SeriesGrid");
    const { host, cleanup } = await mount(createElement(SeriesGrid));
    expect(host.textContent).toContain("No series yet");
    cleanup();
  });

  test("SeriesGrid renders tiles with titles (R1)", async () => {
    const prev = canned["/api/series"];
    canned["/api/series"] = { series: [{ id: 3, slug: "s", title: "indigo blue", subtitle: "2026", statement: "", coverPhotoId: 2, sortOrder: 0, isPublished: true, coverUrl: "/api/images/photos/b.jpg" }] };
    try {
      const { SeriesGrid } = await import("../components/SeriesGrid");
      const { host, cleanup } = await mount(createElement(SeriesGrid));
      expect(host.textContent).toContain("indigo blue");
      cleanup();
    } finally {
      canned["/api/series"] = prev;
    }
  });

  test("Lightbox mounts, navigates and closes without crashing", async () => {
    const { Lightbox } = await import("../components/Lightbox");
    const originalBack = dom.window.history.back.bind(dom.window.history);
    let historyBackCalls = 0;
    dom.window.history.back = () => {
      historyBackCalls += 1;
      originalBack();
    };
    let closed = 0;
    let index = 0;
    const photos = samplePhotos.map((p) => ({ url: p.url, title: p.title, camera: p.camera, lens: p.lens, filmType: p.filmType }));
    try {
      const { cleanup } = await mount(
        createElement(Lightbox, {
          photos,
          index,
          onClose: () => { closed += 1; },
          onPrev: () => { index = (index + photos.length - 1) % photos.length; },
          onNext: () => { index = (index + 1) % photos.length; },
        })
      );
      const dlg = dom.window.document.querySelector("dialog");
      expect(dlg).not.toBeNull();
      // StrictMode effect replay must not immediately history.back() and close the
      // just-opened viewer (the real gallery symptom was a black flicker).
      expect(historyBackCalls).toBe(0);
      // Keyboard navigation + Escape-equivalent close button stay wired.
      dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight" }));
      const closeBtn = dom.window.document.querySelector('dialog button[aria-label="閉じる"]') as HTMLButtonElement | null;
      expect(closeBtn).not.toBeNull();
      closeBtn!.click();
      await flush(420);
      expect(closed).toBe(1);
      expect(historyBackCalls).toBe(0);
      cleanup();
      await flush(5); // popstate/scroll-restore cleanup must not throw after unmount
      expect(historyBackCalls).toBe(1);
    } finally {
      dom.window.history.back = originalBack;
    }
  });

  test("PhotoGallery click keeps the lightbox open under StrictMode", async () => {
    const { PhotoGallery } = await import("../components/PhotoGallery");
    const originalBack = dom.window.history.back.bind(dom.window.history);
    let historyBackCalls = 0;
    dom.window.history.back = () => {
      historyBackCalls += 1;
      originalBack();
    };
    try {
      const { host, cleanup } = await mount(
        createElement(PhotoGallery, { photos: samplePhotos, layoutType: "grid" })
      );
      const firstTile = host.querySelector('button[aria-label="A"]') as HTMLButtonElement | null;
      expect(firstTile).not.toBeNull();
      firstTile!.click();
      await flush(30);
      expect(dom.window.document.querySelector("dialog")).not.toBeNull();
      expect(historyBackCalls).toBe(0);
      cleanup();
      await flush(5);
      expect(historyBackCalls).toBe(1);
    } finally {
      dom.window.history.back = originalBack;
    }
  });

  test("AdminPage: unauthenticated renders the redirect guard (null), no crash", async () => {
    const Admin = (await import("../pages/admin")).default;
    const { host, cleanup } = await mount(createElement(Admin));
    expect(host.innerHTML).toBe(""); // designed: guard returns null and redirects
    cleanup();
  });

  test("AdminPage: authenticated mounts the full admin UI", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);
      expect(host.textContent).toContain("写真");
      expect(host.textContent).toContain("見せ方");
      expect(host.textContent).toContain("サイト");
      expect(host.textContent).toContain("Library");
      expect(host.textContent).toContain("Import");
      expect(host.textContent).toContain("絞り込み");
      expect(host.querySelector('input[aria-label="写真を検索"]')).toBeNull();
      expect(host.textContent).toContain("3 / 3 photos");
      expect(
        host.querySelector(
          '[aria-label="未入力: 日付なし, 機材なし, 媒体なし"]',
        ),
      ).not.toBeNull();

      buttonWithText(host, "絞り込み").click();
      await flush(30);
      expect(host.querySelector('input[aria-label="写真を検索"]')).not.toBeNull();
      expect(host.textContent).toContain("撮影日なし");
      expect(host.textContent).toContain("機材なし");
      expect(host.textContent).toContain("公開のみ");
      expect(host.textContent).toContain("縦写真");
      expect(host.textContent).toContain("媒体: All");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear(); // don't leak persisted tab/sort into other tests
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: Library keeps filters collapsed and shows batch actions only after selection", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);
      expect(host.querySelector('input[aria-label="写真を検索"]')).toBeNull();
      expect(host.textContent).not.toContain("選択中 1枚");

      const firstTile = host.querySelector(
        'button[aria-label="A"]',
      ) as HTMLButtonElement | null;
      expect(firstTile).not.toBeNull();
      firstTile!.click();
      await flush(30);
      expect(host.textContent).toContain("選択中 1枚");
      expect(host.textContent).toContain("公開");
      expect(host.textContent).toContain("一括編集");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: grouped navigation reaches every tab within two clicks", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);

      expect(host.textContent).toContain("Library");

      buttonWithText(host, "見せ方").click();
      await waitForText(host, "Hero Slides");

      buttonWithText(host, "Series").click();
      await waitForText(host, "New Series");

      buttonWithText(host, "Categories").click();
      await waitForText(host, "New Category");

      buttonWithText(host, "サイト").click();
      await waitForText(host, "Profile Photo");

      buttonWithText(host, "Pricing").click();
      await waitForText(host, "プランを追加");

      buttonWithText(host, "Service").click();
      await waitForText(host, "Service Page");

      buttonWithText(host, "Settings").click();
      await waitForText(host, "Live Preview");

      buttonWithText(host, "はじめに").click();
      await waitForText(host, "公開までにやること");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: unsaved guard appears when switching groups", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);

      buttonWithText(host, "サイト").click();
      await waitForText(host, "Profile Photo");
      const nameInput = inputByLabel(host, "Name (JP)");
      changeInput(nameInput, "Draft Name");
      await flush(80);

      buttonWithText(host, "見せ方").click();
      await flush(80);
      expect(host.textContent).toContain("未保存の変更があります");
      expect(host.textContent).toContain("保存せずにタブを移動しますか？");
      expect(host.textContent).toContain("Profile Photo");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: setup checklist jumps update the active group", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    dom.window.localStorage.setItem("admin:tab", JSON.stringify("setup"));
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);
      await waitForText(host, "公開までにやること");

      setupOpenButton(host, "サイトの名前を入れる").click();
      await waitForText(host, "Live Preview");

      buttonWithText(host, "写真").click();
      await waitForText(host, "Library");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: virtualized keyboard navigation follows selection after resize", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevPhotos = canned["/api/photos"];
    const widthDescriptor = Object.getOwnPropertyDescriptor(
      dom.window.HTMLElement.prototype,
      "clientWidth",
    );
    const heightDescriptor = Object.getOwnPropertyDescriptor(
      dom.window.HTMLElement.prototype,
      "clientHeight",
    );
    let layoutWidth = 1200;
    Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return layoutWidth;
      },
    });
    Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 900;
      },
    });
    const largePhotos = makeLargeAdminPhotos();
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/photos"] = { photos: largePhotos };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        (qc) => qc.setQueryData(["photos", "all"], { photos: largePhotos }),
      );
      const firstTile = host.querySelector(
        'button[aria-label="P000"]',
      ) as HTMLButtonElement | null;
      expect(firstTile).not.toBeNull();
      firstTile!.click();
      await flush(20);
      const initialThumbs = Array.from(host.querySelectorAll("img"))
        .map((img) => img.getAttribute("src") ?? "")
        .filter((src) => src.includes("/api/images/thumbs/"));
      expect(initialThumbs.length).toBeLessThanOrEqual(60);
      expect(initialThumbs.length).toBeGreaterThan(0);

      for (let i = 0; i < 74; i += 1) {
        dom.window.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
          }),
        );
        await flush(1);
      }
      await flush(40);
      expect(host.querySelector('button[aria-label="P444"]')).not.toBeNull();

      layoutWidth = 900;
      dom.window.dispatchEvent(new dom.window.Event("resize"));
      await flush(40);
      dom.window.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "ArrowUp",
          bubbles: true,
        }),
      );
      await flush(40);
      expect(host.querySelector('button[aria-label="P440"]')).not.toBeNull();
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/photos"] = prevPhotos;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
      if (widthDescriptor) {
        Object.defineProperty(
          dom.window.HTMLElement.prototype,
          "clientWidth",
          widthDescriptor,
        );
      } else {
        delete (dom.window.HTMLElement.prototype as { clientWidth?: number })
          .clientWidth;
      }
      if (heightDescriptor) {
        Object.defineProperty(
          dom.window.HTMLElement.prototype,
          "clientHeight",
          heightDescriptor,
        );
      } else {
        delete (dom.window.HTMLElement.prototype as { clientHeight?: number })
          .clientHeight;
      }
    }
  });

  test("AdminPage: inspector surfaces quick edit controls and usage", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevCategories = canned["/api/categories"];
    const prevSeries = canned["/api/admin/series"];
    const prevHero = canned["/api/admin/hero-photos"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/categories"] = {
      categories: [
        { slug: "snap", label: "Street Work", sortOrder: 0 },
        { slug: "portrait", label: "Portraits", sortOrder: 1 },
      ],
    };
    canned["/api/admin/series"] = {
      series: [
        {
          id: 3,
          slug: "indigo",
          title: "Indigo Days",
          subtitle: "",
          statement: "",
          coverPhotoId: 2,
          sortOrder: 0,
          isPublished: true,
        },
      ],
    };
    canned["/api/admin/hero-photos"] = {
      heroPhotos: [{ id: 10, photoId: 2, sortOrder: 0 }],
    };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);
      await flush(100);
      const tile = host.querySelector(
        'button[aria-label="B"]',
      ) as HTMLButtonElement | null;
      expect(tile).not.toBeNull();
      expect(
        host.querySelector('[aria-label="使用状況: Hero 1, Series, Size L"]'),
      ).not.toBeNull();
      tile!.click();
      await flush(60);

      expect(host.textContent).toContain("よく使う");
      expect(host.textContent).toContain("Hero 1");
      expect(host.textContent).toContain("Portraits");
      expect(host.textContent).toContain("Indigo Days");
      expect(host.textContent).toContain("Size L");
      expect(host.querySelector('[aria-label="写真の使用状況"]')).not.toBeNull();
      expect(host.querySelector('[aria-label="クイックカテゴリ"]')).not.toBeNull();
      expect(host.querySelector('[aria-label="クイックシリーズ"]')).not.toBeNull();
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/categories"] = prevCategories;
      if (prevSeries === undefined) delete canned["/api/admin/series"];
      else canned["/api/admin/series"] = prevSeries;
      if (prevHero === undefined) delete canned["/api/admin/hero-photos"];
      else canned["/api/admin/hero-photos"] = prevHero;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: library search matches category labels and series titles", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevCategories = canned["/api/categories"];
    const prevSeries = canned["/api/admin/series"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/categories"] = {
      categories: [
        { slug: "snap", label: "Street Work", sortOrder: 0 },
        { slug: "portrait", label: "Portraits", sortOrder: 1 },
      ],
    };
    canned["/api/admin/series"] = {
      series: [
        {
          id: 3,
          slug: "indigo",
          title: "Indigo Days",
          subtitle: "",
          statement: "",
          coverPhotoId: 2,
          sortOrder: 0,
          isPublished: true,
        },
      ],
    };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);
      buttonWithText(host, "絞り込み").click();
      await flush(30);
      const input = host.querySelector(
        'input[aria-label="写真を検索"]',
      ) as HTMLInputElement | null;
      expect(input).toBeDefined();
      if (!input) throw new Error("Search input was not rendered");
      const setSearch = async (value: string) => {
        const setter = Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, value);
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        await flush(50);
      };
      await setSearch("Street Work");
      expect(host.textContent).toContain("1 / 3 photos");
      expect(host.textContent).toContain("表示条件");
      expect(host.textContent).toContain("検索: Street Work");
      expect(host.textContent).toContain("条件を解除");
      await setSearch("Indigo Days");
      expect(host.textContent).toContain("1 / 3 photos");
      await setSearch("No such classification");
      expect(host.textContent).toContain("0 / 3 photos");
      expect(host.textContent).toContain("No matching photos");
      expect(host.textContent).toContain("Clear filters");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/categories"] = prevCategories;
      if (prevSeries === undefined) delete canned["/api/admin/series"];
      else canned["/api/admin/series"] = prevSeries;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: invalid persisted tab falls back to Library", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    dom.window.localStorage.setItem("admin:tab", JSON.stringify("old-tab"));
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);
      await flush(30);
      expect(host.textContent).toContain("Library");
      expect(host.textContent).toContain("Import");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: stale persisted library filters fall back to all", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    dom.window.sessionStorage.setItem("admin:filterCat", JSON.stringify("ghost"));
    dom.window.sessionStorage.setItem("admin:filterSize", JSON.stringify("XL"));
    dom.window.sessionStorage.setItem(
      "admin:filterPublished",
      JSON.stringify("draft"),
    );
    dom.window.sessionStorage.setItem(
      "admin:filterMedium",
      JSON.stringify("slide"),
    );
    dom.window.sessionStorage.setItem(
      "admin:librarySort",
      JSON.stringify("random-old"),
    );
    dom.window.sessionStorage.setItem("admin:thumbSize", JSON.stringify(9999));
    dom.window.sessionStorage.setItem(
      "admin:uploadMedium",
      JSON.stringify("slide"),
    );
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);
      await flush(80);
      expect(host.textContent).toContain("Library");
      expect(dom.window.sessionStorage.getItem("admin:filterCat")).toBe(
        JSON.stringify("all"),
      );
      expect(dom.window.sessionStorage.getItem("admin:filterSize")).toBe(
        JSON.stringify("all"),
      );
      expect(dom.window.sessionStorage.getItem("admin:filterPublished")).toBe(
        JSON.stringify("all"),
      );
      expect(dom.window.sessionStorage.getItem("admin:filterMedium")).toBe(
        JSON.stringify("all"),
      );
      expect(dom.window.sessionStorage.getItem("admin:librarySort")).toBe(
        JSON.stringify("manual"),
      );
      expect(dom.window.sessionStorage.getItem("admin:thumbSize")).toBe(
        JSON.stringify(300),
      );
      expect(dom.window.sessionStorage.getItem("admin:uploadMedium")).toBe(
        JSON.stringify("digital"),
      );
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: smart album modal includes medium and missing metadata conditions", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);
      buttonWithText(host, "絞り込み").click();
      await flush(30);
      const albumButton = Array.from(host.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("アルバム"),
      ) as HTMLButtonElement | undefined;
      expect(albumButton).toBeDefined();
      albumButton!.click();
      await flush(30);
      expect(dom.window.document.body.textContent).toContain("媒体");
      expect(dom.window.document.body.textContent).toContain("媒体なし");
      expect(dom.window.document.body.textContent).toContain("未入力");
      expect(dom.window.document.body.textContent).toContain("日付");
      expect(dom.window.document.body.textContent).toContain("機材");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: saved smart albums show condition labels", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevSettings = canned["/api/settings"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/settings"] = {
      smartAlbums: JSON.stringify([
        {
          id: "review",
          name: "Needs review",
          cond: {
            medium: "film",
            missingShotAt: true,
            missingCapture: true,
            recent: "7",
          },
        },
      ]),
    };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), seedAdminPhotos);
      buttonWithText(host, "絞り込み").click();
      await flush(30);
      expect(host.textContent).toContain("Needs review");
      expect(host.textContent).toContain("Film");
      expect(host.textContent).toContain("撮影日なし");
      expect(host.textContent).toContain("機材なし");
      expect(host.textContent).toContain("+1");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/settings"] = prevSettings;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage Hero tab ignores public hero cache shape", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevAdminHero = canned["/api/admin/hero-photos"];
    const prevPublicHero = canned["/api/hero-photos"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/admin/hero-photos"] = { heroPhotos: [{ photoId: 1, sortOrder: 0 }] };
    canned["/api/hero-photos"] = { heroPhotos: [samplePhotos[0]] };
    dom.window.localStorage.setItem("admin:tab", JSON.stringify("hero"));
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        (qc) => qc.setQueryData(["hero-photos"], { heroPhotos: [samplePhotos[0]] })
      );
      buttonWithText(host, "Hero").click();
      await flush(500);

      expect(host.textContent).toContain("Hero Slides");
      expect(host.textContent).not.toContain("削除済み");
      expect(host.querySelector('button[aria-label="ヒーローから削除"]')).not.toBeNull();
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      if (prevAdminHero === undefined) delete canned["/api/admin/hero-photos"];
      else canned["/api/admin/hero-photos"] = prevAdminHero;
      canned["/api/hero-photos"] = prevPublicHero;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminLogin marks admin auth fresh after successful login", async () => {
    const prev = canned["/api/admin/login"];
    canned["/api/admin/login"] = { ok: true };
    try {
      const AdminLogin = (await import("../pages/admin-login")).default;
      const { qc, host, cleanup } = await mount(createElement(AdminLogin));
      qc.setQueryData(["admin-me"], { authenticated: false });

      const input = host.querySelector('input[aria-label="パスワード"]') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      input!.value = "correct-password";
      input!.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      const form = host.querySelector("form") as HTMLFormElement | null;
      expect(form).not.toBeNull();
      form!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await flush(30);

      const authState = qc.getQueryData(["admin-me"]) as { authenticated: boolean } | undefined;
      expect(authState).toEqual({ authenticated: true });
      cleanup();
    } finally {
      if (prev === undefined) delete canned["/api/admin/login"];
      else canned["/api/admin/login"] = prev;
    }
  });

  test("Provider applies empty settings and survives a preview-settings message", async () => {
    const { Provider } = await import("../components/provider");
    const { qc, host, cleanup } = await mount(
      createElement(Provider, null, createElement("p", null, "child"))
    );
    expect(host.textContent).toContain("child");
    // Live-preview path (§0 3箇所同期の受信側): a settings payload with new keys
    // must never throw, even with empty / odd values.
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      origin: dom.window.location.origin,
      data: { type: "preview-settings", settings: { themeBg: "#101010", siteName: "Preview Name", topWorksMode: "manual", topWorksIds: "1,2", topWorksColumns: "", gallerySizeScale: "1.4", heroNameSize: "48", bodyLeading: "" } },
    }));
    await flush(10);
    expect((qc.getQueryData(["settings"]) as Record<string, string>).siteName).toBe("Preview Name");
    expect(host.textContent).toContain("child");
    cleanup();
  });

  test("Provider preview message updates React-rendered site labels", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    const { host, cleanup } = await mount(
      createElement(Provider, null, createElement(Layout, null, createElement("p", null, "child")))
    );
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      origin: dom.window.location.origin,
      data: {
        type: "preview-settings",
        settings: {
          navLabelTop: "Preview Studio",
          navLabelGallery: "Portfolio",
          navLabelAbout: "Bio",
          navLabelContact: "Booking",
          footerText: "Preview Footer",
          footerCtaLabel: "Ask for a shoot",
        },
      },
    }));
    await flush(10);
    expect(host.textContent).toContain("Preview Studio");
    expect(host.textContent).toContain("Portfolio");
    expect(host.textContent).toContain("Bio");
    expect(host.textContent).toContain("Booking");
    expect(host.textContent).toContain("Ask for a shoot");
    expect(host.textContent).toContain("Preview Footer");
    cleanup();
  });

  test("Layout keeps the service link quiet and production-only", async () => {
    const Layout = (await import("../components/Layout")).default;
    const prevSettings = canned["/api/settings"];
    try {
      canned["/api/settings"] = {};
      const hidden = await mount(createElement(Layout, null, createElement("p", null, "child")));
      expect(hidden.host.querySelector('a[href="/service"]')).toBeNull();
      hidden.cleanup();

      canned["/api/settings"] = { siteUrl: "https://akieguchi.com" };
      const visible = await mount(createElement(Layout, null, createElement("p", null, "child")));
      expect(visible.host.querySelectorAll('a[href="/service"]').length).toBeGreaterThan(0);
      expect(visible.host.textContent).toContain("Service");
      expect(visible.host.textContent).toContain("Portfolio site");
      visible.cleanup();
    } finally {
      canned["/api/settings"] = prevSettings;
    }
  });

  test("DD grain: preview toggles body[data-texture], Layout must not paint over it", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    const { host, cleanup } = await mount(
      createElement(Provider, null, createElement(Layout, null, createElement("p", null, "child")))
    );
    // Preview path: texture on → data attribute lights the styles.css ::before
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      origin: dom.window.location.origin,
      data: { type: "preview-settings", settings: { bgTexture: "grain-fine", bgTextureOpacity: "0.08" } },
    }));
    await flush(5);
    expect(dom.window.document.body.dataset.texture).toBe("grain-fine");
    // texture off → attribute removed (CSS default = no grain)
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      origin: dom.window.location.origin,
      data: { type: "preview-settings", settings: { bgTexture: "none" } },
    }));
    await flush(5);
    expect(dom.window.document.body.dataset.texture).toBeUndefined();
    // Dark themeBg → blend flips to `screen` (multiply is invisible on dark);
    // clearing themeBg → property removed (CSS default multiply for light bg).
    const rootStyle = dom.window.document.documentElement.style;
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      origin: dom.window.location.origin,
      data: { type: "preview-settings", settings: { themeBg: "#111111" } },
    }));
    await flush(5);
    expect(rootStyle.getPropertyValue("--bg-texture-blend")).toBe("screen");
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      origin: dom.window.location.origin,
      data: { type: "preview-settings", settings: { themeBg: "" } },
    }));
    await flush(5);
    expect(rootStyle.getPropertyValue("--bg-texture-blend")).toBe("");
    // A3: font weights flow through the preview path as CSS vars
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      origin: dom.window.location.origin,
      data: { type: "preview-settings", settings: { heroNameWeight: "500", bodyWeight: "300" } },
    }));
    await flush(5);
    expect(rootStyle.getPropertyValue("--hero-name-weight")).toBe("500");
    expect(rootStyle.getPropertyValue("--body-weight")).toBe("300");
    // photoRevealEffect: non-default variants set body[data-reveal]; fade/"" clear it
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      origin: dom.window.location.origin,
      data: { type: "preview-settings", settings: { photoRevealEffect: "rise" } },
    }));
    await flush(5);
    expect(dom.window.document.body.dataset.reveal).toBe("rise");
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      origin: dom.window.location.origin,
      data: { type: "preview-settings", settings: { photoRevealEffect: "fade" } },
    }));
    await flush(5);
    expect(dom.window.document.body.dataset.reveal).toBeUndefined();
    // The grain lives on body::before at z-index:-1, which paints BELOW in-flow
    // block backgrounds. An opaque bg on Layout's full-screen wrapper hides it
    // entirely (the original bug) — the wrapper must stay background-free.
    const wrapper = host.querySelector('[class*="nav-pos-"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).not.toContain("bg-");
    cleanup();
  });

  test("A6 font pairings reference real font-map entries", async () => {
    // A typo (or a future font-map rename) would silently no-op the preset
    // button: provider falls back to system fonts and nothing errors.
    const { FONT_PAIRINGS, GOOGLE_FONTS_JA, GOOGLE_FONTS_EN } = await import("../components/provider");
    expect(FONT_PAIRINGS.length).toBeGreaterThanOrEqual(4);
    for (const p of FONT_PAIRINGS) {
      expect(GOOGLE_FONTS_JA[p.ja]).toBeDefined();
      expect(GOOGLE_FONTS_EN[p.en]).toBeDefined();
    }
  });

  test("PhotoGallery: empty photos renders null, missing settings keys fall back", async () => {
    const { PhotoGallery } = await import("../components/PhotoGallery");
    const empty = await mount(createElement(PhotoGallery, { photos: [], layoutType: "mosaic" }));
    // photos=[] → component renders nothing, and must not crash.
    empty.cleanup();
    const noDims = await mount(
      createElement(PhotoGallery, {
        photos: [{ id: 9, url: "/api/images/photos/x.jpg", title: "" }],
        layoutType: "unknown-layout-value",
        variant: "top",
      })
    );
    noDims.cleanup();
  });
});
