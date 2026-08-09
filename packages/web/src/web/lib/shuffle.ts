/**
 * 種を決めたシャッフル。
 *
 * 「ランダム」でも、見ている最中に並びが変わってはいけない。写真が追加で
 * 読み込まれるたびに引き直すと、目で追っていた1枚が別の場所へ飛ぶ。
 * 種を1回だけ決めて、そのあとは何度呼んでも同じ並びになるようにする
 * （＝訪問ごとに変わり、訪問中は変わらない）。
 *
 * PRNG は `gallery-layout.ts` と同じ mulberry32。
 */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates。元の配列は変えない。 */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const rand = mulberry32(seed | 0);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 訪問ごとに1回だけ決める種。 */
export function makeVisitSeed(): number {
  return (Math.random() * 0x7fffffff) | 0;
}

let visitSeed: number | null = null;

/**
 * このタブで共有する種。1回目に呼ばれたときだけ決まる。
 *
 * ページを移って戻ってきても同じ並びに戻る必要がある。戻るたびに引き直すと、
 * 復元したスクロール位置に別の写真が来て「同じ場所へ戻った」ことにならない
 * （B-18 で戻り先の枚数と位置まで復元できるようにした意味が消える）。
 * 再読み込みでは新しい種になる＝次に来たときは新しい並びになる。
 */
export function visitShuffleSeed(): number {
  if (visitSeed === null) visitSeed = makeVisitSeed();
  return visitSeed;
}
