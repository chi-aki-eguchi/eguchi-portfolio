/**
 * そのページで実際に要る JS を、HTML の時点で先読みさせる。
 *
 * 公開ページは `app.tsx` が `lazy(() => import(...))` で読むため、**チャンクは
 * `index.js` が動いて React が lazy 境界に当たるまで発見されない。** 実測
 * （2026-08-23 / 実ブラウザ・`/`）では資産の取得がはっきり2波に分かれ、
 * 2波目が9ファイルあった。初回表示と強制再読込のたびに往復が1回ぶん余計に乗る。
 *
 * ビルド時の manifest には、経路ごとに「そのページのチャンク＋依存」が入って
 * いる。それを `<link rel="modulepreload">` として `</head>` の直前へ足す。
 * **HTML に既に入っているものは足さない** —— `index.html` の entry と、その
 * imports（react-vendor など）は Vite が自分で書いている。二重に書くと
 * 転送は増えないが、head が無駄に長くなる。
 */

export type ViteManifestEntry = {
  file: string;
  isEntry?: boolean;
  imports?: string[];
  css?: string[];
};
export type ViteManifest = Record<string, ViteManifestEntry>;

/**
 * 経路 → `app.tsx` が読むページの module。
 *
 * **`app.tsx` の `lazy(...)` と対になっている。** 片方だけ増えると先読みが
 * 静かに効かなくなるだけで、画面は普通に動くので気づけない。
 * `route-preload.test.ts` が両者のずれを検出する。
 */
export const ROUTE_MODULES: Record<string, string> = {
  "/": "src/web/pages/top.tsx",
  "/gallery": "src/web/pages/gallery.tsx",
  "/series": "src/web/pages/series.tsx",
  // Work の棚（2026-08-30）。シリーズと同じ部品なので、読む先も同じ。
  "/work": "src/web/pages/series.tsx",
  "/about": "src/web/pages/profile.tsx",
  "/profile": "src/web/pages/profile.tsx",
  "/en/about": "src/web/pages/profile.tsx",
  "/contact": "src/web/pages/contact.tsx",
  "/en/contact": "src/web/pages/contact.tsx",
};

/** `/series/:slug` のように可変部分を持つ経路。 */
const DYNAMIC_ROUTES: [RegExp, string][] = [
  [/^\/series\/[^/]+$/, "src/web/pages/series-detail.tsx"],
  [/^\/work\/[^/]+$/, "src/web/pages/series-detail.tsx"],
];

/**
 * 販売導線（`/portfolio-kit` 系）は経路の別名が多い。**先読みは
 * `canonicalPortfolioKitPath()` を通した後の経路で引く前提**にして、
 * ここでは正規化後の形だけ持つ。
 */
const SERVICE_ROUTES: Record<string, string> = {
  "/portfolio-kit": "src/web/pages/service.tsx",
  "/portfolio-kit/en": "src/web/pages/service.tsx",
  "/portfolio-kit/start": "src/web/pages/service-start.tsx",
  "/portfolio-kit/start/en": "src/web/pages/service-start.tsx",
};

export function routeModuleFor(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const direct = ROUTE_MODULES[clean] ?? SERVICE_ROUTES[clean];
  if (direct) return direct;
  for (const [pattern, mod] of DYNAMIC_ROUTES)
    if (pattern.test(clean)) return mod;
  return null;
}

/** HTML の entry が既に持ち込むチャンク（entry 自身とその imports）。 */
function alreadyInHtml(manifest: ViteManifest): Set<string> {
  const out = new Set<string>();
  for (const [key, entry] of Object.entries(manifest)) {
    if (!entry.isEntry) continue;
    out.add(key);
    for (const dep of entry.imports ?? []) out.add(dep);
  }
  return out;
}

/**
 * `pathname` のページに要る JS を、依存も含めて集める。
 * 返すのは manifest 上の `file`（`assets/...`）で、重複は除く。
 */
export function preloadFilesFor(
  manifest: ViteManifest,
  pathname: string,
): string[] {
  const rootKey = routeModuleFor(pathname);
  if (!rootKey || !manifest[rootKey]) return [];

  const skip = alreadyInHtml(manifest);
  const files: string[] = [];
  const visited = new Set<string>();

  const walk = (key: string) => {
    if (visited.has(key) || skip.has(key)) return;
    visited.add(key);
    const entry = manifest[key];
    if (!entry) return;
    files.push(entry.file);
    for (const dep of entry.imports ?? []) walk(dep);
  };
  walk(rootKey);

  return [...new Set(files)];
}

/** `href` に入れられない文字を落とす。manifest 由来なので通常は素通り。 */
function safeHref(file: string): string | null {
  if (!/^[A-Za-z0-9._\-/]+$/.test(file)) return null;
  return `/${file.replace(/^\/+/, "")}`;
}

export function buildRoutePreloadTags(
  manifest: ViteManifest | null,
  pathname: string,
): string {
  if (!manifest) return "";
  return preloadFilesFor(manifest, pathname)
    .map(safeHref)
    .filter((href): href is string => href !== null)
    .map((href) => `<link rel="modulepreload" crossorigin href="${href}">`)
    .join("\n  ");
}
