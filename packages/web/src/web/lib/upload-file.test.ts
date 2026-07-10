import { describe, expect, test } from "bun:test";
import {
  imageFileTooLarge,
  isUploadableImageFile,
  shouldUploadImagesSerially,
  STORAGE_NOT_CONFIGURED_CODE,
  storageMissingFromErrorBody,
  storageNotConfiguredNotice,
  uploadErrorMessageFromResponse,
  UPLOAD_IMAGE_ACCEPT,
  uploadFailureNotice,
  uploadSizeLimitLabel,
  uploadTooLargeNotice,
} from "./upload-file";

describe("isUploadableImageFile", () => {
  test("accepts TIFF MIME variants and extension-only TIFF files", () => {
    expect(
      isUploadableImageFile({ name: "DSCF1599.tif", type: "image/tiff" }),
    ).toBe(true);
    expect(
      isUploadableImageFile({
        name: "DSCF1607.tiff",
        type: "image/x-tiff",
      }),
    ).toBe(true);
    expect(isUploadableImageFile({ name: "DSCF1609.TIF", type: "" })).toBe(
      true,
    );
  });

  test("keeps unsupported files out before upload", () => {
    expect(
      isUploadableImageFile({ name: "vector.svg", type: "image/svg+xml" }),
    ).toBe(false);
    expect(
      isUploadableImageFile({ name: "notes.txt", type: "text/plain" }),
    ).toBe(false);
  });

  test("rejects empty MIME types except TIFF browser fallbacks", () => {
    expect(isUploadableImageFile({ name: "renamed.jpg", type: "" })).toBe(
      false,
    );
    expect(
      isUploadableImageFile({
        name: "renamed.png",
        type: "application/octet-stream",
      }),
    ).toBe(false);
    expect(isUploadableImageFile({ name: "DSCF1609.TIF", type: "" })).toBe(
      true,
    );
  });
});

describe("UPLOAD_IMAGE_ACCEPT", () => {
  test("advertises TIFF extensions to the browser picker", () => {
    expect(UPLOAD_IMAGE_ACCEPT).toContain(".tif");
    expect(UPLOAD_IMAGE_ACCEPT).toContain(".tiff");
    expect(UPLOAD_IMAGE_ACCEPT).toContain("image/x-tiff");
  });
});

describe("uploadFailureNotice", () => {
  test("includes the server reason beside failed filenames", () => {
    expect(
      uploadFailureNotice([
        {
          file: { name: "DSCF1599.tif" },
          reason: "許可されていないファイル形式です。",
        },
      ]),
    ).toBe("1 件失敗: DSCF1599.tif (許可されていないファイル形式です。)");
  });

  test("keeps the compact three-name summary for many failures", () => {
    expect(
      uploadFailureNotice([
        { file: { name: "a.tif" }, reason: "HTTP 500" },
        { file: { name: "b.tif" }, reason: "HTTP 500" },
        { file: { name: "c.tif" }, reason: "HTTP 500" },
        { file: { name: "d.tif" }, reason: "HTTP 500" },
      ]),
    ).toBe(
      "4 件失敗: a.tif (HTTP 500), b.tif (HTTP 500), c.tif (HTTP 500) ほか",
    );
  });
});

describe("upload size helpers", () => {
  test("allows files up to 300MB and rejects files above it", () => {
    expect(imageFileTooLarge({ size: 300 * 1024 * 1024 })).toBe(false);
    expect(imageFileTooLarge({ size: 300 * 1024 * 1024 + 1 })).toBe(true);
  });

  test("labels the configured limit for admin messages", () => {
    expect(uploadSizeLimitLabel()).toBe("300MB");
    expect(
      uploadTooLargeNotice([
        { name: "small.tif", size: 300 * 1024 * 1024 },
        { name: "huge.tif", size: 300 * 1024 * 1024 + 1 },
      ]),
    ).toBe("1 件失敗: huge.tif (画像が大きすぎます（上限: 300MB）。)");
  });

  test("large files upload one at a time to avoid overwhelming the server", () => {
    expect(shouldUploadImagesSerially([{ size: 60 * 1024 * 1024 }])).toBe(
      false,
    );
    expect(shouldUploadImagesSerially([{ size: 60 * 1024 * 1024 + 1 }])).toBe(
      true,
    );
  });
});

describe("storageMissingFromErrorBody", () => {
  test("extracts missing variable names from the dedicated 503 body", () => {
    expect(
      storageMissingFromErrorBody({
        error: "写真の保存先がまだ接続されていません。",
        code: STORAGE_NOT_CONFIGURED_CODE,
        missing: ["S3_BUCKET", "S3_ENDPOINT"],
      }),
    ).toEqual(["S3_BUCKET", "S3_ENDPOINT"]);
  });

  test("returns null for ordinary errors so the generic path stays intact", () => {
    expect(
      storageMissingFromErrorBody({ error: "Internal server error" }),
    ).toBe(null);
    expect(storageMissingFromErrorBody(null)).toBe(null);
    expect(storageMissingFromErrorBody("oops")).toBe(null);
  });

  test("tolerates a malformed missing field (names only, strings only)", () => {
    expect(
      storageMissingFromErrorBody({
        code: STORAGE_NOT_CONFIGURED_CODE,
        missing: ["S3_BUCKET", 42, null],
      }),
    ).toEqual(["S3_BUCKET"]);
    expect(
      storageMissingFromErrorBody({ code: STORAGE_NOT_CONFIGURED_CODE }),
    ).toEqual([]);
  });
});

describe("storageNotConfiguredNotice", () => {
  test("builds the dedicated beginner-friendly Japanese message", () => {
    const notice = storageNotConfiguredNotice(["S3_BUCKET"]);
    expect(notice.title).toBe("写真の保存先がまだ接続されていません。");
    expect(notice.detail).toContain("S3_BUCKET");
    expect(notice.detail).toContain("Railway の Variables");
    expect(notice.detail).toContain("再デプロイ");
    expect(notice.handoff).toContain(
      "サイトを設定した人へこの画面を送ってください",
    );
  });

  test("shows variable names only — never values", () => {
    const notice = storageNotConfiguredNotice(["S3_SECRET_ACCESS_KEY"]);
    const text = `${notice.title}${notice.detail}${notice.handoff}`;
    expect(text).toContain("S3_SECRET_ACCESS_KEY");
    expect(text).not.toContain("=");
  });

  test("falls back to a generic hint when the list is empty", () => {
    expect(storageNotConfiguredNotice([]).detail).toContain("S3_BUCKET など");
  });
});

describe("uploadErrorMessageFromResponse", () => {
  test("returns the dedicated storage guidance for STORAGE_NOT_CONFIGURED", async () => {
    const res = new Response(
      JSON.stringify({
        error: "写真の保存先がまだ接続されていません。",
        code: STORAGE_NOT_CONFIGURED_CODE,
        missing: ["S3_BUCKET"],
      }),
      { status: 503 },
    );
    const message = await uploadErrorMessageFromResponse(res, "失敗しました");
    expect(message).toContain("写真の保存先がまだ接続されていません。");
    expect(message).toContain("S3_BUCKET");
    expect(message).toContain("再デプロイ");
    expect(message).toContain("サイトを設定した人へこの画面を送ってください");
  });

  test("keeps the server's error string for ordinary failures", async () => {
    const res = new Response(
      JSON.stringify({ error: "許可されていないファイル形式です。" }),
      { status: 415 },
    );
    expect(await uploadErrorMessageFromResponse(res, "失敗しました")).toBe(
      "許可されていないファイル形式です。",
    );
  });

  test("falls back on non-JSON bodies and leaves the body readable", async () => {
    const res = new Response("<html>bad gateway</html>", { status: 502 });
    expect(await uploadErrorMessageFromResponse(res, "失敗しました")).toBe(
      "失敗しました",
    );
    // clone() を使っているので呼び出し元は本文を再読可能
    expect(await res.text()).toContain("bad gateway");
  });
});
