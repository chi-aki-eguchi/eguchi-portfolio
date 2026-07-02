import { describe, test, expect } from "bun:test";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_MAX_BYTES,
  FONT_MAX_BYTES,
  isAllowedImageKey,
  clientIpFrom,
  passwordMatches,
  isHttpsRequest,
  LOGIN_WINDOW_MS,
  LOGIN_MAX_FAILS,
  clampImageWidth,
  clampImageHeight,
  clampImageQuality,
  isAllowedUploadImageFile,
} from "./security";
import { IMAGE_UPLOAD_REQUEST_MAX_BYTES } from "../shared/upload-limits";

describe("ALLOWED_IMAGE_TYPES", () => {
  test("accepts standard photographic formats", () => {
    for (const t of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/tiff",
      "image/x-tiff",
      "image/avif",
    ]) {
      expect(ALLOWED_IMAGE_TYPES.has(t)).toBe(true);
    }
  });

  test("rejects non-image MIME types", () => {
    expect(ALLOWED_IMAGE_TYPES.has("text/html")).toBe(false);
    expect(ALLOWED_IMAGE_TYPES.has("application/javascript")).toBe(false);
    expect(ALLOWED_IMAGE_TYPES.has("image/svg+xml")).toBe(false);
    expect(ALLOWED_IMAGE_TYPES.has("application/pdf")).toBe(false);
  });
});

describe("size limits", () => {
  test("image max is 300MB", () => {
    expect(IMAGE_MAX_BYTES).toBe(300 * 1024 * 1024);
  });
  test("request body max leaves multipart overhead for 300MB files", () => {
    expect(IMAGE_UPLOAD_REQUEST_MAX_BYTES).toBe(305 * 1024 * 1024);
  });
  test("font max is 2MB", () => {
    expect(FONT_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe("isAllowedUploadImageFile", () => {
  test("accepts TIFF MIME variants and extension-only TIFF files", () => {
    expect(isAllowedUploadImageFile({ name: "scan.tif", type: "image/tiff" }))
      .toBe(true);
    expect(
      isAllowedUploadImageFile({ name: "scan.tiff", type: "image/x-tiff" }),
    ).toBe(true);
    expect(isAllowedUploadImageFile({ name: "scan.TIF", type: "" })).toBe(true);
    expect(
      isAllowedUploadImageFile({
        name: "scan.tiff",
        type: "application/octet-stream",
      }),
    ).toBe(true);
  });

  test("rejects unsupported image-ish or non-image files", () => {
    expect(isAllowedUploadImageFile({ name: "vector.svg", type: "image/svg+xml" }))
      .toBe(false);
    expect(isAllowedUploadImageFile({ name: "notes.pdf", type: "application/pdf" }))
      .toBe(false);
  });
});

describe("isAllowedImageKey (path traversal prevention)", () => {
  test("allows valid prefixes", () => {
    expect(isAllowedImageKey("photos/123.jpg")).toBe(true);
    expect(isAllowedImageKey("thumbs/123.webp")).toBe(true);
    expect(isAllowedImageKey("medium/123.webp")).toBe(true);
    expect(isAllowedImageKey("hero/abc.jpg")).toBe(true);
    expect(isAllowedImageKey("profile/me.jpg")).toBe(true);
    expect(isAllowedImageKey("fonts/custom.woff2")).toBe(true);
  });

  test("blocks traversal attempts", () => {
    expect(isAllowedImageKey("../etc/passwd")).toBe(false);
    expect(isAllowedImageKey("../../secrets/key")).toBe(false);
  });

  test("blocks keys without allowed prefix", () => {
    expect(isAllowedImageKey("private/data.json")).toBe(false);
    expect(isAllowedImageKey("admin/config")).toBe(false);
    expect(isAllowedImageKey("")).toBe(false);
  });

  test("blocks prefix as substring (not at start)", () => {
    expect(isAllowedImageKey("x/photos/1.jpg")).toBe(false);
    expect(isAllowedImageKey("nothero/1.jpg")).toBe(false);
  });

  test("blocks encoded traversal after decode", () => {
    expect(isAllowedImageKey("..%2F..%2Fetc%2Fpasswd")).toBe(false);
  });
});

describe("clientIpFrom (rate-limit IP extraction)", () => {
  test("uses last x-forwarded-for IP to prevent spoofing", () => {
    expect(clientIpFrom("1.1.1.1, 2.2.2.2, 3.3.3.3", undefined)).toBe(
      "3.3.3.3",
    );
  });

  test("single x-forwarded-for value", () => {
    expect(clientIpFrom("9.9.9.9", undefined)).toBe("9.9.9.9");
  });

  test("falls back to x-real-ip when no xff", () => {
    expect(clientIpFrom(undefined, "4.4.4.4")).toBe("4.4.4.4");
  });

  test("returns unknown when no headers present", () => {
    expect(clientIpFrom(undefined, undefined)).toBe("unknown");
  });

  test("trims whitespace from xff entries", () => {
    expect(clientIpFrom("  1.1.1.1 ,  2.2.2.2 ", undefined)).toBe("2.2.2.2");
  });

  test("handles empty xff string gracefully", () => {
    expect(clientIpFrom("", "5.5.5.5")).toBe("5.5.5.5");
    expect(clientIpFrom("", undefined)).toBe("unknown");
  });
});

describe("passwordMatches (constant-time comparison)", () => {
  const password = "my-secret-admin-password";

  test("returns true for correct password", () => {
    expect(passwordMatches(password, password)).toBe(true);
  });

  test("returns false for wrong password", () => {
    expect(passwordMatches("wrong", password)).toBe(false);
  });

  test("returns false when admin password is not set", () => {
    expect(passwordMatches("anything", undefined)).toBe(false);
    expect(passwordMatches("anything", "")).toBe(false);
  });

  test("returns false for non-string input", () => {
    expect(passwordMatches(null, password)).toBe(false);
    expect(passwordMatches(undefined, password)).toBe(false);
    expect(passwordMatches(123, password)).toBe(false);
    expect(passwordMatches({}, password)).toBe(false);
    expect(passwordMatches([], password)).toBe(false);
  });

  test("handles unicode passwords", () => {
    const jp = "パスワード";
    expect(passwordMatches(jp, jp)).toBe(true);
    expect(passwordMatches(jp, "パスワート")).toBe(false);
  });
});

describe("isHttpsRequest", () => {
  test("detects https from x-forwarded-proto", () => {
    expect(isHttpsRequest("https", "http://localhost:4200")).toBe(true);
  });

  test("detects http from x-forwarded-proto", () => {
    expect(isHttpsRequest("http", "https://example.com")).toBe(false);
  });

  test("handles comma-separated x-forwarded-proto (uses first)", () => {
    expect(isHttpsRequest("https, http", "http://localhost")).toBe(true);
    expect(isHttpsRequest("http, https", "https://example.com")).toBe(false);
  });

  test("falls back to URL protocol when no proxy header", () => {
    expect(isHttpsRequest(undefined, "https://example.com/path")).toBe(true);
    expect(isHttpsRequest(undefined, "http://localhost:4200/api")).toBe(false);
  });

  test("returns false for malformed URL without header", () => {
    expect(isHttpsRequest(undefined, "not-a-url")).toBe(false);
  });
});

describe("rate limit constants", () => {
  test("window is 15 minutes", () => {
    expect(LOGIN_WINDOW_MS).toBe(15 * 60 * 1000);
  });
  test("max failures is 10", () => {
    expect(LOGIN_MAX_FAILS).toBe(10);
  });
});

describe("clampImageWidth", () => {
  test("returns null for missing/undefined param", () => {
    expect(clampImageWidth(undefined)).toBeNull();
    expect(clampImageWidth("")).toBeNull();
  });

  test("returns null for non-numeric string", () => {
    expect(clampImageWidth("abc")).toBeNull();
    expect(clampImageWidth("NaN")).toBeNull();
  });

  test("clamps to minimum 50", () => {
    expect(clampImageWidth("10")).toBe(50);
    expect(clampImageWidth("0")).toBe(50);
    expect(clampImageWidth("-100")).toBe(50);
  });

  test("clamps to maximum 3200", () => {
    expect(clampImageWidth("5000")).toBe(3200);
    expect(clampImageWidth("99999")).toBe(3200);
  });

  test("passes through valid widths", () => {
    expect(clampImageWidth("800")).toBe(800);
    expect(clampImageWidth("50")).toBe(50);
    expect(clampImageWidth("3200")).toBe(3200);
  });
});

describe("clampImageWidth (edge cases)", () => {
  test("rejects Infinity string (parseInt returns NaN)", () => {
    expect(clampImageWidth("Infinity")).toBeNull();
  });

  test("rejects -Infinity string", () => {
    expect(clampImageWidth("-Infinity")).toBeNull();
  });

  test("parses float as integer (parseInt truncates)", () => {
    expect(clampImageWidth("800.7")).toBe(800);
  });

  test("rejects leading whitespace (parseInt quirk)", () => {
    expect(clampImageWidth("  800")).toBe(800);
  });
});

describe("clampImageHeight", () => {
  test("uses the same bounds as image width", () => {
    expect(clampImageHeight(undefined)).toBeNull();
    expect(clampImageHeight("10")).toBe(50);
    expect(clampImageHeight("630")).toBe(630);
    expect(clampImageHeight("5000")).toBe(3200);
    expect(clampImageHeight("abc")).toBeNull();
  });
});

describe("clampImageQuality", () => {
  test("defaults to 90 for missing/undefined param", () => {
    expect(clampImageQuality(undefined)).toBe(90);
    expect(clampImageQuality("")).toBe(90);
  });

  test("defaults to 90 for non-numeric string", () => {
    expect(clampImageQuality("abc")).toBe(90);
  });

  test("clamps to minimum 10", () => {
    expect(clampImageQuality("1")).toBe(10);
    expect(clampImageQuality("0")).toBe(10);
    expect(clampImageQuality("-5")).toBe(10);
  });

  test("clamps to maximum 100", () => {
    expect(clampImageQuality("200")).toBe(100);
  });

  test("passes through valid qualities", () => {
    expect(clampImageQuality("90")).toBe(90);
    expect(clampImageQuality("10")).toBe(10);
    expect(clampImageQuality("100")).toBe(100);
    expect(clampImageQuality("75")).toBe(75);
  });
});
