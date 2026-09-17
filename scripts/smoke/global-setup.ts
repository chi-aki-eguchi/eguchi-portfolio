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
import {
  SMOKE_BASE_URL,
  SMOKE_EGRESS_PROXY_PORT,
  SMOKE_RUN_DIR,
  SMOKE_STORAGE_PORT,
} from "./smoke-env.ts";
import { splitEgressHits, startEgressProxy, summarizeEgressHits } from "./egress-proxy.ts";

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
  const { SMOKE_PROBE_IMAGE_KEY } = await import(
    "../../packages/web/src/test-fixtures/smoke-site.ts"
  );
  const image = await fetch(`${SMOKE_BASE_URL}/api/images/${SMOKE_PROBE_IMAGE_KEY}?w=64`);
  if (!image.ok || !(image.headers.get("content-type") ?? "").startsWith("image/"))
    throw new Error(`[smoke] 人工データの画像を API から取れない（HTTP ${image.status}）`);
  const log = await json(`http://127.0.0.1:${SMOKE_STORAGE_PORT}/__smoke/requests`);
  const requests = (log.body as unknown as { method: string; key: string }[] | null) ?? [];
  if (!requests.some((r) => r.method === "GET" && r.key === SMOKE_PROBE_IMAGE_KEY))
    throw new Error("[smoke] API の画像取得が偽ストレージへ届いていない");
}

export default async function globalSetup() {
  const proxy = await startEgressProxy(SMOKE_EGRESS_PROXY_PORT);
  try {
    await verifyIsolation();
  } catch (error) {
    await proxy.close();
    throw error;
  }
  return async () => {
    await proxy.close();
    if (proxy.hits.length === 0) return;
    const dir = process.env.SMOKE_EVIDENCE_DIR ?? resolve(__dirname, "../../scratch/smoke-evidence");
    const { preconnect, unexpected } = splitEgressHits(proxy.hits);
    const report = {
      total: proxy.hits.length,
      expectedPreconnect: preconnect.length,
      unexpected: unexpected.length,
      summary: summarizeEgressHits(proxy.hits),
      hits: proxy.hits,
    };
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "blocked-egress.json"), `${JSON.stringify(report, null, 2)}\n`);
    for (const row of report.summary)
      console.log(
        `[smoke] 遮断 ${row.count}件: ${row.kind} ${row.target || "(不明)"} [${row.project || "テスト外"}] ${row.specs.join(", ")}`,
      );
    if (unexpected.length === 0) {
      console.log(`[smoke] 遮断した ${preconnect.length} 件はすべて Google Fonts への preconnect（要求本文なし）。`);
      return;
    }
    throw new Error(
      `[smoke] 想定外の外部への試行を ${unexpected.length} 件止めた（モックかfixtureで扱う）:\n- ${unexpected
        .map((hit) => `${hit.request} [${hit.label || "テスト外"}]`)
        .slice(0, 20)
        .join("\n- ")}`,
    );
  };
}
