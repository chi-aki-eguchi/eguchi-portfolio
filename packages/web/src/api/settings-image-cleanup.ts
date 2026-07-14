// Q-4 案A(2026-07-14 オーナー承認): profilePhotoUrl / heroPhotoUrl の差し替えで
// 参照されなくなった旧R2オブジェクトのキーを算出する。DBに触れない純粋関数として
// 切り出し、api/index.ts の実DBクライアント無しに単体テストできるようにする。
//
// 削除ガード(2026-07-13 決定ログ・codex-reviewer P1指摘): これらの設定値は
// API側で中身を検証しない任意文字列のため、「このキーの値だから安全」とは
// 言えない。旧値の生キーがそのキー専用のアップロードprefixで厳密に始まる場合
// のみ削除候補にし、photos/ 等ギャラリー本体を指し得る値は絶対に返さない。

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
