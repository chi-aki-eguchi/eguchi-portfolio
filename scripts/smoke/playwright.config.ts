import { defineConfig, devices } from "@playwright/test";

// 専用ポート。手動起動中の `bun run dev` (5173/5174等) と衝突しないよう固定する。
const PORT = 4310;

export default defineConfig({
  testDir: "./",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
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
