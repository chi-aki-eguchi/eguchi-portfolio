import { describe, expect, test } from "bun:test";
import {
  introLayout,
  isVerticalName,
  shouldPlayIntro,
  type IntroEnvironment,
} from "./develop-intro";

const env = (over: Partial<IntroEnvironment> = {}): IntroEnvironment => ({
  developTop: true,
  pathname: "/",
  search: "",
  seen: false,
  landedOnTop: true,
  reducedMotion: false,
  reveal: "fade",
  framed: false,
  scrolled: false,
  capable: true,
  ...over,
});

describe("shouldPlayIntro", () => {
  test("新しい構成のトップを最初に開いたときだけ流す", () => {
    expect(shouldPlayIntro(env())).toBe(true);
    expect(shouldPlayIntro(env({ seen: true }))).toBe(false);
    expect(shouldPlayIntro(env({ developTop: false }))).toBe(false);
    expect(shouldPlayIntro(env({ pathname: "/portrait" }))).toBe(false);
    // ほかのページから入ってきて、あとでトップへ移ったときは流さない（もうサイトの中にいる）。
    expect(shouldPlayIntro(env({ landedOnTop: false }))).toBe(false);
  });

  test("動きを減らす設定・写真の現れ方「なし」・埋め込み・途中の位置では流さない", () => {
    expect(shouldPlayIntro(env({ reducedMotion: true }))).toBe(false);
    expect(shouldPlayIntro(env({ reveal: "none" }))).toBe(false);
    expect(shouldPlayIntro(env({ framed: true }))).toBe(false);
    expect(shouldPlayIntro(env({ scrolled: true }))).toBe(false);
    expect(shouldPlayIntro(env({ capable: false }))).toBe(false);
  });

  test("住所に ?intro を付けると、もう一度流す。ただし止める条件は越えない", () => {
    expect(shouldPlayIntro(env({ seen: true, search: "?intro" }))).toBe(true);
    expect(shouldPlayIntro(env({ seen: true, search: "?design=develop&intro=1" }))).toBe(true);
    expect(shouldPlayIntro(env({ landedOnTop: false, search: "?intro" }))).toBe(true);
    expect(shouldPlayIntro(env({ seen: true, search: "?intro", reducedMotion: true }))).toBe(false);
    expect(shouldPlayIntro(env({ seen: true, search: "?intro", reveal: "none" }))).toBe(false);
  });
});

describe("isVerticalName", () => {
  test("漢字・かなの短い名前は縦、英字だけ・長い名前・空は横", () => {
    expect(isVerticalName("江口秋")).toBe(true);
    expect(isVerticalName("えぐち あき")).toBe(true);
    expect(isVerticalName("Aki Eguchi")).toBe(false);
    expect(isVerticalName("江口秋写真事務所アトリエ")).toBe(false);
    expect(isVerticalName("  ")).toBe(false);
  });
});

describe("introLayout", () => {
  test("スマホ：図版と縦の名前をひとまとまりで中央に置き、どちらも箱の中に収まる", () => {
    const stage = { w: 390, h: 608 };
    const layout = introLayout(stage, { x: 0, y: 0, ...stage }, true);
    const plateW = stage.w * layout.plate.scale;
    const plateH = stage.h * layout.plate.scale;
    const left = layout.plate.dx;
    const right = layout.name.left + layout.name.fontSize;
    // まとまりの左右の余りが同じ
    expect(Math.abs(left - (stage.w - right))).toBeLessThan(1);
    expect(layout.name.left).toBeGreaterThan(left + plateW);
    expect(right).toBeLessThanOrEqual(stage.w - 16);
    // 図版は縦の中央あたり、添え書きはそのすぐ下
    expect(layout.plate.dy).toBeGreaterThan(0);
    expect(layout.plate.dy + plateH).toBeLessThan(stage.h);
    expect(layout.caption.top).toBeGreaterThan(layout.plate.dy + plateH);
    expect(layout.caption.left).toBeCloseTo(left);
  });

  test("表紙の写真が箱いっぱいでないとき：図版は写真の箱を基準に縮めて、同じ場所へ運ぶ", () => {
    const stage = { w: 1200, h: 900 };
    const photo = { x: 40, y: 24, w: 1120, h: 630 };
    const layout = introLayout(stage, photo, true);
    // 変形の起点は写真の箱の左上。置いた先の左上は、まとまりを中央に置いた位置
    const left = photo.x + layout.plate.dx;
    const top = photo.y + layout.plate.dy;
    const plateW = photo.w * layout.plate.scale;
    const right = layout.name.left + layout.name.fontSize;
    expect(Math.abs(left - (stage.w - right))).toBeLessThan(1);
    expect(layout.name.left).toBeCloseTo(left + plateW + 32);
    expect(top).toBeGreaterThan(0);
  });

  test("英字の名前：図版の下に横で組み、添え書きはその下", () => {
    const stage = { w: 1200, h: 900 };
    const layout = introLayout(stage, { x: 0, y: 0, ...stage }, false);
    const plateH = stage.h * layout.plate.scale;
    expect(layout.vertical).toBe(false);
    expect(layout.name.left).toBeCloseTo(layout.plate.dx);
    expect(layout.name.top).toBeGreaterThan(layout.plate.dy + plateH);
    expect(layout.caption.top).toBeGreaterThan(layout.name.top + layout.name.fontSize);
  });
});
