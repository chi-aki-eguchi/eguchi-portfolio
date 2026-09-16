import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import * as schema from "../database/schema";

export type StorageRequest = { method: string; key: string };

export type IsolatedApi = {
  /** 一時SQLiteへ直接つながるDB。準備と結果の確認に使う。 */
  db: ReturnType<typeof drizzle<typeof schema>>;
  /** 偽ストレージが受けた要求（バケット名を除いたキー）。 */
  storageRequests: StorageRequest[];
  /** 未ログインでAPIを呼ぶ。`path` は `/api/...`。 */
  request: (path: string, init?: RequestInit) => Promise<Response>;
  /** 正規のログインAPIで得たセッションでAPIを呼ぶ。 */
  adminRequest: (path: string, init?: RequestInit) => Promise<Response>;
  stop: () => Promise<void>;
};

const BUCKET = "isolated-test-bucket";

/**
 * 本物のAPIを子プロセスで起動する。DBは一時フォルダのSQLite、ストレージは
 * 127.0.0.1の偽物。子プロセスへは親の環境変数を渡さない（本番の接続情報が
 * 親に読み込まれていても、子には届かない）。
 */
export async function startIsolatedApi(): Promise<IsolatedApi> {
  const dir = await mkdtemp(join(tmpdir(), "portfolio-api-test-"));
  const databaseUrl = `file:${join(dir, "test.db")}`;

  // 本番のTursoは `db:push` で作られている。同じく現行のschema.tsから表を作る。
  const client = createClient({ url: databaseUrl });
  const statements = await generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}),
    await generateSQLiteDrizzleJson(schema),
  );
  for (const statement of statements) await client.execute(statement);
  const db = drizzle(client, { schema });

  const storageRequests: StorageRequest[] = [];
  const storage = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      const path = decodeURIComponent(new URL(req.url).pathname);
      const key = path.replace(new RegExp(`^/${BUCKET}/`), "");
      storageRequests.push({ method: req.method, key });
      if (req.method === "DELETE") return new Response(null, { status: 204 });
      if (req.method === "PUT") return new Response(null, { status: 200 });
      return new Response("<Error><Code>NoSuchKey</Code></Error>", {
        status: 404,
        headers: { "content-type": "application/xml" },
      });
    },
  });

  const password = `isolated-${crypto.randomUUID()}`;
  const child = Bun.spawn(
    [
      process.execPath,
      "--no-env-file",
      join(import.meta.dir, "isolated-api-server.ts"),
    ],
    {
      cwd: dir,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: dir,
        NODE_ENV: "test",
        DATABASE_URL: databaseUrl,
        ADMIN_PASSWORD: password,
        S3_ENDPOINT: `http://127.0.0.1:${storage.port}`,
        S3_BUCKET: BUCKET,
        S3_REGION: "auto",
        S3_ACCESS_KEY_ID: "isolated",
        S3_SECRET_ACCESS_KEY: "isolated",
        S3_FORCE_PATH_STYLE: "true",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const stop = async () => {
    child.kill();
    await child.exited;
    storage.stop(true);
    client.close();
    await rm(dir, { recursive: true, force: true });
  };

  let baseUrl: string;
  try {
    baseUrl = `http://127.0.0.1:${await readReadyPort(child)}`;
  } catch (error) {
    await stop();
    throw error;
  }

  const request = (path: string, init?: RequestInit) =>
    fetch(`${baseUrl}${path}`, init);

  const login = await request("/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  if (!login.ok || !cookie) {
    await stop();
    throw new Error(`isolated login failed: HTTP ${login.status}`);
  }

  const adminRequest = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("cookie", cookie);
    return request(path, { ...init, headers });
  };

  return { db, storageRequests, request, adminRequest, stop };
}

async function readReadyPort(child: Bun.Subprocess<"ignore", "pipe", "pipe">) {
  // 起動後も読み続ける。読まないとログでパイプが詰まり、子が止まる。
  let stdout = "";
  let stderr = "";
  const drain = async (
    stream: ReadableStream<Uint8Array>,
    append: (text: string) => void,
  ) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) append(decoder.decode(chunk, { stream: true }));
  };
  void drain(child.stdout, (text) => (stdout += text));
  void drain(child.stderr, (text) => (stderr += text));

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const match = stdout.match(/READY (\d+)/);
    if (match) return Number(match[1]);
    if (child.exitCode !== null) break;
    await Bun.sleep(25);
  }
  throw new Error(`isolated API did not start:\n${stdout}\n${stderr}`);
}
