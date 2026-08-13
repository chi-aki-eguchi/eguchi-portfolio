/**
 * Render smoke test: the public site went fully blank once because a missing
 * React import (useRef) threw at render — build and (the then-broken)
 * typecheck both passed. This mounts the real PhotoGallery in jsdom so any
 * render-time crash in the shared gallery path fails the suite before deploy.
 */
import { test, expect } from "bun:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM(
  "<!doctype html><html><body><div id='root'></div></body></html>",
  {
    url: "http://localhost/",
    pretendToBeVisual: true,
  },
);
// Minimal globals the component tree touches at render time.
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  HTMLImageElement: dom.window.HTMLImageElement,
  HTMLDialogElement: dom.window.HTMLDialogElement,
  Image: dom.window.Image,
  matchMedia: dom.window.matchMedia,
});
if (!dom.window.matchMedia) {
  const mm = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  // @ts-expect-error jsdom may lack matchMedia depending on version
  dom.window.matchMedia = mm;
  Object.assign(globalThis, { matchMedia: mm });
}
if (typeof globalThis.ResizeObserver === "undefined") {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.assign(globalThis, { ResizeObserver: RO });
  Object.assign(dom.window, { ResizeObserver: RO });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } =
  await import("@tanstack/react-query");
const { PhotoGallery, shouldUpgradeGeneratedThumb } =
  await import("./PhotoGallery");

const photos = [
  {
    id: 1,
    url: "/api/images/photos/a.jpg",
    title: "A",
    displaySize: "M",
    width: 3200,
    height: 2133,
  },
  {
    id: 2,
    url: "/api/images/photos/b.jpg",
    title: "B",
    displaySize: "L",
    width: 2133,
    height: 3200,
  },
  {
    id: 3,
    url: "/api/images/photos/c.jpg",
    title: "C",
    displaySize: "S",
    width: 3200,
    height: 2133,
  },
];

function installImagePreloadStub(outcome: "load" | "error") {
  const requestedSources: string[] = [];
  const originalImage = globalThis.Image;

  class PreloadImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    sizes = "";
    srcset = "";
    private value = "";

    set src(value: string) {
      this.value = value;
      requestedSources.push(value);
      queueMicrotask(() => {
        if (outcome === "load") this.onload?.();
        else this.onerror?.();
      });
    }

    get src() {
      return this.value;
    }
  }

  Object.assign(globalThis, {
    Image: PreloadImage as unknown as typeof Image,
  });
  return {
    requestedSources,
    restore: () => Object.assign(globalThis, { Image: originalImage }),
  };
}

test("PhotoGallery renders tiles without crashing (every layout)", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  for (const layout of [
    "mosaic",
    "grid",
    "scroll",
    "stagger",
    "editorial",
    "collage",
    "clean-grid",
    "portrait-grid",
    "landscape-grid",
    "masonry",
    "large-format",
    "justified",
  ]) {
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(PhotoGallery, { photos, layoutType: layout }),
        ),
      );
    });
    const imgs = host.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThanOrEqual(photos.length);
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
});

test("large-format hides a film scan year without leaving a separator", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, {
          photos: [
            {
              id: 101,
              url: "/api/images/photos/film.jpg",
              title: "",
              filmType: "フィルム",
              shotAt: "2026-01-01T00:00:00Z",
            },
            {
              id: 102,
              url: "/api/images/photos/digital.jpg",
              title: "",
              filmType: "デジタル",
              shotAt: "2026-01-01T00:00:00Z",
            },
            {
              id: 103,
              url: "/api/images/photos/unknown.jpg",
              title: "",
              filmType: "",
              shotAt: "2026-01-01T00:00:00Z",
            },
          ],
          layoutType: "large-format",
        }),
      ),
    );
  });
  const captions = Array.from(host.querySelectorAll("figcaption")).map(
    (caption) => caption.textContent,
  );
  expect(captions).toEqual(["Film", "Digital — 2026", "2026"]);
  expect(host.textContent).not.toContain("Film —");
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

test("clean-grid forces the outer tile box to a 1:1 square regardless of source photo ratio", async () => {
  // Regression: imgStyle forced the <img> to 1:1, but the shared tile()
  // helper still set the outer .photo-card box's aspectRatio from the
  // source photo, so non-square photos rendered a non-square box with the
  // image merely cropped inside it (2026-07-09 owner report).
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, { photos, layoutType: "clean-grid" }),
      ),
    );
  });
  const cards = host.querySelectorAll<HTMLElement>(".photo-card");
  expect(cards.length).toBe(photos.length);
  for (const card of cards) {
    expect(card.style.aspectRatio).toBe("1 / 1");
  }
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

test.each([
  ["portrait-grid", "4 / 5"],
  ["landscape-grid", "3 / 2"],
])(
  "%s forces the outer tile box to its fixed ratio regardless of source photo ratio",
  async (layout, ratio) => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, enabled: false } },
    });
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(PhotoGallery, { photos, layoutType: layout }),
        ),
      );
    });
    const cards = host.querySelectorAll<HTMLElement>(".photo-card");
    expect(cards.length).toBe(photos.length);
    for (const card of cards) {
      expect(card.style.aspectRatio).toBe(ratio);
    }
    await act(async () => {
      root.unmount();
    });
    host.remove();
  },
);

test("justified keeps each tile's natural (rotation-aware) ratio and pixel width", async () => {
  // The 12th layout must never crop to a fixed grid ratio: the outer card box
  // carries the photo's own oriented ratio and an explicit px width computed
  // by computeJustifiedRows (unit-tested in lib/justified-layout.test.ts).
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, { photos, layoutType: "justified" }),
      ),
    );
  });
  const cards = host.querySelectorAll<HTMLElement>(".photo-card");
  expect(cards.length).toBe(photos.length);
  const expected = [3200 / 2133, 2133 / 3200, 3200 / 2133];
  cards.forEach((card, i) => {
    // jsdom normalizes the value to "<w> / 1" — parseFloat reads the w part
    expect(Number.parseFloat(card.style.aspectRatio)).toBeCloseTo(
      expected[i],
      3,
    );
    // tile() puts the computed px width on the clickable wrapper around the card
    const wrapper = card.closest("button") as HTMLElement;
    expect(wrapper.style.width.endsWith("px")).toBe(true);
    expect(Number.parseFloat(wrapper.style.width)).toBeGreaterThan(0);
  });
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

test("tile hover caption renders for titled photos only", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, {
          photos: [
            { id: 10, url: "/api/images/photos/t.jpg", title: "Titled" },
            { id: 11, url: "/api/images/photos/u.jpg", title: "" },
          ],
          layoutType: "grid",
        }),
      ),
    );
  });
  const captions = host.querySelectorAll(".tile-caption");
  expect(captions.length).toBe(1);
  expect(captions[0].textContent).toBe("Titled");
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

test("tile images apply focal point as object-position", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, {
          photos: [
            {
              id: 12,
              url: "/api/images/photos/focal.jpg",
              title: "Focal",
              focalX: 25,
              focalY: 80,
            },
          ],
          layoutType: "grid",
        }),
      ),
    );
  });
  const img = host.querySelector(".photo-card img") as HTMLImageElement;
  expect(img).not.toBeNull();
  expect(img.style.objectPosition).toBe("25% 80%");
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

test("normal grids do not expose medium candidates before a density check", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, {
          photos: [
            {
              id: 13,
              url: "/api/images/photos/grid.jpg",
              thumbUrl: "/api/images/thumbs/grid.webp",
              mediumUrl: "/api/images/medium/grid.webp",
              title: "Grid",
            },
          ],
          layoutType: "masonry",
        }),
      ),
    );
  });
  const img = host.querySelector(".photo-card img") as HTMLImageElement;
  expect(img).not.toBeNull();
  expect(img.getAttribute("src")).toBe("/api/images/thumbs/grid.webp");
  expect(img.getAttribute("data-src")).toBeNull();
  expect(img.getAttribute("data-srcset")).toBeNull();
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

test("generated thumbnail density only upgrades materially under-dense DPR3 square crops", () => {
  const squareBox = { clientWidth: 164.5, clientHeight: 164.5 };

  expect(
    shouldUpgradeGeneratedThumb({
      naturalWidth: 640,
      naturalHeight: 272,
      devicePixelRatio: 3,
      ...squareBox,
    }),
  ).toBe(true);
  expect(
    shouldUpgradeGeneratedThumb({
      naturalWidth: 640,
      naturalHeight: 450,
      devicePixelRatio: 3,
      ...squareBox,
    }),
  ).toBe(false);
  expect(
    shouldUpgradeGeneratedThumb({
      naturalWidth: 640,
      naturalHeight: 910,
      devicePixelRatio: 3,
      ...squareBox,
    }),
  ).toBe(false);
  expect(
    shouldUpgradeGeneratedThumb({
      naturalWidth: 640,
      naturalHeight: 272,
      devicePixelRatio: 1,
      ...squareBox,
    }),
  ).toBe(false);
  expect(
    shouldUpgradeGeneratedThumb({
      naturalWidth: 0,
      naturalHeight: 272,
      devicePixelRatio: 3,
      ...squareBox,
    }),
  ).toBe(false);
  expect(
    shouldUpgradeGeneratedThumb({
      naturalWidth: Number.NaN,
      naturalHeight: 272,
      devicePixelRatio: 3,
      ...squareBox,
    }),
  ).toBe(false);
});

test("a lazy normal grid upgrades an under-dense thumbnail when it later loads", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const preloader = installImagePreloadStub("load");
  const devicePixelRatioDescriptor = Object.getOwnPropertyDescriptor(
    dom.window,
    "devicePixelRatio",
  );
  Object.defineProperty(dom.window, "devicePixelRatio", {
    configurable: true,
    value: 3,
  });

  try {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(PhotoGallery, {
            photos: Array.from({ length: 9 }, (_, index) => ({
              id: 16 + index,
              url: `/api/images/photos/pano-${index}.jpg`,
              thumbUrl: `/api/images/thumbs/pano-${index}.webp`,
              mediumUrl: `/api/images/medium/pano-${index}.webp`,
              title: `Pano ${index}`,
            })),
            layoutType: "clean-grid",
          }),
        ),
      );
    });
    const img = host.querySelectorAll<HTMLImageElement>(".photo-card img")[8] as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("data-src")).toBeNull();
    expect(img.getAttribute("data-srcset")).toBeNull();
    Object.defineProperties(img, {
      naturalWidth: { configurable: true, value: 640 },
      naturalHeight: { configurable: true, value: 272 },
      clientWidth: { configurable: true, value: 165 },
      clientHeight: { configurable: true, value: 165 },
    });

    await act(async () => {
      img.dispatchEvent(new dom.window.Event("load", { bubbles: true }));
      await Promise.resolve();
    });

    expect(preloader.requestedSources).toEqual([
      "/api/images/medium/pano-8.webp",
    ]);
    expect(img.getAttribute("src")).toBe("/api/images/medium/pano-8.webp");
    expect(img.closest(".photo-card")?.classList.contains("photo-broken")).toBe(
      false,
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    preloader.restore();
    if (devicePixelRatioDescriptor) {
      Object.defineProperty(
        dom.window,
        "devicePixelRatio",
        devicePixelRatioDescriptor,
      );
    } else {
      delete (dom.window as unknown as Record<string, unknown>)
        .devicePixelRatio;
    }
    host.remove();
  }
});

test("cached generated thumbnails are marked loaded even if the load event was missed", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const imageProto = dom.window.HTMLImageElement.prototype;
  const completeDescriptor = Object.getOwnPropertyDescriptor(
    imageProto,
    "complete",
  );
  const naturalWidthDescriptor = Object.getOwnPropertyDescriptor(
    imageProto,
    "naturalWidth",
  );

  Object.defineProperty(imageProto, "complete", {
    configurable: true,
    get: () => true,
  });
  Object.defineProperty(imageProto, "naturalWidth", {
    configurable: true,
    get: () => 320,
  });
  try {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(PhotoGallery, {
            photos: [
              {
                id: 15,
                url: "/api/images/photos/cached.jpg",
                thumbUrl: "/api/images/thumbs/cached.webp",
                title: "Cached",
              },
            ],
            layoutType: "masonry",
          }),
        ),
      );
    });
    const img = host.querySelector(".photo-card img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.classList.contains("lqip-loaded")).toBe(true);
    expect(img.classList.contains("lqip-loading")).toBe(false);
  } finally {
    await act(async () => {
      root.unmount();
    });
    if (completeDescriptor) {
      Object.defineProperty(imageProto, "complete", completeDescriptor);
    } else {
      delete (imageProto as unknown as Record<string, unknown>).complete;
    }
    if (naturalWidthDescriptor) {
      Object.defineProperty(imageProto, "naturalWidth", naturalWidthDescriptor);
    } else {
      delete (imageProto as unknown as Record<string, unknown>).naturalWidth;
    }
    host.remove();
  }
});

test("cached normal panoramas run the same density check after a missed load event", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const preloader = installImagePreloadStub("load");
  const imageProto = dom.window.HTMLImageElement.prototype;
  const devicePixelRatioDescriptor = Object.getOwnPropertyDescriptor(
    dom.window,
    "devicePixelRatio",
  );
  const descriptors = new Map(
    ["complete", "naturalWidth", "naturalHeight", "clientWidth", "clientHeight"].map(
      (name) => [name, Object.getOwnPropertyDescriptor(imageProto, name)],
    ),
  );

  Object.defineProperties(imageProto, {
    complete: { configurable: true, get: () => true },
    naturalWidth: { configurable: true, get: () => 640 },
    naturalHeight: { configurable: true, get: () => 272 },
    clientWidth: { configurable: true, get: () => 165 },
    clientHeight: { configurable: true, get: () => 165 },
  });
  Object.defineProperty(dom.window, "devicePixelRatio", {
    configurable: true,
    value: 3,
  });

  try {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(PhotoGallery, {
            photos: [
              {
                id: 17,
                url: "/api/images/photos/cached-pano.jpg",
                thumbUrl: "/api/images/thumbs/cached-pano.webp",
                mediumUrl: "/api/images/medium/cached-pano.webp",
                title: "Cached pano",
              },
            ],
            layoutType: "clean-grid",
          }),
        ),
      );
      await Promise.resolve();
    });
    const img = host.querySelector(".photo-card img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(preloader.requestedSources).toEqual([
      "/api/images/medium/cached-pano.webp",
    ]);
    expect(img.getAttribute("src")).toBe(
      "/api/images/medium/cached-pano.webp",
    );
    expect(img.classList.contains("lqip-loaded")).toBe(true);
  } finally {
    await act(async () => {
      root.unmount();
    });
    preloader.restore();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) {
        Object.defineProperty(imageProto, name, descriptor);
      } else {
        delete (imageProto as unknown as Record<string, unknown>)[name];
      }
    }
    if (devicePixelRatioDescriptor) {
      Object.defineProperty(
        dom.window,
        "devicePixelRatio",
        devicePixelRatioDescriptor,
      );
    } else {
      delete (dom.window as unknown as Record<string, unknown>)
        .devicePixelRatio;
    }
    host.remove();
  }
});

test("a failed optional medium upgrade leaves the normal thumbnail intact", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const preloader = installImagePreloadStub("error");
  const devicePixelRatioDescriptor = Object.getOwnPropertyDescriptor(
    dom.window,
    "devicePixelRatio",
  );
  Object.defineProperty(dom.window, "devicePixelRatio", {
    configurable: true,
    value: 3,
  });

  try {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(PhotoGallery, {
            photos: [
              {
                id: 18,
                url: "/api/images/photos/missing-medium-pano.jpg",
                thumbUrl: "/api/images/thumbs/missing-medium-pano.webp",
                mediumUrl: "/api/images/medium/missing-medium-pano.webp",
                title: "Fallback",
              },
            ],
            layoutType: "clean-grid",
          }),
        ),
      );
    });
    const img = host.querySelector(".photo-card img") as HTMLImageElement;
    expect(img).not.toBeNull();
    Object.defineProperties(img, {
      naturalWidth: { configurable: true, value: 640 },
      naturalHeight: { configurable: true, value: 272 },
      clientWidth: { configurable: true, value: 165 },
      clientHeight: { configurable: true, value: 165 },
    });

    await act(async () => {
      img.dispatchEvent(new dom.window.Event("load", { bubbles: true }));
      await Promise.resolve();
    });

    expect(preloader.requestedSources).toEqual([
      "/api/images/medium/missing-medium-pano.webp",
    ]);
    expect(img.getAttribute("src")).toBe(
      "/api/images/thumbs/missing-medium-pano.webp",
    );
    expect(img.closest(".photo-card")?.classList.contains("photo-broken")).toBe(
      false,
    );
    expect(img.classList.contains("lqip-loaded")).toBe(true);
  } finally {
    await act(async () => {
      root.unmount();
    });
    preloader.restore();
    if (devicePixelRatioDescriptor) {
      Object.defineProperty(
        dom.window,
        "devicePixelRatio",
        devicePixelRatioDescriptor,
      );
    } else {
      delete (dom.window as unknown as Record<string, unknown>)
        .devicePixelRatio;
    }
    host.remove();
  }
});

test("a failed no-thumbnail proxy upgrade keeps the existing LQIP error behavior", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const preloader = installImagePreloadStub("error");

  try {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(PhotoGallery, {
            photos: Array.from({ length: 9 }, (_, index) => ({
              id: 30 + index,
              url: `/api/images/photos/no-thumb-${index}.jpg`,
              title: `No thumbnail ${index}`,
            })),
            layoutType: "clean-grid",
          }),
        ),
      );
    });
    const img = host.querySelectorAll<HTMLImageElement>(".photo-card img")[8] as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("loading")).toBe("lazy");
    const upgradeSource = img.getAttribute("data-src");
    expect(upgradeSource).not.toBeNull();
    if (!upgradeSource) throw new Error("lazy no-thumbnail image lost data-src");

    await act(async () => {
      img.dispatchEvent(new dom.window.Event("load", { bubbles: true }));
      await Promise.resolve();
    });

    expect(preloader.requestedSources).toEqual([upgradeSource]);
    expect(img.classList.contains("lqip-loading")).toBe(true);
    expect(img.closest(".photo-card")?.classList.contains("photo-broken")).toBe(
      false,
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    preloader.restore();
    host.remove();
  }
});

test("large gallery layouts may upgrade thumbnails to generated medium images", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, {
          photos: [
            {
              id: 14,
              url: "/api/images/photos/large.jpg",
              thumbUrl: "/api/images/thumbs/large.webp",
              mediumUrl: "/api/images/medium/large.webp",
              title: "Large",
            },
          ],
          layoutType: "large-format",
        }),
      ),
    );
  });
  const img = host.querySelector(".photo-card img") as HTMLImageElement;
  expect(img).not.toBeNull();
  expect(img.getAttribute("src")).toBe("/api/images/thumbs/large.webp");
  expect(img.getAttribute("data-src")).toBe("/api/images/medium/large.webp");
  expect(img.getAttribute("data-srcset")).toBeNull();
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

test("a failed image marks its card as photo-broken (quiet placeholder)", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, {
          photos: [
            { id: 21, url: "/api/images/photos/missing.jpg", title: "Gone" },
          ],
          layoutType: "collage",
        }),
      ),
    );
  });
  const img = host.querySelector(".photo-card img") as HTMLImageElement;
  expect(img).not.toBeNull();
  await act(async () => {
    img.dispatchEvent(new dom.window.Event("error", { bubbles: true }));
  });
  expect(img.closest(".photo-card")?.classList.contains("photo-broken")).toBe(
    true,
  );
  expect(img.classList.contains("lqip-loaded")).toBe(true);
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

// --- 列数が届かない問題 (2026-08-07 owner report) ---------------------------
// Measured on the live gallery that day: galleryColumns=8, gallerySizeScale=
// 0.95, page shell 928px wide, 4 columns rendered. The count is floor(width /
// minTile), so 5–8 were unreachable and the slider looked broken. The grid now
// widens its own frame to fit the request. These tests fail if that stops
// happening, or if it starts happening to sites that never touched the key
// (which would silently rewiden every existing gallery).

const { galleryFrameWidth } = await import("./PhotoGallery");

// 8 columns at the owner's photo size: 8 × (210 × 0.95) = 1596, +1px guard.
const OWNER = { requestedColumns: 8, minTile: 210 * 0.95, isMobile: false };

test("the frame grows to fit the requested columns when the shell is too narrow", () => {
  expect(
    galleryFrameWidth({ ...OWNER, natural: 928, available: 1836 }),
  ).toBe(1597);
});

test("the frame never exceeds the room the page actually has", () => {
  // The site's fixed sidebar pushes the content off-centre, so the room is not
  // the viewport width. Overflowing it would add a horizontal scrollbar.
  expect(galleryFrameWidth({ ...OWNER, natural: 896, available: 1152 })).toBe(
    1152,
  );
});

test("a request that already fits leaves the page width alone", () => {
  // 3 × 210 = 630px, well inside the shell — nothing to widen.
  expect(
    galleryFrameWidth({
      requestedColumns: 3,
      minTile: 210,
      isMobile: false,
      natural: 928,
      available: 1836,
    }),
  ).toBe(0);
});

test("an unset column key leaves the page width alone", () => {
  expect(
    galleryFrameWidth({ ...OWNER, requestedColumns: NaN, natural: 928, available: 1836 }),
  ).toBe(0);
});

test("phones are never widened", () => {
  // Already full-bleed there; a wider frame would only add sideways scroll.
  expect(
    galleryFrameWidth({ ...OWNER, isMobile: true, natural: 360, available: 360 }),
  ).toBe(0);
});

test("a shell wider than the room is left as-is rather than narrowed", () => {
  expect(
    galleryFrameWidth({ ...OWNER, natural: 1400, available: 1000 }),
  ).toBe(0);
});

test("the widened frame reaches the DOM and stays centred on the page shell", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  qc.setQueryData(["settings"], {
    galleryColumns: "8",
    gallerySizeScale: "0.95",
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  // jsdom does no layout, so hand the component the geometry it measures:
  // a 928px shell centred at x=950 inside an 1884px viewport.
  Object.defineProperty(host, "clientWidth", { value: 928, configurable: true });
  host.getBoundingClientRect = () =>
    ({ left: 486, right: 1414, width: 928 }) as DOMRect;
  Object.defineProperty(dom.window.document.documentElement, "clientWidth", {
    value: 1884,
    configurable: true,
  });
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, { photos, layoutType: "clean-grid" }),
      ),
    );
  });
  const grid = host.querySelector<HTMLElement>(".filter-grid-animated");
  expect(grid).not.toBeNull();
  expect(grid!.style.width).toBe("1597px");
  // Half the overhang pulled off each side — jsdom reserialises the calc(),
  // so assert the parts rather than the exact spelling.
  expect(grid!.style.marginInline).toContain("100% - 1597px");
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

test("a site that never set the column key renders no frame at all", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  qc.setQueryData(["settings"], { galleryLayout: "clean-grid" });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  Object.defineProperty(host, "clientWidth", { value: 928, configurable: true });
  host.getBoundingClientRect = () =>
    ({ left: 486, right: 1414, width: 928 }) as DOMRect;
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, { photos, layoutType: "clean-grid" }),
      ),
    );
  });
  const grid = host.querySelector<HTMLElement>(".filter-grid-animated");
  expect(grid!.getAttribute("style")).toBeNull();
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

test("a gap above the old clamp actually reaches the grid", async () => {
  // 余白倍率 offered up to 5.0 while this clamped at 3.0, so everything past 3
  // was discarded in silence. clean-grid's gap is round(2 × gapScale): 8 at the
  // requested 4.0, but 6 if the old ceiling is ever put back.
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  qc.setQueryData(["settings"], { galleryGapScale: "4" });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PhotoGallery, { photos, layoutType: "clean-grid" }),
      ),
    );
  });
  const grid = host.querySelector<HTMLElement>(".filter-grid-animated > div");
  expect(grid!.style.gap).toBe("8px");
  await act(async () => {
    root.unmount();
  });
  host.remove();
});
