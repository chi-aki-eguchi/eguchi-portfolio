/**
 * Shared jsdom environment + canned /api responses for render smoke tests.
 * Import (and call setupDom) before importing react-dom in a test file.
 * The canned map can be overridden per test (set before mounting).
 */
import { JSDOM } from "jsdom";

export const samplePhotos = [
  { id: 1, filename: "a.jpg", url: "/api/images/photos/a.jpg", title: "A", meta: "", camera: "X-T5", lens: null, filmType: null, shotAt: "2026-01-01T10:00:00", description: "", category: "snap", displaySize: "M", isPublished: true, seriesId: null, width: 3200, height: 2133, fileHash: "h1", sortOrder: 0, deletedAt: null, createdAt: "2026-01-01T00:00:00Z" },
  { id: 2, filename: "b.jpg", url: "/api/images/photos/b.jpg", title: "B", meta: "", camera: null, lens: null, filmType: "フィルム", shotAt: null, description: "", category: "portrait", displaySize: "L", isPublished: true, seriesId: 3, width: 2133, height: 3200, fileHash: "h2", sortOrder: 1, deletedAt: null, createdAt: "2026-01-02T00:00:00Z" },
  { id: 3, filename: "c.jpg", url: "/api/images/photos/c.jpg", title: "", meta: "", camera: null, lens: null, filmType: null, shotAt: null, description: "", category: "", displaySize: "S", isPublished: true, seriesId: null, width: null, height: null, fileHash: null, sortOrder: 2, deletedAt: null, createdAt: null },
];

// Defaults exercise the "新しいsettingsキーが未設定" path: settings is an empty
// object so every component must survive on its own fallbacks.
export const canned: Record<string, unknown> = {
  "/api/settings": {},
  "/api/photos": { photos: samplePhotos },
  "/api/hero-photos": { heroPhotos: [] },
  "/api/admin/hero-photos": { heroPhotos: [] },
  "/api/series": { series: [] },
  "/api/categories": { categories: [] },
  "/api/pricing": { plans: [] },
  "/api/note-posts": { posts: [] },
  "/api/admin/me": { authenticated: false },
};

let dom: JSDOM | null = null;

export function setupDom(): JSDOM {
  if (dom) return dom;
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  Object.assign(globalThis, {
    window: w,
    document: w.document,
    navigator: w.navigator,
    location: w.location,
    history: w.history,
    sessionStorage: w.sessionStorage,
    localStorage: w.localStorage,
    HTMLElement: w.HTMLElement,
    HTMLInputElement: w.HTMLInputElement,
    HTMLTextAreaElement: w.HTMLTextAreaElement,
    HTMLSelectElement: w.HTMLSelectElement,
    HTMLImageElement: w.HTMLImageElement,
    HTMLDialogElement: w.HTMLDialogElement,
    HTMLDivElement: w.HTMLDivElement,
    Image: w.Image,
    CustomEvent: w.CustomEvent,
    MutationObserver: w.MutationObserver,
    getComputedStyle: w.getComputedStyle,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  });
  // jsdom logs "Not implemented" for scrollTo — silence with a no-op.
  w.scrollTo = (() => {}) as typeof w.scrollTo;
  Object.assign(globalThis, { scrollTo: w.scrollTo });

  if (typeof w.matchMedia !== "function") {
    const mm = () => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false });
    w.matchMedia = mm as unknown as typeof w.matchMedia;
  }
  Object.assign(globalThis, { matchMedia: w.matchMedia.bind(w) });

  if (typeof (globalThis as Record<string, unknown>).ResizeObserver === "undefined") {
    class RO { observe() {} unobserve() {} disconnect() {} }
    Object.assign(globalThis, { ResizeObserver: RO });
    Object.assign(w, { ResizeObserver: RO });
  }
  if (typeof (globalThis as Record<string, unknown>).IntersectionObserver === "undefined") {
    class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } root = null; rootMargin = ""; thresholds = []; }
    Object.assign(globalThis, { IntersectionObserver: IO });
    Object.assign(w, { IntersectionObserver: IO });
  }
  // <dialog> showModal/close shims for jsdom versions without them.
  const dlgProto = w.HTMLDialogElement?.prototype as { showModal?: () => void; close?: () => void; open?: boolean } | undefined;
  if (dlgProto && typeof dlgProto.showModal !== "function") {
    dlgProto.showModal = function (this: { open: boolean }) { this.open = true; };
    dlgProto.close = function (this: { open: boolean }) { this.open = false; };
  }

  // Canned-API fetch: resolves relative /api/* URLs against the jsdom origin.
  globalThis.fetch = (async (input: string | URL | Request) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(raw, "http://localhost/").pathname;
    const hit = canned[path];
    return new Response(JSON.stringify(hit ?? {}), {
      status: hit === undefined ? 404 : 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return dom;
}

/** Mount helper: renders an element into a fresh host and flushes a tick. */
export async function flush(ms = 20) {
  await new Promise((r) => setTimeout(r, ms));
}
