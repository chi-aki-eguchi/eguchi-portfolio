import { describe, expect, test } from "bun:test";
import { contentTypeForStaticPath } from "./static-files";

describe("contentTypeForStaticPath", () => {
  test("serves the admin demonstration video and its caption track", () => {
    expect(contentTypeForStaticPath("/portfolio-kit/admin-demo-ja.webm")).toBe("video/webm");
    expect(contentTypeForStaticPath("/portfolio-kit/admin-demo-ja.vtt")).toBe("text/vtt; charset=utf-8");
  });
  test("returns explicit content types for social card image assets", () => {
    expect(contentTypeForStaticPath("/og-image.jpg")).toBe("image/jpeg");
    expect(contentTypeForStaticPath("/og-service.JPG")).toBe("image/jpeg");
  });

  test("returns explicit content types for built assets and fonts", () => {
    expect(contentTypeForStaticPath("/assets/index-a1b2c3.js")).toBe(
      "application/javascript; charset=utf-8",
    );
    expect(contentTypeForStaticPath("/assets/style-a1b2c3.css")).toBe(
      "text/css; charset=utf-8",
    );
    expect(contentTypeForStaticPath("/assets/font.woff2")).toBe("font/woff2");
  });

  test("ignores query strings and leaves unknown extensions unset", () => {
    expect(contentTypeForStaticPath("/og-image.jpg?v=1")).toBe("image/jpeg");
    expect(contentTypeForStaticPath("/download.bin")).toBeUndefined();
  });
});
