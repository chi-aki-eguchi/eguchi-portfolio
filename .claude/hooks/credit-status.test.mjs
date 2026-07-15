import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const script = new URL("./credit-status.mjs", import.meta.url).pathname;

function fixture({ claudeUsed = 40, claudeWeekly = 30, codexWeekly = 25, confidence = "exact", pace = true, fail = false } = {}) {
  const home = mkdtempSync(join(tmpdir(), "credit-status-test-"));
  const bin = join(home, "bin");
  mkdirSync(bin);
const fake = `#!/bin/sh
echo x >> "$HOME/calls"
${fail ? "exit 1" : ""}
provider=""
while [ "$#" -gt 0 ]; do [ "$1" = "--provider" ] && provider="$2"; shift; done
echo '[{"provider":"claude","usage":{"primary":{"usedPercent":${claudeUsed},"resetsAt":"a"},"secondary":{"usedPercent":${claudeWeekly},"resetsAt":"b"}},"pace":{"primary":{"willLastToReset":${pace},"etaSeconds":10},"secondary":{"willLastToReset":true}}},{"provider":"codex","credits":{"remaining":0},"usage":{"secondary":{"usedPercent":${codexWeekly},"resetsAt":"c"},"dataConfidence":"${confidence}"},"pace":{"secondary":{"willLastToReset":true}}}]'
`;
  writeFileSync(join(bin, "codexbar"), fake, { mode: 0o755 });
  return { home, fakeBin: join(bin, "codexbar") };
}

// Copy the script and replace only the fixed executable path, keeping production behavior intact.
function run(options = {}) {
  const f = fixture(options);
  return runFixture(f);
}

function runFixture(f) {
  const copy = join(f.home, "credit-status.mjs");
  if (!readFileSafe(copy)) {
    const source = readFileSync(script, "utf8").replace('/opt/homebrew/bin/codexbar', f.fakeBin);
    writeFileSync(copy, source);
  }
  return spawnSync(process.execPath, [copy, "--json"], { env: { ...process.env, HOME: f.home }, encoding: "utf8" });
}

function readFileSafe(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
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

test("fails safely after one retry when no cache exists", () => {
  const f = fixture({ fail: true });
  const state = JSON.parse(runFixture(f).stdout);
  assert.equal(state.status, "closing");
  assert.match(state.warning, /CodexBar/);
  assert.equal(readFileSync(join(f.home, "calls"), "utf8").trim().split("\n").length, 2);
});

test("uses a normal cache up to thirty minutes old when lookup fails", () => {
  const f = fixture();
  assert.equal(runFixture(f).status, 0);
  const statePath = join(f.home, ".claude", "credit-status", "status.json");
  const cached = JSON.parse(readFileSync(statePath, "utf8"));
  cached.checkedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  writeFileSync(statePath, JSON.stringify(cached));
  writeFileSync(f.fakeBin, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const state = JSON.parse(runFixture(f).stdout);
  assert.equal(state.cache, "stale");
  assert.equal(state.status, "closing");
  assert.match(state.warning, /CodexBar/);
});
