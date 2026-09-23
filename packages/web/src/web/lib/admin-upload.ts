/**
 * 写真1枚を取り込む（画像を送る → 撮影情報つきで登録する）。
 *
 * 写真一覧（GalleryTab）の取り込みと、作業台（写真集の管理画面）の
 * 「写真を落として加える」が同じ手順を使う。以前は GalleryTab の中にだけ
 * あり、別の画面から取り込めなかった（2026-09-23 に切り出し）。
 *
 * - 失敗は投げずに結果で返す。複数枚を並べて送るとき、1枚の失敗で残りを
 *   止めないため（401 は assertOk がログイン画面へ送る。従来どおり）。
 */
import { adminApi } from "./api";
import { assertOk } from "../pages/admin-shared";
import { shotAtWithSourceForUploadedPhoto } from "./upload-date";
import { storageMissingFromErrorBody } from "./upload-file";

export type UploadMedium = "digital" | "film";
export type UploadDatePolicy = "file" | "none" | string;

export type UploadResult =
  | { kind: "added"; id: number }
  | { kind: "duplicate" }
  | { kind: "failed"; reason?: string; storageMissing?: string[] };

async function serverErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.clone().json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim())
      return data.error.trim();
  } catch {
    // 本文が JSON でなければ番号だけを返す。
  }
  return `HTTP ${res.status}`;
}

export async function uploadPhotoFile(
  file: File,
  {
    medium,
    datePolicy,
    failureMessage,
  }: {
    medium: UploadMedium;
    datePolicy: UploadDatePolicy;
    /** 失敗の文言を言語に合わせたいとき。省略時はサーバーの文言。 */
    failureMessage?: (res: Response) => Promise<string> | string;
  },
): Promise<UploadResult> {
  let storageMissing: string[] | undefined;
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) {
      try {
        const body = (await res.clone().json()) as unknown;
        const missing = storageMissingFromErrorBody(body);
        if (missing) storageMissing = missing;
      } catch {
        // 非JSONエラーは汎用メッセージに任せる
      }
      const message = failureMessage
        ? await failureMessage(res)
        : await serverErrorMessage(res);
      try {
        assertOk(res);
      } catch (err) {
        if (res.status === 401) throw err;
      }
      throw new Error(message);
    }
    assertOk(res);
    const data = (await res.json()) as Record<string, unknown>;
    // サーバーが同じ画像を見つけた — 登録しない。
    if (data.duplicate) return { kind: "duplicate" };
    const {
      url,
      width,
      height,
      fileHash,
      thumbKey,
      mediumKey,
      shotAt,
      exifDateDigitized,
      sourceWidth,
      sourceHeight,
      sourceFormat,
      exifCamera,
      exifMake,
      exifModel,
      exifLens,
      exifFocalLength,
      exifFNumber,
      exifExposureTime,
      exifIso,
    } = data;
    if (!url) throw new Error("no url returned");
    const isDigital = medium === "digital";
    const filmTypeVal = isDigital ? "デジタル" : "フィルム";
    const cameraVal = isDigital ? ((exifCamera as string) ?? "") : "";
    const lensVal = isDigital ? ((exifLens as string) ?? "") : "";
    let { shotAt: shotAtVal, shotAtSource: shotAtSourceVal } =
      shotAtWithSourceForUploadedPhoto(shotAt, exifDateDigitized, file, medium);
    if (
      !shotAtVal &&
      datePolicy === "file" &&
      Number.isFinite(file.lastModified) &&
      file.lastModified > 0
    ) {
      const d = new Date(file.lastModified);
      const pad = (n: number) => String(n).padStart(2, "0");
      shotAtVal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      shotAtSourceVal = "file_modified";
    }
    const created = await adminApi.photos.$post({
      json: {
        filename: file.name,
        url: url as string,
        width: width as number,
        height: height as number,
        fileHash: fileHash as string,
        thumbKey: (thumbKey as string) ?? "",
        mediumKey: (mediumKey as string) ?? "",
        shotAt: shotAtVal,
        shotAtSource: shotAtSourceVal,
        shotAtDigitized: isDigital ? ((exifDateDigitized as string) ?? "") : shotAtVal,
        sourceWidth: (sourceWidth as number) ?? null,
        sourceHeight: (sourceHeight as number) ?? null,
        sourceFormat: (sourceFormat as string) ?? null,
        title: "",
        meta: "",
        category: "",
        filmType: filmTypeVal,
        camera: cameraVal,
        cameraMake: isDigital ? ((exifMake as string) ?? "") : "",
        cameraModel: isDigital ? ((exifModel as string) ?? "") : "",
        lens: lensVal,
        focalLength: isDigital ? ((exifFocalLength as string) ?? "") : "",
        fNumber: isDigital ? ((exifFNumber as string) ?? "") : "",
        exposureTime: isDigital ? ((exifExposureTime as string) ?? "") : "",
        iso: isDigital ? ((exifIso as string) ?? "") : "",
      },
    });
    assertOk(created);
    const createdBody = (await created.json()) as {
      duplicate?: boolean;
      photo?: { id?: unknown };
    };
    if (createdBody.duplicate) return { kind: "duplicate" };
    const createdId = createdBody.photo?.id;
    if (
      created.status !== 201 ||
      typeof createdId !== "number" ||
      !Number.isInteger(createdId)
    ) {
      throw new Error("no photo id returned");
    }
    return { kind: "added", id: createdId };
  } catch (err) {
    // 401 は assertOk がログイン画面へ送る。ここでは従来どおり失敗として数える。
    return {
      kind: "failed",
      reason: err instanceof Error ? err.message : undefined,
      storageMissing,
    };
  }
}
