import { describe, expect, test } from "bun:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import {
  compressBytes,
  compressResponse,
  createCompressedAssetCache,
  isCompressibleType,
  MIN_COMPRESSIBLE_BYTES,
  negotiateEncoding,
} from "./http-compression";

const CSS = ".a{color:red}".repeat(400); // ~5KB, comfortably compressible

function get(accept?: string, url = "https://example.com/assets/x-abc123.css") {
  return new Request(url, {
    method: "GET",
    headers: accept ? { "Accept-Encoding": accept } : {},
  });
}

function cssResponse(body: string = CSS, extra: Record<string, string> = {}) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      ...extra,
    },
  });
}

describe("negotiateEncoding", () => {
  test("prefers brotli when both are equally welcome", () => {
    expect(negotiateEncoding("gzip, deflate, br")).toBe("br");
    expect(negotiateEncoding("br;q=1.0, gzip;q=1.0")).toBe("br");
  });

  test("falls back to gzip for clients that only speak gzip", () => {
    expect(negotiateEncoding("gzip, deflate")).toBe("gzip");
  });

  test("honours an explicit q=0 refusal", () => {
    expect(negotiateEncoding("br;q=0, gzip;q=0")).toBeNull();
    expect(negotiateEncoding("br;q=0, gzip")).toBe("gzip");
  });

  test("respects a higher-weighted gzip over brotli", () => {
    expect(negotiateEncoding("br;q=0.5, gzip;q=0.9")).toBe("gzip");
  });

  test("accepts the wildcard, and refuses when it is disabled", () => {
    expect(negotiateEncoding("*")).toBe("br");
    expect(negotiateEncoding("identity, *;q=0")).toBeNull();
  });

  test("returns null for a missing or unusable header", () => {
    expect(negotiateEncoding(null)).toBeNull();
    expect(negotiateEncoding("")).toBeNull();
    expect(negotiateEncoding("identity")).toBeNull();
    expect(negotiateEncoding("zstd")).toBeNull();
  });
});

describe("isCompressibleType", () => {
  test("accepts text-shaped bodies", () => {
    for (const type of [
      "text/html; charset=utf-8",
      "text/css; charset=utf-8",
      "text/plain; charset=utf-8",
      "application/javascript; charset=utf-8",
      "application/json; charset=utf-8",
      "application/manifest+json; charset=utf-8",
      "application/xml; charset=utf-8",
      "image/svg+xml; charset=utf-8",
    ])
      expect(isCompressibleType(type)).toBe(true);
  });

  test("refuses bodies that are already compressed", () => {
    for (const type of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "font/woff2",
      "image/x-icon",
      null,
      undefined,
    ])
      expect(isCompressibleType(type)).toBe(false);
  });
});

describe("compressBytes", () => {
  test("round-trips through both encodings", () => {
    const bytes = new TextEncoder().encode(CSS);
    expect(new TextDecoder().decode(brotliDecompressSync(compressBytes(bytes, "br")))).toBe(CSS);
    expect(new TextDecoder().decode(gunzipSync(compressBytes(bytes, "gzip")))).toBe(CSS);
  });
});

describe("compressResponse", () => {
  test("compresses css for a brotli client and keeps the body readable", async () => {
    const res = await compressResponse(cssResponse(), get("gzip, br"));
    expect(res.headers.get("Content-Encoding")).toBe("br");
    expect(res.headers.get("Vary")).toBe("Accept-Encoding");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBeLessThan(CSS.length / 4);
    expect(res.headers.get("Content-Length")).toBe(String(body.byteLength));
    expect(new TextDecoder().decode(brotliDecompressSync(body))).toBe(CSS);
  });

  test("uses gzip when that is all the client accepts", async () => {
    const res = await compressResponse(cssResponse(), get("gzip"));
    expect(res.headers.get("Content-Encoding")).toBe("gzip");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(gunzipSync(body))).toBe(CSS);
  });

  test("leaves the body alone but still varies when nothing is accepted", async () => {
    const res = await compressResponse(cssResponse(), get("identity"));
    expect(res.headers.get("Content-Encoding")).toBeNull();
    expect(res.headers.get("Vary")).toBe("Accept-Encoding");
    expect(await res.text()).toBe(CSS);
  });

  test("never re-encodes a response that already carries an encoding", async () => {
    const already = cssResponse(CSS, { "Content-Encoding": "gzip" });
    const res = await compressResponse(already, get("br"));
    expect(res).toBe(already);
    expect(res.headers.get("Content-Encoding")).toBe("gzip");
  });

  test("skips images, fonts and other already-compressed bodies", async () => {
    const jpeg = new Response(new Uint8Array(4096), {
      headers: { "Content-Type": "image/jpeg" },
    });
    const res = await compressResponse(jpeg, get("br"));
    expect(res).toBe(jpeg);
    expect(res.headers.get("Content-Encoding")).toBeNull();
  });

  test("leaves tiny bodies uncompressed but readable", async () => {
    const tiny = "body{margin:0}";
    expect(tiny.length).toBeLessThan(MIN_COMPRESSIBLE_BYTES);
    const res = await compressResponse(cssResponse(tiny), get("br"));
    expect(res.headers.get("Content-Encoding")).toBeNull();
    expect(res.headers.get("Vary")).toBe("Accept-Encoding");
    expect(await res.text()).toBe(tiny);
  });

  test("appends to an existing Vary instead of replacing it", async () => {
    const res = await compressResponse(
      cssResponse(CSS, { Vary: "Origin" }),
      get("br"),
    );
    expect(res.headers.get("Vary")).toBe("Origin, Accept-Encoding");
  });

  test("does not duplicate Accept-Encoding in Vary", async () => {
    const res = await compressResponse(
      cssResponse(CSS, { Vary: "accept-encoding" }),
      get("br"),
    );
    expect(res.headers.get("Vary")).toBe("accept-encoding");
  });

  test("leaves HEAD, non-200 and bodyless responses untouched", async () => {
    const head = new Request("https://example.com/assets/x-abc123.css", {
      method: "HEAD",
      headers: { "Accept-Encoding": "br" },
    });
    const forHead = cssResponse();
    expect(await compressResponse(forHead, head)).toBe(forHead);

    const partial = new Response(CSS, {
      status: 206,
      headers: { "Content-Type": "text/css; charset=utf-8" },
    });
    expect(await compressResponse(partial, get("br"))).toBe(partial);

    const notModified = new Response(null, {
      status: 304,
      headers: { "Content-Type": "text/css; charset=utf-8" },
    });
    expect(await compressResponse(notModified, get("br"))).toBe(notModified);
  });

  test("reuses the cached body for a hashed immutable asset", async () => {
    const cache = createCompressedAssetCache();
    const first = await compressResponse(cssResponse(), get("gzip, br"), cache);
    const firstBody = new Uint8Array(await first.arrayBuffer());
    expect(cache.size).toBe(1);

    const second = await compressResponse(cssResponse(), get("gzip, br"), cache);
    const secondBody = new Uint8Array(await second.arrayBuffer());
    expect(cache.size).toBe(1);
    expect(secondBody).toEqual(firstBody);
  });

  test("caches brotli and gzip separately, and skips non-immutable responses", async () => {
    const cache = createCompressedAssetCache();
    await compressResponse(cssResponse(), get("br"), cache);
    await compressResponse(cssResponse(), get("gzip"), cache);
    expect([...cache.keys()]).toEqual([
      "br:/assets/x-abc123.css",
      "gzip:/assets/x-abc123.css",
    ]);

    const html = new Response(CSS, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
    const res = await compressResponse(
      html,
      get("br", "https://example.com/gallery"),
      cache,
    );
    expect(res.headers.get("Content-Encoding")).toBe("br");
    expect(cache.size).toBe(2);
  });
});
