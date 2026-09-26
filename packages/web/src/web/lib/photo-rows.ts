/**
 * 写真を「段」に組む計算（写真中心のサイト、2026-09-26）。
 *
 * - 写真は元の縦横比のまま。切り抜かない・引き伸ばさない・余白で埋めない。
 * - 各段は横幅いっぱいにそろう（段の高さは、並べた写真の比から決まる）。
 * - 段ごとに狙う高さを変えて、大きな段・中くらいの段・小さな段が交互に来る
 *   リズムを作る。同じ高さの段が続く一覧（どこにでもある写真の壁）にしない。
 *
 * 狙いの高さに最も近くなる枚数を、1段ずつ前から決める。前の段の決め方は後ろの
 * 写真に左右されないので、写真を後ろへ読み足しても、それまでの段は動かない。
 */

export type RowPlanOptions = {
  /** 並べる幅（px） */
  width: number;
  /** 写真と写真のあいだ（px） */
  gap: number;
  /** 段ごとに狙う高さ（px）。先頭から順に使い、尽きたら最初へ戻る。 */
  targets: readonly number[];
  /** 1段の高さの上限（px）。縦の写真1枚が画面より高くならないように。 */
  maxHeight: number;
  /** 1段に並べる枚数の上限 */
  maxPerRow: number;
};

export type PlannedItem = { index: number; x: number; width: number };
export type PlannedRow = { top: number; height: number; items: PlannedItem[]; full: boolean };
export type RowPlan = { rows: PlannedRow[]; height: number };

/** 縦横比（幅/高さ）。記録の無い写真は 3:2 とみなす。 */
export function aspectOf(width?: number | null, height?: number | null): number {
  return width && height && width > 0 && height > 0 ? width / height : 1.5;
}

export function planRows(ratios: readonly number[], opts: RowPlanOptions): RowPlan {
  const { width, gap, targets, maxHeight, maxPerRow } = opts;
  const rows: PlannedRow[] = [];
  let top = 0;
  let i = 0;
  let turn = 0;
  if (!(width > 0) || targets.length === 0) return { rows, height: 0 };
  while (i < ratios.length) {
    const target = targets[turn % targets.length]!;
    turn++;
    let best = 1;
    let bestScore = Infinity;
    let sum = 0;
    const limit = Math.min(maxPerRow, ratios.length - i);
    for (let k = 1; k <= limit; k++) {
      sum += ratios[i + k - 1]!;
      const h = (width - (k - 1) * gap) / sum;
      // 狙いとの差は比で測る（高すぎも低すぎも同じ重み）。上限を超える段は
      // 選ばない——もう1枚足せば収まるなら、そちらにする。
      const score = Math.abs(Math.log(h / target)) + (h > maxHeight ? 10 : 0);
      if (score < bestScore) {
        best = k;
        bestScore = score;
      }
      if (h < target * 0.5) break;
    }
    const slice = ratios.slice(i, i + best);
    const sumR = slice.reduce((a, b) => a + b, 0);
    let height = (width - (best - 1) * gap) / sumR;
    // 最後の写真が足りず、横幅いっぱいにすると狙いより大きくなりすぎる段は、
    // 狙いの高さで止めて左に寄せる（最後の1〜2枚だけが巨大になるのを防ぐ）。
    const last = i + best >= ratios.length;
    let full = true;
    if (height > maxHeight || (last && height > target * 1.35)) {
      height = Math.min(maxHeight, last ? target : maxHeight);
      full = false;
    }
    const items: PlannedItem[] = [];
    let x = 0;
    slice.forEach((r, j) => {
      const w =
        full && j === slice.length - 1 ? width - x : r * height;
      items.push({ index: i + j, x, width: w });
      x += w + gap;
    });
    rows.push({ top, height, items, full });
    top += height + gap;
    i += best;
  }
  return { rows, height: rows.length ? top - gap : 0 };
}

/**
 * 画面の大きさから、段の狙い・上限・枚数を決める。
 *
 * 広い画面: 画面の高さを基準に、大（74%）・中（46〜52%）・小（34〜36%）の段を
 * 交互に。1段は最大5枚。
 * 狭い画面（スマホ）: 幅を基準に。縦の写真は1枚で大きく、横の写真は1〜2枚。
 */
export function rowOptionsFor(width: number, viewportHeight: number): RowPlanOptions {
  const vh = Math.max(480, viewportHeight);
  if (width < 640) {
    const gap = 6;
    return {
      width,
      gap,
      targets: [1.2, 0.62, 0.9, 0.5, 1.2, 0.72].map((f) => f * width),
      maxHeight: Math.min(vh * 0.86, width * 1.6),
      maxPerRow: 3,
    };
  }
  const gap = width < 1024 ? 8 : 10;
  return {
    width,
    gap,
    targets: [0.74, 0.46, 0.35, 0.52, 0.66, 0.4, 0.46, 0.34].map((f) =>
      Math.min(820, Math.max(200, f * vh)),
    ),
    maxHeight: Math.min(vh * 0.86, 900),
    maxPerRow: width < 1024 ? 4 : 5,
  };
}
