import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { objectPositionFromFocal, srcFor, srcSetFor } from "../lib/picture";

/**
 * TOP に置くシリーズの帯。表紙写真とキャプションが横へゆっくり流れ、
 * 触れると止まり、押すとそのシリーズへ入る（2026-08-08 オーナー依頼
 * 「TOPにもオシャレにシリーズの写真とかキャプションが流れるように」）。
 *
 * 作りは古典的なマーキー。同じ並びを2つ繋げた帯を `-50%` まで動かすと、
 * ちょうど2つ目の先頭が元の位置に来るので継ぎ目なく繰り返せる。
 *
 * 動きを減らす設定の人には流さない。そのときは横スクロールできる普通の帯
 * として出す（消してしまうと、その人だけシリーズを見られなくなる）。
 */

const GAP = 28;

export function SeriesStream({
  label,
  showCaption,
  speedPxPerSec,
  tileHeight,
}: {
  label: string;
  showCaption: boolean;
  speedPxPerSec: number;
  tileHeight: number;
}) {
  const { data } = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const series = useMemo(() => data?.series ?? [], [data]);

  // 埋めるべき幅は帯そのものの幅。window.innerWidth ではなく実物を測る
  // （描画前は 0 を返す環境があり、その値で並びの繰り返し数を決めると
  // 帯の右側が空いたまま流れる）。ResizeObserver はマウント直後にも1回
  // 実寸で発火するので、初期値と画面回転の両方をこれ1つで賄える。
  const bandRef = useRef<HTMLDivElement>(null);
  const [bandW, setBandW] = useState(0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const el = bandRef.current;
    if (el && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(([entry]) => {
        const w = entry?.contentRect.width ?? 0;
        if (w > 0) setBandW(w);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
    setBandW(typeof window === "undefined" ? 0 : window.innerWidth);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(!!mq?.matches);
    sync();
    mq?.addEventListener?.("change", sync);
    return () => mq?.removeEventListener?.("change", sync);
  }, []);

  // 帯のタイルは 4:5 の縦位置。高さから幅が決まる。
  const tileW = Math.round(tileHeight * 0.8);

  // 1並びが帯より狭いと、-50% まで動かしたとき右側に隙間ができる。帯の
  // 1.5倍を超えるまで並びを繰り返してから、それを2つ繋げる（= 帯の3倍）。
  // 帯の幅がまだ測れていない間は流さないので、ここは 1 のままでよい。
  const repeats = useMemo(() => {
    const oneRun = series.length * (tileW + GAP);
    if (oneRun <= 0 || bandW <= 0) return 1;
    return Math.max(1, Math.ceil((bandW * 1.5) / oneRun));
  }, [series.length, tileW, bandW]);

  const runWidth = series.length * repeats * (tileW + GAP);
  // 速さは px/秒。本数が増えても体感の速さが変わらないよう、距離から秒数を出す。
  const durationSec = speedPxPerSec > 0 ? runWidth / speedPxPerSec : 0;

  if (series.length === 0) return null;

  const run = Array.from({ length: repeats }, () => series).flat();
  // 幅を測れるまでは流さない。測れていない状態で流すと、並びが足りず
  // 帯の右側が空いたまま動く。測れた次の描画から動き出す。
  const animate = !reduced && bandW > 0 && durationSec > 0;

  const tile = (
    s: (typeof series)[number],
    key: string,
    ariaHidden: boolean,
  ) => (
    <Link
      key={key}
      to={`/series/${s.slug}`}
      className="series-stream-item group shrink-0"
      style={{ width: tileW }}
      aria-hidden={ariaHidden || undefined}
      tabIndex={ariaHidden ? -1 : undefined}
    >
      <div
        className="overflow-hidden bg-[rgba(var(--foreground-rgb),0.03)]"
        style={{ height: tileHeight }}
      >
        {s.coverUrl ? (
          <img
            src={srcFor(s.coverUrl, 800, 85, undefined, s.coverRotationDeg)}
            srcSet={srcSetFor(s.coverUrl, "grid", undefined, s.coverRotationDeg)}
            sizes={`${tileW}px`}
            alt={ariaHidden ? "" : s.subtitle ? `${s.title} — ${s.subtitle}` : s.title}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
            style={{
              objectPosition: objectPositionFromFocal(s.coverFocalX, s.coverFocalY),
            }}
            className="w-full h-full object-cover transition-[transform,filter] duration-[1.1s] ease-[var(--ease-quart)] group-hover:scale-[1.04] group-hover:brightness-[1.04]"
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
      {showCaption && (
        <>
          <p className="mt-3 font-ja text-[0.8rem] tracking-[0.05em] leading-snug text-[rgba(var(--foreground-rgb),0.72)]">
            {s.title}
          </p>
          {s.subtitle && (
            <p className="mt-1 font-en text-[0.65rem] tracking-[0.10em] uppercase text-[color:var(--text-quiet)]">
              {s.subtitle}
            </p>
          )}
        </>
      )}
    </Link>
  );

  return (
    <section className="pb-[calc(4rem*var(--spacing-section-gap,1))] md:pb-[calc(6rem*var(--spacing-section-gap,1))]">
      <div className="max-w-5xl mx-auto px-6 md:px-12 flex items-center justify-between mb-8 md:mb-10">
        <h2
          className="font-en uppercase section-reveal"
          style={{
            fontSize: "var(--section-label-size, 0.75rem)",
            color: "var(--section-label-color)",
            letterSpacing: "var(--section-label-tracking, 0.12em)",
            lineHeight: "var(--section-leading, 1.2)",
          }}
        >
          {label}
        </h2>
        <Link
          to="/series"
          className="font-en hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.55))] transition-colors duration-300 nav-link-luxury section-reveal py-1.5"
          style={{
            transitionDelay: "0.1s",
            fontSize: "var(--section-label-size, 0.6875rem)",
            letterSpacing: "var(--section-label-tracking, 0.06em)",
            color: "var(--section-label-color)",
          }}
        >
          View all →
        </Link>
      </div>

      {/* 全幅の帯。動きを減らす設定のときだけ、自分で横スクロールできる形にする。 */}
      <div
        ref={bandRef}
        className={`series-stream ${animate ? "" : "series-stream-static"}`}
        aria-label={label}
      >
        <div
          className="series-stream-track"
          style={
            animate
              ? ({
                  animationDuration: `${durationSec}s`,
                  gap: `${GAP}px`,
                } as React.CSSProperties)
              : ({ gap: `${GAP}px` } as React.CSSProperties)
          }
        >
          {run.map((s, i) => tile(s, `a-${i}-${s.id}`, false))}
          {/* 継ぎ目を埋めるための2枚目。読み上げと Tab からは外す。 */}
          {animate && run.map((s, i) => tile(s, `b-${i}-${s.id}`, true))}
        </div>
      </div>
    </section>
  );
}
