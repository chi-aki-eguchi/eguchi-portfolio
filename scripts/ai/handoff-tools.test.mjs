import assert from "node:assert/strict";
import test from "node:test";
import { extractCurrentState, extractHeadField, findStaleClaims } from "./check-handoff-freshness.mjs";
import { buildPacket, redactSecrets } from "./chatgpt-handoff.mjs";

test("extracts only the Current State block", () => {
  const markdown = [
    "# Task",
    "<!-- CURRENT_STATE_START -->",
    "## Current State",
    "- **Status:** Ready",
    "<!-- CURRENT_STATE_END -->",
    "old history",
  ].join("\n");
  assert.match(extractCurrentState(markdown), /Status/);
  assert.doesNotMatch(extractCurrentState(markdown), /old history/);
});

test("reads HEAD whether it starts a bullet or shares a line", () => {
  // 行頭にある書き方
  assert.deepEqual(extractHeadField("- **HEAD:** `SELF`"), { ok: true, value: "SELF" });
  // 1行にまとめた書き方（2026-08-03 まで読めずに警告を出し続けていた形）
  assert.deepEqual(
    extractHeadField("- **Branch:** `main` / **HEAD:** `SELF` / **origin/main:** `a3946fc`"),
    { ok: true, value: "SELF" },
  );
  // ハッシュ指定
  assert.deepEqual(extractHeadField("- **Branch:** `main` / **HEAD:** `c2f7117`"), {
    ok: true,
    value: "c2f7117",
  });
});

test("refuses ambiguous or malformed HEAD fields instead of guessing", () => {
  // 実物と同じ形（ブロック自身の見出しで始まる）でも読める
  const realShape = [
    "## Current State — 2026-08-04 JST",
    "",
    "- **Branch:** `main` / **HEAD:** `SELF` / **origin/main:** `a3946fc`",
    "",
    "### 次の一手",
    "",
    "- **HEAD:** `deadbeef` はここでは拾わない",
  ].join("\n");
  assert.deepEqual(extractHeadField(realShape), { ok: true, value: "SELF" });

  // メタ情報部分に2つあれば、黙って最初を採らずエラーにする
  const duplicated = "- **HEAD:** `SELF`\n- **HEAD:** `c2f7117`";
  assert.equal(extractHeadField(duplicated).ok, false);
  assert.match(extractHeadField(duplicated).reason, /2個/);

  // SELF でもハッシュでもない値は受け付けない
  assert.equal(extractHeadField("- **HEAD:** `たぶんmain`").ok, false);

  // 箇条書き以外の行にあっても拾わない
  assert.equal(extractHeadField("説明文の中の **HEAD:** `SELF` は対象外").ok, false);

  // 欄が無い / 入力が不正
  assert.equal(extractHeadField("- **Status:** Ready").ok, false);
  assert.equal(extractHeadField(null).ok, false);
});

test("redacts secret-shaped values but keeps normal status text", () => {
  const secretKey = ["ADMIN", "_PASSWORD"].join("");
  const fixtureValue = ["do", "not", "print"].join("-");
  const redacted = redactSecrets([
    `${secretKey}=${fixtureValue}`,
    `Authorization: Bearer ${fixtureValue}`,
    "Status: Ready",
  ].join("\n"));
  assert.equal(redacted.includes(fixtureValue), false);
  assert.match(redacted, /Status: Ready/);
});

test("builds one complete Japanese packet without reading log bodies", () => {
  const packet = buildPacket();
  assert.match(packet, /^=== CHATGPT HANDOFF PACKET START ===/);
  assert.match(packet, /## 確認できた事実/);
  assert.match(packet, /## 推測/);
  assert.match(packet, /## 不明点/);
  assert.match(packet, /Codexログ本文は読みません/);
  assert.match(packet, /=== CHATGPT HANDOFF PACKET END ===$/);
});

// 2026-08-05: Codex の調査が3回続けて「Current Stateと実物が矛盾する」で
// 止まった。原因は毎回、書いた瞬間しか正しくない値だった —
// ahead件数（直すcommit自体が件数を変える）と push 状況。
// 値ではなく測り方を書く運用にしたので、値のほうを機械的に弾く。
test("findStaleClaims flags an ahead count and a push claim", () => {
  const flagged = findStaleClaims(
    ["- **Branch:** `main` / **origin/main:** `abc1234` より 15 commits ahead",
     "- Status: commit 済み・push 未実施"].join("\n"),
  );
  assert.equal(flagged.length, 2);
  assert.ok(flagged[0].line.includes("15 commits ahead"));
  assert.ok(flagged[1].line.includes("push 未実施"));
});

test("findStaleClaims accepts a line that points at how to measure", () => {
  assert.deepEqual(
    findStaleClaims(
      "- **push状況はここに書かない** — `git rev-list --count origin/main..HEAD` で測る",
    ),
    [],
  );
});

test("findStaleClaims leaves an ordinary Current State alone", () => {
  assert.deepEqual(
    findStaleClaims("- **Branch:** `main` / **HEAD:** `SELF`\n- **Git:** clean"),
    [],
  );
});
