#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFreshness, extractCurrentState } from "./check-handoff-freshness.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const taskPath = resolve(repoRoot, "task.md");
const creditPath = resolve(homedir(), ".claude", "credit-status", "status.json");

function git(args) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function redactSecrets(text) {
  return String(text)
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi, "$1 [REDACTED]")
    .replace(/(https?:\/\/[^:\s/@]+:)[^@\s/]+@/gi, "$1[REDACTED]@")
    .split("\n")
    .map((line) => {
      if (/(password|passwd|api[_-]?key|secret|token|cookie|authorization|credential)\s*[:=]/i.test(line)) {
        return line.replace(/([:=]\s*).+$/, "$1[REDACTED]");
      }
      return line;
    })
    .join("\n");
}

function safeCreditSummary() {
  if (!existsSync(creditPath)) return "状態ファイルなし";
  try {
    const state = JSON.parse(readFileSync(creditPath, "utf8"));
    const checkedAt = typeof state.checkedAt === "string" ? state.checkedAt : null;
    const ageMs = checkedAt ? Date.now() - Date.parse(checkedAt) : Number.NaN;
    const ageLabel = Number.isFinite(ageMs) && ageMs > 30 * 60 * 1000
      ? "30分超のため現在値として使用不可"
      : "30分以内";
    return [
      `status=${state.status || "unknown"}`,
      `cache=${state.cache || "unknown"}`,
      `checkedAt=${checkedAt || "unknown"} (${ageLabel})`,
      `Claude 5h=${state.claude?.sessionRemainingPercent ?? "不明"}%`,
      `Claude week=${state.claude?.weeklyRemainingPercent ?? "不明"}%`,
      `Codex week=${state.codex?.weeklyRemainingPercent ?? "不明"}%`,
      `error=${state.errorCode || "なし"}`,
      `warning=${state.warning || "なし"}`,
    ].join(" / ");
  } catch {
    return "状態ファイルを安全に解析できないため値は非表示";
  }
}

function originDifference() {
  try {
    const [ahead, behind] = git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
      .split(/\s+/)
      .map(Number);
    return `upstreamより ahead ${ahead} / behind ${behind}`;
  } catch {
    return "upstream未設定または比較不能";
  }
}

export function buildPacket() {
  const branch = git(["branch", "--show-current"]) || "(detached HEAD)";
  const head = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain=v1"]);
  const currentState = extractCurrentState(readFileSync(taskPath, "utf8"));
  const freshness = checkFreshness();

  const facts = [
    `- Repository: ${repoRoot}`,
    `- Branch: ${branch}`,
    `- HEAD: ${head}`,
    `- Git: ${status ? "dirty" : "clean"}`,
    `- Origin差: ${originDifference()}`,
    `- Handoff鮮度: ${freshness.ok ? "current" : `warning — ${freshness.reason}`}`,
    `- Credit: ${safeCreditSummary()}`,
  ];
  if (status) {
    facts.push("- Git変更ファイル:");
    for (const line of status.split("\n")) facts.push(`  - ${line}`);
  }

  const stateBlock = currentState
    ? redactSecrets(currentState)
    : "Current State markerが見つかりません。Gitの実物を優先し、推測で続行しないでください。";

  return [
    "=== CHATGPT HANDOFF PACKET START ===",
    "# ChatGPT Handoff Packet",
    "",
    "## 確認できた事実",
    ...facts,
    "",
    "## task.md Current State",
    stateBlock,
    "",
    "## 推測",
    "- なし。このPacketはGitと明示された状態ファイルの読み取り結果だけを記載しています。",
    "",
    "## 不明点",
    "- ChatGPTはClaude/Codexの非公開な会話や思考を自動では読めません。",
    "- 本番状態はCurrent Stateに明示されていない限り、このscriptでは確認しません。",
    "- 外部ツールのログ本文は読みません。Current Stateに書かれた範囲だけを参照情報として扱います。",
    "",
    "## 次のAIへの安全規則",
    "- dirty差分を破棄・上書きしない。",
    "- 同じworktreeを2者が同時編集しない。もう一方はread-onlyとする。",
    "- pushは AGENTS.md の3条件（check成功 / 製品コードがあればsmokeも成功 /",
    "  本番DB・秘密情報・課金・公開設定に関わらない）を満たすときだけ。",
    "- deploy、本番DB/R2/Railway/環境変数の変更は行わない。",
    "- 秘密情報の値を要求・転載しない。",
    "- Current StateとGitが違う場合はGitを保護して止まり、オーナーへ確認する。",
    "",
    "=== CHATGPT HANDOFF PACKET END ===",
  ].join("\n");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.stdout.write(`${buildPacket()}\n`);
