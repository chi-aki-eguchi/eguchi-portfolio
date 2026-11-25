import { mkdir, open, rm, stat } from "node:fs/promises";
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
 * - multipart/form-data の `file`（seed スクリプトや古い画面）。本文はメモリに読まれるが、
 *   ファイルへ書いた後は手放すので、画像処理と重ならない。
 *
 * 書き込みは node:fs で行う。本番は Bun だが、開発サーバー（Vite）と smoke は Node で
 * API を動かすので、`Bun.file` / `Bun.write` を使うとそこでだけ取り込みが落ちる。
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

/**
 * 届いた順にファイルへ書く。1かたまりずつ書き終わるのを待つので、メモリに溜まらない。
 * `maxBytes` を超えたら読むのをやめて "too-large" を返す（ファイルの片付けは呼ぶ側）。
 */
async function writeStreamToFile(
  body: ReadableStream<Uint8Array>,
  path: string,
  maxBytes: number,
): Promise<{ size: number; tooLarge: boolean }> {
  const handle = await open(path, "w");
  const reader = body.getReader();
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return { size, tooLarge: false };
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { size, tooLarge: true };
      }
      await handle.write(value);
    }
  } finally {
    await handle.close();
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
      await writeStreamToFile(file.stream(), path, options.maxBytes);
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

    const { size, tooLarge } = await writeStreamToFile(
      req.body,
      path,
      options.maxBytes,
    );
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
