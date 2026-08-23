import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ContentStatus } from "./ContentStatus";
import { api, jsonOrThrow } from "../lib/api";
import { num } from "../lib/utils";
import {
  clampSetting,
  clampSettingRounded,
} from "../../shared/setting-ranges";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { formatPeriodRange } from "../lib/series-colophon";
import { objectPositionFromFocal, srcFor, srcSetFor } from "../lib/picture";

/**
 * P (works-series-grid): the Series view — each tile is a series' cover photo
 * with its title (and subtitle, if any) in quiet type just below (R1: revised
 * from the original text-free tiles at 秋's request), in a column count tuned
 * from Settings. Clicking a tile goes to that series' detail page where the
 * photos are shown large. Hover stays quiet per design-spec: a slight zoom
 * + brightness lift.
 */
/**
 * 札に添える「規模と時期」。どちらも分からなければ何も出さない——
 * 空の行は、事実ではなく作りかけに見える。
 */
function seriesScale(s: {
  photoCount?: number | null;
  shotAtFirst?: string | null;
  shotAtLast?: string | null;
}): string | null {
  const parts: string[] = [];
  if (typeof s.photoCount === "number" && s.photoCount > 0)
    parts.push(`${s.photoCount}点`);
  const period = formatPeriodRange(s.shotAtFirst, s.shotAtLast);
  if (period) parts.push(period);
  return parts.length ? parts.join(" ／ ") : null;
}

export function SeriesGrid() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const series = data?.series ?? [];

  // Match the breakpoint the gallery grid uses so column counts stay consistent.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // シリーズ一覧の札の作り。作品群の入口はサイトの印象を強く決めるのに、
  // これまで「4:5の表紙 + 下に題名」の1種類しか無く、買った人全員が同じ
  // 見え方になっていた。
  //   caption — 4:5の表紙の下に題名（既定。従来どおり）
  //   overlay — 題名を表紙の上に重ねる（暗い幕を敷いて読めるようにする）
  //   wide    — 3:2 の横長。映画のスチルのように並ぶ
  const cardStyle = ["caption", "overlay", "wide"].includes(
    settings?.seriesCardStyle ?? "",
  )
    ? settings!.seriesCardStyle!
    : "caption";
  const ratio = cardStyle === "wide" ? "aspect-[3/2]" : "aspect-[4/5]";

  // Bounds come from SETTING_RANGES so they cannot drift from what the admin
  // offers: the 列数 control reached 8 while this clamped at 6, so the last two
  // steps did nothing (2026-08-07).
  const configuredColumns = isMobile
    ? clampSettingRounded(
        "seriesGridColumnsMobile",
        num(settings?.seriesGridColumnsMobile, 2),
      )
    : clampSettingRounded(
        "seriesGridColumns",
        num(settings?.seriesGridColumns, 3),
      );
  // Never open more columns than there are series. Measured 2026-08-23 at
  // 1440px: two series in a fixed 3-column grid stopped two thirds of the way
  // across and left the right third empty — the shape 到達点 #5 of
  // `admin-renewal-goal.md` exists to forbid. Fitting the track count to the
  // item count makes the same two covers fill the width instead.
  const columns = Math.max(1, Math.min(configuredColumns, series.length || 1));
  // …but one series stretched over the full 1024px shell becomes a 1280px-tall
  // slab. Hold a lone cover to roughly the width it would have had beside a
  // neighbour, centred, so it reads as deliberate rather than blown up.
  const soloWidth = !isMobile && columns === 1 && configuredColumns > 1;
  // P3: reuse the gallery gap scale so spacing feels of-a-piece with the photo grid.
  const gapScale = clampSetting(
    "galleryGapScale",
    num(settings?.galleryGapScale, 1),
  );
  const gap = (isMobile ? 18 : 32) * gapScale;

  // Tiles are `.page-entrance` (opacity:0 until observed). Own the observer here
  // instead of relying on the parent page's — tiles that mount after the parent's
  // effect ran (series fetch resolving late) would otherwise stay invisible.
  const fadeRef = useScrollFadeIn([series]);

  // Tile is ~(container/columns) CSS px; ask for ~2x for retina. The container
  // caps at 1024px (max-w-5xl), so desktop tiles range ~250–510px.
  const sizes = isMobile
    ? `${Math.round(100 / columns)}vw`
    : `(max-width: 1024px) ${Math.round(100 / columns)}vw, ${Math.round(1024 / columns)}px`;

  if (series.length === 0) {
    if (isLoading) return <div className="py-24" aria-hidden="true" />;
    // **取得に失敗したことを「シリーズが無い」と言わない。** 落ちたときに
    // 「まだシリーズがありません」と出すと、訪問者にはこの写真家に作品が
    // 無いようにしか見えない（実測: /api/series を500にすると実際にそう出た）。
    // Gallery 側は既に同じ罠を避けている（fail-quiet trap）。同じ部品を使う。
    if (isError)
      return (
        <ContentStatus
          state="error"
          error={error}
          onRetry={() => void refetch()}
          className="py-24"
        />
      );
    return (
      <div className="py-24 text-center">
        <p className="font-ja text-xs tracking-[0.08em] text-[color:var(--text-quiet)]">まだシリーズがありません</p>
      </div>
    );
  }

  return (
    <div
      ref={fadeRef}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap}px`,
        alignItems: "start",
        ...(soloWidth
          ? { maxWidth: "min(100%, 460px)", marginInline: "auto" }
          : null),
      }}
    >
      {series.map((s) => (
        <Link
          key={s.id}
          to={`/series/${s.slug}`}
          className="group block min-w-0 page-entrance"
        >
          <div
            className={`relative overflow-hidden bg-[rgba(var(--foreground-rgb),0.03)] ${ratio}`}
          >
            {s.coverUrl ? (
              <img
                src={srcFor(s.coverUrl, 800, 85, undefined, s.coverRotationDeg)}
                srcSet={srcSetFor(
                  s.coverUrl,
                  "grid",
                  undefined,
                  s.coverRotationDeg,
                )}
                sizes={sizes}
                alt={s.subtitle ? `${s.title} — ${s.subtitle}` : s.title}
                loading="lazy"
                decoding="async"
                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                style={{
                  objectPosition: objectPositionFromFocal(
                    s.coverFocalX,
                    s.coverFocalY,
                  ),
                }}
                className="w-full h-full object-cover transition-[transform,filter] duration-[1.1s] ease-[var(--ease-quart)] group-hover:scale-[1.04] group-hover:brightness-[1.04]"
              />
            ) : (
              /* 表紙未設定。以前は空の四角を置いていたが、それは場所を取るだけで
                 何も伝えない。題名を出せば、少なくとも何の組か分かる。 */
              <div className="flex h-full w-full items-center justify-center px-4">
                {/* w-full が要る。中央寄せの flex の子は幅が内容で決まるので、
                    break-words だけでは折り返す幅が無く、札からはみ出して
                    切れる（実測 124px の札に 534px の文字）。 */}
                <span className="w-full font-ja text-[0.8rem] tracking-[0.05em] leading-snug text-center break-words text-[color:var(--text-quiet)]">
                  {s.title}
                </span>
              </div>
            )}
            {/* overlay: 題名を写真の上に置く。写真の明暗に左右されるので、
                下辺に暗い幕を敷いてから載せる（幕なしだと明るい写真で沈む）。 */}
            {cardStyle === "overlay" && s.coverUrl && (
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-[rgba(0,0,0,0.62)] via-[rgba(0,0,0,0.28)] to-transparent pt-10">
                <p className="font-ja text-[0.8rem] tracking-[0.05em] leading-snug break-words text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
                  {s.title}
                </p>
                {s.subtitle && (
                  <p className="mt-0.5 font-en text-[0.65rem] tracking-[0.10em] uppercase break-words text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
                    {s.subtitle}
                  </p>
                )}
              </div>
            )}
          </div>
          {/* overlay で表紙があるときは、上に載せたので下には出さない（二重になる） */}
          {!(cardStyle === "overlay" && s.coverUrl) && (
            <>
              <p className="mt-3 font-ja text-[0.8rem] tracking-[0.05em] leading-snug break-words text-[rgba(var(--foreground-rgb),0.72)]">
                {s.title}
              </p>
              {s.subtitle && (
                <p className="mt-1 font-en text-[0.65rem] tracking-[0.10em] uppercase break-words text-[color:var(--text-quiet)]">
                  {s.subtitle}
                </p>
              )}
              {seriesScale(s) && (
                /* 押す前に規模と時期が分かる。5点の組と59点の組が、
                   一覧では見分けられなかった。 */
                <p className="mt-1 font-en text-[0.65rem] tracking-[0.10em] text-[color:var(--text-quiet)]">
                  {seriesScale(s)}
                </p>
              )}
            </>
          )}
        </Link>
      ))}
    </div>
  );
}
