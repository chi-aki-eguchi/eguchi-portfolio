import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, jsonOrThrow } from "../lib/api";
import { galleryExcludesSeries } from "../lib/book";
import {
  workEntries,
  type PhotoCounts,
  type WorkEntry,
} from "../lib/work-entries";

/**
 * 「作品を見に行く」入口。行き先の決め方は `lib/work-entries.ts` にあり、
 * ここはそれを画面に置くだけ——**見た目は今までのリンクのまま。**大きな
 * ボタンにも、新しい節にもしない。
 *
 * 数と棚は、共通ナビが既に同じ鍵で引いている。通信は増えない。
 */
export function useWorkEntries(
  settings: Record<string, string | undefined> | undefined,
): WorkEntry[] {
  const { data: counts } = useQuery({
    queryKey: ["photo-availability"],
    queryFn: async (): Promise<PhotoCounts> =>
      jsonOrThrow(await api.photos.availability.$get()),
    staleTime: 60_000,
  });
  const { data: seriesData } = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const { data: worksData } = useQuery({
    queryKey: ["works"],
    queryFn: async () =>
      jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  return workEntries({
    counts,
    galleryExcludeSeries: galleryExcludesSeries(settings),
    seriesCount: seriesData?.series.length ?? 0,
    workCount: worksData?.series.length ?? 0,
    // 帯は `topSeriesStream` が off 以外のとき、シリーズが1本でもあれば出る。
    seriesNearby:
      (settings?.topSeriesStream ?? "after-works") !== "off" &&
      (seriesData?.series.length ?? 0) > 0,
    settings,
  });
}

export function WorkEntries({
  settings,
  ...rest
}: {
  settings: Record<string, string | undefined> | undefined;
  kind: "short" | "sentence";
  className: string;
  style?: React.CSSProperties;
  wrapperClassName: string;
}) {
  return <WorkEntryLinks entries={useWorkEntries(settings)} {...rest} />;
}

export function WorkEntryLinks({
  entries,
  kind,
  className,
  style,
  wrapperClassName,
}: {
  entries: WorkEntry[];
  /** `short` は見出しの横、`sentence` は写真のあとの導線。 */
  kind: "short" | "sentence";
  className: string;
  style?: React.CSSProperties;
  wrapperClassName: string;
}) {
  if (entries.length === 0) return null;
  return (
    <div className={wrapperClassName}>
      {entries.map((entry) => (
        <Link key={entry.href} to={entry.href} className={className} style={style}>
          {kind === "short" ? entry.shortLabel : entry.label}
        </Link>
      ))}
    </div>
  );
}
