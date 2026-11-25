import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 送られてきた画像を、メモリに持たずに一時ファイルへ置く（2026-11-25）。
 *
 * 以前は本文を FormData として丸ごとメモリに読み、さらに2回写していた。180MB の TIFF
 * 1枚で処理中のメモリが約900MB、13MB の JPEG を3枚同時で約850MB になり（手元の実測）、
 * メモリの小さい配布先（Railway の無料枠など）ではサーバーごと落ちて、送っていた人には
 * 「HTTP 502」とだけ出ていた。ファイルに置いて sharp に道順で渡すと、同じ出力のまま
 * 写真の大きさに関係なく約200MBで収まる。
 *
 * 受け付ける形は2つ:
 * - 本文がそのまま画像（管理画面）。名前は `X-Upload-Filename`（URLエンコード）、種類は
 *   `Content-Type`。届いた分から順にファイルへ書くので、メモリには溜まらない。
 * - multipart/form-data の `file`（seed スクリプトや古い画面）。Bun が本文をメモリに読むが、
 *   ファイルへ書いた後は手放すので、画像処理と重ならない。
 */
export const UPLOAD_FILENAME_HEADER = "x-upload-filename";

export type SpooledUpload = {
  path: string;
  name: string;
  type: string;
  size: number;
  cleanup: () => Promise<void>;
};

export type SpoolResult =
  | { ok: true; upload: SpooledUpload }
  | { ok: false; reason: "missing" | "type" | "too-large" };

function decodeFilename(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function spoolUpload(
  req: Request,
  options: {
    maxBytes: number;
    accept: (file: { name: string; type: string }) => boolean;
    dir?: string;
  },
): Promise<SpoolResult> {
  const dir = options.dir ?? join(tmpdir(), "portfolio-uploads");
  await mkdir(dir, { recursive: true });
  const path = join(dir, crypto.randomUUID());
  const cleanup = () => rm(path, { force: true });
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (/^multipart\/form-data/i.test(contentType)) {
      const file = (await req.formData()).get("file");
      if (!(file instanceof File)) return { ok: false, reason: "missing" };
      const { name, type } = file;
      if (!options.accept({ name, type })) return { ok: false, reason: "type" };
      if (file.size > options.maxBytes) return { ok: false, reason: "too-large" };
      await Bun.write(path, file);
      return {
        ok: true,
        upload: { path, name, type, size: file.size, cleanup },
      };
    }

    const name = decodeFilename(req.headers.get(UPLOAD_FILENAME_HEADER));
    const type = contentType.split(";")[0].trim().toLowerCase();
    if (!req.body || !name) return { ok: false, reason: "missing" };
    if (!options.accept({ name, type })) return { ok: false, reason: "type" };
    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > options.maxBytes)
      return { ok: false, reason: "too-large" };

    const writer = Bun.file(path).writer();
    const reader = req.body.getReader();
    let size = 0;
    let tooLarge = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > options.maxBytes) {
          tooLarge = true;
          await reader.cancel();
          break;
        }
        writer.write(value);
        // 書き込みが追いつくのを待つ。待たないと、届いた分がメモリに溜まる。
        await writer.flush();
      }
    } finally {
      await writer.end();
    }
    if (tooLarge) {
      await cleanup();
      return { ok: false, reason: "too-large" };
    }
    if (size === 0) {
      await cleanup();
      return { ok: false, reason: "missing" };
    }
    return { ok: true, upload: { path, name, type, size, cleanup } };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/** 落ちた・止められた処理が残した一時ファイルを、起動時に片付ける。 */
export async function clearSpoolDirectory(
  dir = join(tmpdir(), "portfolio-uploads"),
): Promise<void> {
  try {
    await stat(dir);
  } catch {
    return;
  }
  await rm(dir, { recursive: true, force: true });
}
