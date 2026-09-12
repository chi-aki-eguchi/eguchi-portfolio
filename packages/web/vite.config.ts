// Railway deployment trigger 2026-06-17
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite"
import path from "path";
import honoDevPlugin from "./vite/plugins/hono-dev-plugin";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
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

	return {
		plugins: [honoDevPlugin(), react(), tailwind()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src/web"),
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
					// Split node_modules into long-cached vendor chunks so the
					// per-page index chunk stays small (react-dom was leaking into it).
					manualChunks(id) {
						if (!id.includes("node_modules")) return;
						if (id.includes("react-dom") || id.includes("/scheduler/") || /\/react\//.test(id)) return "react-vendor";
						if (id.includes("@tanstack")) return "query-vendor";
						return "vendor";
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
});
