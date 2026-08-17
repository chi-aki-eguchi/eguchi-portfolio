// Where the visitor was on each page, for the lifetime of this tab.
//
// PageTransition scrolls to the top on every route change, which is right going
// forward and wrong on Back — on a gallery thousands of pixels tall, one tap on
// About threw away all the browsing.
//
// スクロール位置だけ覚えても足りない（backlog B-18・2026-08-05 実測）。戻った
// ページは最初のひと束しか描き終えていないので、2400px を頼んでも 692px までしか
// 戻れない。そこで「どこまで読み込んでいたか」も一緒に覚える。
//
// ただし覚えた束の数は、**戻ってきたときだけ**使う。前へ進んで来たときは先頭から
// 見せたいので使わない。その区別は PageTransition しか知らないので、復元に入る
// 直前に markRestoring() で印を付け、ページ側が takeBatches() で1回だけ受け取る。
//
// Deliberately in memory rather than sessionStorage: a reload should start
// clean, and this must never outlive the tab.
const positions = new Map<string, number>();
const batches = new Map<string, number>();
let restoringPath: string | null = null;
let selfPop = false;

/**
 * 写真ビューアは開くとき履歴を1つ積み、閉じるとき history.back() で戻す。
 * この pop は「利用者が戻るボタンを押した」わけではないので、ページ遷移の
 * 復元処理に拾わせてはいけない。
 *
 * **パスの比較では区別できない。** 実測（2026-08-08・実ブラウザ）で、
 * popstate が届いた時点では wouter が先に location を更新し終えており、
 * PageTransition の「今いるパス」も既に移動先へ変わっている。つまり本物の
 * 戻るでも「同じパスへの pop」に見え、区別しようとすると本物まで無視して
 * しまう（実際そうなっていた）。
 *
 * なので推測せず、戻す側が自分で印を付ける。
 */
export const historyBridge = {
  /** 自分で history.back() を呼ぶ直前に立てる。 */
  markSelfPop() {
    selfPop = true;
  },
  /** 直前の pop が自前のものだったかを1回だけ受け取る。 */
  consumeSelfPop(): boolean {
    const was = selfPop;
    selfPop = false;
    return was;
  },
};

/**
 * 記憶の鍵。**「?以降」まで含める。**
 *
 * wouter の `useLocation` はパスしか返さない（`use-browser-location.js` の
 * `usePathname` は `location.pathname` そのもの）。一方、戻ってきたことを知る
 * popstate 側は `window.location` を読むので「?以降」を持っている。両方を
 * そのまま鍵に使っていたため、**絞り込み中のギャラリーだけ鍵が食い違って
 * いた**。`/gallery` で覚えて `/gallery?c=portrait` で探すので一件も見つからず、
 * スクロール位置(get)も読み込んでいた束の数(peekBatches)も両方0が返り、
 * 数百枚見たあと About を一度開くだけで先頭からやり直しになっていた。
 *
 * 絞り込みごとに別の位置を覚えるのは仕様として正しい。`/gallery` と
 * `/gallery?c=portrait` は、見えているものが違う別の画面である。
 *
 * **鍵を作る場所はここ1箇所にする。** 呼び出し側でそれぞれ組み立てると、
 * 今回と同じ食い違いが黙って戻ってくる。
 */
export function routeKeyOf(pathname: string, search: string): string {
  if (!search) return pathname;
  return pathname + (search.startsWith("?") ? search : `?${search}`);
}

export const scrollMemory = {
  remember(path: string, y: number) {
    positions.set(path, y);
  },
  get(path: string): number {
    return positions.get(path) ?? 0;
  },
  forget(path: string) {
    positions.delete(path);
    batches.delete(path);
  },

  /** そのページが追加で読み込んでいた束の数を覚える。 */
  rememberBatches(path: string, count: number) {
    batches.set(path, count);
  },
  /** 戻る/進むでこのページへ帰ってくる、と印を付ける。 */
  markRestoring(path: string) {
    restoringPath = path;
  },
  /** 前へ進む移動。覚えていた束は使わない。 */
  clearRestoring() {
    restoringPath = null;
  },
  /**
   * 戻ってきた場合にかぎり、覚えていた束の数を返す。
   *
   * **読むだけで、印は消さない。** StrictMode は useState の初期化関数を
   * 2回走らせる。1回目で消費する作りにすると2回目が 0 を返し、React が
   * 採るのは後者なので復元が丸ごと効かなくなる（2026-08-08 実測: 497枚
   * まで読み込んで戻っても12枚のまま。backlog B-18 の前回の試みが
   * 「期待どおり効かず外した」のも同じ形と思われる）。
   *
   * 印の後始末は PageTransition が持つ。次にページを移った時点で、戻る
   * なら markRestoring が別のパスへ差し替わり、前へ進むなら
   * clearRestoring が消す。だから読む側は何もしなくてよい。
   */
  peekBatches(path: string): number {
    if (restoringPath !== path) return 0;
    return batches.get(path) ?? 0;
  },
};
