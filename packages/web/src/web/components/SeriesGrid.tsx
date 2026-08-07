import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { num } from "../lib/utils";
import {
  clampSetting,
  clampSettingRounded,
} from "../../shared/setting-ranges";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { objectPositionFromFocal, srcFor, srcSetFor } from "../lib/picture";

/**
 * P (works-series-grid): the Series view — each tile is a series' cover photo
 * with its title (and subtitle, if any) in quiet type just below (R1: revised
 * from the original text-free tiles at 秋's request), in a column count tuned
 * from Settings. Clicking a tile goes to that series' detail page where the
 * photos are shown large. Hover stays quiet per design-spec: a slight zoom
 * + brightness lift.
 */
export function SeriesGrid() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const { data, isLoading } = useQuery({
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

  // Bounds come from SETTING_RANGES so they cannot drift from what the admin
  // offers: the 列数 control reached 8 while this clamped at 6, so the last two
  // steps did nothing (2026-08-07).
  const columns = isMobile
    ? clampSettingRounded(
        "seriesGridColumnsMobile",
        num(settings?.seriesGridColumnsMobile, 2),
      )
    : clampSettingRounded(
        "seriesGridColumns",
        num(settings?.seriesGridColumns, 3),
      );
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
    return isLoading ? (
      <div className="py-24" aria-hidden="true" />
    ) : (
      <div className="py-24 text-center">
        <p className="font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)]">No series yet</p>
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
      }}
    >
      {series.map((s) => (
        <Link
          key={s.id}
          to={`/series/${s.slug}`}
          className="group block page-entrance"
        >
          <div className="overflow-hidden bg-[rgba(var(--foreground-rgb),0.03)] aspect-[4/5]">
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
              <div className="w-full h-full" />
            )}
          </div>
          <p className="mt-3 font-ja text-[0.8rem] tracking-[0.05em] leading-snug text-[rgba(var(--foreground-rgb),0.72)]">
            {s.title}
          </p>
          {s.subtitle && (
            <p className="mt-1 font-en text-[0.65rem] tracking-[0.10em] uppercase text-[color:var(--text-quiet)]">
              {s.subtitle}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
