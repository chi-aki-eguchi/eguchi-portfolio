// guard/playwright-probes.test.ts だけが使う設定。本物の fixtures.ts・global-setup.ts・
// 隔離サーバー（isolated-server.ts）のまま、このフォルダの *.probe.ts を desktop で1回動かす。
// 通常の smoke（playwright.config.ts の testMatch は *.spec.ts）には含まれない。
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import smoke from "../../playwright.config.ts";

const desktop = smoke.projects?.find((project) => project.name === "desktop");
if (!desktop) throw new Error("playwright.config.ts に desktop が無い");

export default defineConfig({
  ...smoke,
  testDir: __dirname,
  testMatch: /\.probe\.ts$/,
  // 相対パスはこの設定ファイルから解決されるので、本物の場所を指す。
  globalSetup: resolve(__dirname, "../../global-setup.ts"),
  reporter: [["list"], [resolve(__dirname, "../../evidence-reporter.ts")]],
  projects: [{ name: "desktop", use: desktop.use }],
});
