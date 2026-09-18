import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { GalleryPhoto } from "../components/PhotoGallery";

export type SeriesDetail = {
  series: {
    id: number;
    slug: string;
    title: string;
    subtitle: string;
    statement: string;
    themeConfig?: string | null;
    kind?: string | null;
  };
  photos: GalleryPhoto[];
};

/**
 * 作品群1本の詳細。作品ページと Contact の「参考作品」が**同じ鍵**で引くので、
 * 作品から相談へ進んだときは手元のキャッシュで足り、通信が増えない。
 */
export function seriesDetailQueryKey(slug: string) {
  return ["series", slug] as const;
}

/** 404（非公開・存在しない）は null。それ以外の失敗だけ投げる。 */
export async function fetchSeriesDetail(
  slug: string,
): Promise<SeriesDetail | null> {
  // The ":slug" subtree of the typed client collapses under TS instantiation
  // limits (see lib/api.ts) — the response shape is annotated manually instead.
  const res = await (api.series as Record<string, any>)[":slug"].$get({
    param: { slug },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<SeriesDetail>;
}

export function useSeriesDetail(slug: string, enabled = true) {
  return useQuery({
    queryKey: seriesDetailQueryKey(slug),
    queryFn: () => fetchSeriesDetail(slug),
    enabled: enabled && !!slug,
  });
}
