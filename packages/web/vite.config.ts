// Railway deployment trigger 2026-06-17
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite"
import path from "path";
import honoDevPlugin from "./vite/plugins/hono-dev-plugin";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, root, '');
	Object.assign(process.env, env);

	return {
		plugins: [honoDevPlugin(), react(), tailwind()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src/web"),
			},
		},
		build: {
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
