#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function checkWebBuild(repo = REPO) {
  const dist = resolve(repo, "packages/web/dist");
  const html = readFileSync(resolve(dist, "index.html"), "utf8");
  const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    .map((match) => decodeURIComponent(new URL(match[1], "https://build.invalid").pathname));
  if (!assets.some((asset) => /\.m?js$/.test(asset))) {
    throw new Error("dist/index.html にビルド済み JavaScript がありません。");
  }
  for (const asset of new Set(assets)) {
    const file = resolve(dist, `.${asset}`);
    if (!file.startsWith(`${dist}${sep}`) || !statSync(file).isFile()) {
      throw new Error(`ビルドの配信ファイルがありません: ${asset}`);
    }
  }
}

export function startPm2({ repo = REPO, run = spawnSync } = {}) {
  // Check before touching an existing process. No implicit build or db:push.
  checkWebBuild(repo);
  const require = createRequire(import.meta.url);
  const result = run(process.execPath, [
    require.resolve("pm2/bin/pm2"), "startOrRestart",
    resolve(repo, "ecosystem.config.cjs"), "--update-env",
  ], { cwd: repo, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = startPm2();
  } catch (error) {
    console.error(`[start] ${error.message}`);
    console.error("bun run build を実行し、配信ファイルと PM2 のインストールを確認してください。");
    process.exitCode = 1;
  }
}
