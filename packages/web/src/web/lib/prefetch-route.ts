import type { QueryClient } from "@tanstack/react-query";
import { api, jsonOrThrow } from "./api";

/**
 * **移動先の中身を、指が触れた時点で取りに行く。**
 *
 * 先読みは「最初に開いたページ」にしか無かった（`main.tsx`）。サイトの中を
 * 移動したときは、着いてから取りに行く。実測（2026-08-30 / TOP→Gallery）では
 * 移り変わりの 325ms のあと、**1秒以上「見出しだけ」の画面**が続いていた。
 * 移り終わった先が骨組みでは、どれだけ丁寧に移り変わっても安っぽく見える。
 *
 * ホバー・フォーカス・指が触れた瞬間に温めておくと、押して 250ms 経つころには
 * 届いていることが多い。**移り変わりの終わりが、骨組みではなく写真になる。**
 *
 * 取りこぼしても何も起きない（失敗は握りつぶす）。本番の取得は各ページの
 * `useQuery` が改めて面倒を見る。
 *
 * `jsonOrThrow` を必ず通す。**素の `.json()` にすると、APIが500を返したときに
 * `{error: "..."}` がそのままキャッシュに乗り**、ページはそれを正常なデータと
 * して読んで「写真がありません」と出す（`main.tsx` に同じ事故の記録がある）。
 */
export function prefetchRoute(qc: QueryClient, path: string): void {
  const warm = (
    queryKey: unknown[],
    request: () => Promise<Parameters<typeof jsonOrThrow>[0]>,
    staleTime?: number,
  ) => {
    void qc
      .prefetchQuery({
        queryKey,
        queryFn: async () => jsonOrThrow(await request()),
        ...(staleTime === undefined ? {} : { staleTime }),
      })
      .catch(() => {});
  };

  const photos = () => warm(["photos"], () => api.photos.$get());
  const series = () => warm(["series"], () => api.series.$get());
  const works = () =>
    warm(["works"], () => api.series.$get({ query: { kind: "work" } }));

  if (path === "/") {
    warm(["hero-photos"], () => api["hero-photos"].$get());
    photos();
    series();
    return;
  }
  if (path === "/gallery") {
    photos();
    series();
    warm(["categories"], () => api.categories.$get(), 5 * 60_000);
    return;
  }
  if (path === "/series") {
    series();
    return;
  }
  if (path === "/work") {
    works();
    return;
  }
  if (path.startsWith("/work/")) {
    const slug = path.slice("/work/".length);
    if (!slug) return;
    works();
    warm(["series", slug], () =>
      fetch(`/api/series/${encodeURIComponent(slug)}`),
    );
    return;
  }
  if (path.startsWith("/series/")) {
    const slug = path.slice("/series/".length);
    if (!slug) return;
    series();
    warm(["series", slug], () =>
      // 型付きクライアントの ":slug" 以下は TS の展開限界で潰れる（lib/api.ts
      // の説明を参照）。ページ側と同じく素の fetch で取る。
      fetch(`/api/series/${encodeURIComponent(slug)}`),
    );
    return;
  }
  if (path === "/profile" || path === "/about" || path === "/en/about") {
    warm(["note-posts"], () => api["note-posts"].$get(), 10 * 60_000);
    return;
  }
}
