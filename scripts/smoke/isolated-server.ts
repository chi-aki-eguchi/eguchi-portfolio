// `bun run smoke` の webServer。本番へつながらない開発サーバーを起動する。
//
//   bun --no-env-file scripts/smoke/isolated-server.ts
//
// 1. 親から受け取るのは SMOKE_* の4つだけ。DB・保存先・パスワードの値は親の
//    環境変数から一切引き継がず、ここで一から組み立てる。
// 2. 組み立てた環境を検証し（packages/web/vite/smoke-isolation.ts）、ポートが
//    空いていることを確かめてから、一時フォルダを新しく作る。既に動いている
//    サーバーは再利用も終了もしない。
// 3. 一時SQLiteへ人工データを入れ、127.0.0.1 に偽ストレージを立て、
//    Node で Vite を起動する（Bun は .env を自動で読むので Vite には使わない）。
// 4. 終了・異常終了時は、自分が起動したプロセスと、自分が作った一時フォルダ
//    だけを片付ける。
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import net from "node:net";
import { join, resolve } from "node:path";
import {
  assertIsolated,
  SMOKE_BUCKET,
  SMOKE_ISOLATION_FLAG,
  SMOKE_PASSWORD_PREFIX,
  smokeDatabasePath,
  smokeDatabaseUrl,
  smokeStorageEndpoint,
} from "../../packages/web/vite/smoke-isolation.ts";

const repoRoot = resolve(import.meta.dir, "../..");
const webDir = join(repoRoot, "packages/web");

type Env = Record<string, string>;

function fail(code: number, message: string): never {
  console.error(`[smoke-server] ${message}`);
  process.exit(code);
}

export function readInputs(parent: Record<string, string | undefined>) {
  const runDir = parent.SMOKE_RUN_DIR ?? "";
  const password = parent.SMOKE_ADMIN_PASSWORD ?? "";
  const webPort = parent.SMOKE_WEB_PORT ?? "";
  const storagePort = parent.SMOKE_STORAGE_PORT ?? "";
  if (!runDir) fail(2, "SMOKE_RUN_DIR がない");
  if (!password.startsWith(SMOKE_PASSWORD_PREFIX))
    fail(2, "SMOKE_ADMIN_PASSWORD がテスト専用の形ではない");
  if (!/^\d{2,5}$/.test(webPort) || !/^\d{2,5}$/.test(storagePort))
    fail(2, "SMOKE_WEB_PORT / SMOKE_STORAGE_PORT が数値ではない");
  return { runDir, password, webPort, storagePort };
}

/** Vite へ渡す環境。親の環境変数は、下の実行に要る最小限しか写さない。 */
export function buildServerEnv(
  parent: Record<string, string | undefined>,
  inputs: ReturnType<typeof readInputs>,
): Env {
  const keep = ["PATH", "TMPDIR", "LANG", "LC_ALL", "TERM", "FORCE_COLOR"];
  const env: Env = {};
  for (const key of keep) if (parent[key]) env[key] = parent[key]!;
  const home = join(inputs.runDir, "home");
  Object.assign(env, {
    HOME: home,
    [SMOKE_ISOLATION_FLAG]: "1",
    SMOKE_RUN_DIR: inputs.runDir,
    SMOKE_STORAGE_PORT: inputs.storagePort,
    DATABASE_URL: smokeDatabaseUrl(inputs.runDir),
    ADMIN_PASSWORD: inputs.password,
    S3_ENDPOINT: smokeStorageEndpoint(inputs.storagePort),
    S3_BUCKET: SMOKE_BUCKET,
    S3_REGION: "auto",
    S3_ACCESS_KEY_ID: "smoke-access-key",
    S3_SECRET_ACCESS_KEY: "smoke-secret-key",
    S3_FORCE_PATH_STYLE: "true",
    // AWS SDK が利用者の ~/.aws やメタデータ窓口を読みに行かないようにする。
    AWS_CONFIG_FILE: join(home, "no-aws-config"),
    AWS_SHARED_CREDENTIALS_FILE: join(home, "no-aws-credentials"),
    AWS_EC2_METADATA_DISABLED: "true",
    GA_MEASUREMENT_ID: "",
  });
  return env;
}

function portIsFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolvePort) => {
    const probe = net.createServer();
    probe.once("error", (error: NodeJS.ErrnoException) =>
      // その種類のアドレスが使えない環境は「使用中」ではない。
      resolvePort(!["EADDRINUSE", "EACCES"].includes(error.code ?? "")),
    );
    probe.listen({ port, host, exclusive: true }, () =>
      probe.close(() => resolvePort(true)),
    );
  });
}

async function assertPortsFree(ports: number[]) {
  for (const port of ports) {
    for (const host of ["127.0.0.1", "::1"]) {
      if (!(await portIsFree(port, host)))
        fail(
          3,
          `ポート ${port}（${host}）は使用中。既に動いているサーバーは再利用も終了もしないので、止めてから実行し直す。`,
        );
    }
  }
}

type StorageRequest = { method: string; key: string };

function startStorage(port: number, images: Map<string, { body: Uint8Array; contentType: string }>) {
  const objects = new Map(images);
  const requests: StorageRequest[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/__smoke/requests")
        return Response.json(requests);
      const prefix = `/${SMOKE_BUCKET}/`;
      if (!url.pathname.startsWith(prefix))
        return new Response("unknown bucket", { status: 404 });
      const key = decodeURIComponent(url.pathname.slice(prefix.length));
      requests.push({ method: req.method, key });
      if (req.method === "PUT") {
        objects.set(key, {
          body: new Uint8Array(await req.arrayBuffer()),
          contentType: req.headers.get("content-type") ?? "application/octet-stream",
        });
        return new Response(null, { status: 200, headers: { etag: '"smoke"' } });
      }
      if (req.method === "DELETE") {
        objects.delete(key);
        return new Response(null, { status: 204 });
      }
      const object = objects.get(key);
      if (!object)
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Key>${key}</Key></Error>`,
          { status: 404, headers: { "content-type": "application/xml" } },
        );
      const headers = {
        "content-type": object.contentType,
        "content-length": String(object.body.byteLength),
        etag: '"smoke"',
        "last-modified": new Date(0).toUTCString(),
      };
      return new Response(req.method === "HEAD" ? null : object.body.slice(), { headers });
    },
  });
  return server;
}

async function main() {
  const inputs = readInputs(process.env);
  const env = buildServerEnv(process.env, inputs);
  // 通信を始める前に、組み立てた環境そのものを検証する。
  try {
    assertIsolated(env, "isolated-server");
  } catch (error) {
    fail(2, (error as Error).message);
  }
  const webPort = Number(inputs.webPort);
  const storagePort = Number(inputs.storagePort);
  await assertPortsFree([webPort, storagePort]);

  try {
    mkdirSync(inputs.runDir); // 既にあれば失敗する＝他の実行の物に触れない
  } catch (error) {
    fail(4, `一時フォルダを新しく作れない: ${(error as Error).message}`);
  }
  mkdirSync(env.HOME);

  let child: ChildProcess | null = null;
  let storage: ReturnType<typeof startStorage> | null = null;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (child && child.exitCode === null) child.kill("SIGTERM");
    storage?.stop(true);
    rmSync(inputs.runDir, { recursive: true, force: true });
  };
  const stop = (code: number) => {
    cleanup();
    process.exit(code);
  };
  process.on("SIGTERM", () => stop(0));
  process.on("SIGINT", () => stop(130));
  process.on("SIGHUP", () => stop(129));
  process.on("uncaughtException", (error) => {
    console.error("[smoke-server]", error);
    stop(1);
  });

  try {
    const fixtures = await import("../../packages/web/src/test-fixtures/smoke-site.ts");
    await fixtures.createSmokeDatabase(smokeDatabasePath(inputs.runDir));
    storage = startStorage(storagePort, await fixtures.createSmokeImages());
  } catch (error) {
    console.error("[smoke-server] 人工データの準備に失敗した", error);
    stop(5);
  }

  child = spawn(
    "node",
    [join(webDir, "node_modules/vite/bin/vite.js"), "--port", String(webPort), "--strictPort"],
    { cwd: webDir, env, stdio: ["ignore", "inherit", "inherit"] },
  );
  child.on("exit", (code, signal) => {
    if (cleaned) return;
    console.error(`[smoke-server] Vite が終了した（code=${code} signal=${signal}）`);
    stop(code === 0 ? 1 : (code ?? 1));
  });
  console.log(
    `[smoke-server] ready: web=${webPort} storage=127.0.0.1:${storagePort} db=${smokeDatabasePath(inputs.runDir)}`,
  );
}

if (import.meta.main) await main();
