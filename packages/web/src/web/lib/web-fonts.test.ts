import { afterEach, expect, test } from "bun:test";
import { setupDom } from "../test/jsdom-setup";

setupDom();
const { waitForWebFonts } = await import("./web-fonts");

afterEach(() => {
  document.body.style.fontWeight = "";
  document.documentElement.style.removeProperty("--font-ja");
});

// 2026-10-02: 太さを書かずに読むと 400 として読まれ、本文が 500 のサイトで使わない 400 の
// 文字の束を余分に読み、500 の到着を待たずに幅を測っていた。
test("書体は実際に描く太さで読む", async () => {
  const asked: string[] = [];
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load: (font: string) => (asked.push(font), Promise.resolve([])), ready: Promise.resolve() },
  });
  document.documentElement.style.setProperty("--font-ja", '"Shippori Mincho", serif');
  document.body.style.fontWeight = "500";
  await waitForWebFonts(200);
  expect(asked).toContain('500 16px "Shippori Mincho"');
  expect(asked.some((f) => f.startsWith("16px") || f.startsWith("400 "))).toBe(false);
});
