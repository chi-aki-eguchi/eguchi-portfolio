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

/** 段の高さ（横幅いっぱいに並べたとき）。 */
function fullHeight(ratios: readonly number[], width: number, gap: number): number {
  const sum = ratios.reduce((a, b) => a + b, 0);
  return (width - (ratios.length - 1) * gap) / sum;
}

/** 前から1段ずつ、狙いの高さに最も近くなる枚数で区切る。 */
function groupRows(ratios: readonly number[], opts: RowPlanOptions): { start: number; end: number; target: number }[] {
  const { width, gap, targets, maxHeight, maxPerRow } = opts;
  const groups: { start: number; end: number; target: number }[] = [];
  let i = 0;
  let turn = 0;
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
    groups.push({ start: i, end: i + best, target });
    i += best;
  }
  return groups;
}

/**
 * 最後の段を、どの写真が何枚来ても横幅いっぱいにそろえる。
 *
 * 写真が足りず横幅いっぱいにすると高すぎる最後の段は、1つ前の段と合わせて
 * 組み直す（1段にまとめるか、比の合計が近い2段に分ける）。こうすると、
 * 一覧の終わりに「右側だけ空いた段」ができない（オーナー 2026-09-26
 * 「どの写真がどこにあっても成り立つ構成」）。
 */
function balanceTail(
  ratios: readonly number[],
  groups: { start: number; end: number; target: number }[],
  opts: RowPlanOptions,
) {
  const { width, gap, maxHeight, maxPerRow, targets } = opts;
  const minRow = Math.min(...targets) * 0.6;
  const rowOk = (a: number, b: number) => {
    if (b - a > maxPerRow + 1) return false;
    const h = fullHeight(ratios.slice(a, b), width, gap);
    return h <= maxHeight && h >= minRow;
  };
  const last = groups[groups.length - 1];
  if (!last || groups.length < 2) return groups;
  const lastH = fullHeight(ratios.slice(last.start, last.end), width, gap);
  if (lastH <= maxHeight && lastH <= last.target * 1.35) return groups;
  // 後ろの段を2つ、3つ…と合わせ、その写真を1〜4段に組み直す。どの段も
  // 横幅いっぱいで高さが範囲に収まる分け方のうち、狙いの高さに最も近いもの。
  for (let take = 2; take <= Math.min(5, groups.length); take++) {
    const pool = groups.slice(-take);
    const from = pool[0]!.start;
    const to = last.end;
    const target = pool[0]!.target;
    let best: { cuts: number[]; score: number } | null = null;
    const search = (a: number, cuts: number[], score: number) => {
      if (cuts.length > 4) return;
      if (a === to) {
        if (!best || score < best.score) best = { cuts: [...cuts], score };
        return;
      }
      for (let b = a + 1; b <= to; b++) {
        if (!rowOk(a, b)) continue;
        const h = fullHeight(ratios.slice(a, b), width, gap);
        search(b, [...cuts, b], score + Math.abs(Math.log(h / target)));
      }
    };
    search(from, [], 0);
    const found = best as { cuts: number[]; score: number } | null;
    if (found) {
      const head = groups.slice(0, -take);
      let a = from;
      const rebuilt = found.cuts.map((b, n) => {
        const g = { start: a, end: b, target: pool[Math.min(n, pool.length - 1)]!.target };
        a = b;
        return g;
      });
      return [...head, ...rebuilt];
    }
  }
  return groups;
}

export function planRows(ratios: readonly number[], opts: RowPlanOptions): RowPlan {
  const { width, gap, targets, maxHeight } = opts;
  const rows: PlannedRow[] = [];
  if (!(width > 0) || targets.length === 0) return { rows, height: 0 };
  const groups = balanceTail(ratios, groupRows(ratios, opts), opts);
  let top = 0;
  groups.forEach((g) => {
    const slice = ratios.slice(g.start, g.end);
    let height = fullHeight(slice, width, gap);
    // それでも画面より高くなる段（一覧に写真が1〜2枚しか無いときなど）だけは、
    // 高さで止めて真ん中に置く（左右の空きをそろえ、片側だけ空けない）。
    let full = true;
    if (height > maxHeight) {
      height = maxHeight;
      full = false;
    }
    const items: PlannedItem[] = [];
    const rowWidth = slice.reduce((a, r) => a + r * height, 0) + (slice.length - 1) * gap;
    let x = full ? 0 : Math.max(0, (width - rowWidth) / 2);
    slice.forEach((r, j) => {
      const w = full && j === slice.length - 1 ? width - x : r * height;
      items.push({ index: g.start + j, x, width: w });
      x += w + gap;
    });
    rows.push({ top, height, items, full });
    top += height + gap;
  });
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
