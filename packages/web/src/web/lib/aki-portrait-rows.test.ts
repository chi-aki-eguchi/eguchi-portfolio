import { describe, expect, test } from "bun:test";
import { planRows, showcaseOptionsFor } from "./photo-rows";
import { akiPortraitOptions } from "./aki-portrait-rows";

// 2026-11-19 の Portrait の16枚（4:5 と 5:4）。
const V = 0.8;
const L = 1.25;
const photos = [V, L, L, L, V, V, V, L, V, V, L, L, V, V, V, V];
/** 個人サイトの紙の余白（aki-edition.css の --aki-inset）。 */
const inset = (page: number) => Math.min(64, Math.max(20, 0.052 * page));
/** 共通の頁が並べる幅（余白をそろえる前）。 */
const shared = (page: number) => (page >= 768 ? page - 48 : page);
const shape = (plan: ReturnType<typeof planRows>) => plan.rows.map((row) => row.items.length).join("");

describe("江口秋の個人サイトの Portrait の段", () => {
  test("768×1024：余白をそろえても、先頭から2枚・1枚・1枚・2枚…の段のまま（全部1枚の段にしない）", () => {
    const width = 768 - 2 * inset(768);
    const plan = planRows(photos, akiPortraitOptions(width, 1024, 0.6, 768));
    expect(shape(plan)).toBe("2112221122");
    // 余白をそろえる前（4851px）より長くしない。
    expect(plan.height).toBeLessThan(planRows(photos, showcaseOptionsFor(720, 1024, 0.6)).height);
  });

  test("タブレットからPCまで：何枚ずつ並ぶかは共通の頁と同じ。どの段も幅いっぱいで、頁は長くならない", () => {
    for (const [page, vh] of [[840, 1100], [1024, 768], [1024, 1366], [1180, 820], [1440, 900], [1536, 864], [1920, 1080]] as const) {
      const width = page - 2 * inset(page);
      const plan = planRows(photos, akiPortraitOptions(width, vh, 0.6, page));
      const before = planRows(photos, showcaseOptionsFor(shared(page), vh, 0.6));
      expect(shape(plan)).toBe(shape(before));
      expect(plan.height).toBeLessThanOrEqual(before.height);
      for (const row of plan.rows) {
        const last = row.items[row.items.length - 1]!;
        expect(row.items[0]!.x).toBe(0);
        expect(Math.abs(last.x + last.width - width)).toBeLessThan(1);
      }
    }
  });

  test("縦に長いタブレット（744×1133・768×1133・800×1280）でも、縦の写真を1枚で幅いっぱいにしない", () => {
    for (const [page, vh] of [[744, 1133], [768, 1133], [800, 1280]] as const) {
      const plan = planRows(photos, akiPortraitOptions(page - 2 * inset(page), vh, 0.6, page));
      expect(shape(plan)).toBe("2112221122");
    }
  });

  test("画面の幅 640〜713px（700×960・680×900 など）：紙の余白で幅が 640px を切っても、スマホの組みにしない", () => {
    for (const [page, vh] of [[700, 960], [680, 900], [640, 900], [713, 1000]] as const) {
      const width = page - 2 * inset(page);
      expect(width).toBeLessThan(640);
      const plan = planRows(photos, akiPortraitOptions(width, vh, 0.6, page));
      expect(shape(plan)).toBe("2112221122");
      // 共通の頁（端から端まで）より長くしない。
      expect(plan.height).toBeLessThanOrEqual(planRows(photos, showcaseOptionsFor(page, vh, 0.6)).height);
      for (const row of plan.rows) {
        const last = row.items[row.items.length - 1]!;
        expect(row.items[0]!.x).toBe(0);
        expect(Math.abs(last.x + last.width - width)).toBeLessThan(1);
      }
    }
  });

  test("スマホは共通の組みのまま", () => {
    for (const page of [320, 390, 430, 639]) {
      const width = page - 2 * inset(page);
      expect(akiPortraitOptions(width, 844, 0.6, page)).toEqual(showcaseOptionsFor(width, 844, 0.6));
    }
  });
});
