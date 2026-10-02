import {
  IMAGE_UPLOAD_MAX_BYTES,
  LARGE_IMAGE_UPLOAD_BYTES,
  formatUploadSizeLimit,
  imageTooLargeMessage,
} from "../../shared/upload-limits";

const UPLOAD_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/x-tiff",
  "image/avif",
]);

const UPLOAD_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "tif",
  "tiff",
  "avif",
]);

const EXTENSION_ONLY_IMAGE_EXTENSIONS = new Set(["tif", "tiff"]);

/**
 * 写真を選ぶ欄に渡す形式。**HEIC は書かない**（2026-10-02）。iPhone の Safari は、欄が
 * HEIC を受け付けると書いてあると写真を HEIC のまま送り（Safari 17 以降は JPEG まで
 * HEIC に変えることがある）、書いていなければ JPEG に直して送る。サーバーの画像処理
 * （sharp の配布版）は HEIC の中身（HEVC）を読めないので、HEIC のままだと必ず失敗していた。
 */
export const UPLOAD_IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.avif,.tif,.tiff,image/jpeg,image/png,image/webp,image/avif,image/tiff,image/x-tiff";

/** HEIC（iPhone の写真の形式）。Mac から選んだときなど、ここへ来た物は送る前に断る。 */
export function isHeicFile(file: { name?: string; type?: string }): boolean {
  const type = file.type?.toLowerCase() ?? "";
  const ext = file.name?.split(".").pop()?.toLowerCase() ?? "";
  return type === "image/heic" || type === "image/heif" || ext === "heic" || ext === "heif";
}

/** HEIC を断るときの言葉（どうすれば加えられるかまで）。 */
export function heicNotice(count: number, english = false): string {
  return english
    ? `${count === 1 ? "1 HEIC photo" : `${count} HEIC photos`} could not be imported. Export as JPEG first (adding from Photos on iPhone converts automatically).`
    : `HEIC（iPhone の写真の形式）の${count}枚は取り込めません。Mac では写真アプリで JPEG に書き出してから加えてください（iPhone から加えると自動で JPEG になります）。`;
}

export function isUploadableImageFile(file: {
  name?: string;
  type?: string;
}): boolean {
  if (isHeicFile(file)) return false;
  const type = file.type?.toLowerCase() ?? "";
  const ext = file.name?.split(".").pop()?.toLowerCase() ?? "";
  if (type && UPLOAD_IMAGE_TYPES.has(type)) return true;
  if (!UPLOAD_IMAGE_EXTENSIONS.has(ext)) return false;
  return (
    EXTENSION_ONLY_IMAGE_EXTENSIONS.has(ext) &&
    (!type || type === "application/octet-stream")
  );
}

export function imageFileTooLarge(file: Pick<File, "size">): boolean {
  return file.size > IMAGE_UPLOAD_MAX_BYTES;
}

export function shouldUploadImagesSerially(
  files: Pick<File, "size">[],
): boolean {
  return files.some((file) => file.size > LARGE_IMAGE_UPLOAD_BYTES);
}

export function uploadSizeLimitLabel(): string {
  return formatUploadSizeLimit();
}

export function uploadFailureNotice(
  failures: { file: Pick<File, "name">; reason?: string }[],
): string | null {
  if (!failures.length) return null;
  const names = failures
    .slice(0, 3)
    .map(({ file, reason }) => `${file.name}${reason ? ` (${reason})` : ""}`)
    .join(", ");
  return `${failures.length} 件失敗: ${names}${failures.length > 3 ? " ほか" : ""}`;
}

export function uploadTooLargeNotice(
  files: Pick<File, "name" | "size">[],
): string | null {
  const tooLarge = files.filter(imageFileTooLarge);
  if (!tooLarge.length) return null;
  return uploadFailureNotice(
    tooLarge.map((file) => ({ file, reason: imageTooLargeMessage() })),
  );
}

export const STORAGE_NOT_CONFIGURED_CODE = "STORAGE_NOT_CONFIGURED";

// サーバの保存先未設定エラー(503)のボディから、不足している環境変数の
// 「名前だけ」を取り出す。該当エラーでなければ null。値は扱わない。
export function storageMissingFromErrorBody(data: unknown): string[] | null {
  if (typeof data !== "object" || data === null) return null;
  const { code, missing } = data as { code?: unknown; missing?: unknown };
  if (code !== STORAGE_NOT_CONFIGURED_CODE) return null;
  return Array.isArray(missing)
    ? missing.filter((name): name is string => typeof name === "string")
    : [];
}

// アップロード系レスポンスの失敗ボディから利用者向けメッセージを1つ作る
// 共通経路。保存先未設定(STORAGE_NOT_CONFIGURED)は専用の案内文にし、
// それ以外はサーバの error 文字列 → fallback の順で使う。
export async function uploadErrorMessageFromResponse(
  res: { clone(): { json(): Promise<unknown> } },
  fallback: string,
): Promise<string> {
  let data: unknown;
  try {
    data = await res.clone().json();
  } catch {
    return fallback;
  }
  const missing = storageMissingFromErrorBody(data);
  if (missing) {
    const notice = storageNotConfiguredNotice(missing);
    return `${notice.title} ${notice.detail} ${notice.handoff}`;
  }
  const err = (data as { error?: unknown } | null)?.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}

// 購入者には内部の設定名や公開作業を見せず、連絡先と
// 送る情報だけを案内する。missing は診断用に受け取るが表示しない。
export function storageNotConfiguredNotice(missing: string[]): {
  title: string;
  detail: string;
  handoff: string;
} {
  void missing;
  return {
    title: "写真の保存先がまだ接続されていません。",
    detail:
      "この状態では写真を追加できません。同じ操作を繰り返さず、設定担当者へご連絡ください。",
    handoff:
      "連絡時は、この画面のスクリーンショットと、写真を追加しようとした時刻をお送りください。",
  };
}
