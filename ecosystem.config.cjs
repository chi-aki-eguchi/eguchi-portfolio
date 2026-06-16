const { execSync } = require("node:child_process");
const path = require("node:path");

// Sync the DB schema before the server starts (prod deploy).
// This runs once when `pm2 start ecosystem.config.cjs` evaluates this file —
// NOT on auto-restart, since PM2 re-launches `script` (src/server.ts), not the
// config. A failure is logged but does not block startup (the schema may
// already be in sync). `timeout` guards against an unexpected interactive hang.
try {
  console.log("[ecosystem] Syncing DB schema (db:push)…");
  execSync("bun run db:push", {
    cwd: path.join(__dirname, "packages/web"),
    stdio: "inherit",
    env: process.env,
    timeout: 120000,
  });
  console.log("[ecosystem] DB schema synced.");
} catch (err) {
  console.error("[ecosystem] db:push failed — starting server anyway:", err && err.message);
}

// 2026-06-13: the deploy bundle now SHIPS packages/web/dist (built and smoke-
// tested by scripts/deploy.sh), so no build runs here anymore. The previous
// boot-time `bunx vite build` failed silently on Runable (devDependencies like
// vite/@vitejs/plugin-react aren't installed there) and the catch below kept
// serving a months-old dist — deploys appeared to "not take effect" while the
// fingerprint/assets never changed. Building at boot is now only a last-resort
// fallback for a bundle that somehow lacks dist.
const fs = require("node:fs");
const distIndex = path.join(__dirname, "packages/web/dist/index.html");
if (fs.existsSync(distIndex)) {
  console.log("[ecosystem] dist shipped with the bundle — skipping boot-time build.");
} else {
  try {
    console.log("[ecosystem] dist missing — building web client (vite build)…");
    execSync("bunx vite build", {
      cwd: path.join(__dirname, "packages/web"),
      stdio: "inherit",
      env: process.env,
      timeout: 300000,
    });
    console.log("[ecosystem] Web client built.");
  } catch (err) {
    console.error("[ecosystem] web build failed — starting server with existing dist:", err && err.message);
  }
}

// Boot diagnostic: log the shipped BUILD_ID and the asset dist/index.html points
// at. If they diverge (X-Build is new but the served dist still references an old/
// untagged asset), that's the "new server, stale dist" mismatch hit on 2026-06-15 —
// now visible right here in Runable logs without shelling in. Pure logging; never blocks boot.
try {
  const ogp = fs.readFileSync(path.join(__dirname, "packages/web/src/api/ogp.ts"), "utf8");
  const buildId = (ogp.match(/export const BUILD_ID = "([^"]*)"/) || [])[1] || "?";
  const html = fs.existsSync(distIndex) ? fs.readFileSync(distIndex, "utf8") : "";
  const mainAsset = (html.match(/\/assets\/index-[^"']+\.js/) || [])[0] || "(none)";
  console.log(`[ecosystem] BUILD_ID=${buildId} · dist index asset=${mainAsset}`);
  if (mainAsset !== "(none)" && buildId !== "?" && mainAsset.indexOf(buildId) === -1) {
    console.warn(`[ecosystem] ⚠ served dist does NOT carry BUILD_ID ${buildId} — STALE dist? Re-publish the latest ZIP / clear the Runable cache.`);
  }
} catch (err) {
  console.error("[ecosystem] boot diagnostic failed:", err && err.message);
}

module.exports = {
  apps: [
    {
      name: "web-app",
      cwd: "./packages/web",
      script: "src/server.ts",
      interpreter: "bun",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 1000,
      env: {
        PORT: process.env.PORT || 4200,
      },
    },
  ],
};
