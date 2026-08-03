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
const SESSION_RESET_MAX_MS = 6 * 60 * 60 * 1000;
const WEEKLY_RESET_MAX_MS = 8 * 24 * 60 * 60 * 1000;
const STATE_DIR = join(homedir(), ".claude", "credit-status");
const STATE_FILE = join(STATE_DIR, "status.json");
const SUMMARY_FILE = join(STATE_DIR, "status.txt");

const zonedTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})$/i;

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

function remaining(used) {
  if (typeof used !== "number" || !Number.isFinite(used)) return null;
  return Math.max(0, Math.min(100, 100 - used));
}

function safeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function safePercent(value) {
  const number = safeNumber(value);
  return number !== null && number <= 100 ? number : null;
}

function parseZonedTimestamp(value) {
  if (typeof value !== "string" || !zonedTimestamp.test(value)) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function safeResetAt(value) {
  return parseZonedTimestamp(value) === null ? null : value;
}

function timestampAge(value, nowMs) {
  const timestampMs = parseZonedTimestamp(value);
  if (timestampMs === null) return null;
  const ageMs = nowMs - timestampMs;
  return Number.isFinite(ageMs) && ageMs >= 0 ? ageMs : null;
}

function parseProvider(provider, parsed) {
  const item = Array.isArray(parsed) ? parsed.find((entry) => entry?.provider === provider) : parsed;
  if (!item || item.error || !item.usage) throw new Error("usage missing");

  if (provider === "claude") {
    const sessionRemainingPercent = remaining(item.usage.primary?.usedPercent);
    const weeklyRemainingPercent = remaining(item.usage.secondary?.usedPercent);
    if (sessionRemainingPercent === null || weeklyRemainingPercent === null) throw new Error("usage windows missing");
    return {
      sessionRemainingPercent,
      weeklyRemainingPercent,
      sessionResetsAt: safeResetAt(item.usage.primary?.resetsAt),
      weeklyResetsAt: safeResetAt(item.usage.secondary?.resetsAt),
      willLastToSessionReset: safeBoolean(item.pace?.primary?.willLastToReset),
      sessionEtaSeconds: safeNumber(item.pace?.primary?.etaSeconds),
      willLastToWeeklyReset: safeBoolean(item.pace?.secondary?.willLastToReset),
      weeklyEtaSeconds: safeNumber(item.pace?.secondary?.etaSeconds),
    };
  }

  const weeklyRemainingPercent = remaining(item.usage.secondary?.usedPercent);
  if (weeklyRemainingPercent === null) throw new Error("weekly usage missing");
  return {
    weeklyRemainingPercent,
    weeklyResetsAt: safeResetAt(item.usage.secondary?.resetsAt),
    dataConfidence: item.usage.dataConfidence === "exact" ? "exact" : "unknown",
    willLastToWeeklyReset: safeBoolean(item.pace?.secondary?.willLastToReset),
    weeklyEtaSeconds: safeNumber(item.pace?.secondary?.etaSeconds),
  };
}

function parseProviderSafely(provider, parsed) {
  try {
    return { data: parseProvider(provider, parsed), errorCode: null };
  } catch {
    return { data: null, errorCode: `${provider}_usage_unavailable` };
  }
}

function fetchProviders(cliPath) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const stdout = execFileSync(cliPath, ["usage", "--provider", "both", "--format", "json"], {
        encoding: "utf8",
        timeout: 45_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const parsed = JSON.parse(stdout);
      return {
        claude: parseProviderSafely("claude", parsed),
        codex: parseProviderSafely("codex", parsed),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError?.message || "usage lookup failed");
}

function readCache() {
  try {
    const value = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function cacheRecord(state, provider) {
  const value = state?.[provider];
  if (!value || typeof value !== "object") return null;
  const checkedAt = typeof value.checkedAt === "string"
    ? value.checkedAt
    : typeof state.checkedAt === "string"
      ? state.checkedAt
      : null;

  if (provider === "claude") {
    const sessionRemainingPercent = safePercent(value.sessionRemainingPercent);
    const weeklyRemainingPercent = safePercent(value.weeklyRemainingPercent);
    if (sessionRemainingPercent === null || weeklyRemainingPercent === null || !checkedAt) return null;
    return {
      checkedAt,
      data: {
        sessionRemainingPercent,
        weeklyRemainingPercent,
        sessionResetsAt: safeResetAt(value.sessionResetsAt),
        weeklyResetsAt: safeResetAt(value.weeklyResetsAt),
        willLastToSessionReset: safeBoolean(value.willLastToSessionReset),
        sessionEtaSeconds: safeNumber(value.sessionEtaSeconds),
        willLastToWeeklyReset: safeBoolean(value.willLastToWeeklyReset),
        weeklyEtaSeconds: safeNumber(value.weeklyEtaSeconds),
      },
    };
  }

  const weeklyRemainingPercent = safePercent(value.weeklyRemainingPercent);
  if (weeklyRemainingPercent === null || !checkedAt) return null;
  return {
    checkedAt,
    data: {
      weeklyRemainingPercent,
      weeklyResetsAt: safeResetAt(value.weeklyResetsAt),
      dataConfidence: value.dataConfidence === "exact" ? "exact" : "unknown",
      willLastToWeeklyReset: safeBoolean(value.willLastToWeeklyReset),
      weeklyEtaSeconds: safeNumber(value.weeklyEtaSeconds),
    },
  };
}

function cachedProvider(state, provider, nowMs) {
  const record = cacheRecord(state, provider);
  if (!record) return { data: null, checkedAt: null, acquisition: "unknown" };
  const ageMs = timestampAge(record.checkedAt, nowMs);
  if (ageMs === null || ageMs > STALE_MS) return { data: null, checkedAt: null, acquisition: "unknown" };
  return {
    ...record,
    acquisition: ageMs <= CACHE_MS ? "recent" : "old",
  };
}

function resetAssessment({ resetsAt, checkedAt, acquisition, nowMs, maxDistanceMs }) {
  const resetAtMs = parseZonedTimestamp(resetsAt);
  const checkedAtMs = parseZonedTimestamp(checkedAt);
  const ageMs = timestampAge(checkedAt, nowMs);
  const isFreshResult = (acquisition === "current" || acquisition === "recent")
    && ageMs !== null
    && ageMs <= CACHE_MS;
  const crossedDuringCache = acquisition === "recent"
    && resetAtMs !== null
    && checkedAtMs !== null
    && checkedAtMs < resetAtMs
    && resetAtMs <= nowMs;
  const distanceFromLocalClockMs = resetAtMs === null ? null : resetAtMs - nowMs;

  if (
    resetAtMs === null
    || checkedAtMs === null
    || !isFreshResult
    || crossedDuringCache
    || distanceFromLocalClockMs === null
    || distanceFromLocalClockMs <= 0
    || distanceFromLocalClockMs > maxDistanceMs
  ) {
    return { status: "unknown", resetsAt: null, secondsUntilReset: null };
  }

  return {
    status: "usable",
    resetsAt,
    secondsUntilReset: Math.floor(distanceFromLocalClockMs / 1000),
  };
}

function weeklyAssessment({ provider, data, checkedAt, acquisition, nowMs }) {
  if (!data) return { status: "unknown", reset: { status: "unknown", resetsAt: null, secondsUntilReset: null } };
  const reset = resetAssessment({
    resetsAt: data.weeklyResetsAt,
    checkedAt,
    acquisition,
    nowMs,
    maxDistanceMs: WEEKLY_RESET_MAX_MS,
  });
  const reliable = provider !== "codex" || data.dataConfidence === "exact";
  const status = reliable && reset.status === "usable" && typeof data.willLastToWeeklyReset === "boolean"
    ? data.willLastToWeeklyReset ? "sufficient" : "low"
    : "unknown";
  return { status, reset };
}

function continuityAssessment({ data, checkedAt, acquisition, nowMs }) {
  if (!data) return { status: "unknown", reset: { status: "unknown", resetsAt: null, secondsUntilReset: null } };
  const reset = resetAssessment({
    resetsAt: data.sessionResetsAt,
    checkedAt,
    acquisition,
    nowMs,
    maxDistanceMs: SESSION_RESET_MAX_MS,
  });
  const status = reset.status === "usable" && typeof data.willLastToSessionReset === "boolean"
    ? data.willLastToSessionReset ? "holds" : "at_risk"
    : "unknown";
  return { status, reset };
}

function cacheLabel(claude, codex) {
  const acquisitions = [claude.acquisition, codex.acquisition];
  if (acquisitions.every((value) => value === "current")) return "live";
  if (acquisitions.every((value) => value === "recent")) return "fresh";
  if (acquisitions.every((value) => value === "old")) return "stale";
  if (acquisitions.every((value) => value === "unknown")) return "none";
  return "mixed";
}

function actionPlan({ acquisition, weekly, workContinuity, retrievalFailed }) {
  const lowProviders = ["claude", "codex"].filter((provider) => weekly[provider] === "low");
  const resumeReasons = [];
  if (workContinuity.claude === "at_risk") resumeReasons.push("five_hour_at_risk");
  if (workContinuity.claude === "unknown") resumeReasons.push("five_hour_unknown");
  for (const provider of ["claude", "codex"]) {
    if (acquisition[provider] === "old" || acquisition[provider] === "unknown") {
      resumeReasons.push(`${provider}_acquisition_${acquisition[provider]}`);
    }
  }
  if (retrievalFailed) resumeReasons.push("retrieval_failed");

  const actions = [];
  if (lowProviders.length > 0) actions.push({ type: "narrow_scope", providers: lowProviders });
  if (resumeReasons.length > 0) actions.push({ type: "create_resume_point", reasons: [...new Set(resumeReasons)] });
  return actions;
}

function warningList({ claude, codex, acquisition, weekly, workContinuity, lookupWarning }) {
  const warnings = [];
  if (lookupWarning) warnings.push(lookupWarning);
  for (const [provider, label] of [["claude", "Claude"], ["codex", "Codex"]]) {
    const record = provider === "claude" ? claude : codex;
    if (record?.errorCode && !lookupWarning) warnings.push(`${label}の利用状況を解析できませんでした`);
    if (acquisition[provider] === "old") warnings.push(`${label}の値は5分を超える過去値です`);
    if (acquisition[provider] === "unknown") warnings.push(`${label}の取得値は不明です`);
    if (acquisition[provider] !== "unknown" && weekly[provider] === "unknown") {
      warnings.push(`${label}週枠の見通しは不明です`);
    }
  }
  if (acquisition.claude !== "unknown" && workContinuity.claude === "unknown") {
    warnings.push("Claude 5時間枠の継続性は不明です");
  }
  return [...new Set(warnings)];
}

function oldestSharedCheckedAt(claude, codex) {
  if (!claude.data || !codex.data) return null;
  const claudeMs = parseZonedTimestamp(claude.checkedAt);
  const codexMs = parseZonedTimestamp(codex.checkedAt);
  if (claudeMs === null || codexMs === null) return null;
  return claudeMs <= codexMs ? claude.checkedAt : codex.checkedAt;
}

function buildState({ claude, codex, nowMs, lookupErrorCode = null, lookupWarning = null }) {
  const acquisition = {
    claude: claude.acquisition,
    codex: codex.acquisition,
  };
  const claudeWeekly = weeklyAssessment({
    provider: "claude",
    data: claude.data,
    checkedAt: claude.checkedAt,
    acquisition: claude.acquisition,
    nowMs,
  });
  const codexWeekly = weeklyAssessment({
    provider: "codex",
    data: codex.data,
    checkedAt: codex.checkedAt,
    acquisition: codex.acquisition,
    nowMs,
  });
  const claudeContinuity = continuityAssessment({
    data: claude.data,
    checkedAt: claude.checkedAt,
    acquisition: claude.acquisition,
    nowMs,
  });
  const weekly = { claude: claudeWeekly.status, codex: codexWeekly.status };
  const workContinuity = { claude: claudeContinuity.status };
  const retrievalFailed = Boolean(lookupErrorCode || claude.errorCode || codex.errorCode);
  const actions = actionPlan({ acquisition, weekly, workContinuity, retrievalFailed });
  const warnings = warningList({
    claude,
    codex,
    acquisition,
    weekly,
    workContinuity,
    lookupWarning,
  });
  const errorCode = lookupErrorCode || (claude.errorCode || codex.errorCode ? "partial_provider_data" : null);
  const lastAttemptAt = new Date(nowMs).toISOString();

  return {
    schemaVersion: 2,
    checkedAt: oldestSharedCheckedAt(claude, codex),
    lastAttemptAt,
    claude: claude.data ? { ...claude.data, checkedAt: claude.checkedAt, errorCode: claude.errorCode || null } : null,
    codex: codex.data ? { ...codex.data, checkedAt: codex.checkedAt, errorCode: codex.errorCode || null } : null,
    acquisition,
    weekly,
    workContinuity,
    resetStatus: {
      claude: { session: claudeContinuity.reset, weekly: claudeWeekly.reset },
      codex: { weekly: codexWeekly.reset },
    },
    actions,
    cache: cacheLabel(claude, codex),
    warning: warnings.length > 0 ? warnings.join(" / ") : null,
    errorCode,
  };
}

function acquisitionLabel(value) {
  return { current: "現在値", recent: "5分以内の過去値", old: "古い値", unknown: "不明" }[value] || "不明";
}

function weeklyLabel(value) {
  return { sufficient: "十分", low: "少ない", unknown: "不明" }[value] || "不明";
}

function continuityLabel(value) {
  return { holds: "持つ", at_risk: "途中で尽きそう", unknown: "不明" }[value] || "不明";
}

function actionGuidance(actions) {
  const messages = [];
  if (actions.some((action) => action.type === "narrow_scope")) {
    messages.push("週枠に余裕が少ない実測値です。今回の作業範囲を小さくすると安全です。");
  }
  if (actions.some((action) => action.type === "create_resume_point")) {
    messages.push("5時間枠または取得状態に不確実さがあります。長い工程の前に、現在地と未検証事項を残して再開可能な区切りを作ると安全です。commitは依頼で許可され、変更が一貫している場合に限ります。");
  }
  return messages.join(" ");
}

function summary(state) {
  const axes = `取得: Claude=${acquisitionLabel(state.acquisition?.claude)} / Codex=${acquisitionLabel(state.acquisition?.codex)}; 週枠: Claude=${weeklyLabel(state.weekly?.claude)} / Codex=${weeklyLabel(state.weekly?.codex)}; 作業継続性: Claude 5h=${continuityLabel(state.workContinuity?.claude)}.`;
  const guidance = actionGuidance(state.actions || []);
  return `[credit] ${axes}${guidance ? ` ${guidance}` : ""}${state.warning ? ` 警告: ${state.warning}` : ""}`;
}

function atomicWrite(path, content) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, content, { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, path);
}

function persist(state) {
  try {
    atomicWrite(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
    atomicWrite(SUMMARY_FILE, `${summary(state)}\n`);
    return { state, text: summary(state) };
  } catch {
    const warning = state.warning ? `${state.warning} / 状態ファイルを保存できませんでした` : "状態ファイルを保存できませんでした";
    const unsaved = { ...state, warning, errorCode: state.errorCode || "credit_status_write_failed" };
    return { state: unsaved, text: summary(unsaved) };
  }
}

function freshCacheState(cached, nowMs) {
  if (!cached || cached.warning || cached.errorCode) return null;
  const claude = cachedProvider(cached, "claude", nowMs);
  const codex = cachedProvider(cached, "codex", nowMs);
  if (claude.acquisition !== "recent" || codex.acquisition !== "recent") return null;
  return buildState({ claude, codex, nowMs });
}

function fallbackEntry(cached, provider, nowMs, errorCode = null) {
  return { ...cachedProvider(cached, provider, nowMs), errorCode };
}

export function run({ force = false } = {}) {
  const nowMs = Date.now();
  const cached = readCache();
  if (!force) {
    const fresh = freshCacheState(cached, nowMs);
    if (fresh) return { state: fresh, text: summary(fresh) };
  }

  const cli = findCodexBar();
  let providers = null;
  let lookupErrorCode = null;
  let lookupWarning = null;
  if (!cli) {
    lookupErrorCode = "codexbar_cli_not_found";
    lookupWarning = "CodexBar CLIが見つかりません";
  } else {
    try {
      providers = fetchProviders(cli.path);
    } catch {
      lookupErrorCode = "codexbar_lookup_failed";
      lookupWarning = "CodexBarの取得に失敗しました（1回再試行済み）";
    }
  }

  const checkedAt = new Date(nowMs).toISOString();
  const claude = providers?.claude?.data
    ? { data: providers.claude.data, checkedAt, acquisition: "current", errorCode: null }
    : fallbackEntry(cached, "claude", nowMs, providers?.claude?.errorCode || lookupErrorCode);
  const codex = providers?.codex?.data
    ? { data: providers.codex.data, checkedAt, acquisition: "current", errorCode: null }
    : fallbackEntry(cached, "codex", nowMs, providers?.codex?.errorCode || lookupErrorCode);
  const state = buildState({ claude, codex, nowMs, lookupErrorCode, lookupWarning });
  return persist(state);
}

function internalFailureState() {
  const nowMs = Date.now();
  const unknown = { data: null, checkedAt: null, acquisition: "unknown", errorCode: "credit_status_hook_failed" };
  return buildState({
    claude: unknown,
    codex: { ...unknown },
    nowMs,
    lookupErrorCode: "credit_status_hook_failed",
    lookupWarning: "クレジット状態を安全に確認できませんでした",
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let result;
  try {
    result = run({ force: process.argv.includes("--force") });
  } catch {
    const state = internalFailureState();
    result = { state, text: summary(state) };
  }
  if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(result.state, null, 2)}\n`);
  else process.stdout.write(`${result.text}\n`);
}
