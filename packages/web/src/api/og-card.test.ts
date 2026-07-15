import { describe, expect, test } from "bun:test";
import { buildOgCardSvg, escapeXml, generateOgCardPng } from "./og-card";
import { OG_CARD_FONT_PATH } from "./og-card-font";

describe("buildOgCardSvg", () => {
  test("builds the editorial card with the expected size and colors", () => {
    const svg = buildOgCardSvg("Mori Photography");

    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain('fill="#f4f1ea"');
    expect(svg).toContain('stroke="#1a1917"');
    expect(svg).toContain('data-font-source="bundled-ttf-outline"');
    expect(svg).toContain("<path ");
    expect(svg).toContain("<title>Mori Photography</title>");
  });

  test("escapes XML and falls back to Photography for an empty title", () => {
    expect(escapeXml(`A&B <Studio> "Photo" 'Book'`)).toBe(
      "A&amp;B &lt;Studio&gt; &quot;Photo&quot; &apos;Book&apos;",
    );
    const svg = buildOgCardSvg(`A&B <Studio>`);
    expect(svg).toContain("A&amp;B &lt;Studio&gt;");
    expect(svg).not.toContain("A&B <Studio>");
    expect(buildOgCardSvg("   ")).toContain("<title>Photography</title>");
  });

  test("renders a 1200x630 PNG through sharp", async () => {
    const { default: sharp } = await import("sharp");
    const png = await generateOgCardPng("Mori Photography");
    const metadata = await sharp(png).metadata();

    expect(metadata).toMatchObject({ width: 1200, height: 630, format: "png" });
  });

  test("renders Japanese from bundled outlines without font resolution", async () => {
    const { default: sharp } = await import("sharp");
    const firstSvg = buildOgCardSvg("日本語写真");
    expect(OG_CARD_FONT_PATH).toEndWith("/assets/fonts/NotoSerifJP.ttf");
    expect(firstSvg).not.toContain("<text");
    expect(firstSvg).not.toContain("font-family");
    expect(firstSvg).not.toContain("@font-face");
    expect(firstSvg).toContain('data-font-source="bundled-ttf-outline"');

    const [firstPng, secondPng] = await Promise.all([
      sharp(Buffer.from(firstSvg)).png().toBuffer(),
      generateOgCardPng("東京人物像"),
    ]);
    const titleRegion = { left: 250, top: 240, width: 700, height: 150 };
    const [first, second] = await Promise.all([
      sharp(firstPng).extract(titleRegion).removeAlpha().raw().toBuffer(),
      sharp(secondPng).extract(titleRegion).removeAlpha().raw().toBuffer(),
    ]);

    let inkPixels = 0;
    let differentPixels = 0;
    for (let index = 0; index < first.length; index += 3) {
      if (
        first[index] !== 244 ||
        first[index + 1] !== 241 ||
        first[index + 2] !== 234
      ) {
        inkPixels += 1;
      }
      if (
        first[index] !== second[index] ||
        first[index + 1] !== second[index + 1] ||
        first[index + 2] !== second[index + 2]
      ) {
        differentPixels += 1;
      }
    }

    expect(inkPixels).toBeGreaterThan(500);
    // Missing Japanese glyphs collapse to the same repeated tofu boxes. Two
    // equal-length titles must therefore produce materially different shapes.
    expect(differentPixels).toBeGreaterThan(500);
  });
});
