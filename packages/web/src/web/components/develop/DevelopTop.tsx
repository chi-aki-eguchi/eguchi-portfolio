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
 * 新しい構成のトップに要る物を集める。表紙は「トップに出す」で選んだ写真
 * （今までの構成と同じ登録）。1枚も選んでいなければ、並びの先頭の1枚。
 */
export function DevelopTop({
  settings,
  pickedCover,
  coverLoading,
}: {
  settings: Settings;
  pickedCover: DevelopPhoto[];
  coverLoading: boolean;
}) {
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
  // 選んだ表紙がまだ届いていない間は、代わりの写真を一瞬出さない。
  const coverPhotos = pickedCover.length > 0 ? pickedCover : coverLoading ? [] : photos.slice(0, 1);
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
      coverPhotos={coverPhotos}
      photos={photos}
      seriesCover={seriesCover}
      showSeries={shelves.length > 0}
      showGallery={galleryHasPhotos(photoCounts, galleryExcludesSeries(settings))}
      after={<InquiryCta />}
    />
  );
}
