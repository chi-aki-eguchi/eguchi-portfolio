/**
 * 写真ビューアを閉じたあと、フォーカスがタイルへ戻ることの回帰テスト
 * （backlog B-20 / 2026-08-05 実測）。
 *
 * ネイティブ <dialog> は showModal 前にフォーカスしていた要素へ戻す仕様だが、
 * 実測では閉じたあと document.activeElement が BODY になっていた。閉じている
 * 間にグリッドが描き直され、元のボタン要素が別物に入れ替わっているため。
 * キーボードで見ている人は、閉じるたびにページ先頭からタブし直しになる。
 */
import { test, expect, describe } from "bun:test";
import { setupDom, samplePhotos, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { PhotoGallery } = await import("../components/PhotoGallery");

const doc = dom.window.document;

async function mountGallery() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(PhotoGallery, {
        photos: samplePhotos as never,
        layoutType: "clean-grid",
      }) as never,
    ),
  );
  await flush(80);
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

describe("写真ビューアを閉じたあとのフォーカス", () => {
  test("開いたタイルへ戻る", async () => {
    const { host, cleanup } = await mountGallery();
    try {
      const tiles = host.querySelectorAll<HTMLButtonElement>("[data-photo-tile]");
      expect(tiles.length).toBeGreaterThan(1);
      const opener = tiles[1];
      const openerId = opener.getAttribute("data-photo-tile");

      opener.focus();
      opener.click();
      await flush(60);
      expect(doc.querySelector("dialog")).not.toBeNull();

      // 閉じる（ビューアの閉じるボタン）
      const closeBtn = doc.querySelector<HTMLButtonElement>(
        'dialog button[aria-label="閉じる"]',
      );
      expect(closeBtn).not.toBeNull();
      closeBtn!.click();
      await flush(500); // 閉じるアニメーション 370ms ぶん待つ

      expect(doc.querySelector("dialog")).toBeNull();
      const active = doc.activeElement as HTMLElement | null;
      expect(active?.tagName).toBe("BUTTON");
      expect(active?.getAttribute("data-photo-tile")).toBe(openerId);
    } finally {
      cleanup();
    }
  });

  test("矢印で送ったときは、最後に見ていた写真のタイルへ戻る", async () => {
    const { host, cleanup } = await mountGallery();
    try {
      const tiles = host.querySelectorAll<HTMLButtonElement>("[data-photo-tile]");
      tiles[0].focus();
      tiles[0].click();
      await flush(60);

      const nextBtn = doc.querySelector<HTMLButtonElement>(
        'dialog button[aria-label="次の写真"]',
      );
      expect(nextBtn).not.toBeNull();
      nextBtn!.click();
      await flush(60);

      doc
        .querySelector<HTMLButtonElement>('dialog button[aria-label="閉じる"]')!
        .click();
      await flush(500);

      const active = doc.activeElement as HTMLElement | null;
      // 開いたのは1枚目、送ったので2枚目で閉じている
      expect(active?.getAttribute("data-photo-tile")).toBe(
        String(samplePhotos[1].id),
      );
    } finally {
      cleanup();
    }
  });
});
