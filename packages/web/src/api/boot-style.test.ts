import { describe, expect, test } from "bun:test";
import { bootThemeStyle } from "./boot-style";

describe("bootThemeStyle", () => {
  test("設定の太さを、最初の描画の前に書く", () => {
    expect(bootThemeStyle({ bodyWeight: "500", heroNameWeight: "500" })).toBe(
      '<style id="boot-theme">:root{--body-weight:500;--hero-name-weight:500}</style>',
    );
    expect(bootThemeStyle({ bodyWeight: "300" })).toBe('<style id="boot-theme">:root{--body-weight:300}</style>');
  });
  test("設定が無い・おかしい値なら何も書かない（既定の 400 のまま）", () => {
    expect(bootThemeStyle({})).toBe("");
    expect(bootThemeStyle({ bodyWeight: "" })).toBe("");
    expect(bootThemeStyle({ bodyWeight: "bold" })).toBe("");
    expect(bootThemeStyle({ bodyWeight: "500;}body{display:none" })).toBe("");
    expect(bootThemeStyle({ bodyWeight: "1000" })).toBe("");
  });
});
