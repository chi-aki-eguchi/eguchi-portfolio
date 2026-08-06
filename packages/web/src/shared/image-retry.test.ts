import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { withRetryParam, withRetrySrcSet } from "./image-url";

describe("withRetryParam", () => {
  test("leaves the URL alone before the first retry", () => {
    expect(withRetryParam("https://x.test/a.webp?w=800", 0)).toBe(
      "https://x.test/a.webp?w=800",
    );
  });

  test("appends to an existing query string", () => {
    expect(withRetryParam("https://x.test/a.webp?w=800", 2)).toBe(
      "https://x.test/a.webp?w=800&retry=2",
    );
  });

  test("starts a query string when there is none", () => {
    expect(withRetryParam("https://x.test/a.webp", 1)).toBe(
      "https://x.test/a.webp?retry=1",
    );
  });
});

// `src` にだけ印を付けても、`srcSet` があるブラウザはそちらから選ぶ。
// 失敗したのと同じURLを取りに行き、再試行が空振りしていた。
describe("withRetrySrcSet", () => {
  const srcSet =
    "https://x.test/a.webp?w=800&q=84 800w, https://x.test/a.webp?w=1600&q=86 1600w";

  test("leaves the candidates alone before the first retry", () => {
    expect(withRetrySrcSet(srcSet, 0)).toBe(srcSet);
  });

  test("marks every candidate and keeps its width descriptor", () => {
    expect(withRetrySrcSet(srcSet, 3)).toBe(
      "https://x.test/a.webp?w=800&q=84&retry=3 800w, " +
        "https://x.test/a.webp?w=1600&q=86&retry=3 1600w",
    );
  });

  test("handles a single candidate with no descriptor", () => {
    expect(withRetrySrcSet("https://x.test/a.webp", 1)).toBe(
      "https://x.test/a.webp?retry=1",
    );
  });

  test("survives an empty srcSet", () => {
    expect(withRetrySrcSet("", 2)).toBe("");
  });

  test("every candidate differs from the URL that just failed", () => {
    const before = srcSet.split(",").map((c) => c.trim());
    const after = withRetrySrcSet(srcSet, 1)
      .split(",")
      .map((c) => c.trim());
    expect(after).toHaveLength(before.length);
    for (const [i, candidate] of after.entries()) {
      expect(candidate).not.toBe(before[i]);
    }
  });
});

describe("the Lightbox actually uses it", () => {
  const source = readFileSync(
    import.meta.dir + "/../web/components/Lightbox.tsx",
    "utf8",
  );

  test("no srcSet on the retrying image escapes the cache-buster", () => {
    // 再試行する img と、その picture の source。ここが素の srcSet に戻ると
    // 再試行が空振りに戻る。
    expect(source).toContain("withRetrySrcSet(fitSrcSet(photo), retryToken)");
    expect(source.match(/withRetrySrcSet\(/g)).toHaveLength(3);
    expect(source).not.toMatch(/srcSet=\{photoSrcSetFor\(photo, "lightbox"/);
    expect(source).not.toMatch(/srcSet=\{fitSrcSet\(photo\)\}/);
  });

  test("the retry helper is shared, not redefined locally", () => {
    expect(source).not.toContain("const withRetryParam = (");
    expect(source).toContain('from "../lib/picture"');
  });
});
