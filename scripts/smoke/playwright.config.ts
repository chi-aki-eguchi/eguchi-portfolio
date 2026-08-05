import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// 専用ポート。手動起動中の `bun run dev` (5173/5174等) と衝突しないよう固定する。
const PORT = 4310;

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
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // アプリは /sw.js を登録する。Service Worker が居ると、そこから出る通信は
    // page.route() を通らず本物のAPIへ抜けてしまう。APIを差し替えるテストが
    // 黙って素通りするため、smokeでは Service Worker を止める。
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `cd ../../packages/web && bunx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "desktop",
      // scratch/ は調査用の使い捨てスペック置き場(gitignore対象)。
      // 本番と同じDBにつながるため、full smoke に紛れ込ませない。
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
        /(public-site|admin-reorder-safety|admin-touch-targets|admin-mobile-input-zoom)\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "mobile-safari",
      testMatch: /admin-library-remount-fade\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
      },
    },
  ],
});
