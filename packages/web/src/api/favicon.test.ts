import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import {
  buildMonogramSvg,
  DYNAMIC_FAVICON_PATHS,
  generateFaviconAsset,
  profileStorageKey,
  wrapPngInIco,
} from "./favicon";

describe("wrapPngInIco", () => {
  test("wraps one 48px PNG in a valid ICO directory entry", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const ico = wrapPngInIco(png, 48);
    const view = new DataView(ico.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(1);
    expect(ico[6]).toBe(48);
    expect(ico[7]).toBe(48);
    expect(view.getUint16(10, true)).toBe(1);
    expect(view.getUint16(12, true)).toBe(32);
    expect(view.getUint32(14, true)).toBe(png.byteLength);
    expect(view.getUint32(18, true)).toBe(22);
    expect(ico.slice(22)).toEqual(png);
  });
});

describe("buildMonogramSvg", () => {
  test("uses the first site-name character and escapes XML", () => {
    const svg = buildMonogramSvg("  <Aki");
    expect(svg).toContain(">&lt;</text>");
    expect(svg).toContain('fill="#f4f1ea"');
    expect(svg).toContain('fill="#1a1917"');
  });

  test("uses Photography's P when the site name is empty", () => {
    expect(buildMonogramSvg("  ")).toContain(">P</text>");
  });
});

describe("profileStorageKey", () => {
  test("accepts only managed profile proxy paths", () => {
    expect(profileStorageKey("/api/images/profile/%E5%86%99%E7%9C%9F.jpg"))
      .toBe("profile/写真.jpg");
    expect(profileStorageKey("/api/images/photos/other.jpg")).toBeNull();
    expect(profileStorageKey("https://example.com/profile.jpg")).toBeNull();
  });
});

describe("generateFaviconAsset", () => {
  test("generates the expected format and size for every dynamic path", async () => {
    const expectedSize = new Map([
      ["/favicon.svg", 64],
      ["/favicon.ico", 48],
      ["/favicon-v2.svg", 64],
      ["/favicon-v2.ico", 48],
      ["/apple-touch-icon.png", 180],
      ["/icon-192.png", 192],
      ["/icon-512.png", 512],
    ]);

    expect(DYNAMIC_FAVICON_PATHS).toEqual([...expectedSize.keys()]);

    for (const path of DYNAMIC_FAVICON_PATHS) {
      const asset = await generateFaviconAsset(path, { siteName: "Mori" }, async () => {
        throw new Error("profile image should not be loaded");
      });
      const size = expectedSize.get(path);

      if (path.endsWith(".svg")) {
        expect(asset.contentType).toBe("image/svg+xml");
        expect(asset.body.toString()).toContain('width="64" height="64"');
      } else if (path.endsWith(".ico")) {
        expect(asset.contentType).toBe("image/x-icon");
        const metadata = await sharp(asset.body.subarray(22)).metadata();
        expect(metadata).toMatchObject({ width: size, height: size, format: "png" });
      } else {
        expect(asset.contentType).toBe("image/png");
        const metadata = await sharp(asset.body).metadata();
        expect(metadata).toMatchObject({ width: size, height: size, format: "png" });
      }
    }
  });

  test("embeds a centered 64px profile PNG in the SVG", async () => {
    const source = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: "#735a42",
      },
    })
      .png()
      .toBuffer();
    const loadedKeys: string[] = [];
    const asset = await generateFaviconAsset(
      "/favicon-v2.svg",
      { profilePhotoUrl: "/api/images/profile/portrait.jpg" },
      async (key) => {
        loadedKeys.push(key);
        return source;
      },
    );
    const svg = asset.body.toString();
    const encoded = svg.match(/base64,([^"]+)/)?.[1];
    const metadata = await sharp(Buffer.from(encoded ?? "", "base64")).metadata();

    expect(asset.contentType).toBe("image/svg+xml");
    expect(loadedKeys).toEqual(["profile/portrait.jpg"]);
    expect(metadata).toMatchObject({ width: 64, height: 64, format: "png" });
  });

  test("returns a monogram PNG when profile image loading fails", async () => {
    const failures: unknown[] = [];
    const asset = await generateFaviconAsset(
      "/icon-192.png",
      { profilePhotoUrl: "/api/images/profile/missing.jpg", siteName: "Mori" },
      async () => {
        throw new Error("storage unavailable");
      },
      (error) => failures.push(error),
    );
    const metadata = await sharp(asset.body).metadata();

    expect(asset.contentType).toBe("image/png");
    expect(metadata).toMatchObject({ width: 192, height: 192, format: "png" });
    expect(failures).toHaveLength(1);
  });
});
