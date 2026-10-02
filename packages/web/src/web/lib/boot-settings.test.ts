import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { setupDom } from "../test/jsdom-setup";

setupDom();
const { readBootSettings, seedBootSettings } = await import("./boot-settings");

function withBoot(text: string | null) {
  document.getElementById("boot-settings")?.remove();
  if (text == null) return;
  const el = document.createElement("script");
  el.id = "boot-settings";
  el.type = "application/json";
  el.textContent = text;
  document.head.appendChild(el);
}

describe("HTML に入った設定", () => {
  test("取り寄せずに設定の置き場へ入れる（< を戻した文もそのまま）", () => {
    withBoot('{"siteName":"江口秋","profileBio":"\\u003c/script> と書いた自己紹介"}');
    const qc = new QueryClient();
    expect(seedBootSettings(qc)).toBe(true);
    expect(qc.getQueryData<Record<string, string>>(["settings"])).toEqual({ siteName: "江口秋", profileBio: "</script> と書いた自己紹介" });
    expect(qc.getQueryState(["settings"])?.status).toBe("success");
  });
  test("無い・壊れている・形が違うときは使わない（今までどおり取り寄せる）", () => {
    for (const text of [null, "", "{", "[1,2]", "null"]) {
      withBoot(text);
      expect(readBootSettings()).toBeNull();
      expect(seedBootSettings(new QueryClient())).toBe(false);
    }
  });
});
