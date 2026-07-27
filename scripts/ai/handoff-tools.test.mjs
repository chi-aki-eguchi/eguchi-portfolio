import assert from "node:assert/strict";
import test from "node:test";
import { extractCurrentState } from "./check-handoff-freshness.mjs";
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
