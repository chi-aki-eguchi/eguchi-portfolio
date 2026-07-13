// site_settings の許可リスト振り分け(Q-5 / audit-2026-07.md P2-3)。DBに触れない
// 純粋関数として切り出し、api/index.ts の実DBクライアント無しに単体テストできるようにする。
export function partitionAllowedSettings(
  body: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): { allowed: Array<[string, string]>; ignoredKeys: string[] } {
  const allowed: Array<[string, string]> = [];
  const ignoredKeys: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") continue;
    if (allowedKeys.has(key)) {
      allowed.push([key, value]);
    } else {
      ignoredKeys.push(key);
    }
  }
  return { allowed, ignoredKeys };
}
