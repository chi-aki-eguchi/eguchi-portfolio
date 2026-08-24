/**
 * 経路ごとのチャンク先読み。
 *
 * 公開ページは `lazy(() => import(...))` で読むため、チャンクは `index.js` が
 * 動くまで発見されない。実測（2026-08-23 / 実ブラウザ・`/`）では資産の取得が
 * 2波に分かれ、2波目が9ファイルあった。往復が1回ぶん余計に乗る。
 *
 * **ここでいちばん大事なのは「app.tsx とずれても気づけない」こと。**
 * 先読みが効かなくなるだけで画面は普通に動くので、テストで縛る。
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ROUTE_MODULES,
  buildRoutePreloadTags,
  preloadFilesFor,
  routeModuleFor,
  type ViteManifest,
} from "./route-preload";

const MANIFEST: ViteManifest = {
  "index.html": {
    file: "assets/index-AAA.js",
    isEntry: true,
    imports: ["_react-vendor-R.js", "_vendor-V.js"],
    css: ["assets/index-C.css"],
  },
  "_react-vendor-R.js": { file: "assets/react-vendor-R.js" },
  "_vendor-V.js": { file: "assets/vendor-V.js" },
  "_shared-S.js": { file: "assets/shared-S.js", imports: ["_deep-D.js"] },
  "_deep-D.js": { file: "assets/deep-D.js" },
  "src/web/pages/top.tsx": {
    file: "assets/top-T.js",
    imports: ["index.html", "_react-vendor-R.js", "_shared-S.js"],
  },
  "src/web/pages/series-detail.tsx": {
    file: "assets/series-detail-SD.js",
    imports: ["_shared-S.js"],
  },
};

describe("routeModuleFor", () => {
  test("固定の経路を引ける", () => {
    expect(routeModuleFor("/")).toBe("src/web/pages/top.tsx");
    expect(routeModuleFor("/gallery")).toBe("src/web/pages/gallery.tsx");
    expect(routeModuleFor("/about")).toBe("src/web/pages/profile.tsx");
  });

  test("シリーズ詳細のような可変の経路も引ける", () => {
    expect(routeModuleFor("/series/ishigakiisland")).toBe(
      "src/web/pages/series-detail.tsx",
    );
    // 一覧のほうは別のページ
    expect(routeModuleFor("/series")).toBe("src/web/pages/series.tsx");
    // 2階層より深いものは詳細ではない
    expect(routeModuleFor("/series/a/b")).toBeNull();
  });

  test("末尾のスラッシュは無視する", () => {
    expect(routeModuleFor("/gallery/")).toBe("src/web/pages/gallery.tsx");
    expect(routeModuleFor("/")).toBe("src/web/pages/top.tsx");
  });

  test("知らない経路は null。**先読みを出さないだけで、ページは動く**", () => {
    expect(routeModuleFor("/nope")).toBeNull();
    expect(routeModuleFor("/admin")).toBeNull(); // 管理画面は先読みしない
  });
});

describe("preloadFilesFor", () => {
  test("そのページのチャンクと依存を集める", () => {
    const files = preloadFilesFor(MANIFEST, "/");
    expect(files).toContain("assets/top-T.js");
    expect(files).toContain("assets/shared-S.js");
    // 依存の依存まで辿る
    expect(files).toContain("assets/deep-D.js");
  });

  test("**HTML が既に持ち込むものは足さない**（entry とその imports）", () => {
    const files = preloadFilesFor(MANIFEST, "/");
    expect(files).not.toContain("assets/index-AAA.js");
    expect(files).not.toContain("assets/react-vendor-R.js");
    expect(files).not.toContain("assets/vendor-V.js");
  });

  test("同じチャンクを二度並べない", () => {
    const files = preloadFilesFor(MANIFEST, "/series/x");
    expect(files.length).toBe(new Set(files).size);
  });

  test("manifest に無い経路・知らない経路は空", () => {
    expect(preloadFilesFor(MANIFEST, "/contact")).toEqual([]); // 表にはあるが manifest に無い
    expect(preloadFilesFor(MANIFEST, "/nope")).toEqual([]);
  });
});

describe("buildRoutePreloadTags", () => {
  test("modulepreload のタグを組む", () => {
    const html = buildRoutePreloadTags(MANIFEST, "/");
    expect(html).toContain(
      '<link rel="modulepreload" crossorigin href="/assets/top-T.js">',
    );
    expect(html).not.toContain("react-vendor");
  });

  test("manifest が無ければ何も出さない（dev / 未生成）", () => {
    expect(buildRoutePreloadTags(null, "/")).toBe("");
  });

  test("href に使えない文字が混じったものは落とす", () => {
    const dirty: ViteManifest = {
      "src/web/pages/top.tsx": { file: 'assets/x".js' },
    };
    expect(buildRoutePreloadTags(dirty, "/")).toBe("");
  });
});

describe("app.tsx との対応", () => {
  const app = readFileSync(
    new URL("../web/app.tsx", import.meta.url),
    "utf8",
  );

  test("表に書いたページは app.tsx に実在する", () => {
    for (const mod of new Set(Object.values(ROUTE_MODULES))) {
      const rel = mod.replace("src/web/pages/", "./pages/").replace(/\.tsx$/, "");
      expect(`${mod}: ${app.includes(`import("${rel}")`)}`).toBe(`${mod}: true`);
    }
  });

  test("**公開ページの経路を app.tsx へ足したら、この表にも足す。**", () => {
    // app.tsx の <Route path="..."> のうち、公開側（/admin と /en 以外の
    // 別名を除く）が表に載っているか。載っていないと先読みだけが静かに
    // 効かなくなり、画面は普通に動くので気づけない。
    const paths = [...app.matchAll(/<Route path="([^"]+)">/g)].map((m) => m[1]!);
    const publicPaths = paths.filter(
      (p) =>
        !p.startsWith("/admin") &&
        // 販売導線は canonicalPortfolioKitPath で正規化してから引く
        !p.startsWith("/service") &&
        !p.startsWith("/start") &&
        !p.startsWith("/portfolio-kit"),
    );
    const missing = publicPaths.filter((p) => routeModuleFor(p) === null);
    expect(missing).toEqual([]);
  });
});
