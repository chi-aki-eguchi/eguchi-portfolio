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

const { createElement } = await import("react");
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
  for (const layout of ["mosaic", "grid", "scroll", "stagger", "editorial", "collage"]) {
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      createElement(QueryClientProvider, { client: qc },
        createElement(PhotoGallery, { photos, layoutType: layout }))
    );
    // flush React's concurrent render
    await new Promise((r) => setTimeout(r, 0));
    const imgs = host.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThanOrEqual(photos.length);
    root.unmount();
    host.remove();
  }
});

test("tile hover caption renders for titled photos only", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
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
  await new Promise((r) => setTimeout(r, 0));
  const captions = host.querySelectorAll(".tile-caption");
  expect(captions.length).toBe(1);
  expect(captions[0].textContent).toBe("Titled");
  root.unmount();
  host.remove();
});

test("a failed image marks its card as photo-broken (quiet placeholder)", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(QueryClientProvider, { client: qc },
      createElement(PhotoGallery, {
        photos: [{ id: 21, url: "/api/images/photos/missing.jpg", title: "Gone" }],
        layoutType: "collage", // the production layout — error path must hold inside the framed card too
      }))
  );
  await new Promise((r) => setTimeout(r, 0));
  const img = host.querySelector(".photo-card img") as HTMLImageElement;
  expect(img).not.toBeNull();
  img.dispatchEvent(new dom.window.Event("error"));
  await new Promise((r) => setTimeout(r, 0));
  expect(img.closest(".photo-card")?.classList.contains("photo-broken")).toBe(true);
  expect(img.classList.contains("lqip-loaded")).toBe(true); // blur is released, not stuck
  root.unmount();
  host.remove();
});
