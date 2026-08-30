/**
 * 棚（`series` / `work`）の読み方を1か所に置く。
 *
 * 2026-08-30 に `series.kind` を足したとき、同じ三項演算子を API・管理画面・
 * 公開ページの3か所に書いていた。**読み方が3つあると、片方だけ直したときに
 * 「どちらの棚にも出ない1本」ができる**（列を足す前に作られた行は `kind` が
 * 空なので、その扱いが揃っていないと消える）。
 */
export type ShelfKind = "series" | "work";

/** 空・null・知らない値は、既定の棚（`series`）として読む。 */
export function normalizeShelfKind(value: unknown): ShelfKind {
  return value === "work" ? "work" : "series";
}

/** 入力として受け付けてよい値か（受け付けられないものは断る側で使う）。 */
export function isShelfKind(value: unknown): value is ShelfKind {
  return value === "work" || value === "series";
}
