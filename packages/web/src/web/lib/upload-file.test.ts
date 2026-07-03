import { describe, expect, test } from "bun:test";
import {
  imageFileTooLarge,
  isUploadableImageFile,
  shouldUploadImagesSerially,
  UPLOAD_IMAGE_ACCEPT,
  uploadFailureNotice,
  uploadSizeLimitLabel,
  uploadTooLargeNotice,
} from "./upload-file";

describe("isUploadableImageFile", () => {
  test("accepts TIFF MIME variants and extension-only TIFF files", () => {
    expect(isUploadableImageFile({ name: "DSCF1599.tif", type: "image/tiff" }))
      .toBe(true);
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
    expect(isUploadableImageFile({ name: "vector.svg", type: "image/svg+xml" }))
      .toBe(false);
    expect(isUploadableImageFile({ name: "notes.txt", type: "text/plain" }))
      .toBe(false);
  });

  test("rejects empty MIME types except TIFF browser fallbacks", () => {
    expect(isUploadableImageFile({ name: "renamed.jpg", type: "" })).toBe(false);
    expect(isUploadableImageFile({ name: "renamed.png", type: "application/octet-stream" }))
      .toBe(false);
    expect(isUploadableImageFile({ name: "DSCF1609.TIF", type: "" })).toBe(true);
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
    ).toBe(
      "1 件失敗: DSCF1599.tif (許可されていないファイル形式です。)",
    );
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
    expect(shouldUploadImagesSerially([{ size: 60 * 1024 * 1024 }])).toBe(false);
    expect(shouldUploadImagesSerially([{ size: 60 * 1024 * 1024 + 1 }])).toBe(true);
  });
});
