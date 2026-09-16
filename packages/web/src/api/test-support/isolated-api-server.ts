// 経路テスト用に、本物のAPI（src/api/index.ts）を隔離した環境で起動する子プロセス。
// 起動は isolated-api.ts から行う。直接実行しない。
//
// 接続先が手元の一時SQLiteと127.0.0.1の偽ストレージでなければ起動を拒否する。
// 本番のTurso・R2へ誤って書き込む経路を、設定の取り違えでも作らないため。
const databaseUrl = process.env.DATABASE_URL ?? "";
const storageEndpoint = process.env.S3_ENDPOINT ?? "";
if (
  !databaseUrl.startsWith("file:") ||
  process.env.DATABASE_PROVIDER === "postgres" ||
  process.env.DATABASE_AUTH_TOKEN ||
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(storageEndpoint)
) {
  console.error(
    "isolated-api-server: refusing to start outside a local SQLite file and a 127.0.0.1 storage stub",
  );
  process.exit(2);
}

const { default: app } = await import("../index");
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
console.log(`READY ${server.port}`);
