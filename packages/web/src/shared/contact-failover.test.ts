import { test, expect, describe } from "bun:test";
import { buildFailoverMailto } from "./contact-failover";

/** FormData の代わりに使う最小の入れ物。 */
function fields(map: Record<string, string>) {
  return { get: (k: string) => map[k] ?? null };
}

describe("送信失敗時のメールへの逃げ道", () => {
  test("メール未設定のサイトでは何も出さない", () => {
    // 購入者のまっさらな状態。押せない案内を出さない。
    expect(buildFailoverMailto("", fields({ message: "こんにちは" }))).toBe("");
  });

  test("書いた本文と件名を持っていける", () => {
    const href = buildFailoverMailto(
      "hello@example.com",
      fields({ subject: "撮影の相談", name: "江口", message: "はじめまして" }),
    );
    expect(href.startsWith("mailto:hello@example.com?")).toBe(true);
    expect(href).toContain(`subject=${encodeURIComponent("撮影の相談")}`);
    expect(decodeURIComponent(href)).toContain("はじめまして");
    // 署名として名前を添える。
    expect(decodeURIComponent(href)).toContain("— 江口");
  });

  test("改行は CRLF で符号化する（メールクライアント側で潰れないように）", () => {
    const href = buildFailoverMailto(
      "hello@example.com",
      fields({ name: "江口", message: "一行目\n二行目" }),
    );
    expect(href).toContain("%0D%0A");
    // 裸の LF が1つも残っていないこと。
    expect(href).not.toMatch(/(?<!%0D)%0A/);
  });

  test("空白が + にならない", () => {
    // mailto の本文では `+` を空白へ戻さないメールクライアントがある。
    const href = buildFailoverMailto(
      "hello@example.com",
      fields({ subject: "photo shoot", message: "hello there" }),
    );
    expect(href).not.toContain("+");
    expect(href).toContain("%20");
  });

  test("件名も本文も空なら、宛先だけの mailto にする", () => {
    expect(buildFailoverMailto("hello@example.com", fields({}))).toBe(
      "mailto:hello@example.com",
    );
  });
});
