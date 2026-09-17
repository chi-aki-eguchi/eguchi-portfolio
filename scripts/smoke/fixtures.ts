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
//
// page.request / context.request / request fixture は Node から直接送り、上の route を
// 通らない。ここで塞ぎ、API を読むときは `api`（smoke-api.ts）だけを使う。
import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { relative } from "node:path";
import { SMOKE_ALLOWED_ORIGINS, SMOKE_BASE_URL, SMOKE_EGRESS_PROXY_PORT } from "./smoke-env.ts";
import { smokeApi, type SmokeApi } from "./smoke-api.ts";

// `export *` にすると、route を通らない `request` / `chromium` なども spec から読めてしまう。
export type { APIResponse, Locator, Page, Route, TestInfo } from "@playwright/test";
export type { SmokeApi };

export type NetworkGuardRecord = {
  external: string[];
  writes: string[];
  fonts: string[];
};

const LOGIN_PATH = "/api/admin/login";
const FONT_CSS_HOST = "fonts.googleapis.com";
const FONT_FILE_HOST = "fonts.gstatic.com";
const DIRECT_REQUEST_ERROR =
  "[smoke] page.request / context.request / request fixture は直接使わない（fixtures.ts の route を通らない）。API は `api` fixture で読む";

/** 遮断プロキシに、いま実行中のテストを伝える（空文字は「テスト外」）。 */
async function markRunningTest(label: string): Promise<void> {
  const marked = await fetch(
    `http://127.0.0.1:${SMOKE_EGRESS_PROXY_PORT}/__smoke/label?value=${encodeURIComponent(label)}`,
  ).catch(() => null);
  if (!marked?.ok) throw new Error("[smoke] 外部通信の遮断プロキシに届かない（global-setup.ts が立てる）");
}

/** 塞ぐ前に取っておいた、context ごとの本来の fetch（`api` だけが使う）。 */
const directFetch = new WeakMap<APIRequestContext, APIRequestContext["fetch"]>();

export const test = base.extend<{
  egressLabel: void;
  networkGuard: NetworkGuardRecord;
  unmockedRequestPolicy: "fail" | "record";
  api: SmokeApi;
}>({
  // 番人そのものを確かめるテストだけが "record" にする。
  unmockedRequestPolicy: ["fail", { option: true }],
  // 遮断プロキシの記録に、どのテストの試行かを残す（global-setup.ts が集計する）。
  // ブラウザ context を作る前に付け、context を閉じた後に外す。成功・失敗・時間切れの
  // どれでも外すので、テストの前後・テストの間の試行は「テスト外」として想定外に数えられる。
  egressLabel: [
    async ({ playwright: _worker }, use, testInfo) => {
      await markRunningTest(
        [testInfo.project.name, relative(__dirname, testInfo.file), testInfo.title].join(" › "),
      );
      try {
        await use();
      } finally {
        await markRunningTest("");
      }
    },
    { auto: true },
  ],
  // egressLabel の後に context を準備する（引数の順に準備され、逆の順に片付く）。
  networkGuard: [
    async ({ egressLabel: _running, context, unmockedRequestPolicy }, use) => {
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
      // page.request は context.request と同じもの。get/post/… はどれも fetch を通るので、
      // ここを塞げば直接の送信は送る前に失敗する。
      const direct = context.request;
      directFetch.set(direct, direct.fetch.bind(direct));
      direct.fetch = () => Promise.reject(new Error(DIRECT_REQUEST_ERROR));
      await use(record);
      if (unmockedRequestPolicy === "fail") {
        expect(record.external, "モックされていない外部への通信は許さない").toEqual([]);
        expect(record.writes, "ログイン以外の書き込みは spec 側のモックで受ける").toEqual([]);
      }
    },
    { auto: true },
  ],
  // 開発サーバーの API を読む唯一の経路。ブラウザと同じ Cookie を使う。
  api: async ({ networkGuard: _guard, context }, use) => {
    const send = directFetch.get(context.request);
    if (!send) throw new Error("[smoke] networkGuard が準備されていない");
    await use(smokeApi(send, SMOKE_BASE_URL));
  },
  // 組み込みの request fixture は context と別の、制限のない要求クライアント。
  request: async ({ playwright: _worker }, _use) => {
    throw new Error(DIRECT_REQUEST_ERROR);
  },
});

export { expect };
