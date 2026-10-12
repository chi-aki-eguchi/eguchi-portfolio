import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import { sortPhotosBySetting } from "../../lib/photo-sort";
import { galleryExcludesSeries } from "../../lib/book";
import { galleryHasPhotos } from "../../lib/work-entries";
import { InquiryCta } from "../InquiryCta";
import { DevelopHome, type DevelopPhoto } from "./DevelopHome";

type Settings = Record<string, string | null | undefined> | undefined;

/**
 * 新しい構成のトップの、表紙より下に要る物を集める（扉の目次・すべての写真への入口・撮影依頼の案内）。
 * 表紙は今までの構成と同じ部品（pages/top.tsx の heroSection）が、この上に置く。
 */
export function DevelopTop({ settings }: { settings: Settings }) {
  const photosQ = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  const seriesQ = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const worksQ = useQuery({
    queryKey: ["works"],
    queryFn: async () => jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  const { data: photoCounts } = useQuery({
    queryKey: ["photo-availability"],
    queryFn: async (): Promise<{ total: number; standalone: number }> =>
      jsonOrThrow(await api.photos.availability.$get()),
    staleTime: 60_000,
  });
  const photos = useMemo(
    // 扉の写真は、その先のページの最初の1枚。ページと同じく、管理画面で決めた順で読む。
    () => sortPhotosBySetting(photosQ.data?.photos ?? [], "manual") as DevelopPhoto[],
    [photosQ.data],
  );
  const shelves = [...(seriesQ.data?.series ?? []), ...(worksQ.data?.series ?? [])];
  const first = shelves.find((s) => s.coverUrl);
  const seriesCover = useMemo<DevelopPhoto | null>(
    () =>
      first?.coverUrl
        ? { url: first.coverUrl, rotationDeg: first.coverRotationDeg, focalX: first.coverFocalX, focalY: first.coverFocalY }
        : null,
    [first?.coverUrl, first?.coverRotationDeg, first?.coverFocalX, first?.coverFocalY],
  );
  return (
    <DevelopHome
      settings={settings}
      photos={photos}
      seriesCover={seriesCover}
      showSeries={shelves.length > 0}
      showGallery={galleryHasPhotos(photoCounts, galleryExcludesSeries(settings))}
      after={<InquiryCta />}
    />
  );
}
