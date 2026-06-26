import { describe, expect, it } from "bun:test";
import {
  imageUrlWithParams,
  objectPositionFromFocal,
  orientedAspectRatio,
  orientedDimensions,
  parseRotationDeg,
  rotateRotationDeg,
} from "./image-url";

describe("image-url helpers", () => {
  it("adds resize, format, and rotation params without duplicating empty rot=0", () => {
    expect(
      imageUrlWithParams("/api/images/photos/a.jpg", {
        w: 1200,
        q: 85,
        fmt: "webp",
        rotationDeg: 90,
      }),
    ).toBe("/api/images/photos/a.jpg?w=1200&q=85&fmt=webp&rot=90");

    expect(
      imageUrlWithParams("/api/images/photos/a.jpg?token=1", {
        w: 800,
        q: 82,
        rotationDeg: 0,
      }),
    ).toBe("/api/images/photos/a.jpg?token=1&w=800&q=82");
  });

  it("validates the supported rotation values", () => {
    expect(parseRotationDeg(undefined)).toBe(0);
    expect(parseRotationDeg("270")).toBe(270);
    expect(parseRotationDeg("45")).toBeNull();
  });

  it("rotates in quarter turns with wraparound", () => {
    expect(rotateRotationDeg(0, -90)).toBe(270);
    expect(rotateRotationDeg(270, 90)).toBe(0);
    expect(rotateRotationDeg(90, 180)).toBe(270);
  });

  it("builds clamped object-position values from focal points", () => {
    expect(objectPositionFromFocal(25, 80)).toBe("25% 80%");
    expect(objectPositionFromFocal("-10", "101")).toBe("0% 100%");
    expect(objectPositionFromFocal(undefined, Number.NaN)).toBe("50% 50%");
  });

  it("swaps dimensions and aspect ratio for quarter turns", () => {
    expect(orientedDimensions(3200, 2133, 90)).toEqual({
      width: 2133,
      height: 3200,
    });
    expect(orientedAspectRatio(3200, 2133, 270)).toBe("2133 / 3200");
    expect(orientedAspectRatio(3200, 2133, 180)).toBe("3200 / 2133");
  });
});
