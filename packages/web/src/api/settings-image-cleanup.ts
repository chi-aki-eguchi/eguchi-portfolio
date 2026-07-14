// Q-4 案A(2026-07-14 オーナー承認): profilePhotoUrl / heroPhotoUrl の差し替えで
// 参照されなくなった旧R2オブジェクトを片付ける仕組み一式。DBやR2に触れる処理は
// すべて依存注入(createSettingsImageCleanupRunner)にし、実クライアント無しに
// 実行順序まで単体テストできるようにする。
//
// 削除しても安全と言える根拠は3段構え(2026-07-13 決定ログ+2026-07-14 codex-reviewer
// P1指摘2回分を反映):
//   1. 書き込み側の制限: これらのキーは自分専用のアップロードprefix
//      (profile/・hero/)のプロキシURLか空文字しか受け付けない
//      (invalidImageSettingKeys)。別キーの旧値を書き戻す「入れ替え」は
//      API境界で不可能になる。
//   2. 直列化+削除直前の再確認: read→write→再確認→delete を1本ずつ実行し、
//      書き込み後の実DB値で参照が生きている候補は消さない。
//   3. pending参照カウント: 実行待ちのリクエストがこれから書く新値も
//      「生きている参照」として扱い、待機中の値を先回りで消さない。
// 残存リスク(受容): 削除済みの旧URLを後から手書きAPIで同じキーに書き戻す操作は
// 防げない(存在しないURLを直接入力するのと同種の操作ミス。UIは常に
// アップロード直後の新URLしか書かない)。

const PROXY_PREFIX = "/api/images/";

// 各設定キーが指してよいアップロードprefix(index.ts の upload 各ルートと対応)。
const CLEANUP_PREFIX_BY_KEY: Record<string, string> = {
  profilePhotoUrl: "profile/",
  heroPhotoUrl: "hero/",
};

export const SETTINGS_IMAGE_CLEANUP_KEYS: ReadonlySet<string> = new Set(
  Object.keys(CLEANUP_PREFIX_BY_KEY),
);

function proxyValueToRawKey(value: string | undefined): string | null {
  if (!value || !value.startsWith(PROXY_PREFIX)) return null;
  return value.slice(PROXY_PREFIX.length);
}

// 書き込み側の制限(上記1)。空文字(解除)は許可。違反キーの一覧を返す。
// 既存DBに残る旧形式の値には影響しない(読み取りは制限しない)。
export function invalidImageSettingKeys(
  entries: ReadonlyArray<[string, string]>,
): string[] {
  const bad: string[] = [];
  for (const [key, value] of entries) {
    const prefix = CLEANUP_PREFIX_BY_KEY[key];
    if (!prefix || value === "") continue;
    if (!value.startsWith(PROXY_PREFIX + prefix)) bad.push(key);
  }
  return bad;
}

// 書き込み後のDB実値でもう一度参照を確認し、まだ参照されているキーを候補から
// 除外する(上記2)。誤削除ゼロ優先 — 迷ったら消さない。
export function unreferencedImageKeys(
  candidates: ReadonlyArray<string>,
  current: ReadonlyMap<string, string>,
): string[] {
  const live = new Set<string>();
  for (const value of current.values()) {
    const raw = proxyValueToRawKey(value);
    if (raw) live.add(raw);
  }
  return candidates.filter((key) => !live.has(key));
}

export function staleSettingsImageKeys(
  entries: ReadonlyArray<[string, string]>,
  previous: ReadonlyMap<string, string>,
): string[] {
  const nextByKey = new Map(entries);
  // 書き込み後も参照が生きている生キー。書き込まれないキーは旧値のまま残る。
  // 万一2つの設定値が同じオブジェクトを指していても、片方が生きていれば消さない
  // ため、ここでは prefix を問わず集める(削除側だけを prefix で絞る)。
  const live = new Set<string>();
  for (const key of SETTINGS_IMAGE_CLEANUP_KEYS) {
    const after = nextByKey.has(key) ? nextByKey.get(key) : previous.get(key);
    const raw = proxyValueToRawKey(after);
    if (raw) live.add(raw);
  }
  const stale = new Set<string>();
  for (const [key, prefix] of Object.entries(CLEANUP_PREFIX_BY_KEY)) {
    if (!nextByKey.has(key)) continue;
    const oldRaw = proxyValueToRawKey(previous.get(key));
    if (oldRaw && oldRaw.startsWith(prefix) && !live.has(oldRaw)) {
      stale.add(oldRaw);
    }
  }
  return [...stale];
}

// 実行待ちリクエストの「これから参照する生キー」の参照カウント(上記3)。
// 登録はリクエスト受付時(キュー投入前)、解除はタスク完了時。
function createPendingImageRefs() {
  const counts = new Map<string, number>();
  return {
    register(entries: ReadonlyArray<[string, string]>): () => void {
      const keys: string[] = [];
      for (const [key, value] of entries) {
        if (!SETTINGS_IMAGE_CLEANUP_KEYS.has(key)) continue;
        const raw = proxyValueToRawKey(value);
        if (raw) keys.push(raw);
      }
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        for (const key of keys) {
          const n = (counts.get(key) ?? 0) - 1;
          if (n <= 0) counts.delete(key);
          else counts.set(key, n);
        }
      };
    },
    has(key: string): boolean {
      return counts.has(key);
    },
  };
}

export type SettingsImageCleanupDeps = {
  // 1本ずつ順番に実行するキュー(api/serial-queue.ts)。
  queue: <T>(fn: () => Promise<T>) => Promise<T>;
  // 対象キーの現在値を読む(withRetryはdeps側で掛ける)。
  readManagedValues: () => Promise<ReadonlyMap<string, string>>;
  // entriesをatomicに書き込む(成功時のみ戻る)。
  write: (entries: ReadonlyArray<[string, string]>) => Promise<void>;
  // R2オブジェクト1件のbest-effort削除。失敗はrunner側で握りつぶす。
  deleteObject: (key: string) => Promise<void>;
};

// read→write→再確認→delete の本体。index.ts が実DB/R2を注入し、テストは
// fakeを注入して実際のキュー順序ごと検証する(2026-07-14 codex-reviewer
// 再レビューの要求: queueを通した統合テストが可能な構造にする)。
export function createSettingsImageCleanupRunner(
  deps: SettingsImageCleanupDeps,
) {
  const pending = createPendingImageRefs();
  return (entries: ReadonlyArray<[string, string]>): Promise<void> => {
    const release = pending.register(entries);
    return deps.queue(async () => {
      try {
        // 旧値の読み取りは書き込み前でなければならない(書き込み後では旧値が消える)。
        const prev = await deps.readManagedValues();
        const candidates = staleSettingsImageKeys(entries, prev);
        await deps.write(entries);
        if (candidates.length === 0) return;
        // 削除は必ず書き込み成功の後(先に消すと、書き込みが失敗した場合に
        // 「今表示されているはずの画像」が消える)。書き込み後の実DB値と
        // 実行待ちリクエストの新値の両方で参照を再確認する。
        const after = await deps.readManagedValues();
        const stale = unreferencedImageKeys(candidates, after).filter(
          (key) => !pending.has(key),
        );
        for (const key of stale) {
          try {
            await deps.deleteObject(key);
          } catch {
            /* ignore — 誤削除ゼロ優先・取りこぼし許容(2026-07-13 決定ログ 案A) */
          }
        }
      } finally {
        release();
      }
    });
  };
}
