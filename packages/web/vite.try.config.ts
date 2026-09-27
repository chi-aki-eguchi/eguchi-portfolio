// 公開サイトの試作を、本番の公開写真で触って試すための開発サーバー。
//
//   bun run try            → http://localhost:4400/ （見た目は写真集）
//   TRY_DESIGN=classic bun run try   → いつもの構成で試す
//
// - API は本番（TRY_TARGET、既定 https://akieguchi.com）の**公開 GET だけ**を
//   中継する。保存・削除・ログインなど GET/HEAD 以外は、ここで 403 にして
//   本番へ送らない。管理画面の API も中継しない。
// - `.env` は読まない（DB・保存先・パスワードに一切つながらない）。
// - 設定（/api/settings）の `siteDesign` だけを差し替えて返す。本番の設定は
//   変わらない。
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "path";

const TARGET = (process.env.TRY_TARGET || "https://akieguchi.com").replace(/\/$/, "");
const DESIGN = process.env.TRY_DESIGN || "book";

function readOnlyApi(): Plugin {
  return {
    name: "try-read-only-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "/";
        // 管理画面はここでは開けない（ログインも本番へ送らない）。ログイン画面だけ
        // 出て必ず失敗すると迷うので、見本データで試せる try:admin へ案内する。
        if (/^\/admin(\/|\?|$)/.test(url) && (req.headers.accept ?? "").includes("text/html")) {
          res.statusCode = 200;
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.setHeader("cache-control", "no-store");
          res.end(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>管理画面はこちら</title>
<body style="font:16px/1.8 system-ui,sans-serif;max-width:34rem;margin:12vh auto;padding:0 20px;color:#222">
<h1 style="font-size:20px">このお試しでは管理画面を開けません</h1>
<p>ここ（localhost:4400）は、本番の写真を<strong>読むだけ</strong>で表示するお試しです。ログインや保存は本番へ送りません。</p>
<p>管理画面は、見本の写真で試せる別のお試しで開けます。</p>
<p><a href="http://localhost:5299/admin" style="font-size:18px">http://localhost:5299/admin</a></p>
<p style="color:#666;font-size:14px">開かないときは、ターミナルで <code>bun run try:admin</code> を実行してください。パスワードはそのターミナルに表示されます。</p>
</body></html>`);
          return;
        }
        if (!url.startsWith("/api/")) return next();
        const method = req.method ?? "GET";
        if ((method !== "GET" && method !== "HEAD") || url.startsWith("/api/admin")) {
          res.statusCode = 403;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "お試し用サーバーは読むだけです（本番へは送っていません）" }));
          return;
        }
        try {
          const upstream = await fetch(TARGET + url, {
            method,
            headers: { accept: req.headers.accept ?? "*/*" },
          });
          res.statusCode = upstream.status;
          const type = upstream.headers.get("content-type") ?? "";
          if (type) res.setHeader("content-type", type);
          res.setHeader("cache-control", "no-store");
          if (url.startsWith("/api/settings") && type.includes("json") && upstream.ok) {
            const json = (await upstream.json()) as Record<string, unknown>;
            res.end(JSON.stringify({ ...json, siteDesign: DESIGN }));
            return;
          }
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (error) {
          res.statusCode = 502;
          res.end(`upstream error: ${(error as Error).message}`);
        }
      });
    },
  };
}

export default defineConfig({
  // .env を読ませない（envDir を空のフォルダ相当にする）。
  envDir: path.resolve(__dirname, "vite"),
  plugins: [readOnlyApi(), react(), tailwind()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src/web") },
  },
  server: { port: 4400, strictPort: true, host: true, hmr: { overlay: false } },
});
