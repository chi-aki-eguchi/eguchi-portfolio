// Railway deployment trigger 2026-06-17
import { defineConfig, loadEnv, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite"
import path from "path";
import honoDevPlugin from "./vite/plugins/hono-dev-plugin";
import publicEntryGuard from "./vite/public-entry-guard.ts";
import { assertIsolated, SMOKE_ISOLATION_FLAG } from "./vite/smoke-isolation.ts";
import { installSmokeEgressGuard } from "./vite/smoke-egress-guard.ts";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
	// smoke（scripts/smoke/isolated-server.ts から起動）では、リポジトリ直下の
	// `.env`（本番の接続情報）を読まない。起動側が一から作った環境だけを使い、
	// 一時SQLite・127.0.0.1 の偽ストレージを指していなければここで止める。
	if (process.env[SMOKE_ISOLATION_FLAG] === "1") {
		installSmokeEgressGuard();
		assertIsolated(process.env, "vite.config.ts");
		return appConfig();
	}
	const env = loadEnv(mode, root, '');
	// ローカルの `.env`（gitignore・本番未配布）は開発用に `NODE_ENV=development`
	// を持つ。ここへ無条件に Object.assign すると、`vite build`（mode=production）
	// で Vite が設定した NODE_ENV=production を上書きし、React が jsx-dev-runtime
	// （key/children検証つきの重い経路）のまま本番相当ビルドに混入する
	// （実測 CPUプロファイル: contactHeight スライダー連続ドラッグの自己時間の
	// 77.6% が `jsxDEV`）。本番デプロイは `.env` を含まないため Railway 上の
	// 実ビルドはこの影響を受けないが、ローカルで `bun run build:web` して
	// 「本番相当」を測る・検証するときは常にこの経路を踏んでいた。
	// mode から来る NODE_ENV だけは .env に譲らない。
	delete env.NODE_ENV;
	Object.assign(process.env, env);
	return appConfig();
});

function appConfig(): UserConfig {
	return {
		plugins: [honoDevPlugin(), react(), tailwind(), publicEntryGuard()],
		// Worker dependencies must be pre-bundled before editing starts (avoid a cold-start reload).
		optimizeDeps: { include: ["pdf-lib", "@pdf-lib/fontkit"] },
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src/web"),
				// budoux（日本語の文節区切り）が Node 向けに読む DOM 実装。
				// ブラウザでは使わないので、ブラウザの DOMParser に渡すだけの物へ。
				linkedom: path.resolve(__dirname, "./vite/linkedom-browser.ts"),
			},
		},
		build: {
			// 経路ごとのチャンクを先読みするために要る。`server.ts` が読み、
			// そのページで実際に要るチャンクだけ modulepreload に足す。
			// 出力先は dist/.vite/manifest.json。
			manifest: true,
			rollupOptions: {
				output: {
					// Content-hashed names PLUS a per-build BUILD_TAG suffix (deploy.sh sets
					// it from a timestamp; "b" when built manually). Content hashing alone
					// leaves unchanged chunks (e.g. vendor) at the same URL across builds —
					// so a Cloudflare edge that cached a *corrupted* copy keeps serving it.
					// Mixing the build tag into every asset name guarantees fresh URLs each
					// deploy, physically bypassing any poisoned edge cache (content.md 修正A).
					// HTML is served no-store (server.ts) so it always points at the new names.
					entryFileNames: `assets/[name]-[hash]-${process.env.BUILD_TAG || "b"}.js`,
					chunkFileNames: `assets/[name]-[hash]-${process.env.BUILD_TAG || "b"}.js`,
					assetFileNames: `assets/[name]-[hash]-${process.env.BUILD_TAG || "b"}[extname]`,
					// Split React and TanStack into long-cached vendor chunks so the
					// per-page index chunk stays small (react-dom was leaking into it).
					// Every other package is left to Rollup, which places it beside the
					// code that imports it. A catch-all "vendor" chunk pulled the admin's
					// PDF maker (pdf-lib, fontkit) and photo import (exifr) into every
					// public page: 384KB → 92KB brotli at the entry (2026-10-02).
					// vite/public-entry-guard.ts stops the build if they come back.
					manualChunks(id) {
						if (!id.includes("node_modules")) return;
						if (id.includes("react-dom") || id.includes("/scheduler/") || /\/react\//.test(id)) return "react-vendor";
						if (id.includes("@tanstack")) return "query-vendor";
					},
				},
			},
		},
		server: {
			allowedHosts: true,
			hmr: { overlay: false, },
			cors: false
		}
	};
}
