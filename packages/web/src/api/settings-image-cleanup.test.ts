import { describe, expect, test } from "bun:test";
import { staleSettingsImageKeys } from "./settings-image-cleanup";

describe("staleSettingsImageKeys", () => {
  test("差し替えられた profilePhotoUrl の旧キーを返す", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/2-new.jpg"]],
      new Map([["profilePhotoUrl", "/api/images/profile/1-old.jpg"]]),
    );
    expect(keys).toEqual(["profile/1-old.jpg"]);
  });

  test("値が変わっていなければ何も返さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/1-same.jpg"]],
      new Map([["profilePhotoUrl", "/api/images/profile/1-same.jpg"]]),
    );
    expect(keys).toEqual([]);
  });

  test("初回保存(旧値なし)では何も返さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/1-first.jpg"]],
      new Map(),
    );
    expect(keys).toEqual([]);
  });

  test("photos/ 等、専用prefix外を指す旧値は絶対に返さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/2-new.jpg"]],
      new Map([["profilePhotoUrl", "/api/images/photos/gallery-shot.jpg"]]),
    );
    expect(keys).toEqual([]);
  });

  test("プロキシパス形式でない旧値(絶対URL等)は返さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/2-new.jpg"]],
      new Map([
        ["profilePhotoUrl", "https://evil.example/api/images/profile/x.jpg"],
      ]),
    );
    expect(keys).toEqual([]);
  });

  test("heroPhotoUrl は hero/ prefix のみ削除候補になる", () => {
    const keys = staleSettingsImageKeys(
      [["heroPhotoUrl", "/api/images/hero/2-new.jpg"]],
      new Map([["heroPhotoUrl", "/api/images/hero/1-old.jpg"]]),
    );
    expect(keys).toEqual(["hero/1-old.jpg"]);

    const crossPrefix = staleSettingsImageKeys(
      [["heroPhotoUrl", "/api/images/hero/2-new.jpg"]],
      new Map([["heroPhotoUrl", "/api/images/profile/1-old.jpg"]]),
    );
    expect(crossPrefix).toEqual([]);
  });

  test("もう片方の設定が同じオブジェクトを参照し続ける場合は消さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/2-new.jpg"]],
      new Map([
        ["profilePhotoUrl", "/api/images/profile/1-shared.jpg"],
        ["heroPhotoUrl", "/api/images/profile/1-shared.jpg"],
      ]),
    );
    expect(keys).toEqual([]);
  });

  test("対象外の設定キーは無視する", () => {
    const keys = staleSettingsImageKeys(
      [["siteName", "Aki Eguchi"]],
      new Map([["profilePhotoUrl", "/api/images/profile/1-old.jpg"]]),
    );
    expect(keys).toEqual([]);
  });

  test("両方のキーが同時に差し替わればそれぞれの旧キーを返す", () => {
    const keys = staleSettingsImageKeys(
      [
        ["profilePhotoUrl", "/api/images/profile/2-new.jpg"],
        ["heroPhotoUrl", "/api/images/hero/2-new.jpg"],
      ],
      new Map([
        ["profilePhotoUrl", "/api/images/profile/1-old.jpg"],
        ["heroPhotoUrl", "/api/images/hero/1-old.jpg"],
      ]),
    );
    expect(keys.sort()).toEqual(["hero/1-old.jpg", "profile/1-old.jpg"]);
  });
});
