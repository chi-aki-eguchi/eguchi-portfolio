import assert from "node:assert/strict";
import test from "node:test";
import { extractCurrentState, extractHeadField } from "./check-handoff-freshness.mjs";
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
  assert.equal(extractHeadField("- **HEAD:** `SELF`"), "SELF");
  // 1行にまとめた書き方（2026-08-03 まで読めずに警告を出し続けていた形）
  assert.equal(
    extractHeadField("- **Branch:** `main` / **HEAD:** `SELF` / **origin/main:** `a3946fc`"),
    "SELF",
  );
  // ハッシュ指定
  assert.equal(extractHeadField("- **Branch:** `main` / **HEAD:** `c2f7117`"), "c2f7117");
  // 欄が無い場合は null
  assert.equal(extractHeadField("- **Status:** Ready"), null);
  assert.equal(extractHeadField(null), null);
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
