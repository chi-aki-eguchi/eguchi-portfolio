import { test, expect, describe } from "bun:test";
import {
  isValidSiteUrlSetting,
  normalizeSiteUrlSetting,
} from "./site-url-setting";

describe("公開サイトの基準URL", () => {
  test("空欄は許す（未設定は誤りではない）", () => {
    // 配布直後がこれ。サーバーはリクエストのホストから組み立てる道を持つ。
    for (const v of ["", "   ", undefined, null]) {
      expect(isValidSiteUrlSetting(v)).toBe(true);
      expect(normalizeSiteUrlSetting(v)).toBe("");
    }
  });

  test("前後の空白と末尾スラッシュを落とす", () => {
    // 末尾が残ると、組み立てた先が https://example.com//gallery になる。
    expect(normalizeSiteUrlSetting("  https://example.com/  ")).toBe(
      "https://example.com",
    );
    expect(normalizeSiteUrlSetting("https://example.com///")).toBe(
      "https://example.com",
    );
  });

  test("普通のURLは通す", () => {
    for (const v of [
      "https://akieguchi.com",
      "https://www.akieguchi.com",
      "http://example.co.jp",
      "https://example.com/",
    ])
      expect(isValidSiteUrlSetting(v), v).toBe(true);
  });

  test("組み立てが壊れる形は止める", () => {
    const bad = [
      "akieguchi.com", // scheme が無い
      "/gallery", // 相対
      "ftp://example.com", // http(s) 以外
      "https://", // ホスト名が無い
      "https://localhost", // 点が無い＝打ち間違いか開発用
      "https://user:pass@example.com", // 認証情報入り
      "https://example.com#top", // fragment
      "https://example.com?utm=1", // クエリ
      "ただの文字",
    ];
    for (const v of bad) expect(isValidSiteUrlSetting(v), v).toBe(false);
  });
});
