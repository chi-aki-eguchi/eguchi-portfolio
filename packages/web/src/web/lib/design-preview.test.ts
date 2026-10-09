import { describe, expect, test } from "bun:test";
import { resolvePreviewDesign } from "./design-preview";

describe("新しい構成の下見（?design=develop）", () => {
  test("住所で頼まれたら下見を始め、タブに覚えさせる", () => {
    expect(resolvePreviewDesign("?design=develop", null)).toEqual({ design: "develop", write: "develop" });
  });

  test("何も付いていなければ、覚えている下見を続ける", () => {
    expect(resolvePreviewDesign("", "develop")).toEqual({ design: "develop", write: undefined });
    expect(resolvePreviewDesign("?c=portrait", "develop").design).toBe("develop");
  });

  test("覚えていなければ下見ではない（公開サイトは保存された構成のまま）", () => {
    expect(resolvePreviewDesign("", null)).toEqual({ design: null, write: undefined });
    expect(resolvePreviewDesign("", "something")).toEqual({ design: null, write: undefined });
  });

  test("develop 以外を指定したら下見をやめる", () => {
    expect(resolvePreviewDesign("?design=classic", "develop")).toEqual({ design: null, write: "" });
    expect(resolvePreviewDesign("?design=", "develop")).toEqual({ design: null, write: "" });
  });
});
