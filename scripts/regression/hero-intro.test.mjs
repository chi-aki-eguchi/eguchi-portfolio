// Run: node --test scripts/regression/hero-intro.test.mjs
// Needs the project's TypeScript dev dependency (or TYPESCRIPT_PATH).
// Executes the actual component's effect with React hooks/DOM/timers mocked.
// This checks interruption/lifetime logic, NOT browser layout or iPhone FPS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || 'typescript');
const filename = new URL('../../packages/web/src/web/components/develop/DevelopIntro.tsx', import.meta.url);
const result = ts.transpileModule(readFileSync(filename, 'utf8'), {
  fileName: filename.pathname,
  reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

function mount({ pendingFont = false, hasPhoto = true, expectPhoto = true } = {}) {
  const refs = [], effects = [], states = [], timers = new Map(), handlers = new Map();
  let now = 0, timerId = 0, completed = 0, stateIndex = 0;
  const window = {
    scrollY: 0,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (id) => timers.delete(id),
    addEventListener(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
    },
    removeEventListener: (name, fn) => handlers.get(name)?.delete(fn),
  };
  const image = { complete: true, naturalWidth: 1000, currentSrc: '/photo.jpg', decode: async () => {}, closest: () => ({}) };
  const root = { parentElement: { querySelector: (selector) => selector.includes('img') ? (hasPhoto ? image : null) : {} } };
  const props = { name: '秋', caption: '', expectPhoto, onDone: () => { completed += 1; } };
  const exports = {};
  vm.runInNewContext(result.outputText, {
    exports, window, performance: { now: () => now },
    document: { fonts: { ready: pendingFont ? new Promise(() => {}) : Promise.resolve() } },
    sessionStorage: { setItem() {} },
    getComputedStyle: () => ({ objectFit: 'cover', objectPosition: '50% 50%', backgroundColor: 'white' }),
    require(name) {
      if (name === 'react') return {
        useRef(value) { const ref = { current: value }; refs.push(ref); return ref; },
        useState(value) {
          const index = stateIndex++;
          return [value, (next) => { states.push({ index, value: next }); }];
        },
        useLayoutEffect() {},
        useEffect: (fn) => effects.push(fn),
      };
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name.endsWith('.css')) return {};
      if (name === '../../lib/develop-intro') return {
        INTRO_FONT_WAIT_MS: 100, INTRO_GROW_AFTER_MS: 20, INTRO_GROW_MS: 20,
        INTRO_IMAGE_WAIT_MS: 200, INTRO_OUT_MS: 20, INTRO_PLATE_AFTER_MS: 20,
        INTRO_SEEN_KEY: 'seen', introLayout: () => null, isVerticalName: () => true,
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename: 'DevelopIntro.transpiled.cjs' });
  exports.DevelopIntro(props);
  refs[0].current = root;
  let cleanup = effects[0]();
  async function advance(ms) {
    await flush();
    const target = now + ms;
    let steps = 0;
    while (true) {
      const next = [...timers.entries()].filter(([, item]) => item.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert.ok(++steps < 100, 'timer loop should be bounded');
      const [id, item] = next;
      timers.delete(id); now = item.at; item.fn(); await flush();
    }
    now = target; await flush();
  }
  return {
    window, timers, handlers, advance,
    phases: () => states.filter((item) => item.index === 0).map((item) => item.value),
    completed: () => completed,
    emit: (name) => { for (const fn of handlers.get(name) || []) fn(); },
    cleanup: () => cleanup?.(),
    strictReplay() { cleanup?.(); cleanup = effects[0](); },
  };
}

test('touch during font wait finishes immediately, with no out/grow and no pending timers', async () => {
  const m = mount({ pendingFont: true });
  m.emit('touchstart');
  assert.equal(m.completed(), 1);
  assert.equal(m.timers.size, 0);
  await m.advance(5000);
  assert.deepEqual(m.phases(), []);
  m.cleanup();
});
test('swipe during plate reveal does not trigger fullscreen growth/exit', async () => {
  const m = mount(); await m.advance(20);
  assert.deepEqual(m.phases(), ['on', 'plate']);
  m.emit('touchstart');
  assert.equal(m.completed(), 1); assert.equal(m.timers.size, 0);
  await m.advance(5000);
  assert.deepEqual(m.phases(), ['on', 'plate']);
  m.cleanup();
});
test('pointer, touch and scroll sequence only completes once', async () => {
  const m = mount(); await m.advance(40);
  assert.deepEqual(m.phases(), ['on', 'plate', 'grow']);
  m.emit('pointerdown'); m.emit('touchstart'); m.window.scrollY = 60; m.emit('scroll');
  await m.advance(5000);
  assert.equal(m.completed(), 1); assert.ok(!m.phases().includes('out'));
  m.cleanup();
});
test('natural playback still plays plate, grow, then the full exit duration', async () => {
  const m = mount(); await m.advance(140);
  assert.deepEqual(m.phases(), ['on', 'plate', 'grow', 'out']);
  assert.equal(m.completed(), 0);
  await m.advance(59); assert.equal(m.completed(), 0);
  await m.advance(1); assert.equal(m.completed(), 1); assert.equal(m.timers.size, 0);
  m.cleanup();
});
test('input during natural fade-out skips its remaining timer exactly once', async () => {
  const m = mount(); await m.advance(140);
  m.emit('wheel'); assert.equal(m.completed(), 1); assert.equal(m.timers.size, 0);
  await m.advance(5000); assert.equal(m.completed(), 1);
  m.cleanup();
});
test('negative overscroll also interrupts while small scroll noise does not', async () => {
  const m = mount({ pendingFont: true });
  m.window.scrollY = 3; m.emit('scroll'); assert.equal(m.completed(), 0);
  m.window.scrollY = -20; m.emit('scroll'); assert.equal(m.completed(), 1);
  assert.equal(m.timers.size, 0); m.cleanup();
});
test('unmount clears timers and listeners without completing or updating later', async () => {
  const m = mount(); await m.advance(20);
  m.cleanup();
  assert.equal(m.timers.size, 0);
  for (const set of m.handlers.values()) assert.equal(set.size, 0);
  await m.advance(5000);
  assert.equal(m.completed(), 0); assert.deepEqual(m.phases(), ['on', 'plate']);
});
test('StrictMode effect cleanup/setup does not retain the previous lifecycle', async () => {
  const m = mount(); m.strictReplay(); await m.advance(20);
  assert.deepEqual(m.phases(), ['on', 'plate']);
  for (const set of m.handlers.values()) assert.equal(set.size, 1);
  m.emit('keydown'); await m.advance(5000);
  assert.equal(m.completed(), 1); m.cleanup();
});
test('missing photo still ends naturally with the existing name-only exit', async () => {
  const m = mount({ hasPhoto: false, expectPhoto: false });
  await m.advance(1500);
  assert.deepEqual(m.phases(), ['on', 'out']); assert.equal(m.completed(), 0);
  await m.advance(60); assert.equal(m.completed(), 1); m.cleanup();
});
