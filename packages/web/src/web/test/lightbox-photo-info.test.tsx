import { describe, expect, test } from "bun:test";
import { flush, setupDom } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { Lightbox } = await import("../components/Lightbox");

async function mountPhotoInfo(filmType: string | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(Lightbox, {
        photos: [
          {
            url: "/api/images/photos/date-label.jpg",
            title: "",
            filmType,
            shotAt: "2026-01-01T00:00:00Z",
          },
        ],
        index: 0,
        onClose() {},
        onPrev() {},
        onNext() {},
      }),
    ),
  );
  await flush(120);
  const infoButton = dom.window.document.querySelector<HTMLButtonElement>(
    'dialog button[aria-label="撮影情報を表示"]',
  );
  if (!infoButton) throw new Error("photo information button did not mount");
  infoButton.click();
  await flush();
  return {
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

describe("Lightbox 撮影情報の日付ラベル", () => {
  test.each([
    ["フィルム", "スキャン"],
    ["デジタル", "撮影"],
    ["", "Date"],
  ] as const)("filmType=%s uses %s", async (filmType, label) => {
    const { cleanup } = await mountPhotoInfo(filmType);
    try {
      const labels = Array.from(
        dom.window.document.querySelectorAll(
          'dialog section[aria-label="撮影情報"] tr > td:first-child',
        ),
      ).map((cell) => cell.textContent);
      expect(labels).toEqual([label]);
    } finally {
      cleanup();
    }
  });
});
