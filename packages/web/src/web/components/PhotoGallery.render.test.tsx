/**
 * Render smoke test: the public site went fully blank once because a missing
 * React import (useRef) threw at render — build and (the then-broken)
 * typecheck both passed. This mounts the real PhotoGallery in jsdom so any
 * render-time crash in the shared gallery path fails the suite before deploy.
 */
import { test, expect } from "bun:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
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
  const mm = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  // @ts-expect-error jsdom may lack matchMedia depending on version
  dom.window.matchMedia = mm;
  Object.assign(globalThis, { matchMedia: mm });
}
if (typeof globalThis.ResizeObserver === "undefined") {
  class RO { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: RO });
  Object.assign(dom.window, { ResizeObserver: RO });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { PhotoGallery } = await import("./PhotoGallery");

const photos = [
  { id: 1, url: "/api/images/photos/a.jpg", title: "A", displaySize: "M", width: 3200, height: 2133 },
  { id: 2, url: "/api/images/photos/b.jpg", title: "B", displaySize: "L", width: 2133, height: 3200 },
  { id: 3, url: "/api/images/photos/c.jpg", title: "C", displaySize: "S", width: 3200, height: 2133 },
];

test("PhotoGallery renders tiles without crashing (every layout)", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  for (const layout of ["mosaic", "grid", "scroll", "stagger", "editorial", "collage", "clean-grid", "masonry", "large-format"]) {
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(QueryClientProvider, { client: qc },
          createElement(PhotoGallery, { photos, layoutType: layout }))
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

test("tile hover caption renders for titled photos only", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: qc },
        createElement(PhotoGallery, {
          photos: [
            { id: 10, url: "/api/images/photos/t.jpg", title: "Titled" },
            { id: 11, url: "/api/images/photos/u.jpg", title: "" },
          ],
          layoutType: "grid",
        }))
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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: qc },
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
        }))
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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: qc },
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
        }))
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

test("large gallery layouts may upgrade thumbnails to generated medium images", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: qc },
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
        }))
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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: qc },
        createElement(PhotoGallery, {
          photos: [{ id: 21, url: "/api/images/photos/missing.jpg", title: "Gone" }],
          layoutType: "collage",
        }))
    );
  });
  const img = host.querySelector(".photo-card img") as HTMLImageElement;
  expect(img).not.toBeNull();
  await act(async () => { img.dispatchEvent(new dom.window.Event("error", { bubbles: true })); });
  expect(img.closest(".photo-card")?.classList.contains("photo-broken")).toBe(true);
  expect(img.classList.contains("lqip-loaded")).toBe(true);
  await act(async () => {
    root.unmount();
  });
  host.remove();
});
