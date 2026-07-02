import { describe, expect, test } from "bun:test";
import {
  isUploadableImageFile,
  UPLOAD_IMAGE_ACCEPT,
  uploadFailureNotice,
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
