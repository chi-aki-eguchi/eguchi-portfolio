import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  parseZoomSize,
  pickZoomLevel,
  visibleZoomTiles,
  zoomLevels,
  zoomTilePath,
  type ZoomSize,
  type ZoomTilePlacement,
} from "../../shared/photo-zoom";

/** API が返す「置き場所#大きさ」を読む。形が違えば null（＝高精細なし）。 */
export function parseZoomRef(
  zoom: string | null | undefined,
): { base: string; size: ZoomSize } | null {
  if (!zoom) return null;
  const at = zoom.lastIndexOf("#");
  if (at <= 0) return null;
  const size = parseZoomSize(zoom.slice(at + 1));
  return size ? { base: zoom.slice(0, at), size } : null;
}

export type ZoomTilesHandle = {
  /** 写真の大きさ・位置が変わった（拡大・移動）。落ち着いたら読む四角を選び直す。 */
  refresh: () => void;
};

/** 開いてから高精細を読み始めるまで。送っている途中の写真では読まない。 */
const DWELL_MS = 350;
/** 拡大・移動が止まってから選び直すまで。 */
const SETTLE_MS = 140;

function Tile({ src, place }: { src: string; place: ZoomTilePlacement }) {
  const [shown, setShown] = useState(false);
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
      data-zoom-tile={`${place.level}/${place.col}_${place.row}`}
      onLoad={() => setShown(true)}
      style={{
        position: "absolute",
        left: `${place.left}%`,
        top: `${place.top}%`,
        width: `${place.width}%`,
        height: `${place.height}%`,
        // 現れ方は濃淡だけ。下に同じ絵（粗い方）があるので、位置も大きさも動かない。
        opacity: shown ? 1 : 0,
        transition: "opacity var(--dur-base, 200ms) var(--ease-out, ease-out)",
      }}
    />
  );
}

/**
 * 写真の上に重ねる高精細（四角に切ったもの）。見えている所に、画面の細かさに足りる
 * 段の四角だけを置く。写真の箱（object-fit: contain の親）いっぱいに重ねて使う。
 *
 * 画面に収めた1枚（`baseWidth` 画素）で足りているあいだは、何も読まない。
 */
export const ZoomTiles = forwardRef<
  ZoomTilesHandle,
  {
    zoom: string;
    /** 下の写真が出そろった。それまでは読まない。 */
    active: boolean;
    /** 下に出ている1枚の横の画素数。これで足りる大きさなら四角は要らない。 */
    getBaseWidth: () => number;
  }
>(function ZoomTiles({ zoom, active, getBaseWidth }, ref) {
  const parsed = useMemo(() => parseZoomRef(zoom), [zoom]);
  const levels = useMemo(() => (parsed ? zoomLevels(parsed.size) : []), [parsed]);
  const boxRef = useRef<HTMLDivElement>(null);
  const [tiles, setTiles] = useState<ZoomTilePlacement[]>([]);
  const signatureRef = useRef("");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const compute = useCallback(() => {
    const box = boxRef.current;
    if (!box || levels.length === 0) return;
    const r = box.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const needed = r.width * dpr;
    let next: ZoomTilePlacement[] = [];
    if (needed > getBaseWidth() * 1.05) {
      const level = pickZoomLevel(levels, needed);
      const view = {
        x0: -r.left / r.width,
        y0: -r.top / r.height,
        x1: (window.innerWidth - r.left) / r.width,
        y1: (window.innerHeight - r.top) / r.height,
      };
      // 粗い段から順に重ねる。細かい段が届くまで、粗い段が下で見えている。
      if (level)
        for (let i = levels.length - 1; i >= level.index; i--)
          next = next.concat(visibleZoomTiles(levels[i], view));
    }
    const signature = next.map((t) => `${t.level}/${t.col}_${t.row}`).join(",");
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
    setTiles(next);
  }, [levels, getBaseWidth]);

  const schedule = useCallback(
    (first: number) => {
      for (const t of timersRef.current) clearTimeout(t);
      // 2回目は、拡大の動き（0.25秒）が終わった後の位置で選び直すため。
      timersRef.current = [
        setTimeout(compute, first),
        setTimeout(compute, first + 280),
      ];
    },
    [compute],
  );

  useImperativeHandle(ref, () => ({ refresh: () => schedule(SETTLE_MS) }), [schedule]);

  useEffect(() => {
    if (!active) return;
    schedule(DWELL_MS);
    const onResize = () => schedule(SETTLE_MS);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      for (const t of timersRef.current) clearTimeout(t);
    };
  }, [active, schedule]);

  if (!parsed) return null;
  const { w, h } = parsed.size;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        containerType: "size",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        ref={boxRef}
        data-zoom-tiles={tiles.length}
        style={{
          position: "relative",
          flex: "none",
          // 親の中に、写真の縦横比のまま収める（下の写真の object-fit: contain と同じ位置）。
          width: `min(100cqw, calc(100cqh * ${w} / ${h}))`,
          aspectRatio: `${w} / ${h}`,
        }}
      >
        {tiles.map((place) => (
          <Tile
            key={`${place.level}/${place.col}_${place.row}`}
            src={`${parsed.base}/${zoomTilePath(place.level, place.col, place.row)}`}
            place={place}
          />
        ))}
      </div>
    </div>
  );
});
