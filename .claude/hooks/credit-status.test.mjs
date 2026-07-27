import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findCodexBar } from "./credit-status.mjs";

const script = new URL("./credit-status.mjs", import.meta.url).pathname;

function fakeCli({ claudeUsed = 40, claudeWeekly = 30, codexWeekly = 25, confidence = "exact", pace = true, fail = false } = {}) {
  return `#!/bin/sh
echo x >> "$HOME/calls"
${fail ? "exit 1" : ""}
echo '[{"provider":"claude","usage":{"primary":{"usedPercent":${claudeUsed},"resetsAt":"a"},"secondary":{"usedPercent":${claudeWeekly},"resetsAt":"b"}},"pace":{"primary":{"willLastToReset":${pace},"etaSeconds":10},"secondary":{"willLastToReset":true}}},{"provider":"codex","credits":{"remaining":0},"usage":{"secondary":{"usedPercent":${codexWeekly},"resetsAt":"c"},"dataConfidence":"${confidence}"},"pace":{"secondary":{"willLastToReset":true}}}]'
`;
}

function fixture(options = {}) {
  const home = mkdtempSync(join(tmpdir(), "credit-status-test-"));
  const bin = join(home, "bin");
  mkdirSync(bin);
  const fakeBin = join(bin, "codexbar");
  writeFileSync(fakeBin, fakeCli(options), { mode: 0o755 });
  return { home, bin, fakeBin };
}

function runFixture(f, { explicit = true, path = "" } = {}) {
  const env = { ...process.env, HOME: f.home, PATH: path };
  if (explicit) env.CODEXBAR_CLI = f.fakeBin;
  else delete env.CODEXBAR_CLI;
  return spawnSync(process.execPath, [script, "--json"], { env, encoding: "utf8" });
}

function run(options = {}) {
  return runFixture(fixture(options));
}

test("calculates remaining percentages and ignores credits.remaining", () => {
  const result = run({ claudeUsed: 40, claudeWeekly: 30, codexWeekly: 25 });
  assert.equal(result.status, 0, result.stderr);
  const state = JSON.parse(result.stdout);
  assert.equal(state.claude.sessionRemainingPercent, 60);
  assert.equal(state.claude.weeklyRemainingPercent, 70);
  assert.equal(state.codex.weeklyRemainingPercent, 75);
  assert.equal(state.status, "normal");
});

test("pace risk elevates the state by one level", () => {
  const state = JSON.parse(run({ claudeUsed: 40, pace: false }).stdout);
  assert.equal(state.claude.status, "saving");
});

test("non-exact Codex confidence is conservative", () => {
  const state = JSON.parse(run({ confidence: "estimated" }).stdout);
  assert.equal(state.codex.status, "closing");
  assert.equal(state.status, "closing");
});

test("under ten percent is critical", () => {
  const state = JSON.parse(run({ claudeUsed: 95 }).stdout);
  assert.equal(state.status, "critical");
});

test("reuses a successful result for five minutes", () => {
  const f = fixture();
  assert.equal(runFixture(f).status, 0);
  assert.equal(runFixture(f).status, 0);
  assert.equal(readFileSync(join(f.home, "calls"), "utf8").trim().split("\n").length, 1);
});

test("discovers codexbar from PATH", () => {
  const f = fixture();
  const result = runFixture(f, { explicit: false, path: f.bin });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).cache, "live");
});

test("discovers CodexBar.app bundled CLI", () => {
  const home = mkdtempSync(join(tmpdir(), "credit-status-app-test-"));
  const cli = join(home, "Applications", "CodexBar.app", "Contents", "Helpers", "CodexBarCLI");
  mkdirSync(join(cli, ".."), { recursive: true });
  writeFileSync(cli, "#!/bin/sh\nexit 0\n");
  chmodSync(cli, 0o755);
  const found = findCodexBar({ env: { PATH: "" }, homeDir: home, systemApplications: join(home, "SystemApps") });
  assert.equal(found?.path, cli);
  assert.equal(found?.source, "user app");
});

test("reports a clear error when no CLI exists", () => {
  const f = fixture();
  const result = runFixture(f, { explicit: false, path: "" });
  const state = JSON.parse(result.stdout);
  assert.equal(state.status, "closing");
  assert.equal(state.cache, "none");
  assert.equal(state.errorCode, "codexbar_cli_not_found");
  assert.match(state.warning, /CLI未発見/);
});

test("fails safely after one retry when lookup fails", () => {
  const f = fixture({ fail: true });
  const state = JSON.parse(runFixture(f).stdout);
  assert.equal(state.status, "closing");
  assert.equal(state.errorCode, "codexbar_lookup_failed");
  assert.match(state.warning, /CodexBar取得失敗/);
  assert.equal(readFileSync(join(f.home, "calls"), "utf8").trim().split("\n").length, 2);
});

test("uses a successful cache up to thirty minutes old as stale, never live", () => {
  const f = fixture();
  assert.equal(runFixture(f).status, 0);
  const statePath = join(f.home, ".claude", "credit-status", "status.json");
  const cached = JSON.parse(readFileSync(statePath, "utf8"));
  cached.checkedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  writeFileSync(statePath, JSON.stringify(cached));
  writeFileSync(f.fakeBin, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const state = JSON.parse(runFixture(f).stdout);
  assert.equal(state.cache, "stale");
  assert.equal(state.status, "closing");
  assert.match(state.warning, /CodexBar取得失敗/);
});

test("does not expose provider values from a cache older than thirty minutes", () => {
  const f = fixture();
  assert.equal(runFixture(f).status, 0);
  const statePath = join(f.home, ".claude", "credit-status", "status.json");
  const cached = JSON.parse(readFileSync(statePath, "utf8"));
  cached.checkedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  writeFileSync(statePath, JSON.stringify(cached));
  writeFileSync(f.fakeBin, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const state = JSON.parse(runFixture(f).stdout);
  assert.equal(state.cache, "none");
  assert.equal(state.claude, null);
  assert.equal(state.codex, null);
});
