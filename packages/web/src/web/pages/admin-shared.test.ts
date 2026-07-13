import { afterEach, describe, expect, test } from "bun:test";
import { postAdminSettings } from "./admin-shared";

// codex-reviewer P1指摘(2026-07-13統合レビュー): APIはignoredKeysを返すが、
// 呼び出し元がassertOk()だけ見てres.json()を読まないと、台帳から漏れた
// 正当キーが黙って保存されないまま「保存成功」表示になってしまう。
// postAdminSettings()が実際のPOSTレスポンスからその分岐を正しく拾うことを確認する。

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockSettingsResponse(body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("postAdminSettings", () => {
  test("resolves when nothing was ignored", async () => {
    mockSettingsResponse({ ok: true, ignoredKeys: [] });
    await expect(
      postAdminSettings({ siteName: "Akiko Eguchi" }),
    ).resolves.toBeUndefined();
  });

  test("resolves when ignoredKeys is absent from the response", async () => {
    mockSettingsResponse({ ok: true });
    await expect(
      postAdminSettings({ siteName: "Akiko Eguchi" }),
    ).resolves.toBeUndefined();
  });

  test("throws surfacing the ignored key names when the API dropped a key", async () => {
    mockSettingsResponse({ ok: true, ignoredKeys: ["totallyUnknownKey"] });
    await expect(
      postAdminSettings({
        siteName: "Akiko Eguchi",
        totallyUnknownKey: "should have saved but didn't",
      }),
    ).rejects.toThrow("totallyUnknownKey");
  });

  test("throws on a non-2xx response same as before (assertOk still applies)", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "設定値が大きすぎます。" }), {
        status: 413,
      })) as unknown as typeof fetch;
    await expect(
      postAdminSettings({ siteName: "x".repeat(200) }),
    ).rejects.toThrow("413");
  });
});
