import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 行を開いて直接書き換える編集（Series / Pricing）で、書きかけを守る。
 *
 * この2画面だけ、書きかけが**何も言わずに消えていた**。
 *
 * - 未保存であることを親へ通知していなかった → タブ切替とログアウトの
 *   確認をすり抜けた（他4箇所は通知しており、確認は既にある）
 * - 別の行の鉛筆を押すと、いま書いている下書きが上書きされた
 * - 「閉じる」は確認なしで捨てた
 * - ブラウザを閉じるときの警告も無かった
 *
 * ここで守るのは**一番時間をかけて書く文章**である（シリーズのステートメント、
 * 料金の説明）。押し間違い1回で消える状態をやめる。
 *
 * 一時保存はしない。下書きをどこかに残すと「保存したのかしていないのか」が
 * かえって分からなくなるので、**離れる前に必ず尋ねる**方を選ぶ。
 */
export function useRowDraftGuard<T>({
  editing,
  draft,
  original,
  onUnsavedChange,
}: {
  /** いま編集中の行。null なら編集していない。 */
  editing: boolean;
  /** 画面上の下書き。 */
  draft: T;
  /** 開いた時点の値。null なら比較しない（＝未保存ではない）。 */
  original: T | null;
  onUnsavedChange?: (v: boolean) => void;
}) {
  const hasUnsaved =
    editing && original !== null && !shallowEqual(draft, original);

  // 親のタブ切替・ログアウトの確認は、この通知だけを見ている。
  useEffect(() => {
    onUnsavedChange?.(hasUnsaved);
  }, [hasUnsaved, onUnsavedChange]);
  // タブを離れるときに未保存の印を残さない（次のタブが巻き込まれる）。
  useEffect(() => () => onUnsavedChange?.(false), [onUnsavedChange]);

  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  // 確認が要る操作は「保留中の動作」として持ち、了承されてから実行する。
  const [pending, setPending] = useState<null | (() => void)>(null);
  const hasUnsavedRef = useRef(hasUnsaved);
  hasUnsavedRef.current = hasUnsaved;

  /** 編集中の行を離れる操作を包む。未保存なら確認を挟む。 */
  const guard = useCallback((action: () => void) => {
    if (!hasUnsavedRef.current) {
      action();
      return;
    }
    // useState に関数をそのまま入れると更新関数として呼ばれるので包む。
    setPending(() => action);
  }, []);

  const confirmDiscard = useCallback(() => {
    setPending((run) => {
      run?.();
      return null;
    });
  }, []);
  const cancelDiscard = useCallback(() => setPending(null), []);

  return {
    hasUnsaved,
    guard,
    /** 確認を出すかどうか。 */
    confirming: pending !== null,
    confirmDiscard,
    cancelDiscard,
  };
}

function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) =>
      (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k],
  );
}
