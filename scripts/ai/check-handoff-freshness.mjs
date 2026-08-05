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
// 一方で全文検索にすると、本文中のコード例や引用を誤って拾う。
// そこで「最初の小見出しより前のメタ情報部分」だけを対象にし、
// 曖昧なら黙って最初の値を採らずエラーにする。
export function extractHeadField(currentState) {
  if (typeof currentState !== "string") return { ok: false, reason: "Current Stateが空です" };

  // ブロック自身の見出し（`## Current State — ...`）を落としてから、
  // 次の見出しより前だけをメタ情報として見る。以降は本文なので拾わない。
  const body = currentState.replace(/^#{1,6}\s[^\n]*\n?/, "");
  const meta = body.split(/^#{1,6}\s/m)[0] ?? "";
  const bullets = meta.split("\n").filter((line) => line.trimStart().startsWith("- "));
  const matches = bullets.flatMap((line) => [...line.matchAll(/\*\*HEAD:\*\*[ \t]*`([^`\n]+)`/g)])
    .map((m) => m[1]);

  if (matches.length === 0) return { ok: false, reason: "Current StateのHEAD欄を読めません" };
  if (matches.length > 1) {
    return { ok: false, reason: `Current StateにHEAD欄が${matches.length}個あります` };
  }

  const value = matches[0];
  if (value !== "SELF" && !/^[0-9a-f]{7,40}$/i.test(value)) {
    return { ok: false, reason: `HEAD欄の値が SELF でもcommitハッシュでもありません: ${value}` };
  }
  return { ok: true, value };
}

// HEAD欄が合っていても、Current State が「その瞬間しか正しくない値」を
// 書いていると、次に読む者が矛盾を見つけて止まる。2026-08-05 に Codex が
// 3回連続で調査を中断した原因がこれで、内訳は ahead 件数（直すcommit自体が
// 件数を変える自己矛盾）と push 状況（オーナーが push した瞬間に古くなる）。
// 値を書かせず、測り方を書かせる。
const STALE_CLAIM_PATTERNS = [
  {
    re: /(\d+)\s*commits?\s*ahead/i,
    why: "ahead件数は書いた次のcommitで古くなる（この行を直すcommit自体が件数を変える）",
  },
  {
    re: /push\s*(未実施|していない)|未push/,
    why: "push状況はオーナーが push した瞬間に古くなる",
  },
];

export function findStaleClaims(currentState) {
  if (typeof currentState !== "string") return [];
  return STALE_CLAIM_PATTERNS.flatMap(({ re, why }) => {
    const line = currentState
      .split("\n")
      .find((l) => re.test(l) && !l.includes("書かない") && !l.includes("測る"));
    return line ? [{ line: line.trim().slice(0, 90), why }] : [];
  });
}

export function checkFreshness() {
  const currentState = extractCurrentState(readFileSync(taskPath, "utf8"));
  if (!currentState) {
    return { ok: false, reason: "Current State markerが見つかりません" };
  }

  const actualHead = git(["rev-parse", "HEAD"]);
  const taskDirty = Boolean(git(["status", "--porcelain=v1", "--", "task.md"]));
  const head = extractHeadField(currentState);

  if (!head.ok) {
    return { ok: false, reason: head.reason, actualHead };
  }
  const headField = head.value;

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

  const stale = findStaleClaims(currentState);
  if (stale.length > 0) {
    return {
      ok: false,
      reason:
        "Current Stateに、すぐ古くなる値が書かれています: " +
        stale.map((s) => `「${s.line}」(${s.why})`).join(" / ") +
        " — 値ではなく測り方を書いてください",
      actualHead,
      recordedHead,
    };
  }

  // 検査しているのはHEAD欄と、すぐ古くなる値の有無だけ。Current State の
  // 内容そのものが実物と合っているかまでは見ていない。
  return { ok: true, reason: "Current StateのHEAD欄は現在のHEADと一致しています", actualHead, recordedHead };
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
