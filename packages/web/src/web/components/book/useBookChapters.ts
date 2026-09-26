import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import {
  fetchSeriesDetail,
  seriesDetailQueryKey,
} from "../../hooks/useSeriesDetail";
import { bookFacts, galleryExcludesSeries, orderedSeriesPhotos, type BookFacts } from "../../lib/book";
import type { GalleryPhoto } from "../PhotoGallery";
import { galleryHasPhotos } from "../../lib/work-entries";

export type BookChapter = {
  slug: string;
  title: string;
  subtitle: string;
  statement: string;
  kind: "series" | "work";
  href: string;
  coverPhotoId: number | null;
  photos: GalleryPhoto[];
  facts: BookFacts;
};

type ShelfRow = {
  slug: string;
  title: string;
  kind?: string | null;
  coverPhotoId?: number | null;
};

/**
 * 公開中のすべての章（Series の棚 → Work の棚の順）と、その写真。
 *
 * 一覧は共通ナビと同じ鍵、各章の写真は作品ページと同じ鍵で引くので、
 * 目次から作品ページへ移るときは手元のキャッシュで足りる。
 */
export function useBookChapters() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const seriesQ = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const worksQ = useQuery({
    queryKey: ["works"],
    queryFn: async () =>
      jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  const rows: ShelfRow[] = useMemo(
    () => [
      ...((seriesQ.data?.series ?? []) as ShelfRow[]),
      ...((worksQ.data?.series ?? []) as ShelfRow[]),
    ],
    [seriesQ.data, worksQ.data],
  );
  const details = useQueries({
    queries: rows.map((row) => ({
      queryKey: seriesDetailQueryKey(row.slug),
      queryFn: () => fetchSeriesDetail(row.slug),
    })),
  });

  // details は毎回新しい配列なので、届いた時刻の並びで変化を見る。
  const detailsKey = details.map((d) => d.dataUpdatedAt).join(",");
  const chapters: BookChapter[] = useMemo(() => {
    const out: BookChapter[] = [];
    rows.forEach((row, i) => {
      const detail = details[i]?.data;
      if (!detail) return;
      const photos = orderedSeriesPhotos(detail, settings);
      if (photos.length === 0) return;
      const kind = row.kind === "work" ? "work" : "series";
      out.push({
        slug: row.slug,
        title: detail.series.title,
        subtitle: detail.series.subtitle ?? "",
        statement: detail.series.statement ?? "",
        kind,
        href: `/${kind}/${row.slug}`,
        coverPhotoId: row.coverPhotoId ?? null,
        photos,
        facts: bookFacts(photos),
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, settings, detailsKey]);

  const isLoading =
    seriesQ.isLoading ||
    worksQ.isLoading ||
    details.some((d) => d.isLoading);
  const isError = seriesQ.isError || worksQ.isError || details.some((d) => d.isError);
  const refetch = () => {
    void seriesQ.refetch();
    void worksQ.refetch();
    details.forEach((d) => void d.refetch());
  };
  return { chapters, isLoading, isError, refetch, settings };
}

/**
 * Photos（/gallery）への入口。共通ナビと同じ判定（`lib/work-entries.ts`）で、
 * 中身があるときだけ出す。`galleryExcludeSeries` が on のサイトでは、
 * Gallery は作品に入っていない写真だけなので、言い方もそれに合わせる。
 */
export function useBookGalleryEntry(settings: Record<string, string | null | undefined> | undefined) {
  const { data: counts } = useQuery({
    queryKey: ["photo-availability"],
    queryFn: async (): Promise<{ total: number; standalone: number }> =>
      jsonOrThrow(await api.photos.availability.$get()),
    staleTime: 60_000,
  });
  const excludeSeries = galleryExcludesSeries(settings);
  if (!galleryHasPhotos(counts, excludeSeries)) return null;
  const count = counts ? (excludeSeries ? counts.standalone : counts.total) : null;
  return {
    href: "/gallery",
    label: excludeSeries ? "作品に入っていない写真を見る" : "すべての写真を見る",
    count,
  };
}
