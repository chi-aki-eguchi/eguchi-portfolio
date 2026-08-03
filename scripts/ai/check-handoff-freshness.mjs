#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const taskPath = resolve(repoRoot, "task.md");

function git(args) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function extractCurrentState(markdown) {
  const match = markdown.match(/<!-- CURRENT_STATE_START -->([\s\S]*?)<!-- CURRENT_STATE_END -->/);
  return match?.[1]?.trim() || null;
}

// HEAD欄は行頭にあるとは限らない。`- **Branch:** \`main\` / **HEAD:** \`SELF\` / ...`
// のように1行へまとめて書かれることが多く、行頭アンカーで探すと読めずに
// 「HEAD欄を読めません」を出し続ける（2026-08-03 に実際に発生）。
// 書式ではなくフィールド名で探す。
export function extractHeadField(currentState) {
  return currentState?.match(/\*\*HEAD:\*\*\s*`([^`]+)`/)?.[1] || null;
}

export function checkFreshness() {
  const currentState = extractCurrentState(readFileSync(taskPath, "utf8"));
  if (!currentState) {
    return { ok: false, reason: "Current State markerが見つかりません" };
  }

  const actualHead = git(["rev-parse", "HEAD"]);
  const taskDirty = Boolean(git(["status", "--porcelain=v1", "--", "task.md"]));
  const headField = extractHeadField(currentState);

  if (!headField) {
    return { ok: false, reason: "Current StateのHEAD欄を読めません", actualHead };
  }

  if (taskDirty) {
    return {
      ok: false,
      reason: "task.mdのCurrent Stateが未commitです",
      actualHead,
      recordedHead: headField,
    };
  }

  const recordedHead = headField === "SELF"
    ? git(["log", "-1", "--format=%H", "--", "task.md"])
    : git(["rev-parse", headField]);

  if (recordedHead !== actualHead) {
    return {
      ok: false,
      reason: "Current State更新後に別のcommitが追加されています",
      actualHead,
      recordedHead,
    };
  }

  return { ok: true, reason: "Current Stateは現在のHEADと一致しています", actualHead, recordedHead };
}

function printResult(result, { json = false } = {}) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const label = result.ok ? "OK" : "WARNING";
  const details = result.ok
    ? ""
    : ` actual=${result.actualHead?.slice(0, 7) || "?"} recorded=${result.recordedHead?.slice(0, 7) || "?"}`;
  process.stdout.write(`[handoff ${label}] ${result.reason}${details}\n`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    printResult(checkFreshness(), { json: process.argv.includes("--json") });
  } catch {
    printResult({ ok: false, reason: "鮮度チェックを実行できませんでした" }, {
      json: process.argv.includes("--json"),
    });
  }
}
