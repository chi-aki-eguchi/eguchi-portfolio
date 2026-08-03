import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findCodexBar } from "./credit-status.mjs";

const script = new URL("./credit-status.mjs", import.meta.url).pathname;

function futureIso(milliseconds) {
  return new Date(Date.now() + milliseconds).toISOString();
}

function fakeCli({
  claudeUsed = 40,
  claudeWeekly = 30,
  codexWeekly = 25,
  confidence = "exact",
  sessionPace = true,
  claudeWeeklyPace = true,
  codexWeeklyPace = true,
  sessionReset = futureIso(4 * 60 * 60 * 1000),
  claudeWeeklyReset = futureIso(4 * 24 * 60 * 60 * 1000),
  codexWeeklyReset = futureIso(4 * 24 * 60 * 60 * 1000),
  claudeError = false,
  codexError = false,
  fail = false,
} = {}) {
  const payload = [
    claudeError
      ? { provider: "claude", error: { message: "unavailable" } }
      : {
          provider: "claude",
          usage: {
            primary: { usedPercent: claudeUsed, resetsAt: sessionReset },
            secondary: { usedPercent: claudeWeekly, resetsAt: claudeWeeklyReset },
          },
          pace: {
            primary: { willLastToReset: sessionPace, etaSeconds: 10 },
            secondary: { willLastToReset: claudeWeeklyPace, etaSeconds: 20 },
          },
          token: "must-not-be-saved",
        },
    codexError
      ? { provider: "codex", error: { message: "unavailable" } }
      : {
          provider: "codex",
          credits: { remaining: 0 },
          usage: {
            secondary: { usedPercent: codexWeekly, resetsAt: codexWeeklyReset },
            dataConfidence: confidence,
          },
          pace: { secondary: { willLastToReset: codexWeeklyPace, etaSeconds: 30 } },
          authorization: "must-not-be-saved",
        },
  ];
  return `#!/bin/sh
echo x >> "$HOME/calls"
${fail ? "exit 1" : ""}
printf '%s\\n' '${JSON.stringify(payload)}'
`;
}

// 作った一時ディレクトリは終了時にまとめて消す。放置すると tmpdir が
// テスト実行のたびに増え続ける（2026-08-03 の Phase E レビュー指摘）。
const tempDirs = [];
function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
process.on("exit", () => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 後始末の失敗でテスト結果を変えない
    }
  }
});

function fixture(options = {}) {
  const home = makeTempDir("credit-status-test-");
  const bin = join(home, "bin");
  mkdirSync(bin);
  const fakeBin = join(bin, "codexbar");
  writeFileSync(fakeBin, fakeCli(options), { mode: 0o755 });
  return { home, bin, fakeBin };
}

function runFixture(f, { explicit = true, path = "", force = false, json = true } = {}) {
  const env = { ...process.env, HOME: f.home, PATH: path };
  if (explicit) env.CODEXBAR_CLI = f.fakeBin;
  else delete env.CODEXBAR_CLI;
  return spawnSync(process.execPath, [script, ...(force ? ["--force"] : []), ...(json ? ["--json"] : [])], { env, encoding: "utf8" });
}

function run(options = {}) {
  return runFixture(fixture(options));
}

function stateFrom(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function hasAction(state, type) {
  return state.actions.some((action) => action.type === type);
}

test("records the three axes separately from safe provider values", () => {
  const state = stateFrom(run({ claudeUsed: 40, claudeWeekly: 30, codexWeekly: 25 }));
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.status, undefined);
  assert.equal(state.claude.sessionRemainingPercent, 60);
  assert.equal(state.claude.weeklyRemainingPercent, 70);
  assert.equal(state.codex.weeklyRemainingPercent, 75);
  assert.deepEqual(state.acquisition, { claude: "current", codex: "current" });
  assert.deepEqual(state.weekly, { claude: "sufficient", codex: "sufficient" });
  assert.deepEqual(state.workContinuity, { claude: "holds" });
  assert.deepEqual(state.actions, []);
});

test("uses the weekly forecast rather than remaining percent alone", () => {
  const state = stateFrom(run({ claudeWeekly: 95, codexWeekly: 95, claudeWeeklyPace: true, codexWeeklyPace: true }));
  assert.deepEqual(state.weekly, { claude: "sufficient", codex: "sufficient" });
  assert.equal(hasAction(state, "narrow_scope"), false);
});

test("only a measured weekly shortfall suggests a smaller scope", () => {
  const state = stateFrom(run({ claudeWeeklyPace: false }));
  assert.equal(state.weekly.claude, "low");
  assert.equal(hasAction(state, "narrow_scope"), true);
});

test("a five-hour risk suggests a resumable boundary without shrinking scope", () => {
  const state = stateFrom(run({ sessionPace: false }));
  assert.equal(state.workContinuity.claude, "at_risk");
  assert.equal(hasAction(state, "create_resume_point"), true);
  assert.equal(hasAction(state, "narrow_scope"), false);
});

test("an unknown weekly value remains visible and never becomes normal guidance", () => {
  const result = run({ confidence: "estimated" });
  const state = stateFrom(result);
  assert.equal(state.weekly.codex, "unknown");
  assert.match(result.stdout, /"codex": "unknown"/);
  assert.doesNotMatch(result.stdout, /通常運転/);
  assert.equal(state.status, undefined);
});

test("reuses a successful result for five minutes as recent data", () => {
  const f = fixture();
  stateFrom(runFixture(f));
  const second = stateFrom(runFixture(f));
  assert.equal(second.cache, "fresh");
  assert.deepEqual(second.acquisition, { claude: "recent", codex: "recent" });
  assert.equal(readFileSync(join(f.home, "calls"), "utf8").trim().split("\n").length, 1);
});

test("keeps Codex current when Claude alone cannot be parsed", () => {
  const state = stateFrom(run({ claudeError: true }));
  assert.equal(state.acquisition.claude, "unknown");
  assert.equal(state.acquisition.codex, "current");
  assert.equal(state.codex.weeklyRemainingPercent, 75);
  assert.equal(state.weekly.codex, "sufficient");
  assert.equal(state.errorCode, "partial_provider_data");
  assert.equal(hasAction(state, "create_resume_point"), true);
});

test("treats an invalid reset timestamp as unknown instead of using it", () => {
  const state = stateFrom(run({ sessionReset: "2026-08-03T12:00:00" }));
  assert.equal(state.workContinuity.claude, "unknown");
  assert.equal(state.resetStatus.claude.session.status, "unknown");
  assert.equal(hasAction(state, "create_resume_point"), true);
});

test("treats a reset implausibly far from the local clock as unknown", () => {
  const state = stateFrom(run({ sessionReset: futureIso(7 * 60 * 60 * 1000) }));
  assert.equal(state.workContinuity.claude, "unknown");
  assert.equal(state.resetStatus.claude.session.status, "unknown");
});

test("does not use a recent cache after its session reset has passed", () => {
  const f = fixture();
  stateFrom(runFixture(f));
  const statePath = join(f.home, ".claude", "credit-status", "status.json");
  const cached = JSON.parse(readFileSync(statePath, "utf8"));
  const recent = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  cached.checkedAt = recent;
  cached.claude.checkedAt = recent;
  cached.codex.checkedAt = recent;
  cached.claude.sessionResetsAt = new Date(Date.now() - 60 * 1000).toISOString();
  writeFileSync(statePath, JSON.stringify(cached));
  const state = stateFrom(runFixture(f));
  assert.deepEqual(state.acquisition, { claude: "recent", codex: "recent" });
  assert.equal(state.workContinuity.claude, "unknown");
  assert.equal(state.resetStatus.claude.session.status, "unknown");
  assert.equal(hasAction(state, "create_resume_point"), true);
});

test("reads a legacy state file without using its old single status", () => {
  const f = fixture();
  const statusDir = join(f.home, ".claude", "credit-status");
  const statePath = join(statusDir, "status.json");
  const checkedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  mkdirSync(statusDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify({
    checkedAt,
    status: "closing",
    cache: "fresh",
    warning: null,
    claude: {
      sessionRemainingPercent: 60,
      weeklyRemainingPercent: 70,
      sessionResetsAt: futureIso(4 * 60 * 60 * 1000),
      weeklyResetsAt: futureIso(4 * 24 * 60 * 60 * 1000),
      willLastToSessionReset: true,
      sessionEtaSeconds: 10,
      willLastToWeeklyReset: true,
      weeklyEtaSeconds: 20,
      status: "closing",
    },
    codex: {
      weeklyRemainingPercent: 75,
      weeklyResetsAt: futureIso(4 * 24 * 60 * 60 * 1000),
      dataConfidence: "exact",
      willLastToWeeklyReset: true,
      weeklyEtaSeconds: 30,
      status: "closing",
    },
  }));
  const state = stateFrom(runFixture(f));
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.status, undefined);
  assert.deepEqual(state.acquisition, { claude: "recent", codex: "recent" });
  assert.deepEqual(state.weekly, { claude: "sufficient", codex: "sufficient" });
});

test("discovers codexbar from PATH", () => {
  const f = fixture();
  const result = runFixture(f, { explicit: false, path: f.bin });
  const state = stateFrom(result);
  assert.equal(state.cache, "live");
});

test("discovers CodexBar.app bundled CLI", () => {
  const home = makeTempDir("credit-status-app-test-");
  const cli = join(home, "Applications", "CodexBar.app", "Contents", "Helpers", "CodexBarCLI");
  mkdirSync(join(cli, ".."), { recursive: true });
  writeFileSync(cli, "#!/bin/sh\nexit 0\n");
  chmodSync(cli, 0o755);
  const found = findCodexBar({ env: { PATH: "" }, homeDir: home, systemApplications: join(home, "SystemApps") });
  assert.equal(found?.path, cli);
  assert.equal(found?.source, "user app");
});

test("returns exit code zero and a resumable-boundary warning when no CLI exists", () => {
  const f = fixture();
  const result = runFixture(f, { explicit: false, path: "" });
  const state = stateFrom(result);
  assert.deepEqual(state.acquisition, { claude: "unknown", codex: "unknown" });
  assert.deepEqual(state.weekly, { claude: "unknown", codex: "unknown" });
  assert.equal(state.workContinuity.claude, "unknown");
  assert.equal(state.cache, "none");
  assert.equal(state.errorCode, "codexbar_cli_not_found");
  assert.equal(hasAction(state, "create_resume_point"), true);
});

test("returns exit code zero after one retry when lookup fails", () => {
  const f = fixture({ fail: true });
  const state = stateFrom(runFixture(f));
  assert.equal(state.errorCode, "codexbar_lookup_failed");
  assert.equal(hasAction(state, "create_resume_point"), true);
  assert.equal(readFileSync(join(f.home, "calls"), "utf8").trim().split("\n").length, 2);
});

test("keeps stale cache values but treats every judgment axis as unknown", () => {
  const f = fixture();
  stateFrom(runFixture(f));
  const statePath = join(f.home, ".claude", "credit-status", "status.json");
  const cached = JSON.parse(readFileSync(statePath, "utf8"));
  const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  cached.checkedAt = old;
  cached.claude.checkedAt = old;
  cached.codex.checkedAt = old;
  writeFileSync(statePath, JSON.stringify(cached));
  writeFileSync(f.fakeBin, fakeCli({ fail: true }), { mode: 0o755 });
  const state = stateFrom(runFixture(f));
  assert.equal(state.cache, "stale");
  assert.deepEqual(state.acquisition, { claude: "old", codex: "old" });
  assert.deepEqual(state.weekly, { claude: "unknown", codex: "unknown" });
  assert.equal(state.workContinuity.claude, "unknown");
  assert.equal(state.claude.weeklyRemainingPercent, 70);
  assert.equal(state.codex.weeklyRemainingPercent, 75);
  assert.equal(hasAction(state, "narrow_scope"), false);
  assert.equal(hasAction(state, "create_resume_point"), true);
});

test("does not reuse a future cache timestamp when the clock moves backwards", () => {
  const f = fixture();
  stateFrom(runFixture(f));
  const statePath = join(f.home, ".claude", "credit-status", "status.json");
  const cached = JSON.parse(readFileSync(statePath, "utf8"));
  const future = new Date(Date.now() + 60 * 1000).toISOString();
  cached.checkedAt = future;
  cached.claude.checkedAt = future;
  cached.codex.checkedAt = future;
  writeFileSync(statePath, JSON.stringify(cached));
  writeFileSync(f.fakeBin, fakeCli({ fail: true }), { mode: 0o755 });
  const state = stateFrom(runFixture(f));
  assert.equal(state.cache, "none");
  assert.deepEqual(state.acquisition, { claude: "unknown", codex: "unknown" });
  assert.equal(readFileSync(join(f.home, "calls"), "utf8").trim().split("\n").length, 3);
});

test("summary is warning-centered and leaves commit conditional", () => {
  const f = fixture({ claudeWeeklyPace: false, sessionPace: false });
  const result = runFixture(f, { explicit: true, json: false });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /作業範囲を小さくすると安全です/);
  assert.match(result.stdout, /再開可能な区切りを作ると安全です/);
  assert.match(result.stdout, /commitは依頼で許可され、変更が一貫している場合に限ります/);
  assert.doesNotMatch(result.stdout, /新規作業禁止|新規工程を始めず|最低限テスト|必須要件だけ|通常運転/);
});

test("does not persist unrelated CLI fields that could contain credentials", () => {
  const f = fixture();
  stateFrom(runFixture(f));
  const statePath = join(f.home, ".claude", "credit-status", "status.json");
  const stored = readFileSync(statePath, "utf8");
  assert.doesNotMatch(stored, /must-not-be-saved/);
  assert.doesNotMatch(stored, /credits/);
});
