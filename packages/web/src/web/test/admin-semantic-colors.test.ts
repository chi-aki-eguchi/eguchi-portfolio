import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";

const pageDirectory = new URL("../pages/", import.meta.url);
const componentDirectory = new URL("../components/", import.meta.url);
const adminSourceFiles = [
  ...(await readdir(pageDirectory))
    .filter((name) => /^admin.*\.tsx$/.test(name) && !name.includes(".test."))
    .map((name) => new URL(name, pageDirectory)),
  ...(await readdir(componentDirectory))
    .filter((name) => /^Admin.*\.tsx$/.test(name) && !name.includes(".test."))
    .map((name) => new URL(name, componentDirectory)),
];
const adminSources = await Promise.all(
  adminSourceFiles.map(async (path) => ({
    path: path.pathname,
    source: await Bun.file(path).text(),
  })),
);
const styles = await Bun.file(
  new URL("../styles.css", import.meta.url),
).text();

describe("Admin semantic color tokens", () => {
  test("管理画面の製品UIは旧Tailwind意味色と応急処置の直書きを使わない", () => {
    for (const { path, source } of adminSources) {
      expect(source, path).not.toMatch(
        /(?:text|bg|border|fill)-(?:red|amber|emerald|green|yellow|rose)-/,
      );
      expect(source, path).not.toContain("ring-[#aaa]");
      expect(source, path).not.toContain("bg-[#ddd]");
      expect(source, path).not.toContain(
        "shadow-[0_0_10px_rgba(255,255,255,0.75)]",
      );
    }
  });

  test("旧色クラスの部分一致CSSを撤去し、4つの意味色を個別に持つ", () => {
    expect(styles).not.toContain('[class*="bg-red"]');
    expect(styles).not.toContain('[class*="text-red"]');
    expect(styles).not.toContain('[class*="bg-emerald"]');
    expect(styles).not.toContain('[class*="bg-amber"]');
    for (const token of [
      "--admin-danger",
      "--admin-warning",
      "--admin-success",
      "--admin-info",
    ]) {
      expect(styles).toContain(`var(${token})`);
    }
  });
});
