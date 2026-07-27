#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  accessSync,
  chmodSync,
  constants,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CACHE_MS = 5 * 60 * 1000;
const STALE_MS = 30 * 60 * 1000;
const STATE_DIR = join(homedir(), ".claude", "credit-status");
const STATE_FILE = join(STATE_DIR, "status.json");
const SUMMARY_FILE = join(STATE_DIR, "status.txt");

const level = { normal: 0, saving: 1, closing: 2, critical: 3 };
const worse = (...values) => values.reduce((a, b) => level[b] > level[a] ? b : a, "normal");

function isExecutable(path) {
  if (!path) return false;
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function findCodexBar({
  env = process.env,
  homeDir = homedir(),
  systemApplications = "/Applications",
} = {}) {
  const pathCandidates = (env.PATH || "")
    .split(":")
    .filter(Boolean)
    .flatMap((dir) => [join(dir, "codexbar"), join(dir, "CodexBarCLI")]);

  const candidates = [
    { path: env.CODEXBAR_CLI, source: "CODEXBAR_CLI" },
    ...pathCandidates.map((path) => ({ path, source: "PATH" })),
    { path: "/opt/homebrew/bin/codexbar", source: "Homebrew" },
    { path: "/usr/local/bin/codexbar", source: "Homebrew" },
    {
      path: join(homeDir, "Applications", "CodexBar.app", "Contents", "Helpers", "CodexBarCLI"),
      source: "user app",
    },
    {
      path: join(systemApplications, "CodexBar.app", "Contents", "Helpers", "CodexBarCLI"),
      source: "system app",
    },
  ];

  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate.path || seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    if (isExecutable(candidate.path)) return candidate;
  }
  return null;
}

function statusForRemaining(remaining) {
  if (remaining < 10) return "critical";
  if (remaining < 20) return "closing";
  if (remaining < 50) return "saving";
  return "normal";
}

function elevate(status) {
  return ["saving", "closing", "critical", "critical"][level[status]];
}

function remaining(used) {
  return typeof used === "number" ? Math.max(0, Math.min(100, 100 - used)) : null;
}

function parseProvider(provider, stdout) {
  const parsed = JSON.parse(stdout);
  const item = Array.isArray(parsed) ? parsed.find((entry) => entry.provider === provider) : parsed;
  if (!item || item.error || !item.usage) throw new Error(item?.error?.message || `${provider} usage missing`);

  if (provider === "claude") {
    const sessionRemainingPercent = remaining(item.usage.primary?.usedPercent);
    const weeklyRemainingPercent = remaining(item.usage.secondary?.usedPercent);
    if (sessionRemainingPercent === null || weeklyRemainingPercent === null) throw new Error("Claude usage windows missing");
    let status = worse(statusForRemaining(sessionRemainingPercent), statusForRemaining(weeklyRemainingPercent));
    if (item.pace?.primary?.willLastToReset === false || item.pace?.secondary?.willLastToReset === false) status = elevate(status);
    return {
      sessionRemainingPercent,
      weeklyRemainingPercent,
      sessionResetsAt: item.usage.primary?.resetsAt || null,
      weeklyResetsAt: item.usage.secondary?.resetsAt || null,
      willLastToSessionReset: item.pace?.primary?.willLastToReset ?? null,
      sessionEtaSeconds: item.pace?.primary?.etaSeconds ?? null,
      willLastToWeeklyReset: item.pace?.secondary?.willLastToReset ?? null,
      weeklyEtaSeconds: item.pace?.secondary?.etaSeconds ?? null,
      status,
    };
  }

  const weeklyRemainingPercent = remaining(item.usage.secondary?.usedPercent);
  if (weeklyRemainingPercent === null) throw new Error("Codex weekly usage missing");
  const dataConfidence = item.usage.dataConfidence || "unknown";
  let status = statusForRemaining(weeklyRemainingPercent);
  if (item.pace?.secondary?.willLastToReset === false) status = elevate(status);
  if (dataConfidence !== "exact") status = worse(status, "closing");
  return {
    weeklyRemainingPercent,
    weeklyResetsAt: item.usage.secondary?.resetsAt || null,
    dataConfidence,
    willLastToWeeklyReset: item.pace?.secondary?.willLastToReset ?? null,
    weeklyEtaSeconds: item.pace?.secondary?.etaSeconds ?? null,
    status,
  };
}

function readCache() {
  try {
    const value = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    const ageMs = Date.now() - Date.parse(value.checkedAt);
    return Number.isFinite(ageMs) ? { value, ageMs } : null;
  } catch {
    return null;
  }
}

function fetchBoth(cliPath) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const stdout = execFileSync(cliPath, ["usage", "--provider", "both", "--format", "json"], {
        encoding: "utf8",
        timeout: 45_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return {
        claude: parseProvider("claude", stdout),
        codex: parseProvider("codex", stdout),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError?.message || "usage lookup failed");
}

function guidance(status) {
  if (status === "critical") return "安全化→最低限テスト→commit→Current State→終了。新規作業禁止。";
  if (status === "closing") return "新規工程を始めず、現在工程を最低限テスト・commit・Current Stateまで閉じる。";
  if (status === "saving") return "必須要件だけ。小さく完了し、重要テストだけ行う。";
  return "通常運転。重複テスト・不要な全読込は避ける。";
}

function coordinationGuidance(claude, codex) {
  if (!claude || !codex) return "残量不明。大規模な新規作業を始めない。";
  const claudeLow = level[claude.status] >= level.closing;
  const codexLow = level[codex.status] >= level.closing;
  if (claudeLow && codexLow) return "両方少ない。新規作業禁止。安全化と引き継ぎを優先。";
  if (claudeLow) return "Claudeは詳細分析を増やさず、仕様確定済み作業だけCodexへ。確認は重要箇所のみ。";
  if (codexLow) return "Codexへ新規実装を委任しない。Claudeは仕様整理・次回指示・引き継ぎまで。";
  return "";
}

function summary(state) {
  const c = state.claude;
  const x = state.codex;
  const coordination = coordinationGuidance(c, x);
  const cacheLabel = state.cache === "fresh" ? " cache" : state.cache === "stale" ? " stale" : "";
  return `[credit ${state.status}${cacheLabel}] Claude 5h ${c?.sessionRemainingPercent ?? "?"}% / week ${c?.weeklyRemainingPercent ?? "?"}%; Codex week ${x?.weeklyRemainingPercent ?? "?"}%. ${guidance(state.status)}${coordination ? ` ${coordination}` : ""}${state.warning ? ` WARNING: ${state.warning}` : ""}`;
}

function atomicWrite(path, content) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, content, { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, path);
}

export function run({ force = false } = {}) {
  const cached = readCache();
  if (!force && cached && cached.ageMs <= CACHE_MS && !cached.value.warning) {
    const state = { ...cached.value, cache: "fresh" };
    return { state, text: summary(state) };
  }

  const cli = findCodexBar();
  let lookupError = null;
  try {
    if (!cli) {
      const error = new Error("CodexBar CLI not found");
      error.code = "CODEXBAR_CLI_NOT_FOUND";
      throw error;
    }
    const { claude, codex } = fetchBoth(cli.path);
    const state = {
      checkedAt: new Date().toISOString(),
      claude,
      codex,
      status: worse(claude.status, codex.status),
      cache: "live",
      warning: null,
    };
    atomicWrite(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
    atomicWrite(SUMMARY_FILE, `${summary(state)}\n`);
    return { state, text: summary(state) };
  } catch (error) {
    lookupError = error;
  }

  const notFound = lookupError?.code === "CODEXBAR_CLI_NOT_FOUND";
  const warning = notFound
    ? "CodexBar CLI未発見（PATH・Homebrew・CodexBar.appを確認）"
    : "CodexBar取得失敗（1回再試行済み）";
  const errorCode = notFound ? "codexbar_cli_not_found" : "codexbar_lookup_failed";

  if (cached && cached.ageMs <= STALE_MS && cached.value.claude && cached.value.codex) {
    const state = {
      ...cached.value,
      lastAttemptAt: new Date().toISOString(),
      status: worse(cached.value.status, "closing"),
      cache: "stale",
      warning,
      errorCode,
    };
    atomicWrite(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
    atomicWrite(SUMMARY_FILE, `${summary(state)}\n`);
    return { state, text: summary(state) };
  }

  const state = {
    checkedAt: new Date().toISOString(),
    claude: null,
    codex: null,
    status: "closing",
    cache: "none",
    warning,
    errorCode,
  };
  atomicWrite(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  atomicWrite(SUMMARY_FILE, `${summary(state)}\n`);
  return { state, text: summary(state) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = run({ force: process.argv.includes("--force") });
  if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(result.state, null, 2)}\n`);
  else process.stdout.write(`${result.text}\n`);
}
