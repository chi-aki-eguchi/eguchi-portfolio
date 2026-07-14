import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { buildOgCardSvg, escapeXml, generateOgCardPng } from "./og-card";

describe("buildOgCardSvg", () => {
  test("builds the editorial card with the expected size and colors", () => {
    const svg = buildOgCardSvg("Mori Photography");

    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain('fill="#f4f1ea"');
    expect(svg).toContain('stroke="#1a1917"');
    expect(svg).toContain(">Mori Photography</text>");
  });

  test("escapes XML and falls back to Photography for an empty title", () => {
    expect(escapeXml(`A&B <Studio> "Photo" 'Book'`)).toBe(
      "A&amp;B &lt;Studio&gt; &quot;Photo&quot; &apos;Book&apos;",
    );
    const svg = buildOgCardSvg(`A&B <Studio>`);
    expect(svg).toContain("A&amp;B &lt;Studio&gt;");
    expect(svg).not.toContain("A&B <Studio>");
    expect(buildOgCardSvg("   ")).toContain(">Photography</text>");
  });

  test("renders a 1200x630 PNG through sharp", async () => {
    const png = await generateOgCardPng("Mori Photography");
    const metadata = await sharp(png).metadata();

    expect(metadata).toMatchObject({ width: 1200, height: 630, format: "png" });
  });
});
