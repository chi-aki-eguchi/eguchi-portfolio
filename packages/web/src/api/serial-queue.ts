// 非同期タスクを1本ずつ順番に実行するキュー。profile/hero画像差し替えの
// read→write→再確認→delete を直列化し、並行保存が同じ旧snapshotから
// 「最終的に参照されるオブジェクト」を削除候補にする競合を防ぐ
// (2026-07-14 codex-reviewer P1指摘)。前のタスクの失敗は後続に伝播しない。
export function createSerialQueue(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
