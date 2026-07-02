import { describe, expect, test } from "bun:test";

async function jpegDimensions(path: string) {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;

    const length = (bytes[offset] << 8) + bytes[offset + 1];
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      return {
        height: (bytes[offset + 3] << 8) + bytes[offset + 4],
        width: (bytes[offset + 5] << 8) + bytes[offset + 6],
        bytes: bytes.length,
      };
    }
    offset += length;
  }
  throw new Error(`JPEG dimensions not found: ${path}`);
}

describe("static social card images", () => {
  for (const name of ["og-image.jpg", "og-service.jpg"]) {
    test(`${name} is the expected lightweight large-card JPEG`, async () => {
      const image = await jpegDimensions(
        `${import.meta.dir}/../../public/${name}`,
      );
      expect(image).toMatchObject({ width: 1200, height: 630 });
      expect(image.bytes).toBeLessThan(300_000);
    });
  }
});
