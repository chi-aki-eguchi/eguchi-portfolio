// テストを1件も始める前に、開発サーバーが本当に隔離されているかを確かめる。
// あわせて、ブラウザから外へ出る通信を受け止めて拒否するプロキシを立てる。
//
// 起動順は webServer（isolated-server.ts）→ ここ。終了はここ → webServer。
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SMOKE_ISOLATION_PATH,
  smokeDatabasePath,
} from "../../packages/web/vite/smoke-isolation.ts";
// import() で読まない。Playwright 1.61.1 は変換結果をファイル名だけで覚えるので、ここで ESM として
// 読むと、同じファイルを require する spec（audit-stage1-real-api.spec.ts）が読めなくなる（2026-09-18）。
import { SMOKE_PROBE_IMAGE_KEY } from "../../packages/web/src/test-fixtures/smoke-site.ts";
import {
  SMOKE_BASE_URL,
  SMOKE_EGRESS_PROXY_PORT,
  SMOKE_RUN_DIR,
  SMOKE_STORAGE_PORT,
} from "./smoke-env.ts";
import {
  egressVerdict,
  startEgressProxy,
  summarizeEgressHits,
  type ServerEgressReport,
} from "./egress-proxy.ts";

async function json(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

export async function verifyIsolation(): Promise<void> {
  const report = await json(`${SMOKE_BASE_URL}${SMOKE_ISOLATION_PATH}`);
  const body = report.body ?? {};
  if (report.status !== 200 || body.ok !== true)
    throw new Error(`[smoke] 開発サーバーの隔離を確認できない: ${JSON.stringify(body.problems ?? report.status)}`);
  const expected = realpathSync(smokeDatabasePath(SMOKE_RUN_DIR));
  if (typeof body.database !== "string" || realpathSync(body.database) !== expected)
    throw new Error("[smoke] API が開いている DB がこの実行の一時SQLiteではない");
  if (body.storage !== `http://127.0.0.1:${SMOKE_STORAGE_PORT}`)
    throw new Error("[smoke] API の保存先がこの実行の偽ストレージではない");

  // 画像を1枚、API 経由で取り、偽ストレージがその要求を受けたことを確かめる。
  const image = await fetch(`${SMOKE_BASE_URL}/api/images/${SMOKE_PROBE_IMAGE_KEY}?w=64`);
  if (!image.ok || !(image.headers.get("content-type") ?? "").startsWith("image/"))
    throw new Error(`[smoke] 人工データの画像を API から取れない（HTTP ${image.status}）`);
  const log = await json(`http://127.0.0.1:${SMOKE_STORAGE_PORT}/__smoke/requests`);
  const requests = (log.body as unknown as { method: string; key: string }[] | null) ?? [];
  if (!requests.some((r) => r.method === "GET" && r.key === SMOKE_PROBE_IMAGE_KEY))
    throw new Error("[smoke] API の画像取得が偽ストレージへ届いていない");
}

/** 終了時、開発サーバーがまだ動いているうちに隔離確認（サーバー側の遮断記録を含む）を読む。 */
async function readServerEgress(): Promise<ServerEgressReport> {
  try {
    const { status, body } = await json(`${SMOKE_BASE_URL}${SMOKE_ISOLATION_PATH}`);
    return { reachable: true, status, body };
  } catch (error) {
    return { reachable: false, error: (error as Error).message };
  }
}

export default async function globalSetup() {
  const proxy = await startEgressProxy(SMOKE_EGRESS_PROXY_PORT);
  try {
    await verifyIsolation();
  } catch (error) {
    await proxy.close();
    throw error;
  }
  // 片付けの順は、ここ → webServer（isolated-server.ts）。ここではサーバーはまだ動いている。
  // ブラウザ側の記録が0件でも、サーバー側を必ず読んで判定する（部分実行でも同じ）。
  return async () => {
    await proxy.close();
    const server = await readServerEgress();
    const verdict = egressVerdict(proxy.hits, server);
    for (const row of summarizeEgressHits(proxy.hits))
      console.log(
        `[smoke] 遮断 ${row.count}件: ${row.kind} ${row.target || "(不明)"} [${row.project || "テスト外"}] ${row.specs.join(", ")}`,
      );
    if (proxy.hits.length > 0 || !verdict.ok) {
      const dir = process.env.SMOKE_EVIDENCE_DIR ?? resolve(__dirname, "../../scratch/smoke-evidence");
      const report = {
        ok: verdict.ok,
        problems: verdict.problems,
        total: proxy.hits.length,
        expectedPreconnect: verdict.preconnect.length,
        unexpected: verdict.unexpected.length,
        server: server.reachable
          ? { status: server.status, blockedConnections: verdict.serverBlocked }
          : { error: server.error },
        summary: summarizeEgressHits(proxy.hits),
        hits: proxy.hits,
      };
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "blocked-egress.json"), `${JSON.stringify(report, null, 2)}\n`);
    }
    if (!verdict.ok)
      throw new Error(`[smoke] 外部への試行の確認で失敗（モックかfixtureで扱う）:\n- ${verdict.problems.join("\n- ")}`);
    if (verdict.preconnect.length > 0)
      console.log(
        `[smoke] 遮断した ${verdict.preconnect.length} 件はすべてテスト中の Google Fonts への preconnect（要求本文なし）。サーバー側の遮断は0件。`,
      );
  };
}
