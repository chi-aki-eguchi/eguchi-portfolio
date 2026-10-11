import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { adminPhotoObjectPosition, adminPhotoSrc } from "../../pages/admin-shared";
import {
  COARSE_TILE,
  filterPhotos,
  gapForTile,
  groupByPeriod,
  tileFromZoom,
  type PagePhoto,
  type PhotoGroup,
  type PickerFilter,
} from "../../lib/page-photos";
import { measureFlip, playFlip } from "./motion";
import { useFlip, usePinchZoom, useStoredZoom } from "./hooks";
import { ZoomSlider } from "./ZoomSlider";

const FILTERS: [PickerFilter, string][] = [
  ["all", "すべて"],
  ["unused", "まだ出していない"],
  ["picked", "選んだ写真"],
  ["people", "人"],
  ["film", "フィルム"],
];

type Tick = { year: string; at: number };

/**
 * 写真を足す画面。公開している写真すべてから、このページに出す写真を選ぶ。
 *
 * - 撮った月ごとに区切る（新しい月が上）。写真を小さくしたら年ごと
 * - 上の帯に、いま見ている月。右端のつまみに年の目盛り。つかんで送ると月が出る
 * - 選んだ写真には印（番号は出さない）。新しく選んだ写真は、並びの最後に入る
 * - 「これで決める」で反映。Esc は何も変えずに閉じる
 *
 * 見出しも写真も1つの並びに平らに置く（月⇄年で区切りが変わっても、写真を作り直さないため）。
 */
export function PhotoPicker({
  photos,
  value,
  used,
  series,
  name,
  onClose,
  onDone,
}: {
  photos: PagePhoto[];
  value: number[];
  used: ReadonlySet<number>;
  series: { id: number; title: string }[];
  name: string;
  onClose: () => void;
  onDone: (next: number[]) => void;
}) {
  const [draft, setDraft] = useState<number[]>(() => [...value]);
  const [filter, setFilter] = useState<PickerFilter>("all");
  // 「選んだ写真」を見ている間は、外した写真もその場に残す（押し間違えても選び直せる）。
  const [pickedView, setPickedView] = useState<number[]>([]);
  const [seriesFilter, setSeriesFilter] = useState<number | "none" | null>(null);
  const [zoom, setZoom] = useStoredZoom("picker", 62, 60);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [scrollable, setScrollable] = useState(false);
  const poolRef = useRef<HTMLDivElement>(null);
  const libRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const capture = useFlip(libRef);
  const suppressClick = useRef(0);

  const tile = tileFromZoom(zoom);
  const coarse = tile < COARSE_TILE;
  const draftSet = useMemo(() => new Set(draft), [draft]);
  const shown = useMemo(
    () => filterPhotos(photos, { filter, series: seriesFilter, used, draft: pickedView }),
    [photos, filter, seriesFilter, used, pickedView],
  );
  const groups = useMemo<PhotoGroup[]>(
    () =>
      filter === "picked"
        ? shown.length
          ? [{ key: "", label: "選んだ順", photos: shown }]
          : []
        : groupByPeriod(shown, coarse),
    [shown, filter, coarse],
  );
  const showNow = filter !== "picked" && groups.length > 1;

  // ── いまどこを見ているか：上の帯の月と、右端のつまみ ───────────────
  const headers = () => [...(libRef.current?.querySelectorAll<HTMLElement>("[data-period]") ?? [])];
  const barHeight = () => nowRef.current?.parentElement?.offsetHeight ?? 0;
  const scrollMax = () => {
    const pool = poolRef.current;
    return pool ? Math.max(1, pool.scrollHeight - pool.clientHeight) : 1;
  };
  const currentHeader = useCallback(() => {
    const pool = poolRef.current;
    if (!pool) return null;
    const y = pool.scrollTop + barHeight() + 20;
    let current: HTMLElement | null = null;
    for (const h of headers()) {
      if (!current || h.offsetTop <= y) current = h;
      else break;
    }
    return current;
  }, []);
  const sync = useCallback(() => {
    const pool = poolRef.current;
    const label = currentHeader()?.dataset.label ?? "";
    if (nowRef.current && label && nowRef.current.textContent !== label) nowRef.current.textContent = label;
    const scrub = scrubRef.current;
    if (!pool || !scrub || scrub.hidden) return;
    if (thumbRef.current)
      thumbRef.current.style.transform = `translateY(${((pool.scrollTop / scrollMax()) * scrub.clientHeight).toFixed(1)}px)`;
    if (tipRef.current && tipRef.current.textContent !== label) tipRef.current.textContent = label;
  }, [currentHeader]);

  // 年の目盛りを、全体の長さに対するその年の始まりの位置へ置く。
  const layout = useCallback(() => {
    const pool = poolRef.current;
    const scrub = scrubRef.current;
    if (!pool || !scrub) return;
    const can = showNow && pool.scrollHeight > pool.clientHeight + 40;
    setScrollable(can);
    const next: Tick[] = [];
    if (can) {
      const height = scrub.clientHeight || pool.clientHeight;
      const max = scrollMax();
      let lastY = -99;
      let lastYear = "";
      for (const h of headers()) {
        const year = (h.dataset.period ?? "").slice(0, 4);
        if (year === lastYear) continue;
        lastYear = year;
        const at = Math.min(1, h.offsetTop / max);
        if (at * height - lastY < 18) continue;
        lastY = at * height;
        next.push({ year: year || "—", at: Math.round(at * 10000) / 100 });
      }
    }
    setTicks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    sync();
  }, [showNow, sync]);
  useLayoutEffect(() => {
    layout();
  }, [layout, groups, zoom]);
  // 幅が変わったときだけ並べ直す（スマホは、送るたびにアドレスバーで高さだけが変わる）。
  useEffect(() => {
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return sync();
      width = window.innerWidth;
      layout();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [layout, sync]);

  // 送っている間だけ、つまみの吹き出しを出す。
  const tipTimer = useRef(0);
  const onScroll = () => {
    sync();
    const scrub = scrubRef.current;
    if (!scrub) return;
    scrub.dataset.on = "";
    window.clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(() => delete scrub.dataset.on, 900);
  };
  useEffect(() => () => window.clearTimeout(tipTimer.current), []);

  // つまみをつかむ・帯を押す：その高さの割合へ送る。
  const scrubbing = useRef(false);
  const scrubTo = (clientY: number) => {
    const pool = poolRef.current;
    const scrub = scrubRef.current;
    if (!pool || !scrub) return;
    const r = scrub.getBoundingClientRect();
    pool.scrollTop = Math.max(0, Math.min(1, (clientY - r.top) / r.height)) * scrollMax();
  };

  // ── 大きさ・区切り・絞り込みを変えるとき：同じあたりを見続け、写真は滑らせる ─────
  const keepPeriod = (ms: number, change: () => void) => {
    const key = currentHeader()?.dataset.period ?? "";
    const atTop = (poolRef.current?.scrollTop ?? 0) < 4;
    capture(ms, undefined, () => {
      const pool = poolRef.current;
      if (!pool || atTop) return;
      const to = headers().find((h) => {
        const k = h.dataset.period ?? "";
        return k === key || k === key.slice(0, 4) || (key.length === 4 && k.startsWith(key));
      });
      if (to) pool.scrollTop = to.offsetTop - barHeight() + 8;
    });
    change();
  };
  const reset = (change: () => void) => {
    capture(240, undefined, () => {
      if (poolRef.current) poolRef.current.scrollTop = 0;
    });
    change();
  };

  usePinchZoom({
    areaRef: poolRef,
    targetRef: libRef,
    zoom,
    onCommit: (next, center, clear) => {
      suppressClick.current = performance.now();
      const lib = libRef.current;
      const pool = poolRef.current;
      if (!lib || !pool) return clear();
      const under = document.elementFromPoint(center.x, center.y)?.closest<HTMLElement>("[data-photo]");
      // 指の下の写真を、指の下に保ったまま並べ直す。
      const settle = () => {
        clear();
        if (under?.isConnected) {
          const r = under.getBoundingClientRect();
          pool.scrollTop += r.top + r.height / 2 - center.y;
        }
      };
      if (next === zoom) {
        const first = measureFlip(lib);
        settle();
        playFlip(lib, first, 280);
        return;
      }
      capture(280, undefined, settle);
      setZoom(next);
    },
  });

  // 開いている間、後ろの頁を動かさない（body の overflow を切り替えると、iPhone では頁が飛ぶ）。
  useEffect(() => {
    const y = window.scrollY;
    const body = document.body.style;
    const before = { position: body.position, top: body.top, left: body.left, right: body.right };
    body.position = "fixed";
    body.top = `${-y}px`;
    body.left = "0";
    body.right = "0";
    return () => {
      Object.assign(body, before);
      window.scrollTo(0, y);
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const toggle = (id: number) => {
    if (performance.now() - suppressClick.current < 350) return;
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  };
  const chooseFilter = (next: PickerFilter) => {
    if (next === filter) return;
    reset(() => {
      if (next === "picked") setPickedView([...draft]);
      setFilter(next);
    });
  };

  const vars = { "--pp-tile": `${tile}px`, "--pp-gap": `${gapForTile(tile)}px` } as CSSProperties;

  return (
    <dialog open className="pp-sheet" aria-modal="true" aria-label={`${name} に出す写真を選ぶ`}>
      <div className="pp-sheet__head">
        <h2 className="pp-sheet__title">{name} に出す写真を選ぶ</h2>
        <span className="pp-sheet__count" data-pp-count>
          {draft.length} 枚を選択中
        </span>
        <span className="pp-sheet__hint">新しく選んだ写真は、並びの最後に入ります</span>
        <span className="pp-sheet__zoom">
          <ZoomSlider value={zoom} onChange={(v) => keepPeriod(160, () => setZoom(v))} />
        </span>
        <button type="button" className="pp-button pp-button--solid" data-pp-done onClick={() => onDone(draft)}>
          これで決める
        </button>
        <div className="pp-chips">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} data-filter={key} onClick={() => chooseFilter(key)}>
              {label}
              {key === "picked" && <b>{draft.length}</b>}
            </button>
          ))}
          <select
            aria-label="シリーズで絞る"
            data-on={seriesFilter !== null || undefined}
            value={seriesFilter === null ? "" : String(seriesFilter)}
            onChange={(e) => {
              const v = e.target.value;
              reset(() => setSeriesFilter(v === "" ? null : v === "none" ? "none" : Number(v)));
            }}
          >
            <option value="">シリーズで絞る</option>
            <option value="none">シリーズに入れていない</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pp-pool" ref={poolRef} onScroll={onScroll} data-pp-pool>
        <div className="pp-now" hidden={!showNow}>
          <b ref={nowRef}>{groups[0]?.label ?? ""}</b>
          <span>
            {shown.length} 枚・{groups.length} {coarse ? "年" : "か月"}
          </span>
        </div>
        <div className="pp-lib" ref={libRef} style={vars}>
          {groups.flatMap((group) => [
            <h3 key={`h:${group.key}`} className="pp-period" data-period={group.key} data-label={group.label}>
              {group.label}
              <span>{group.photos.length}枚</span>
            </h3>,
            ...group.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className="pp-pick"
                data-flip={photo.id}
                data-photo={photo.id}
                aria-pressed={draftSet.has(photo.id)}
                aria-label="この写真を選ぶ"
                onClick={() => toggle(photo.id)}
              >
                <img
                  src={adminPhotoSrc(photo, 480, 80)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={{ objectPosition: adminPhotoObjectPosition(photo) }}
                  onLoad={(e) => e.currentTarget.setAttribute("data-loaded", "")}
                />
                <span className="pp-check" aria-hidden="true">
                  ✓
                </span>
              </button>
            )),
          ])}
          {shown.length === 0 && <p className="pp-none">当てはまる写真がありません。</p>}
        </div>
      </div>

      <div
        className="pp-scrub"
        ref={scrubRef}
        hidden={!scrollable}
        aria-hidden="true"
        onPointerDown={(e) => {
          scrubbing.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // 取り込めない環境でも、押した高さへは送れる。
          }
          scrubTo(e.clientY);
          e.preventDefault();
        }}
        onPointerMove={(e) => scrubbing.current && scrubTo(e.clientY)}
        onPointerUp={() => (scrubbing.current = false)}
        onPointerCancel={() => (scrubbing.current = false)}
      >
        {ticks.map((t) => (
          <span key={t.year} className="pp-scrub__year" style={{ top: `${t.at}%` }}>
            {t.year}
          </span>
        ))}
        <div className="pp-scrub__thumb" ref={thumbRef}>
          <span className="pp-scrub__tip" ref={tipRef} />
        </div>
      </div>
    </dialog>
  );
}
