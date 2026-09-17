import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import {
  SMOKE_ADMIN_PASSWORD_ENV,
  SMOKE_BASE_URL,
  SMOKE_EGRESS_PROXY_PORT,
  SMOKE_RUN_DIR,
  SMOKE_STORAGE_PORT,
  SMOKE_WEB_PORT,
} from "./smoke-env.ts";
import { SMOKE_ISOLATION_PATH } from "../../packages/web/vite/smoke-isolation.ts";

// smoke は本番のDB・保存先へつながらない（2026-09-17）。
// - 開発サーバーは isolated-server.ts が起動する。実行ごとの一時SQLite・人工データ・
//   127.0.0.1 の偽ストレージ・テスト専用パスワードだけを使い、リポジトリ直下の
//   `.env` は読まない。接続先を安全と確かめられなければ起動しない。
// - 既に同じポートで動いているサーバーは再利用しない（本番につながっているかも
//   しれない）。終了もさせず、その場で止まる。
// - 起動の合図は API 側の隔離確認（実際に開いている DB ファイルまで見る）。
// - ブラウザから外へ出る通信は fixtures.ts が止め、漏れたものは global-setup.ts の
//   遮断プロキシが止めて記録する。

// 実行ごとに別フォルダへ出す。Playwrightの既定の出力先は実行のたびに消えるため、
// 同じ場所を使うと「たまに落ちる」テストの証拠が次の実行で失われる。
// 全部成功した実行のフォルダは evidence-reporter が最後に消すので、
// 失敗した実行だけが scratch/smoke-evidence/ に残る。
// Playwrightは親プロセスとworkerでこの設定を読み直す。読み直すたびに新しい
// 時刻を使うと、まとめと添付が別フォルダに分かれてしまう。先に決まった値が
// 環境変数として子へ渡るので、既にあればそれを使う。
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const EVIDENCE_DIR =
  process.env.SMOKE_EVIDENCE_DIR ??
  resolve(__dirname, "../../scratch/smoke-evidence", RUN_ID);
process.env.SMOKE_EVIDENCE_DIR = EVIDENCE_DIR;

export default defineConfig({
  testDir: "./",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  outputDir: `${EVIDENCE_DIR}/artifacts`,
  reporter: [["list"], ["./evidence-reporter.ts"]],
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: SMOKE_BASE_URL,
    // fixtures.ts を通らない通信（自分で作った context など）も外へ出さない。
    proxy: {
      server: `http://127.0.0.1:${SMOKE_EGRESS_PROXY_PORT}`,
      bypass: "localhost,127.0.0.1,[::1]",
    },
    trace: "retain-on-failure",
    // アプリは /sw.js を登録する。Service Worker が居ると、そこから出る通信は
    // page.route() を通らず本物のAPIへ抜けてしまう。APIを差し替えるテストが
    // 黙って素通りするため、smokeでは Service Worker を止める。
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "bun --no-env-file scripts/smoke/isolated-server.ts",
    cwd: resolve(__dirname, "../.."),
    url: `${SMOKE_BASE_URL}${SMOKE_ISOLATION_PATH}`,
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    stdout: "pipe",
    stderr: "pipe",
    env: {
      SMOKE_RUN_DIR,
      SMOKE_WEB_PORT: String(SMOKE_WEB_PORT),
      SMOKE_STORAGE_PORT: String(SMOKE_STORAGE_PORT),
      SMOKE_ADMIN_PASSWORD: process.env[SMOKE_ADMIN_PASSWORD_ENV] ?? "",
    },
  },
  projects: [
    {
      name: "desktop",
      // scratch/ は調査用の使い捨てスペック置き場(gitignore対象)。full smoke に紛れ込ませない。
      testIgnore: [/admin-library-remount-fade\.spec\.ts/, /scratch\//],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      testIgnore: [/admin-library-remount-fade\.spec\.ts/, /scratch\//],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      // `mobile` は画面幅を狭めた Desktop Chrome で、タッチ端末ではない。
      // 公開側には (pointer: coarse) でしか効かない当たり判定拡張(.tap-target)と、
      // (hover: hover) でしか出ない写真キャプションがある。狭いだけの環境で測ると、
      // 実機では起きない状態を検査してしまう。ここだけ本物のタッチ profile で回す。
      // 描画エンジンは Chromium のまま（Pixel 7）にして、変数をタッチ有無に絞る。
      name: "mobile-touch",
      testMatch:
        /(public-site|admin-reorder-safety|admin-touch-targets|admin-mobile-input-zoom|admin-page-header-geometry|admin-library-panels|admin-library-contact-sheet|admin-hero-picker|admin-photo-dates)\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "mobile-safari",
      testMatch: /(public-site|admin-library-(remount-fade|panels|contact-sheet)|admin-hero-picker|admin-photo-dates)\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
      },
    },
  ],
});
