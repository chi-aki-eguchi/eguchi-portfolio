import { describe, expect, test } from "bun:test";

const pageSources = await Promise.all(
  ["../pages/admin.tsx", "../pages/admin-tabs.tsx"].map((path) =>
    Bun.file(new URL(path, import.meta.url)).text(),
  ),
);
const styles = await Bun.file(
  new URL("../styles.css", import.meta.url),
).text();

describe("Admin semantic color tokens", () => {
  test("管理画面の製品UIは旧Tailwind意味色と応急処置の直書きを使わない", () => {
    const source = pageSources.join("\n");

    expect(source).not.toMatch(
      /(?:text|bg|border|fill)-(?:red|amber|emerald|green|yellow|rose)-/,
    );
    expect(source).not.toContain("ring-[#aaa]");
    expect(source).not.toContain("bg-[#ddd]");
    expect(source).not.toContain(
      "shadow-[0_0_10px_rgba(255,255,255,0.75)]",
    );
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
