import { describe, expect, test } from "bun:test";
import {
  buildPublicSiteHref,
  clampSettingsPreviewWidth,
  defaultSettingsPreviewWidth,
  settingsPreviewRatioFromWidth,
  settingsPreviewWidthBounds,
  settingsPreviewWidthFromRatio,
  SETTINGS_FORM_MIN_WIDTH,
  SETTINGS_PREVIEW_HANDLE_WIDTH,
  SETTINGS_PREVIEW_MIN_WIDTH,
} from "./admin-shared";

// Settings プレビューの幅は localStorage に比率で残る。壊れた値・別の画面幅で
// 保存された値・NaN が来ても編集不能にしないことを、ここで固定する
// (仕様 admin-phase1-settings-preview.md §3-1 / §3-3 / テスト計画 U1・U2)。

describe("settings preview width", () => {
  test("既定幅は写真を確認するpreviewに58%を割り当てる", () => {
    for (const width of [960, 1032, 1192, 1352]) expect(defaultSettingsPreviewWidth(width)).toBe(Math.round(width * .58));
  });

  test("previewを広げても設定本文のためにフォーム400pxを残す", () => {
    expect(settingsPreviewWidthBounds(1192).max).toBe(1192 - SETTINGS_FORM_MIN_WIDTH - SETTINGS_PREVIEW_HANDLE_WIDTH);
    expect(settingsPreviewWidthBounds(900).max).toBe(900 - SETTINGS_FORM_MIN_WIDTH - SETTINGS_PREVIEW_HANDLE_WIDTH);
  });

  test("どんな幅でも、プレビューを広げてフォームが 400px を割らない", () => {
    for (const workspace of [760, 900, 960, 1032, 1192, 1352, 1600]) {
      const widest = clampSettingsPreviewWidth(99_999, workspace);
      const formLeft = workspace - widest - SETTINGS_PREVIEW_HANDLE_WIDTH;
      expect(formLeft).toBeGreaterThanOrEqual(SETTINGS_FORM_MIN_WIDTH);
    }
  });

  test("U1: 範囲外・NaN・null・負値を渡しても最小〜最大に収まる", () => {
    const workspace = 1192;
    const { min, max } = settingsPreviewWidthBounds(workspace);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -500, 0, 5_000]) {
      const width = clampSettingsPreviewWidth(value, workspace);
      expect(width).toBeGreaterThanOrEqual(min);
      expect(width).toBeLessThanOrEqual(max);
    }
    for (const ratio of [null, undefined, Number.NaN, -0.5, 0, 4]) {
      const width = settingsPreviewWidthFromRatio(ratio, workspace);
      expect(width).toBeGreaterThanOrEqual(min);
      expect(width).toBeLessThanOrEqual(max);
    }
  });

  test("狭すぎる Workspace でも幅は正の値で、編集不能にならない", () => {
    for (const workspace of [0, 320, 500]) {
      const width = settingsPreviewWidthFromRatio(null, workspace);
      expect(Number.isFinite(width)).toBe(true);
      expect(width).toBeGreaterThan(0);
    }
  });

  test("最小幅は 320px。これを下回るとツールバーが折り返す(P5)", () => {
    expect(settingsPreviewWidthBounds(1192).min).toBe(
      SETTINGS_PREVIEW_MIN_WIDTH,
    );
    expect(clampSettingsPreviewWidth(10, 1192)).toBe(
      SETTINGS_PREVIEW_MIN_WIDTH,
    );
  });

  test("U2: 比率↔px の変換が往復で一致する", () => {
    const workspace = 1192;
    for (const width of [320, 400, 480, 520, 640]) {
      const ratio = settingsPreviewRatioFromWidth(width, workspace);
      expect(settingsPreviewWidthFromRatio(ratio, workspace)).toBe(width);
      // もう一往復しても動かない。
      const again = settingsPreviewRatioFromWidth(
        settingsPreviewWidthFromRatio(ratio, workspace),
        workspace,
      );
      expect(settingsPreviewWidthFromRatio(again, workspace)).toBe(width);
    }
  });

  test("別の画面幅で保存された比率は、開いた側の範囲へ補正される", () => {
    // 1600px の Workspace で 55% まで広げた比率を 960px の Workspace で開く。
    const ratio = settingsPreviewRatioFromWidth(880, 1600);
    const width = settingsPreviewWidthFromRatio(ratio, 960);
    expect(width).toBeLessThanOrEqual(settingsPreviewWidthBounds(960).max);
    expect(960 - width - SETTINGS_PREVIEW_HANDLE_WIDTH).toBeGreaterThanOrEqual(
      SETTINGS_FORM_MIN_WIDTH,
    );
  });

  test("workspace が 0 のとき比率は保存しない", () => {
    expect(settingsPreviewRatioFromWidth(480, 0)).toBeNull();
    expect(settingsPreviewRatioFromWidth(Number.NaN, 1192)).toBeNull();
  });
});

describe("buildPublicSiteHref", () => {
  test("通常は保存済みの公開サイトのトップを指す", () => {
    expect(buildPublicSiteHref()).toBe("/");
    expect(buildPublicSiteHref(null)).toBe("/");
    expect(buildPublicSiteHref("")).toBe("/");
  });

  test("デモモードでは demo seed をクエリへ付ける", () => {
    expect(buildPublicSiteHref("abc")).toBe("/?admin-demo-preview=abc");
    expect(buildPublicSiteHref("a b&c")).toBe(
      "/?admin-demo-preview=a%20b%26c",
    );
  });
});
