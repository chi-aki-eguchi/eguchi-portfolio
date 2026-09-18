import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { seriesLinksById, type SeriesLink } from "../lib/series-links";

/**
 * 写真 → 作品群の対応表。両方の棚（Series / Work）を見る。
 *
 * 鍵は `["series"]` と `["works"]` で、共通ナビ・`WorkEntryLinks`・Gallery が
 * 既に同じ鍵で引いている。**新しい通信は増えない**（キャッシュを共有する）。
 */
export function useSeriesLinks(): Record<number, SeriesLink> {
  const { data: seriesData } = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const { data: worksData } = useQuery({
    queryKey: ["works"],
    queryFn: async () =>
      jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  return useMemo(
    () => seriesLinksById(seriesData?.series, worksData?.series),
    [seriesData, worksData],
  );
}
