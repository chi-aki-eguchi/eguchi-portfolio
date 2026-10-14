import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const root = process.env.PORTFOLIO_SOURCE_ROOT || fileURLToPath(new URL("../../", import.meta.url));
const html = readFileSync(resolve(root, "packages/web/public/offline.html"), "utf8");
function page() {
  let reloads = 0;
  const handlers = new Map();
  const location = { href: "https://portfolio.example/series/one?lang=ja", reload() { reloads++; } };
  const window = { location, addEventListener(type, fn, options) { handlers.set(type, { fn, options }); } };
  const document = { getElementById(id) {
    assert.equal(id, "retry"); return { addEventListener(type, fn) { handlers.set(type, { fn }); } };
  } };
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  vm.runInNewContext(script, { window, document });
  return { location, handlers, get reloads() { return reloads; } };
}
test("retry reloads the requested page rather than navigating to home", () => {
  const p = page(); p.handlers.get("click").fn();
  assert.equal(p.reloads, 1);
  assert.equal(p.location.href, "https://portfolio.example/series/one?lang=ja");
});
test("online recovery is one-shot and never scheduled polling", () => {
  const p = page(); const event = p.handlers.get("online");
  assert.equal(event.options.once, true); event.fn(); assert.equal(p.reloads, 1);
});
test("message does not misdiagnose all errors as disconnected internet", () => {
  assert.doesNotMatch(html, /インターネットに接続されていません/);
  assert.match(html, /サイトが一時的に応答していない/);
});
