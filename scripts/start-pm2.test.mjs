import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { startPm2 } from "./start-pm2.mjs";

function fixture(t) {
  const repo = mkdtempSync(path.join(tmpdir(), "portfolio-start-test-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const dist = path.join(repo, "packages/web/dist");
  mkdirSync(path.join(dist, "assets"), { recursive: true });
  return { repo, dist };
}

test("reading PM2 configuration cannot execute commands or touch files", () => {
  const source = readFileSync(new URL("../ecosystem.config.cjs", import.meta.url), "utf8");
  const sandbox = {
    module: { exports: {} },
    __dirname: "/fixture/portfolio",
    process: { env: { PORT: "4567" } },
    require(name) {
      assert.equal(name, "node:path", `configuration attempted to load ${name}`);
      return path;
    },
  };
  vm.runInNewContext(source, sandbox);
  const app = sandbox.module.exports.apps[0];
  assert.equal(app.cwd, "/fixture/portfolio/packages/web");
  assert.equal(app.script, "src/server.ts");
  assert.equal(app.env.PORT, "4567");
});

test("missing or incomplete build leaves an existing PM2 process alone", (t) => {
  const { repo, dist } = fixture(t);
  let calls = 0;
  const run = () => { calls += 1; return { status: 0 }; };
  assert.throws(() => startPm2({ repo, run }));
  writeFileSync(path.join(dist, "index.html"), '<script type="module" src="/assets/missing.js"></script>');
  assert.throws(() => startPm2({ repo, run }));
  assert.equal(calls, 0);
});

test("a complete build starts or restarts without deleting the process", (t) => {
  const { repo, dist } = fixture(t);
  writeFileSync(path.join(dist, "index.html"), '<script type="module" src="/assets/app.js"></script><link href="/assets/app.css" rel="stylesheet">');
  writeFileSync(path.join(dist, "assets/app.js"), "export {};");
  writeFileSync(path.join(dist, "assets/app.css"), "body {}");
  const calls = [];
  const status = startPm2({ repo, run: (...args) => { calls.push(args); return { status: 0 }; } });
  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1].slice(1), ["startOrRestart", path.join(repo, "ecosystem.config.cjs"), "--update-env"]);
  assert.equal(calls[0][2].cwd, repo);
});

test("a PM2 failure is returned to the caller", (t) => {
  const { repo, dist } = fixture(t);
  writeFileSync(path.join(dist, "index.html"), '<script type="module" src="/assets/app.js"></script>');
  writeFileSync(path.join(dist, "assets/app.js"), "export {};");
  assert.equal(startPm2({ repo, run: () => ({ status: 7 }) }), 7);
});
