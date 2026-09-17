import type { Plugin, ViteDevServer } from "vite";
import { realpathSync } from "node:fs";
import {
  isolationProblems,
  SMOKE_ISOLATION_FLAG,
  SMOKE_ISOLATION_PATH,
  smokeDatabasePath,
} from "../smoke-isolation.ts";
import { blockedConnections } from "../smoke-egress-guard.ts";

export default function honoDevPlugin(): Plugin {
  return {
    name: "hono-dev-server",
    configureServer(server) {
      const isolated = process.env[SMOKE_ISOLATION_FLAG] === "1";
      if (isolated) {
        // smoke 用。API が実際に開いている DB ファイルまで確かめて返す。
        // 200 はこの実行の一時SQLiteにつながっているときだけ。
        server.middlewares.use(SMOKE_ISOLATION_PATH, async (_req, res) => {
          const report = await smokeIsolationReport(server);
          res.statusCode = report.ok ? 200 : 503;
          res.setHeader("content-type", "application/json");
          res.setHeader("cache-control", "no-store");
          res.end(JSON.stringify(report));
        });
      }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();

        try {
          if (isolated && isolationProblems(process.env).length > 0) {
            // vite.config.ts で起動前に止めているので通常は来ない。来ても API を読まない。
            res.statusCode = 503;
            res.end("smoke isolation check failed");
            return;
          }
          const request = await toWebRequest(req);
          const app = await loadApp(server);
          const response = await app.fetch(request);

          res.statusCode = response.status;
          response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          console.error("[hono-dev]", err);
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      });
    },
  };
}

// ゴミ箱の保持期間（api/index.ts の TRASH_RETENTION_DAYS と同じ30日）。
const TRASH_RETENTION_SECONDS = 30 * 24 * 60 * 60;

async function smokeIsolationReport(server: ViteDevServer) {
  const problems = isolationProblems(process.env);
  const expected = smokeDatabasePath(process.env.SMOKE_RUN_DIR ?? "");
  let database: string | null = null;
  let expiredTrash: number | null = null;
  if (problems.length === 0) {
    try {
      const mod = await server.ssrLoadModule("/src/api/database/index.ts");
      const client = mod.db.$client as {
        execute: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>;
      };
      const list = await client.execute("PRAGMA database_list");
      const main = list.rows.find((row) => row.name === "main");
      database = typeof main?.file === "string" ? main.file : null;
      if (!database || realpathSync(database) !== realpathSync(expected))
        problems.push("API が開いている DB がこの実行の一時SQLiteではない");
      // ゴミ箱を開くと保持期間を過ぎた写真が消える。テスト中に共有データが
      // 変わらないよう、期限切れのゴミ箱写真が無いことも確かめる。
      const cutoff = Math.floor(Date.now() / 1000) - TRASH_RETENTION_SECONDS;
      const trash = await client.execute(
        `SELECT count(*) AS n FROM photos WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoff}`,
      );
      expiredTrash = Number(trash.rows[0]?.n ?? 0);
      if (expiredTrash > 0)
        problems.push("期限切れのゴミ箱写真がある（開くと削除され、テスト間で共有データが変わる）");
    } catch (error) {
      problems.push(`DB の確認に失敗した: ${(error as Error).message}`);
    }
  }
  return {
    ok: problems.length === 0,
    problems,
    runDir: process.env.SMOKE_RUN_DIR ?? null,
    database,
    storage: process.env.S3_ENDPOINT ?? null,
    expiredTrash,
    blockedConnections: blockedConnections(),
  };
}

async function loadApp(server: ViteDevServer) {
  const mod = await server.ssrLoadModule("/src/api/index.ts");
  return mod.default;
}

function toWebRequest(req: import("http").IncomingMessage): Request {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (req as unknown as ReadableStream) : undefined,
    // @ts-expect-error duplex needed for streaming request bodies
    duplex: hasBody ? "half" : undefined,
  });
}
