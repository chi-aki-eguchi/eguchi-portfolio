// spec が開発サーバーの API を直接読むときの唯一の経路（fixtures.ts の `api`）。
//
// Playwright の APIRequestContext（page.request / context.request / request fixture）は
// Node から直接送るため、fixtures.ts の context.route を通らない。プロキシの bypass も
// localhost をポートを問わず素通しにする（2026-09-17 のレビュー R1）。ここで次を絞る。
// - 宛先: この実行の開発サーバーと同じオリジンの `/` で始まるパスだけ
// - メソッド: GET / HEAD だけ（書き込みは spec 側の page.route モックで確かめる）
// - リダイレクト: 追わない（maxRedirects: 0）。3xx が返ったら失敗にする
// どれも、送る前に判定する。
import type { APIRequestContext, APIResponse } from "@playwright/test";

export const SMOKE_API_METHODS = ["GET", "HEAD"] as const;
export type SmokeApiMethod = (typeof SMOKE_API_METHODS)[number];

/** `base`（この実行の開発サーバー）と同じオリジンのパスだけを URL にする。 */
export function smokeApiUrl(base: string, path: string): URL {
  const origin = new URL(base).origin;
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//"))
    throw new Error(`[smoke] API は開発サーバーのパス（/ で始まる）だけを読む: ${String(path)}`);
  const url = new URL(path, origin);
  if (url.origin !== origin)
    throw new Error(`[smoke] 開発サーバー以外へは送らない: ${url.origin}`);
  return url;
}

export function smokeApiMethod(method: string): SmokeApiMethod {
  const upper = String(method).toUpperCase();
  if (!(SMOKE_API_METHODS as readonly string[]).includes(upper))
    throw new Error(`[smoke] API の直接呼び出しは GET/HEAD だけ（${upper} は page.route のモックで確かめる）`);
  return upper as SmokeApiMethod;
}

/**
 * 判定を通った要求だけを `send`（APIRequestContext#fetch）で送る。
 * `send` は fixtures.ts が page.request を塞ぐ前に取っておいた本来の fetch。
 */
export async function readSmokeApi(
  send: APIRequestContext["fetch"],
  base: string,
  path: string,
  method: string = "GET",
): Promise<APIResponse> {
  const url = smokeApiUrl(base, path);
  const verb = smokeApiMethod(method);
  const response = await send(url.href, { method: verb, maxRedirects: 0 });
  const status = response.status();
  if (status >= 300 && status < 400)
    throw new Error(
      `[smoke] API がリダイレクトを返した（追わない）: ${verb} ${url.pathname} → ${status} ${response.headers().location ?? ""}`,
    );
  return response;
}

export type SmokeApi = {
  get(path: string): Promise<APIResponse>;
  head(path: string): Promise<APIResponse>;
};

export function smokeApi(send: APIRequestContext["fetch"], base: string): SmokeApi {
  return {
    get: (path) => readSmokeApi(send, base, path, "GET"),
    head: (path) => readSmokeApi(send, base, path, "HEAD"),
  };
}
