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
const { PhotoGallery } = await import("./PhotoGallery");

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

test("generated thumbnails do not auto-upgrade normal gallery grids", async () => {
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
