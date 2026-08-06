import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  optimiseUploadedImage,
  UnreadableImageError,
} from "./uploaded-image-processing";

describe("optimiseUploadedImage", () => {
  test("turns a file that only claims to be an image into a client-fixable error", async () => {
    await expect(
      optimiseUploadedImage(Buffer.from("not-an-image"), 3200, 92),
    ).rejects.toBeInstanceOf(UnreadableImageError);
  });

  test("still optimises a real image", async () => {
    const input = await sharp({
      create: {
        width: 2,
        height: 1,
        channels: 3,
        background: "#c08040",
      },
    })
      .png()
      .toBuffer();

    const output = await optimiseUploadedImage(input, 3200, 92);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(2);
    expect(metadata.height).toBe(1);
  });
});

describe("upload route wiring", () => {
  const source = readFileSync(import.meta.dir + "/index.ts", "utf8");

  test("maps unreadable image contents to 422", () => {
    const errorHandler = source.slice(
      source.indexOf(".onError((err, c) =>"),
      source.indexOf(".use(\n    cors("),
    );
    expect(errorHandler).toContain("err instanceof UnreadableImageError");
    expect(errorHandler).toContain("UNREADABLE_IMAGE_MESSAGE }, 422");
  });

  test("all three image-upload routes use the guarded optimiser", () => {
    const uploadRoutes = source.slice(
      source.indexOf('.post("/admin/upload"'),
      source.indexOf("// ── Admin: Upload custom font"),
    );
    expect(uploadRoutes.match(/optimiseUploadedImage\(/g)).toHaveLength(3);
    expect(uploadRoutes).not.toContain("optimiseImage(");
  });
});
