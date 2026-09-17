// `bun run test:smoke-guard` の入口。いまの Node に合わせて guard/*.test.ts を起動する。
// 型除去の要否・下限・Playwright が読めない Node の判定は node-support.mjs。
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { guardNodeFlags, requireHookConditions } from "./node-support.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const support = guardNodeFlags(process.version, requireHookConditions(process.execPath));
if (!support.ok) {
  console.error(`[smoke-guard] ${support.reason}`);
  process.exit(1);
}
const files = readdirSync(here)
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => relative(process.cwd(), join(here, name)));
console.log(
  `[smoke-guard] Node ${process.version}${support.flags.length ? `（${support.flags.join(" ")} を付ける）` : ""}: ${files.length} ファイル`,
);
// launcher.test.ts と playwright-probes.test.ts はどちらも開発サーバーを起動し、一時フォルダの
// 残りを数え、Vite の依存キャッシュを共有する。ファイルを並行に動かすと互いの実行を数えるので、1つずつ動かす。
const result = spawnSync(process.execPath, [...support.flags, "--test", "--test-concurrency=1", ...files], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
