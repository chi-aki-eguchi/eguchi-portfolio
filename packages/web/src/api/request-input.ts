export type JsonObject = Record<string, unknown>;

/**
 * 本文が「素のオブジェクト」かどうか。
 *
 * `null`・配列・数値・文字列が届くと、各ルートの分解代入が TypeError になり
 * 500 で返っていた。呼び出し側の誤りなのにサーバ障害に見える。入口でここを
 * 弾いて 400 にする。
 */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 1リクエストで扱うID件数の上限。
 *
 * 「すべて選択」を壊さないだけの余裕を取りつつ、青天井にしない。
 * これを超える配列は、そのまま `inArray` へ渡すとSQLの変数上限に触れて
 * ドライバ側で落ち、原因の分かりにくい500になる。
 */
export const MAX_ID_LIST_LENGTH = 5000;

export type IdListResult =
  | { ok: true; ids: number[] }
  | { ok: false; reason: "NOT_A_LIST" | "TOO_MANY" };

/**
 * ID配列を受け取る入口の共通検証。
 *
 * 整数でない要素を捨てる既存の挙動は変えない（古いクライアントを壊さない）。
 * 変えるのは、配列でない場合と、上限を超える場合を 400 で返す点。
 */
export function parseIdList(
  value: unknown,
  { max = MAX_ID_LIST_LENGTH, positiveOnly = false } = {},
): IdListResult {
  if (!Array.isArray(value)) return { ok: false, reason: "NOT_A_LIST" };
  if (value.length > max) return { ok: false, reason: "TOO_MANY" };
  const ids = value.filter(
    (n): n is number => Number.isInteger(n) && (!positiveOnly || n > 0),
  );
  return { ok: true, ids };
}

export function idListError(
  reason: "NOT_A_LIST" | "TOO_MANY",
  max = MAX_ID_LIST_LENGTH,
): string {
  return reason === "NOT_A_LIST"
    ? "IDの一覧が正しくありません。"
    : `一度に扱えるのは${max}件までです。選択を分けて実行してください。`;
}
