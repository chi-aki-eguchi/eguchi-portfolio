// Run from the repository root: node --test scripts/regression/offline.test.mjs
// Tests the actual worker/recovery scripts with mocked network/storage, not a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = (name) => readFileSync(new URL(`../../packages/web/public/${name}`, import.meta.url), 'utf8');
const workerSource = source('sw.js');
const recoverySource = source('offline-recovery.js');
const origin = 'https://portfolio.test';
const json = () => new Response('{"status":"ok"}', { headers: { 'content-type': 'application/json' } });

function worker(options = {}) {
  const handlers = new Map();
  const entries = new Map();
  const fetches = [], writes = [], deleted = [], waits = [], added = [];
  let skipCount = 0;
  const key = (r) => typeof r === 'string' ? new URL(r, origin).href : r.url;
  const cache = {
    async match(r) {
      if (options.matchFails) throw new Error('SecurityError');
      return entries.get(key(r))?.clone();
    },
    async put(r, res) {
      if (options.putFails) throw new Error('QuotaExceededError');
      writes.push(key(r));
      entries.set(key(r), res.clone());
    },
    async keys() { return [...entries.keys()]; },
    async delete(r) { deleted.push(key(r)); return entries.delete(key(r)); },
    async addAll(urls) { added.push(...urls); },
  };
  const context = {
    self: {
      location: { origin },
      addEventListener: (name, fn) => handlers.set(name, fn),
      skipWaiting: async () => { skipCount += 1; },
      clients: { claim() { throw new Error('must not claim the first visit'); } },
    },
    caches: {
      async open() {
        if (options.openFails) throw new Error('SecurityError');
        return cache;
      },
      async keys() { return ['static-v2', 'static-v3', 'images-v2']; },
      async delete(name) { deleted.push(name); return true; },
    },
    fetch: async (r) => {
      fetches.push(key(r));
      return options.fetch ? options.fetch(r, fetches.length) : new Response('network');
    },
    setTimeout: (fn, ms) => { waits.push(ms); queueMicrotask(fn); return waits.length; },
    URL, Response, Headers, DOMException,
  };
  vm.runInNewContext(workerSource, context, { filename: 'sw.js' });
  function dispatch(path, init = {}) {
    const request = new Request(new URL(path, origin), init);
    if (init.navigation) Object.defineProperty(request, 'mode', { value: 'navigate' });
    const pending = [];
    let response;
    handlers.get('fetch')({ request, waitUntil: (p) => pending.push(p), respondWith: (p) => { response = p; } });
    return { response, settle: () => Promise.all(pending) };
  }
  async function lifecycle(type) {
    const pending = [];
    handlers.get(type)({ waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
  }
  return { entries, fetches, writes, deleted, waits, added, dispatch, lifecycle, skips: () => skipCount };
}

for (const fault of ['openFails', 'matchFails', 'putFails']) {
  test(`image network response survives ${fault}`, async () => {
    const w = worker({ [fault]: true });
    const e = w.dispatch('/api/images/photo.jpg');
    assert.equal(await (await e.response).text(), 'network');
    await e.settle();
    assert.equal(w.fetches.length, 1);
  });
}
test('image cache hits do not fetch or rewrite/enumerate the cache', async () => {
  const w = worker();
  w.entries.set(`${origin}/api/images/photo.jpg`, new Response('cached'));
  const e = w.dispatch('/api/images/photo.jpg');
  assert.equal(await (await e.response).text(), 'cached');
  await e.settle();
  assert.equal(w.fetches.length, 0);
  assert.equal(w.writes.length, 0);
});
test('partial images are not cached', async () => {
  const w = worker({ fetch: () => new Response('partial', { status: 206 }) });
  const e = w.dispatch('/api/images/photo.jpg');
  assert.equal((await e.response).status, 206);
  await e.settle();
  assert.equal(w.writes.length, 0);
});
test('new image entries evict the oldest entries above the 300 limit', async () => {
  const w = worker();
  for (let i = 0; i < 300; i += 1) w.entries.set(`${origin}/api/images/${i}`, new Response('old'));
  const e = w.dispatch('/api/images/new');
  await e.response; await e.settle();
  assert.equal(w.entries.size, 300);
  assert.deepEqual(w.deleted, [`${origin}/api/images/0`]);
});
test('static cache hits survive failed background fetches without rejected waitUntil', async () => {
  const w = worker({ fetch: () => { throw new TypeError('network offline'); } });
  w.entries.set(`${origin}/assets/app.js`, new Response('cached-js'));
  const e = w.dispatch('/assets/app.js');
  assert.equal(await (await e.response).text(), 'cached-js');
  await e.settle();
});
for (const fault of ['openFails', 'matchFails', 'putFails']) {
  test(`static network response survives ${fault}`, async () => {
    const w = worker({ [fault]: true });
    const e = w.dispatch('/assets/app.css');
    assert.equal(await (await e.response).text(), 'network');
    await e.settle();
  });
}
test('HTML error/fallback responses are never stored as scripts', async () => {
  const w = worker({ fetch: () => new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } }) });
  const e = w.dispatch('/assets/app.js');
  await e.response; await e.settle();
  assert.equal(w.writes.length, 0);
});
test('API data and mutations bypass the worker', () => {
  const w = worker();
  assert.equal(w.dispatch('/api/settings').response, undefined);
  assert.equal(w.dispatch('/api/health').response, undefined);
  assert.equal(w.dispatch('/api/images/photo', { method: 'POST' }).response, undefined);
  assert.equal(w.dispatch('/contact', { method: 'POST', body: 'test' }).response, undefined);
  assert.equal(w.fetches.length, 0);
});
for (const first of ['network', 502, 503, 504]) {
  test(`navigation retries ${first} once, then returns the healthy document`, async () => {
    const w = worker({ fetch: (_r, attempt) => {
      if (attempt === 1) {
        if (first === 'network') throw new TypeError('connection reset');
        return new Response('gateway', { status: first });
      }
      return new Response('document');
    } });
    const e = w.dispatch('/series/one?lang=ja', { navigation: true });
    assert.equal(await (await e.response).text(), 'document');
    assert.equal(w.fetches.length, 2);
    assert.deepEqual(w.waits, [350]);
  });
}
test('navigation errors have a valid no-store 503 fallback even without storage', async () => {
  const w = worker({ openFails: true, fetch: () => { throw new TypeError('offline'); } });
  const res = await w.dispatch('/series/one', { navigation: true }).response;
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(await res.text(), /通信またはサーバー/);
  assert.equal(w.fetches.length, 2);
});
test('cached offline page is served with fresh transport headers', async () => {
  const w = worker({ fetch: () => { throw new TypeError('offline'); } });
  w.entries.set(`${origin}/offline.html`, new Response('offline-page', { headers: { 'content-length': '987', 'content-encoding': 'br' } }));
  const res = await w.dispatch('/series/one', { navigation: true }).response;
  assert.equal(await res.text(), 'offline-page');
  assert.equal(res.headers.get('content-length'), null);
  assert.equal(res.headers.get('content-encoding'), null);
});
for (const status of [403, 404, 500, 502]) {
  test(`real HTTP ${status} is preserved instead of labelled offline`, async () => {
    const w = worker({ fetch: () => new Response('server response', { status }) });
    const res = await w.dispatch('/series/one', { navigation: true }).response;
    assert.equal(res.status, status);
    assert.equal(await res.text(), 'server response');
    assert.equal(w.fetches.length, status === 502 ? 2 : 1);
  });
}
test('a navigation ending in .js does not enter the static cache', async () => {
  const w = worker();
  const e = w.dispatch('/example.js', { navigation: true });
  await e.response; await e.settle();
  assert.equal(w.writes.length, 0);
});
test('cancelled navigation is not retried', async () => {
  const controller = new AbortController(); controller.abort();
  const w = worker();
  await assert.rejects(w.dispatch('/series/one', { navigation: true, signal: controller.signal }).response, { name: 'AbortError' });
  assert.equal(w.fetches.length, 0);
});
test('install precaches the recovery page and script before activation, without claim', async () => {
  const w = worker();
  await w.lifecycle('install'); await w.lifecycle('activate');
  assert.deepEqual(w.added, ['/offline.html', '/offline-recovery.js']);
  assert.equal(w.skips(), 1);
  assert.deepEqual(w.deleted, ['static-v2']);
});

async function flush() { for (let i = 0; i < 20; i += 1) await Promise.resolve(); await new Promise(setImmediate); }
function recovery(options = {}) {
  const handlers = new Map(), timers = new Map();
  const storage = options.storage ?? new Map();
  let reloads = 0, fetches = 0, prevented = false;
  const window = {
    location: { pathname: '/series/one', search: '?lang=ja', hash: '#photo-2', reload: () => { reloads += 1; } },
    setTimeout: (fn) => { timers.set(timers.size + 1, fn); return timers.size; },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (name, fn) => handlers.set(name, fn),
  };
  const document = {
    visibilityState: options.hidden ? 'hidden' : 'visible',
    getElementById: () => ({ addEventListener: (name, fn) => handlers.set(name, fn) }),
    addEventListener: (name, fn) => handlers.set(name, fn),
  };
  const navigator = { onLine: options.online ?? true };
  vm.runInNewContext(recoverySource, {
    window, document, navigator, AbortController,
    Date: options.clock ?? Date,
    sessionStorage: {
      getItem: (key) => { if (options.storageFails) throw new Error('SecurityError'); return storage.get(key); },
      setItem: (key, value) => { if (options.storageFails) throw new Error('QuotaExceededError'); storage.set(key, value); },
    },
    fetch: async (...args) => { fetches += 1; return options.fetch ? options.fetch(...args) : json(); },
  }, { filename: 'offline-recovery.js' });
  return {
    window, document, navigator, storage, timers,
    reloads: () => reloads, fetches: () => fetches,
    emit: (name) => handlers.get(name)?.({ preventDefault() { prevented = true; } }),
    prevented: () => prevented,
  };
}
test('healthy JSON health check reloads the original path/query/hash once', async () => {
  const r = recovery(); await flush();
  assert.equal(r.reloads(), 1);
  assert.equal(r.window.location.pathname + r.window.location.search + r.window.location.hash, '/series/one?lang=ja#photo-2');
  r.emit('online'); r.emit('visibilitychange'); r.emit('click'); await flush();
  assert.equal(r.reloads(), 1);
  assert.equal(r.timers.size, 0);
});
test('recent automatic retry is suppressed across documents; manual retry still works', async () => {
  const first = recovery(); await flush();
  const second = recovery({ storage: first.storage }); await flush();
  assert.equal(second.fetches(), 0); assert.equal(second.reloads(), 0);
  second.emit('click');
  assert.equal(second.reloads(), 1); assert.equal(second.prevented(), true);
});
for (const kind of ['offline', 'hidden', 'storage-failure', '500', 'html', 'invalid-json', 'network-error']) {
  test(`automatic recovery does not reload on ${kind}`, async () => {
    const r = recovery({
      online: kind !== 'offline', hidden: kind === 'hidden', storageFails: kind === 'storage-failure',
      fetch: () => {
        if (kind === 'network-error') throw new TypeError('offline');
        if (kind === '500') return new Response('server error', { status: 500 });
        if (kind === 'html') return new Response('<html/>', { headers: { 'content-type': 'text/html' } });
        if (kind === 'invalid-json') return new Response('invalid', { headers: { 'content-type': 'application/json' } });
        return json();
      },
    });
    await flush(); assert.equal(r.reloads(), 0);
    r.emit('click'); assert.equal(r.reloads(), 1);
  });
}
test('online event after a browser-offline start checks the server then recovers', async () => {
  const r = recovery({ online: false }); await flush();
  assert.equal(r.fetches(), 0);
  r.navigator.onLine = true; r.emit('online'); await flush();
  assert.equal(r.reloads(), 1);
});
test('recovery health request is bounded by an abort timer', async () => {
  const r = recovery({ fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')), { once: true });
  }) });
  for (const fn of [...r.timers.values()]) fn();
  await flush();
  assert.equal(r.reloads(), 0); assert.equal(r.timers.size, 0);
});

test('a failed probe does not suppress recovery for 30 seconds after the server returns', async () => {
  let now = 100_000, healthy = false;
  const r = recovery({ clock: { now: () => now }, fetch: () => healthy ? json() : new Response('error', { status: 503 }) });
  await flush(); assert.equal(r.reloads(), 0); assert.equal(r.storage.size, 0);
  now += 1500; healthy = true;
  r.emit('visibilitychange'); await flush();
  assert.equal(r.reloads(), 1); assert.equal(r.fetches(), 2);
});
