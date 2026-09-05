import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroPicture } from "../pages/top";
import {
  heroGeneratedSrcSet,
  heroImageSizes,
  heroPreloadAllowed,
} from "../../shared/hero-responsive";

describe("TOP hero responsive image candidates", () => {
  test("keeps the server preload size hint aligned with each hero layout", () => {
    expect(heroImageSizes("editorial")).toBe(
      "(min-width: 768px) 55vw, 100vw",
    );
    expect(heroImageSizes("single")).toBe("100vw");
    expect(heroImageSizes("quiet-grid")).toBe("100vw");
    expect(heroImageSizes("immersive")).toBe("100vw");
    expect(heroImageSizes("carousel")).toBe(
      "(min-width: 1200px) 1152px, 100vw",
    );
    expect(heroImageSizes("carousel", "fullscreen")).toBe("100vw");
  });

  test("does not preload a guessed first slide in random HERO modes", () => {
    expect(heroPreloadAllowed(undefined)).toBe(true);
    expect(heroPreloadAllowed("off")).toBe(true);
    expect(heroPreloadAllowed("shuffle")).toBe(false);
    expect(heroPreloadAllowed("any")).toBe(false);
  });

  test("uses the existing 640px thumb, 1920px medium, and larger original", () => {
    expect(
      heroGeneratedSrcSet({
        url: "/api/images/photos/a.jpg",
        thumbUrl: "/api/images/thumbs/a.webp",
        mediumUrl: "/api/images/medium/a.webp",
        width: 3200,
        height: 2136,
        rotationDeg: 0,
      }),
    ).toBe(
      "/api/images/thumbs/a.webp 640w, /api/images/medium/a.webp 1920w, /api/images/photos/a.jpg 3200w",
    );
  });

  test("uses oriented width and keeps rotation on the original candidate", () => {
    expect(
      heroGeneratedSrcSet({
        url: "/api/images/photos/portrait.jpg",
        thumbUrl: "/api/images/thumbs/portrait.webp?rot=90",
        mediumUrl: "/api/images/medium/portrait.webp?rot=90",
        width: 4000,
        height: 3000,
        rotationDeg: 90,
      }),
    ).toBe(
      "/api/images/thumbs/portrait.webp?rot=90 480w, /api/images/medium/portrait.webp?rot=90 1440w, /api/images/photos/portrait.jpg?rot=90 3000w",
    );
  });

  test("does not advertise generated files as wider than a small original", () => {
    expect(
      heroGeneratedSrcSet({
        url: "/api/images/photos/small.jpg",
        thumbUrl: "/api/images/thumbs/small.webp",
        mediumUrl: "/api/images/medium/small.webp",
        width: 1200,
        height: 800,
      }),
    ).toBe(
      "/api/images/thumbs/small.webp 640w, /api/images/medium/small.webp 1200w",
    );
  });

  test("keeps the previous fallback when dimensions are unknown", () => {
    expect(
      heroGeneratedSrcSet({
        url: "/api/images/photos/legacy.jpg",
        thumbUrl: "/api/images/thumbs/legacy.webp",
        mediumUrl: "/api/images/medium/legacy.webp",
      }),
    ).toBe("");
  });

  test("wires the candidates and layout size hint onto the rendered hero", () => {
    const html = renderToStaticMarkup(
      createElement(HeroPicture, {
        url: "/api/images/photos/a.jpg",
        thumbUrl: "/api/images/thumbs/a.webp",
        mediumUrl: "/api/images/medium/a.webp",
        width: 3200,
        height: 2136,
        alt: "Photograph",
        sizes: "100vw",
      }),
    );
    expect(html).toContain('src="/api/images/medium/a.webp"');
    expect(html).toContain(
      'srcSet="/api/images/thumbs/a.webp 640w, /api/images/medium/a.webp 1920w, /api/images/photos/a.jpg 3200w"',
    );
    expect(html).toContain('sizes="100vw"');
  });
});

test("the HTML shell warms Google Fonts without downloading fixed families", async () => {
  const html = await Bun.file(
    new URL("../../../index.html", import.meta.url),
  ).text();
  expect(html).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
  expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com"');
  expect(html).not.toContain("fonts.googleapis.com/css2?family=");
  expect(html).not.toContain('rel="preload" as="style"');
});
