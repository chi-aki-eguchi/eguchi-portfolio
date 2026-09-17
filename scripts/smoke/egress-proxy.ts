// ブラウザから外へ出る通信を受け止めて拒否するプロキシ（playwright.config.ts の use.proxy）。
// fixtures.ts の番人を通らない通信（自分で作った context、preconnect など）もここで止まる。
import net from "node:net";

export type EgressHit = { at: string; request: string };

/** 受けた要求を記録して 403 を返すだけのプロキシ。CONNECT（https）も同じ。 */
export function startEgressProxy(port: number): Promise<{ hits: EgressHit[]; close: () => Promise<void> }> {
  const hits: EgressHit[] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let head = "";
    socket.on("data", (chunk) => {
      if (head.includes("\r\n")) return;
      head += chunk.toString("latin1");
      const line = head.split("\r\n")[0];
      if (!head.includes("\r\n")) return;
      hits.push({ at: new Date().toISOString(), request: line.slice(0, 300) });
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

// index.html の `<link rel="preconnect">` は、要求ではなく接続の先行準備なので
// page/context の route を通らない。Google Fonts への準備だけは想定どおりとして数え、
// ここでも拒否する（本文は送られない）。それ以外は1件でもあれば失敗にする。
const EXPECTED_PRECONNECT = /^CONNECT fonts\.(googleapis|gstatic)\.com:443 /;

export function splitEgressHits(hits: EgressHit[]) {
  const preconnect = hits.filter((hit) => EXPECTED_PRECONNECT.test(hit.request));
  const unexpected = hits.filter((hit) => !EXPECTED_PRECONNECT.test(hit.request));
  return { preconnect, unexpected };
}
