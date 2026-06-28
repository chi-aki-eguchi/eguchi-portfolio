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
      const { host, cleanup } = await mount(createElement(Admin));
      expect(host.textContent).toContain("Library");
      expect(host.textContent).toContain("Import");
      expect(host.textContent).toContain("日付なし");
      expect(host.textContent).toContain("公開のみ");
      expect(host.textContent).toContain("縦写真");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear(); // don't leak persisted tab/sort into other tests
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
