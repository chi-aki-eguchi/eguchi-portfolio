/**
 * Contact の既定文が、買った人のサイトで「自分で決めていない約束」に
 * ならないことの回帰テスト。
 *
 * **akieguchi.com の表示は1文字も変えない**ことも同時に縛る。触っていない設定欄は
 * DBに値が無いので、既定を変えると本番の表示がそのまま変わる。
 */
import { test, expect, describe } from "bun:test";
import { contactDefaultsFor } from "./contact-defaults";

const OWNER = "https://akieguchi.com";
const BUYER = "https://someone-else.example";

describe("Contact の既定文", () => {
  test("持ち主のサイトでは、これまでの文言のまま", () => {
    const d = contactDefaultsFor(OWNER);
    expect(d.contactNote).toContain("通常2〜3日以内にお返事しています");
    expect(d.contactFlow).toContain("1〜2週間でデータ納品");
    expect(d.contactSentMessage).toContain("2〜3日以内にお返事します");
    expect(d.contactSubjectOptions).toContain("テンプレートについて");
  });

  test("www 付きでも、持ち主のサイトとして扱う", () => {
    expect(contactDefaultsFor("https://www.akieguchi.com").contactNote).toBe(
      contactDefaultsFor(OWNER).contactNote,
    );
  });

  test("買った人のサイトには、約束の数字を出さない", () => {
    const d = contactDefaultsFor(BUYER);
    for (const text of [d.contactNote, d.contactFlow, d.contactSentMessage]) {
      expect(text).not.toMatch(/\d+\s*[〜~]\s*\d+\s*(日|週間)/);
    }
    // 温度は残す。事務的な文に置き換えない。
    expect(d.contactNote).toContain("歓迎");
    expect(d.contactFlow).toContain("データ納品");
  });

  test("買った人のサイトの件名から、テンプレート計測用の項目を外す", () => {
    const d = contactDefaultsFor(BUYER);
    expect(d.contactSubjectOptions).not.toContain("テンプレートについて");
    // 空にはしない（空にすると選択肢が消えて画面が壊れる）。
    expect(d.contactSubjectOptions.split(",").length).toBeGreaterThan(2);
  });

  test("送信完了文と件名は、どちらのサイトでも空にしない", () => {
    for (const site of [OWNER, BUYER, undefined]) {
      const d = contactDefaultsFor(site);
      expect(d.contactSentMessage.length).toBeGreaterThan(0);
      expect(d.contactSubjectOptions.length).toBeGreaterThan(0);
    }
  });

  test("サイトURL未設定なら、買った人側として扱う", () => {
    // 設定前の配布直後がこれ。安全側（約束をしない側）へ倒す。
    expect(contactDefaultsFor(undefined)).toEqual(contactDefaultsFor(BUYER));
    expect(contactDefaultsFor("")).toEqual(contactDefaultsFor(BUYER));
  });
});
