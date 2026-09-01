import { describe, expect, test } from "bun:test";
import {
  canonicalPortfolioKitPath,
  canonicalSpaRedirectUrl,
  htmlStatusForSpaPath,
  isKnownSpaPath,
  isSeriesDetailPath,
  normalizeSpaPathname,
} from "./public-routes";

describe("public SPA route status", () => {
  test("keeps known app routes as normal 200 HTML responses", () => {
    for (const path of [
      "/",
      "/gallery",
      "/series",
      "/about",
      "/profile",
      "/contact",
      "/en/about",
      "/en/contact",
      "/portfolio-kit",
      "/portfolio-kit/en",
      "/portfolio-kit/start",
      "/start",
      "/start/en",
      "/admin",
      "/admin/login",
      "/admin/demo",
    ]) {
      expect(isKnownSpaPath(path)).toBe(true);
      expect(htmlStatusForSpaPath(path)).toBe(200);
    }
  });

  test("maps legacy service URLs to Portfolio Kit and keeps canonical paths", () => {
    expect(canonicalPortfolioKitPath("/service")).toBe("/portfolio-kit");
    expect(canonicalPortfolioKitPath("/service/start/")).toBe(
      "/portfolio-kit/start",
    );
    expect(canonicalPortfolioKitPath("/service/en")).toBe(
      "/portfolio-kit/en",
    );
    expect(canonicalPortfolioKitPath("/service/start/en")).toBe("/start/en");
    expect(canonicalPortfolioKitPath("/portfolio-kit/start/en")).toBe(
      "/start/en",
    );
    expect(canonicalPortfolioKitPath("/portfolio-kit")).toBe(
      "/portfolio-kit",
    );
  });

  test("series detail routes depend on whether the slug resolves", () => {
    expect(isSeriesDetailPath("/series/ishigakiisland")).toBe(true);
    expect(htmlStatusForSpaPath("/series/ishigakiisland", { seriesFound: true })).toBe(200);
    expect(htmlStatusForSpaPath("/series/zzz-not-exist", { seriesFound: false })).toBe(404);
  });

  test("normalizes trailing slashes for shared public URLs", () => {
    expect(normalizeSpaPathname("/gallery/")).toBe("/gallery");
    expect(isKnownSpaPath("/gallery/")).toBe(true);
    expect(htmlStatusForSpaPath("/gallery/")).toBe(200);
    expect(isSeriesDetailPath("/series/ishigakiisland/")).toBe(true);
    expect(
      htmlStatusForSpaPath("/series/ishigakiisland/", { seriesFound: true }),
    ).toBe(200);
  });

  test("canonical trailing-slash redirects keep the public https origin", () => {
    expect(
      canonicalSpaRedirectUrl(
        "http://akieguchi.com/gallery/?utm_source=x",
        "https://akieguchi.com",
        "/gallery/",
      ),
    ).toBe("https://akieguchi.com/gallery?utm_source=x");
  });

  test("unknown extensionless paths still serve the SPA shell, but with 404 status", () => {
    expect(isKnownSpaPath("/unknown-test-path")).toBe(false);
    expect(htmlStatusForSpaPath("/unknown-test-path")).toBe(404);
  });
});

/**
 * **公開ページの経路が、いくつもの一覧に散っている。**
 *
 * `/work` を足したとき、`app.tsx` には入れたのに次の2つを忘れた:
 *   - `api/public-routes.ts` の `SPA_STATIC_PATHS` … これが**HTTPの status**
 *   - `api/ogp.ts` の `KNOWN_ROUTES` … これが**題名と robots**
 *
 * 結果、本番で `/work` は**画面が出るのに HTTP 404**、共有カードは
 * 「Not Found」、検索エンジンには `noindex` になっていた（2026-08-31 実測）。
 * **開発サーバは何でも 200 を返すので、手元で開いても気づけない。**
 *
 * 先読み表には同じ趣旨の見張りが既にあって、そちらは正しく落ちた。
 * ここでも同じ形で見張る——**一覧が3つあるなら、3つとも突き合わせる。**
 */
import { readFileSync } from "node:fs";

describe("app.tsx と各一覧の突き合わせ", () => {
  const read = (rel: string) =>
    readFileSync(new URL(rel, import.meta.url), "utf8");
  const app = read("../web/app.tsx");

  /** 別名や販売導線を除いた「素の公開ページ」。動的な :slug も除く。 */
  const publicPaths = [...app.matchAll(/<Route path="([^"]+)">/g)]
    .map((m) => m[1]!)
    .filter(
      (p) =>
        !p.startsWith("/admin") &&
        !p.includes(":") &&
        !p.startsWith("/service") &&
        !p.startsWith("/start") &&
        !p.startsWith("/portfolio-kit"),
    );

  test("**公開ページを app.tsx へ足したら、SPA の経路一覧にも足す**（忘れると HTTP 404）", () => {
    const missing = publicPaths.filter((p) => htmlStatusForSpaPath(p) !== 200);
    expect(missing).toEqual([]);
  });

  test("**同じく OGP の既知経路にも足す**（忘れると題名が Not Found・noindex）", () => {
    const ogp = read("./ogp.ts");
    // KNOWN_ROUTES の中身だけを見る（他の場所の経路文字列と混ざらないように）
    const block = ogp.slice(
      ogp.indexOf("const KNOWN_ROUTES = ["),
      ogp.indexOf("]", ogp.indexOf("const KNOWN_ROUTES = [")),
    );
    const missing = publicPaths.filter((p) => !block.includes(`"${p}"`));
    expect(missing).toEqual([]);
  });

  test("棚の1本ぶんは、シリーズも Work も同じ扱い", () => {
    expect(isSeriesDetailPath("/series/x")).toBe(true);
    expect(isSeriesDetailPath("/work/x")).toBe(true);
    expect(htmlStatusForSpaPath("/work/x", { seriesFound: true })).toBe(200);
    expect(htmlStatusForSpaPath("/work/x", { seriesFound: false })).toBe(404);
    expect(isSeriesDetailPath("/work")).toBe(false);
  });
});

describe("seriesDetailRoute", () => {
  const { seriesDetailRoute } =
    require("./public-routes") as typeof import("./public-routes");

  test("棚と slug に割れる", () => {
    expect(seriesDetailRoute("/series/indigo")).toEqual({
      shelf: "series",
      slug: "indigo",
    });
    expect(seriesDetailRoute("/work/kyoto")).toEqual({
      shelf: "work",
      slug: "kyoto",
    });
  });

  test("末尾スラッシュを付けても同じに割れる", () => {
    expect(seriesDetailRoute("/work/kyoto/")).toEqual({
      shelf: "work",
      slug: "kyoto",
    });
  });

  test("詳細ページでない道は null", () => {
    expect(seriesDetailRoute("/work")).toBeNull();
    expect(seriesDetailRoute("/series")).toBeNull();
    expect(seriesDetailRoute("/gallery")).toBeNull();
    expect(seriesDetailRoute("/work/kyoto/extra")).toBeNull();
  });

  test("slug は復号前のまま返す（呼び出し側が decodeURIComponent する）", () => {
    expect(seriesDetailRoute("/series/%E4%BA%AC%E9%83%BD")?.slug).toBe(
      "%E4%BA%AC%E9%83%BD",
    );
  });
});

describe("canonicalHostRedirect", () => {
  const { canonicalHostRedirect } =
    require("./public-routes") as typeof import("./public-routes");

  test("www は基準URL（apex）へ寄せる。パスとクエリは保つ", () => {
    expect(
      canonicalHostRedirect(
        "https://www.akieguchi.com/series/indigoblue?x=1",
        "https://akieguchi.com",
      ),
    ).toBe("https://akieguchi.com/series/indigoblue?x=1");
  });

  test("基準URLが www なら、apex を www へ寄せる（向きは設定に従う）", () => {
    expect(
      canonicalHostRedirect("https://akieguchi.com/about", "https://www.akieguchi.com"),
    ).toBe("https://www.akieguchi.com/about");
  });

  test("既に基準のホストなら何もしない", () => {
    expect(
      canonicalHostRedirect("https://akieguchi.com/about", "https://akieguchi.com"),
    ).toBeNull();
  });

  test("基準URLが空なら何もしない（自分自身へのループを作らない）", () => {
    expect(canonicalHostRedirect("https://www.akieguchi.com/", "")).toBeNull();
    expect(canonicalHostRedirect("https://www.akieguchi.com/", undefined)).toBeNull();
  });

  test("**安全弁**: www の有無以外が違うホストへは飛ばさない", () => {
    // 打ち間違いや、別サイトの値が基準URLに入っていても、
    // 存在しないホストへ飛ばしてサイトを開けなくしない。
    expect(
      canonicalHostRedirect("https://akieguchi.com/", "https://example.com"),
    ).toBeNull();
    expect(
      canonicalHostRedirect("https://akieguchi.com/", "https://akieguchi.co"),
    ).toBeNull();
    expect(
      canonicalHostRedirect("https://akieguchi.com/", "https://www.other.com"),
    ).toBeNull();
  });

  test("壊れた基準URLでも例外にしない", () => {
    expect(canonicalHostRedirect("https://www.akieguchi.com/", "not a url")).toBeNull();
  });

  test("Railway の内部ホストなど、関係ないホストは素通しする", () => {
    expect(
      canonicalHostRedirect(
        "http://localhost:3000/healthz",
        "https://akieguchi.com",
      ),
    ).toBeNull();
  });
});
