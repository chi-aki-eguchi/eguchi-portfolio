import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Picture } from "./Picture";

describe("Picture generated variants", () => {
  test("uses upload-time variants instead of requesting a new runtime transform", () => {
    const html = renderToStaticMarkup(
      createElement(Picture, {
        url: "/api/images/photos/a.jpg",
        thumbUrl: "/api/images/thumbs/a.webp",
        mediumUrl: "/api/images/medium/a.webp",
        width: 3200,
        height: 2136,
        rotationDeg: 0,
        alt: "Photograph",
        preset: "lightbox",
        sizes: "90vw",
        fallbackW: 1400,
        fallbackQ: 86,
      }),
    );

    expect(html).toContain('src="/api/images/medium/a.webp"');
    expect(html).toContain(
      'srcSet="/api/images/thumbs/a.webp 640w, /api/images/medium/a.webp 1920w, /api/images/photos/a.jpg 3200w"',
    );
    expect(html).not.toContain("?w=1400");
    expect(html).not.toContain("<source");
  });
});
