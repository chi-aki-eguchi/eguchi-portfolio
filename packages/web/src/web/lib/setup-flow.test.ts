import { describe, expect, test } from "bun:test";
import { shouldLandOnSetup } from "./setup-flow";

describe("shouldLandOnSetup", () => {
  test("setupCompleted未保存の認証済み利用者は「はじめに」へ着地する", () => {
    expect(shouldLandOnSetup(true, {})).toBe(true);
    expect(shouldLandOnSetup(true, { setupCompleted: "false" })).toBe(true);
  });

  test("写真の有無は判定に影響しない(引数に取らない=バックフィル廃止)", () => {
    // 旧実装は写真ありだと裏で setupCompleted を書き込んでいた。新実装は
    // 設定と認証状態だけで決まり、書き込みは一切しない。
    expect(shouldLandOnSetup(true, { setupCompleted: "" })).toBe(true);
  });

  test("setupCompleted=true の既存サイトには強制導線を出さない", () => {
    expect(shouldLandOnSetup(true, { setupCompleted: "true" })).toBe(false);
  });

  test("未認証・認証確認中は何もしない", () => {
    expect(shouldLandOnSetup(false, {})).toBe(false);
    expect(shouldLandOnSetup(undefined, {})).toBe(false);
  });

  test("設定の読込前は判定しない(読込後にもう一度呼ばれる)", () => {
    expect(shouldLandOnSetup(true, undefined)).toBe(false);
  });
});
