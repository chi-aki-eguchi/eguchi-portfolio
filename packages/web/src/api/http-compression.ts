import { brotliCompressSync, constants as zlib, gzipSync } from "node:zlib";

/**
 * Text responses left this origin uncompressed until 2026-08-23.
 *
 * `AGENTS.md` and `docs/checklists.md` said "`Content-Encoding` を手動設定しない
 * （Railway プロキシが処理）". Measured against production at build `6606ff3f`,
 * that premise was false: a GET for `/assets/index-C50pP-_Z-b.css` sent with
 * `Accept-Encoding: gzip, br, deflate, zstd` returned **183,672 plain bytes**
 * with no `content-encoding` and no `vary` header. Nothing in front of the
 * origin compresses anything, so the origin has to.
 *
 * The old rule's real point is kept, and is the whole design of this module:
 *
 * - never set `Content-Encoding` without compressing the body in the same
 *   place — that split is what produced the 2026-06-13 double-encode incident;
 * - never touch a response that already carries a `Content-Encoding`;
 * - always emit `Vary: Accept-Encoding`, so a shared cache can never hand a
 *   brotli body to a client that did not ask for one (the other half of the
 *   06-13 incident was the edge replaying a cached compressed body).
 */

export type ContentEncoding = "br" | "gzip";

/**
 * Brotli quality. Measured on this repo's own bundles (2026-08-23):
 *
 * | asset            | raw     | gzip    | br q6  | br q11 |
 * |------------------|--------:|--------:|-------:|-------:|
 * | index.css        | 183,672 |  29,975 | 26,873 | 24,362 |
 * | react-vendor.js  | 365,865 | 110,810 | 97,929 | 89,224 |
 *
 * q11 buys ~9% more for 80× the CPU (157ms / 419ms per asset, synchronous on a
 * single-process server). q6 costs 2.0ms / 6.5ms. Not worth the stall.
 */
const BROTLI_QUALITY = 6;

/**
 * Below this, the framing overhead and the CPU are not worth the saving, and
 * for very small bodies the compressed form is often larger.
 */
export const MIN_COMPRESSIBLE_BYTES = 1024;

/**
 * Only text-shaped bodies. Images, fonts, audio and video are already
 * compressed; running them through brotli burns CPU to make them bigger.
 */
const COMPRESSIBLE_TYPE =
  /^(?:text\/|image\/svg\+xml|application\/(?:javascript|ecmascript|json|manifest\+json|xml|xhtml\+xml|rss\+xml|atom\+xml))/i;

export function isCompressibleType(
  contentType: string | null | undefined,
): boolean {
  if (!contentType) return false;
  return COMPRESSIBLE_TYPE.test(contentType.trim());
}

/**
 * Picks the best encoding the client actually accepts. Honours `q=0`
 * (an explicit refusal) and the `*` wildcard, and prefers brotli over gzip
 * when both are equally welcome.
 */
export function negotiateEncoding(
  acceptEncoding: string | null | undefined,
): ContentEncoding | null {
  if (!acceptEncoding) return null;
  const quality = new Map<string, number>();
  for (const part of acceptEncoding.split(",")) {
    const [rawName, ...params] = part.split(";");
    const name = rawName?.trim().toLowerCase();
    if (!name) continue;
    let q = 1;
    for (const param of params) {
      const match = /^\s*q=([0-9.]+)\s*$/i.exec(param);
      if (match) q = Number.parseFloat(match[1] ?? "");
    }
    quality.set(name, Number.isFinite(q) ? q : 0);
  }
  const weightOf = (name: string) =>
    quality.get(name) ?? quality.get("*") ?? 0;
  const br = weightOf("br");
  const gzip = weightOf("gzip");
  if (br > 0 && br >= gzip) return "br";
  if (gzip > 0) return "gzip";
  return null;
}

export function compressBytes(
  bytes: Uint8Array,
  encoding: ContentEncoding,
): Uint8Array<ArrayBuffer> {
  if (encoding === "gzip") return new Uint8Array(gzipSync(bytes));
  return new Uint8Array(
    brotliCompressSync(bytes, {
      params: {
        [zlib.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
        [zlib.BROTLI_PARAM_SIZE_HINT]: bytes.byteLength,
      },
    }),
  );
}

/**
 * Compressed bodies for hashed, immutable assets. The URL carries the content
 * hash, so the path is a safe cache key and an entry can never go stale.
 * Bounded because a distributed site accumulates one entry per asset per
 * encoding across deploys within a single process lifetime.
 */
export type CompressedAssetCache = Map<string, Uint8Array<ArrayBuffer>>;

const CACHE_MAX_ENTRIES = 64;

export function createCompressedAssetCache(): CompressedAssetCache {
  return new Map();
}

function remember(
  cache: CompressedAssetCache,
  key: string,
  value: Uint8Array<ArrayBuffer>,
): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
}

function withVary(headers: Headers): Headers {
  const out = new Headers(headers);
  const existing = out.get("Vary");
  if (!existing) {
    out.set("Vary", "Accept-Encoding");
  } else if (
    !existing
      .split(",")
      .some((field) => field.trim().toLowerCase() === "accept-encoding")
  ) {
    out.set("Vary", `${existing}, Accept-Encoding`);
  }
  return out;
}

/**
 * Compresses a text response when the client asked for it, and marks every
 * compressible response as varying by `Accept-Encoding` whether or not it ends
 * up compressed.
 *
 * Returns the original response untouched whenever compression does not apply,
 * so callers can use it as a transparent wrapper.
 */
export async function compressResponse(
  response: Response,
  request: Request,
  cache?: CompressedAssetCache,
): Promise<Response> {
  // HEAD carries no body; compressing would publish a Content-Length that the
  // matching GET does not have. Other methods never reach the static path.
  if (request.method !== "GET") return response;
  // 206 bodies are byte ranges of the uncompressed representation, and 304 has
  // no body at all. Only a whole 200 body is safe to re-encode.
  if (response.status !== 200 || !response.body) return response;
  // Already encoded upstream — re-encoding is the 2026-06-13 incident.
  if (response.headers.has("Content-Encoding")) return response;
  if (!isCompressibleType(response.headers.get("Content-Type")))
    return response;

  const encoding = negotiateEncoding(request.headers.get("Accept-Encoding"));
  if (!encoding) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: withVary(response.headers),
    });
  }

  const immutable =
    response.headers.get("Cache-Control")?.includes("immutable") === true;
  const cacheKey = immutable
    ? `${encoding}:${new URL(request.url).pathname}`
    : null;

  let body = cacheKey ? cache?.get(cacheKey) : undefined;
  if (!body) {
    const raw = new Uint8Array(await response.arrayBuffer());
    if (raw.byteLength < MIN_COMPRESSIBLE_BYTES) {
      // The body is consumed now, so the original response can no longer be
      // returned — hand back an equivalent one.
      return new Response(raw, {
        status: response.status,
        statusText: response.statusText,
        headers: withVary(response.headers),
      });
    }
    body = compressBytes(raw, encoding);
    if (cacheKey && cache) remember(cache, cacheKey, body);
  }

  const headers = withVary(response.headers);
  headers.set("Content-Encoding", encoding);
  headers.set("Content-Length", String(body.byteLength));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
