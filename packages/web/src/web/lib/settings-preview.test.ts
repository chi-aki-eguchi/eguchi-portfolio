import { describe, expect, test } from "bun:test";
import { JS_PREVIEW_KEYS, SETTINGS_PREVIEW_KEYS, makeSettingsPreviewPayload } from "./settings-preview";

describe("settings preview registry", () => {
  test("has no duplicate preview keys", () => {
    expect(new Set(SETTINGS_PREVIEW_KEYS).size).toBe(SETTINGS_PREVIEW_KEYS.length);
  });

  test("keeps React-driven preview keys inside the sent payload", () => {
    const previewKeys = new Set<string>(SETTINGS_PREVIEW_KEYS);
    for (const key of JS_PREVIEW_KEYS) expect(previewKeys.has(key)).toBe(true);
  });

  test("builds a complete string payload with empty defaults", () => {
    const payload = makeSettingsPreviewPayload({ themeBg: "#111111", heroMode: "single" });
    expect(payload.themeBg).toBe("#111111");
    expect(payload.heroMode).toBe("single");
    expect(payload.themeText).toBe("");
    expect(Object.keys(payload)).toHaveLength(SETTINGS_PREVIEW_KEYS.length);
  });
});

// §0 の「settings 4箇所同期」のうち、台帳 → API default の片方向をソースから
// 機械検証する。台帳にキーを足して API の GET /settings を忘れると、保存後の
// 再取得でそのキーが undefined になり、プレビューと公開表示が食い違う。
test("every ledger key has a default in API GET /settings", async () => {
  const src = await Bun.file(new URL("../../api/index.ts", import.meta.url).pathname).text();
  const start = src.indexOf(".get('/settings'");
  const end = src.indexOf(".get('/categories'");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const block = src.slice(start, end);
  // Response keys look like `      keyName: settings.keyName ?? ...` (some
  // without the space after the colon).
  const apiKeys = new Set([...block.matchAll(/^\s{6}([a-zA-Z0-9]+):/gm)].map((m) => m[1]));
  const missing = SETTINGS_PREVIEW_KEYS.filter((k) => !apiKeys.has(k));
  expect(missing).toEqual([]);
});
