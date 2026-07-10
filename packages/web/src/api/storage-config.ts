// 保存先(S3互換ストレージ)の設定不足を、画像処理やDB書き込みを始める前に
// 名前だけで切り分けるための純関数群。値(秘密情報)はエラー・レスポンス・
// ログのどこにも含めない。Railwayテンプレート利用者が Bucket サービスの
// 変数参照を貼り忘れたとき、SDK の "No value provided for input HTTP label:
// Bucket." のような分かりにくい失敗になるのを防ぐ。

export const STORAGE_ENV_VARS = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

export const STORAGE_NOT_CONFIGURED_CODE = "STORAGE_NOT_CONFIGURED";

export const STORAGE_NOT_CONFIGURED_MESSAGE =
  "写真の保存先がまだ接続されていません。";

export class StorageConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    // Railway Logs に出る想定のメッセージ。変数名のみで値は含めない。
    super(
      `Missing storage env var(s): ${missing.join(", ")}. If you use Railway Bucket, set them from the Bucket service reference, e.g. S3_BUCKET=\${{ Bucket.BUCKET }}.`,
    );
    this.name = "StorageConfigError";
    this.missing = missing;
  }
}

export function missingStorageVariables(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return STORAGE_ENV_VARS.filter((name) => !env[name]);
}

export function storageHealth(
  env: Record<string, string | undefined> = process.env,
): { storageConfigured: boolean; missingStorageVariables: string[] } {
  const missing = missingStorageVariables(env);
  return {
    storageConfigured: missing.length === 0,
    missingStorageVariables: missing,
  };
}

export function assertStorageConfigured(
  env: Record<string, string | undefined> = process.env,
): void {
  const missing = missingStorageVariables(env);
  if (missing.length > 0) throw new StorageConfigError(missing);
}
