/**
 * 開いたメニューの後ろのページを止める。戻す関数を返す（2026-09-26）。
 *
 * body の overflow を hidden にするだけだと、2つの環境で困る。
 *
 * - スクロールバーが幅を取る環境（Windows、Mac の「スクロールバーを常に表示」）:
 *   スクロールバーが消えて画面が 4〜17px 広がる。768px 付近では「PC の幅になった」と
 *   判定され、開いたメニューが 17ms 後に閉じていた（Safari で実測）。
 * - 写真中心のサイト: スクロールバーの出入りで器が横へずれないよう、html に
 *   `overflow-y: scroll` を付けている。そのときは body の hidden が画面のスクロールに
 *   効かず、後ろのページが流れる。
 *
 * どちらのときも、スクロールバーを残したまま、ページを今の位置で固定する（body を
 * fixed にして上へずらす）。閉じたら元の位置へ戻す（別のページへ移ったときは戻さない）。
 * それ以外（スマホや、重なるスクロールバー）は今までどおり hidden だけ。
 *
 * body の overflow は元の値へ戻す。空にすると、同時に開いている写真ビューアの固定まで
 * 解いてしまう。
 */
export function lockPageScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const previous = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    htmlOverflowY: html.style.overflowY,
  };
  // jsdom など幅を持たない環境では clientWidth が 0。スクロールバーは広くても 20px 程度。
  const bar = html.clientWidth > 0 ? window.innerWidth - html.clientWidth : 0;
  const keepsBar = getComputedStyle(html).overflowY === "scroll";
  const pin = ((bar > 0 && bar <= 32) || keepsBar) && previous.position !== "fixed";
  const y = window.scrollY;
  const where = window.location.pathname + window.location.search;

  body.style.overflow = "hidden";
  if (pin) {
    html.style.overflowY = "scroll";
    body.style.position = "fixed";
    body.style.top = `${-y}px`;
    body.style.left = "0";
    body.style.right = "0";
  }
  return () => {
    body.style.overflow = previous.overflow;
    if (!pin) return;
    body.style.position = previous.position;
    body.style.top = previous.top;
    body.style.left = previous.left;
    body.style.right = previous.right;
    html.style.overflowY = previous.htmlOverflowY;
    if (window.location.pathname + window.location.search === where) {
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    }
  };
}
