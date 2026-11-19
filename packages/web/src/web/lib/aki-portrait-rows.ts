import { showcaseOptionsFor, type RowPlanOptions } from "./photo-rows";

/*
 * 江口秋の個人サイトの Portrait の段（2026-11-19）。
 *
 * 個人サイトでは、写真の左右を帯の名前と同じ線（--aki-inset）にそろえた。並べる幅が共通の頁より
 * 4〜6% 狭くなる。段の組み方（`photo-rows.ts`）は「1枚の高さが上限を少しでも下回るか」で枚数が
 * 切り替わるので、その少しの差で組みが変わった：768×1024 では幅 720 → 688 で先頭の6枚が全部1枚の段に
 * なり、頁が3画面ぶん伸びた（1920×1080 でも 2.8 → 4.0 画面）。
 *
 * ここでは、何枚ずつ並べるかを共通の頁の幅で決め、できた段を紙の余白の分だけ縮めて置く。
 * どの画面でも、余白を変える前と同じ枚数の段になり、写真だけが少し小さくなる。
 * 写真の順番・縦横比・「どの段も幅いっぱい」は `planRows` のまま。ほかのサイトはこの関数を通らない。
 */

/** 共通の頁が写真を並べる幅。PC は左右 24px（styles.css の --page-inset）、768px 未満は画面の端から端まで（develop.css）。 */
function sharedStreamWidth(pageWidth: number): number {
  return pageWidth >= 768 ? pageWidth - 48 : pageWidth;
}

/**
 * @param width 実際に並べる幅（紙の余白の内側）
 * @param pageWidth 画面の幅
 */
export function akiPortraitOptions(
  width: number,
  viewportHeight: number,
  gapScale: number | undefined,
  pageWidth: number,
): RowPlanOptions {
  const basis = Math.max(width, sharedStreamWidth(pageWidth));
  // スマホの組み（1枚で幅いっぱい／縦2枚）は共通のまま。スマホかどうかも共通の頁の幅で決める：
  // 画面の幅 640〜713px は、紙の余白を引くと 640px を下回るが、共通の頁では広い組みだった
  // （700×960 で、実際の幅 627px だけを見ると全部が1枚寄りの段になり、実例まで 7462px。744×1133 は 4573px）。
  if (basis < 640) return showcaseOptionsFor(width, viewportHeight, gapScale);
  const shared = showcaseOptionsFor(basis, viewportHeight, gapScale);
  const scale = width / basis;
  // タブレットの幅では、縦の写真（4:5 より縦長）を1枚で幅いっぱいにしない。共通の頁は、画面が縦に長いと
  // （768×1047 以上など）16枚すべてが1枚の段になり 11 画面ぶん続く。隣の幅（840 など）と同じ、2枚並びにする。
  // 基準の幅が 750px を超えると、もとの上限（900px）のほうが低いので何も変わらない。
  const maxHeight = Math.min(shared.maxHeight, basis * 1.2);
  return {
    ...shared,
    width,
    // 写真の間も同じ比で縮める（狙いと上限だけ縮めると、境目の画面で共通の頁と枚数が食い違う）。
    gap: shared.gap * scale,
    targets: shared.targets.map((target) => target * scale),
    maxHeight: maxHeight * scale,
  };
}
