import { describe, expect, test } from "bun:test";

describe("static HTML template metadata", () => {
  test("does not ship production-only identity in fallback meta tags", async () => {
    const html = await Bun.file(`${import.meta.dir}/../../index.html`).text();
    expect(html).not.toContain("江口秋");
    expect(html).not.toContain("Aki Eguchi");
    expect(html).not.toContain("akieguchi.com");
    expect(html).not.toContain("G-NKECCDLXYD");
    expect(html).toContain("<title>Photography Portfolio</title>");
    expect(html).toContain('property="og:image:type" content="image/jpeg"');
    expect(html).toContain(
      'name="twitter:image:alt" content="Photography Portfolio"',
    );
  });
});
