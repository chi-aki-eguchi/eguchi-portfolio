import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { CONVERSION_SETTINGS, convertTiffInbox } from "./convert-tiffs";

describe("convertTiffInbox", () => {
  test("converts TIFFs with site master settings and skips existing outputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "convert-tiffs-"));
    const inputDir = join(root, "in");
    const outputDir = join(root, "out");
    const source = join(inputDir, "scan.tif");
    const output = join(outputDir, "scan.jpg");

    try {
      await mkdir(inputDir, { recursive: true });
      await sharp({
        create: {
          width: 4000,
          height: 2000,
          channels: 3,
          background: { r: 120, g: 80, b: 40 },
        },
      })
        .tiff()
        .toFile(source);

      const first = await convertTiffInbox({ inputDir, outputDir, log: () => {} });
      expect(first.converted).toEqual(["scan.tif"]);
      expect(first.skipped).toEqual([]);
      expect(first.failed).toEqual([]);

      const metadata = await sharp(output).metadata();
      expect(metadata.format).toBe("jpeg");
      expect(metadata.width).toBe(CONVERSION_SETTINGS.maxPx);
      expect(metadata.height).toBe(1600);
      expect(metadata.chromaSubsampling).toBe(CONVERSION_SETTINGS.chromaSubsampling);
      expect(CONVERSION_SETTINGS.quality).toBe(92);
      expect(CONVERSION_SETTINGS.mozjpeg).toBe(true);

      const before = await stat(output);
      const second = await convertTiffInbox({ inputDir, outputDir, log: () => {} });
      const after = await stat(output);
      expect(second.converted).toEqual([]);
      expect(second.skipped).toEqual(["scan.tif"]);
      expect(second.failed).toEqual([]);
      expect(after.mtimeMs).toBe(before.mtimeMs);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
