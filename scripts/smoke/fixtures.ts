// smoke の全テストに自動で付く通信の番人。spec は "@playwright/test" ではなく
// このファイルから `test` / `expect` を読む。
//
// 以前は helpers.ts の最上位に `test.beforeEach` を置いていたが、Playwright は
// 共有モジュールを worker ごとに1度しか評価しないため、**最初に読み込んだ spec
// ファイルにしか効いていなかった**（2026-09-17 に確認）。fixture の `auto` なら
// 全テストに付く。
//
// ブラウザ context 単位で:
// - この実行の開発サーバー以外（外部サイト、別ポートの localhost）への要求は止めて記録する。
//   Google Fonts だけは空の応答で答える（見た目の検証は既定の代替書体で行う）。
// - 開発サーバーへの書き込み（GET/HEAD/OPTIONS 以外）は、ログインを除いて止めて記録する。
//   テストが書き込みを確かめるときは、spec 側で page.route のモックを置く
//   （page.route は context.route より先に効くので、ここまで来ない）。
// 記録が1件でもあれば、そのテストは失敗する。
import { test as base, expect } from "@playwright/test";
import { SMOKE_ALLOWED_ORIGINS } from "./smoke-env.ts";

export * from "@playwright/test";

export type NetworkGuardRecord = {
  external: string[];
  writes: string[];
  fonts: string[];
};

const LOGIN_PATH = "/api/admin/login";
const FONT_CSS_HOST = "fonts.googleapis.com";
const FONT_FILE_HOST = "fonts.gstatic.com";

export const test = base.extend<{
  networkGuard: NetworkGuardRecord;
  unmockedRequestPolicy: "fail" | "record";
}>({
  // 番人そのものを確かめるテストだけが "record" にする。
  unmockedRequestPolicy: ["fail", { option: true }],
  networkGuard: [
    async ({ context, unmockedRequestPolicy }, use) => {
      const record: NetworkGuardRecord = { external: [], writes: [], fonts: [] };
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        if (!SMOKE_ALLOWED_ORIGINS.has(url.origin)) {
          if (url.hostname === FONT_CSS_HOST) {
            record.fonts.push(url.origin + url.pathname);
            await route.fulfill({ status: 200, contentType: "text/css", body: "" });
            return;
          }
          if (url.hostname === FONT_FILE_HOST) {
            record.fonts.push(url.origin + url.pathname);
            await route.fulfill({ status: 404, body: "" });
            return;
          }
          record.external.push(`${method} ${url.origin}${url.pathname}`);
          await route.abort("blockedbyclient");
          return;
        }
        if (!["GET", "HEAD", "OPTIONS"].includes(method) && url.pathname !== LOGIN_PATH) {
          record.writes.push(`${method} ${url.pathname}`);
          await route.abort("blockedbyclient");
          return;
        }
        await route.fallback();
      });
      await use(record);
      if (unmockedRequestPolicy === "fail") {
        expect(record.external, "モックされていない外部への通信は許さない").toEqual([]);
        expect(record.writes, "ログイン以外の書き込みは spec 側のモックで受ける").toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
