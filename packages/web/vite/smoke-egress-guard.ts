// smoke 用の開発サーバー（Node）から外へ出る TCP 接続を止める。
//
// DB（libSQL の HTTP）、PostgreSQL、fetch（note の RSS など）、S3 クライアントは、
// どれも最後は net.Socket#connect を通る。ここで 127.0.0.1 / localhost / ::1 と
// UNIX ソケット以外への接続を、相手へ届く前にエラーにして記録する。
// 黙って通さない。記録は隔離確認の窓口（/__smoke/isolation）から読める。
import net from "node:net";

export type BlockedConnection = { host: string; port: string };

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const blocked: BlockedConnection[] = [];
let installed = false;

export function blockedConnections(): BlockedConnection[] {
  return blocked.slice();
}

function targetOf(args: unknown[]): { host?: string; port?: string; path?: string } {
  const first = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0];
  if (first && typeof first === "object") {
    const o = first as { host?: unknown; port?: unknown; path?: unknown };
    return {
      host: typeof o.host === "string" ? o.host : undefined,
      port: o.port === undefined ? undefined : String(o.port),
      path: typeof o.path === "string" ? o.path : undefined,
    };
  }
  if (typeof first === "string" && !/^\d+$/.test(first)) return { path: first };
  const host = typeof args[1] === "string" ? args[1] : undefined;
  return { host, port: first === undefined ? undefined : String(first) };
}

export function installSmokeEgressGuard(): void {
  if (installed) return;
  installed = true;
  const original = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedConnect(
    this: net.Socket,
    ...args: unknown[]
  ) {
    const { host, port, path } = targetOf(args);
    // host 省略は Node の既定で localhost。
    if (path || host === undefined || LOOPBACK.has(host.toLowerCase())) {
      return (original as (...a: unknown[]) => net.Socket).apply(this, args);
    }
    blocked.push({ host, port: port ?? "" });
    const error = Object.assign(
      new Error(`[smoke-isolation] 外部への接続を止めました: ${host}:${port ?? ""}`),
      { code: "ESMOKEBLOCKED" },
    );
    process.nextTick(() => this.destroy(error));
    return this;
  } as typeof net.Socket.prototype.connect;
}
