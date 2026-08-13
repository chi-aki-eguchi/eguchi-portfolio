import { describe, expect, test } from "bun:test";
import {
  hasUsableContactChannel,
  invalidContactSettingKeys,
  isUsableContactEmail,
  isUsableContactEndpoint,
  isValidContactEmailSetting,
  isValidContactEndpointSetting,
  normalizeContactSettingsPayload,
  usableContactEmail,
  usableContactEndpoint,
} from "./contact-settings";

describe("contact settings", () => {
  test("メールは空欄または一般的なメール形式だけを設定値として許可する", () => {
    for (const value of ["", "   ", " hello@example.test "]) {
      expect(isValidContactEmailSetting(value)).toBe(true);
    }
    expect(isUsableContactEmail(" hello@example.test ")).toBe(true);
    for (const value of [
      "not-a-url",
      "hello@",
      "hello example.test",
      ".hello@example.test",
      "hello..there@example.test",
      "hello@example.test?subject=not-an-address",
    ]) {
      expect(isValidContactEmailSetting(value)).toBe(false);
      expect(isUsableContactEmail(value)).toBe(false);
    }
  });

  test("送信先は空欄または資格情報・fragmentなしのHTTPS URLだけを許可する", () => {
    for (const value of [
      "",
      "   ",
      " https://formspree.io/f/example ",
      "https://compatible.example.test/forms/contact?source=site",
    ]) {
      expect(isValidContactEndpointSetting(value)).toBe(true);
    }
    expect(isUsableContactEndpoint("https://compatible.example.test/forms/contact")).toBe(
      true,
    );

    for (const value of [
      "not-a-url",
      "/contact",
      "http://formspree.io/f/example",
      "https://user:pass@example.test/form",
      "https://example.test/form#confirmation",
    ]) {
      expect(isValidContactEndpointSetting(value)).toBe(false);
      expect(isUsableContactEndpoint(value)).toBe(false);
    }
  });

  test("公開側へ渡す値はtrimし、不正な旧値は空に倒す", () => {
    expect(usableContactEmail(" hello@example.test ")).toBe("hello@example.test");
    expect(usableContactEmail("not-a-url")).toBe("");
    expect(usableContactEndpoint(" https://compatible.example.test/form ")).toBe(
      "https://compatible.example.test/form",
    );
    expect(usableContactEndpoint("http://compatible.example.test/form")).toBe("");
    expect(hasUsableContactChannel("not-a-url", "http://example.test/form")).toBe(
      false,
    );
    expect(hasUsableContactChannel("", "https://compatible.example.test/form")).toBe(
      true,
    );
  });

  test("APIが受け取った連絡先キーだけを検査・正規化する", () => {
    expect(
      invalidContactSettingKeys({
        contactEmail: "not-a-url",
        formspreeUrl: "http://example.test/form",
      }),
    ).toEqual(["contactEmail", "formspreeUrl"]);
    expect(invalidContactSettingKeys({ siteName: "Only this changes" })).toEqual([]);
    expect(
      normalizeContactSettingsPayload({
        contactEmail: " hello@example.test ",
        formspreeUrl: " https://compatible.example.test/form ",
        siteName: "Untouched",
      }),
    ).toEqual({
      contactEmail: "hello@example.test",
      formspreeUrl: "https://compatible.example.test/form",
      siteName: "Untouched",
    });
  });
});
