// Run after installing repository dependencies:
// node --test scripts/regression/hero-interruption.test.mjs
// Executes the actual TSX effect with a deterministic clock and mocked hooks.
// This checks lifecycle/gesture behavior, not real React rendering or device FPS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_MODULE || "typescript");
const root = process.env.PORTFOLIO_SOURCE_ROOT || fileURLToPath(new URL("../../", import.meta.url));
const file = resolve(root, "packages/web/src/web/components/develop/DevelopIntro.tsx");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: file, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, isolatedModules: true },
});
assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function mount({ image = true } = {}) {
  const timers = new Map(), listeners = new Map(), phases = [], effects = [];
  let now = 0, nextId = 0, refIndex = 0, stateIndex = 0, done = 0;
  const img = { complete: true, naturalWidth: 100, src: "/photo.jpg",
    decode: () => Promise.resolve(), closest: () => null };
  const host = { querySelector: selector => selector.includes(".hero-slide") ? (image ? img : null) : {} };
  const refs = [{ current: { parentElement: host } }, { current: null }];
  const window = {
    scrollY: 0,
    setTimeout(fn, ms) { const id = ++nextId; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, fn, options) { listeners.set(type, { fn, options }); },
    removeEventListener(type, fn) { if (listeners.get(type)?.fn === fn) listeners.delete(type); },
  };
  const react = {
    useRef(value) { const i = refIndex++; return refs[i] ||= { current: value }; },
    useState(value) {
      const i = stateIndex++;
      return [value, next => { if (i === 0) phases.push(next); }];
    },
    useEffect(fn) { effects.push(fn); },
    useLayoutEffect() {}, // DOM measurement/Canvas drawing are not under test.
  };
  const constants = {
    INTRO_FONT_WAIT_MS: 100, INTRO_GROW_AFTER_MS: 200, INTRO_GROW_MS: 300,
    INTRO_IMAGE_WAIT_MS: 1000, INTRO_OUT_MS: 300, INTRO_PLATE_AFTER_MS: 100,
    INTRO_SEEN_KEY: "intro-seen", isVerticalName: () => true,
  };
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx() {}, jsxs() {} };
      if (name === "../../lib/develop-intro") return constants;
      if (name === "./develop-intro.css") return {};
      throw Error(`Unexpected import: ${name}`);
    },
    window, document: { fonts: { ready: Promise.resolve() } },
    sessionStorage: { setItem() {} }, performance: { now: () => now },
    getComputedStyle: () => ({ objectFit: "cover", objectPosition: "50% 50%", backgroundColor: "transparent" }),
  }, { filename: file });
  exports.DevelopIntro({ name: "作品", caption: "Photographs", expectPhoto: image, onDone: () => done++ });
  const cleanup = effects[0]();
  async function advance(ms) {
    const end = now + ms;
    await flush();
    while (true) {
      const first = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!first || first[1].at > end) break;
      now = first[1].at; timers.delete(first[0]); first[1].fn(); await flush();
    }
    now = end; await flush();
  }
  return { phases, timers, listeners, window, cleanup, advance,
    emit(type) { listeners.get(type)?.fn(); }, get done() { return done; } };
}

for (const phase of ["wait", "on", "plate", "grow", "out"]) {
  test(`touch interrupts ${phase} immediately without starting a new exit/zoom`, async () => {
    const h = mount();
    const times = { wait: -1, on: 0, plate: 100, grow: 300, out: 680 };
    if (times[phase] >= 0) await h.advance(times[phase]);
    if (phase !== "wait") assert.equal(h.phases.at(-1), phase);
    const before = [...h.phases];
    h.emit("touchstart");
    assert.equal(h.done, 1, "must not wait for the fade timer during a gesture");
    assert.deepEqual(h.phases, before, "interrupting must not enter out and start an expansion");
    assert.equal(h.timers.size, 0);
    h.emit("pointerdown"); h.emit("touchstart");
    await h.advance(2000);
    assert.equal(h.done, 1, "only finish once even with synthetic/overlapping input events");
    assert.deepEqual(h.phases, before);
    h.cleanup(); assert.equal(h.listeners.size, 0);
  });
}

for (const type of ["wheel", "keydown", "pointerdown"]) {
  test(`${type} dismisses immediately with passive input`, async () => {
    const h = mount(); await h.advance(100);
    assert.equal(h.listeners.get(type).options.passive, true);
    h.emit(type); assert.equal(h.done, 1); h.cleanup();
  });
}

test("scroll below the threshold preserves intro; real scrolling interrupts", () => {
  const h = mount();
  h.window.scrollY = 4; h.emit("scroll"); assert.equal(h.done, 0);
  h.window.scrollY = 5; h.emit("scroll"); assert.equal(h.done, 1);
  h.cleanup();
});

test("natural playback still grows and fades before completing", async () => {
  const h = mount();
  await h.advance(680);
  assert.deepEqual(h.phases, ["on", "plate", "grow", "out"]);
  assert.equal(h.done, 0);
  await h.advance(340);
  assert.equal(h.done, 1);
  assert.equal(h.timers.size, 0);
  h.cleanup();
});

test("no-photo natural ending still completes", async () => {
  const h = mount({ image: false });
  await h.advance(1840);
  assert.deepEqual(h.phases, ["on", "out"]);
  assert.equal(h.done, 1); h.cleanup();
});

test("unmount cancels timers/listeners and never calls onDone afterward", async () => {
  const h = mount(); await h.advance(100); h.cleanup();
  const before = [...h.phases];
  assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
  await h.advance(2000);
  assert.equal(h.done, 0); assert.deepEqual(h.phases, before);
});
