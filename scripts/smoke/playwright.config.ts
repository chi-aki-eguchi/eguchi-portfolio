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
      testIgnore: /admin-library-remount-fade\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      testIgnore: /admin-library-remount-fade\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
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
