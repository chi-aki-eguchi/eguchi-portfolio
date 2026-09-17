// ブラウザから外へ出る通信を受け止めて拒否するプロキシ（playwright.config.ts の use.proxy）。
// fixtures.ts の番人を通らない通信（preconnect など、route を通らない接続）もここで止まる。
// 受けた試行はすべて 403 で拒否し、転送は一切しない。
//
// 同じポートへの「プロキシではない直接の要求」（`GET /__smoke/...`）は制御用:
//   /__smoke/label?value=…  いま実行中のテスト名を記録する（fixtures.ts が各テストの最初に呼ぶ）
//   /__smoke/hits           受けた試行の一覧（JSON）
import net from "node:net";

export type EgressHit = {
  at: string;
  /** 1行目（例 `CONNECT fonts.gstatic.com:443 HTTP/1.1`）。 */
  request: string;
  kind: "connect" | "http" | "other";
  /** CONNECT は `host:port`、平文は `host:port`（URL から）。読めなければ空。 */
  target: string;
  /** 試行のあいだに実行中だったテスト（project › file › title）。無ければ空。 */
  label: string;
};

function parseRequestLine(line: string): Pick<EgressHit, "kind" | "target"> {
  const [method = "", target = ""] = line.split(" ");
  if (method === "CONNECT") return { kind: "connect", target };
  try {
    const url = new URL(target);
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    return { kind: "http", target: `${url.hostname}:${port}` };
  } catch {
    return { kind: "other", target: "" };
  }
}

/** 受けた要求を記録して 403 を返すだけのプロキシ。CONNECT（https）も同じ。 */
export function startEgressProxy(
  port: number,
): Promise<{ hits: EgressHit[]; close: () => Promise<void> }> {
  const hits: EgressHit[] = [];
  let label = "";
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let head = "";
    socket.on("data", (chunk) => {
      if (head.includes("\r\n")) return;
      head += chunk.toString("latin1");
      if (!head.includes("\r\n")) return;
      const line = head.split("\r\n")[0].slice(0, 300);
      const [method, target = ""] = line.split(" ");
      if (method === "GET" && target.startsWith("/__smoke/")) {
        const url = new URL(target, "http://control.invalid");
        let body = "";
        if (url.pathname === "/__smoke/label") label = url.searchParams.get("value") ?? "";
        else if (url.pathname === "/__smoke/hits") body = JSON.stringify(hits);
        socket.end(
          `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
        );
        return;
      }
      hits.push({ at: new Date().toISOString(), request: line, label, ...parseRequestLine(line) });
      socket.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    });
  });
  return new Promise((resolveProxy, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) =>
      reject(
        new Error(
          `[smoke] 外部通信の遮断プロキシを 127.0.0.1:${port} に立てられない（${error.code}）。使用中なら止めてから実行し直す。`,
        ),
      ),
    );
    server.listen({ port, host: "127.0.0.1", exclusive: true }, () =>
      resolveProxy({
        hits,
        close: () =>
          new Promise<void>((done) => {
            for (const socket of sockets) socket.destroy();
            server.close(() => done());
          }),
      }),
    );
  });
}

// index.html の `<link rel="preconnect" href="https://fonts.googleapis.com">` と
// `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` は、要求ではなく
// 接続の先行準備なので page/context の route を通らず、プロキシへ CONNECT として届く
// （2026-09-17 の全体smokeで WebKit から1ページ2件ずつ。Chromium からは0件）。
// 次の条件を**すべて**満たすときだけ「想定どおり拒否した先行接続」と数える。拒否は変わらない。
// - CONNECT であること（平文の要求やその他は対象外）
// - 宛先が index.html の preconnect と完全に同じ `fonts.googleapis.com:443` / `fonts.gstatic.com:443`
// - テストの実行中であること（fixtures.ts が付けた名前がある）
// 実際のフォントの取得は fixtures.ts の route が手元で答えるのでプロキシへ届かない。全 spec が
// fixtures.ts の context を使うことは guard/spec-boundary.test.ts が見張る。
export const PRECONNECT_TARGETS = new Set(["fonts.googleapis.com:443", "fonts.gstatic.com:443"]);

export function isExpectedPreconnect(hit: EgressHit): boolean {
  return (
    hit.kind === "connect" &&
    PRECONNECT_TARGETS.has(hit.target) &&
    hit.request === `CONNECT ${hit.target} HTTP/1.1` &&
    hit.label !== ""
  );
}

export function splitEgressHits(hits: EgressHit[]) {
  const preconnect = hits.filter(isExpectedPreconnect);
  const unexpected = hits.filter((hit) => !isExpectedPreconnect(hit));
  return { preconnect, unexpected };
}

/** 宛先・種類・project ごとの件数（ログと報告用。値に秘密は含まない）。 */
export function summarizeEgressHits(hits: EgressHit[]) {
  const rows = new Map<string, { kind: string; target: string; project: string; count: number; specs: Set<string> }>();
  for (const hit of hits) {
    const [project = "", file = ""] = hit.label.split(" › ");
    const key = `${hit.kind}|${hit.target}|${project}`;
    const row = rows.get(key) ?? { kind: hit.kind, target: hit.target, project, count: 0, specs: new Set<string>() };
    row.count += 1;
    if (file) row.specs.add(file);
    rows.set(key, row);
  }
  return [...rows.values()]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({ ...row, specs: [...row.specs].sort() }));
}
