/**
 * 作風プリセットの台帳検査。
 *
 * プリセットは「既存の設定値をまとめて入れ替えるだけ」で成り立っている。
 * 存在しないキーや、その設定に無い値を書くと、保存は成功したように見えて
 * 実際には無視される（API は許可リスト外を ignoredKeys で黙って落とす）。
 * 画面では気づけないので、ここで機械的に縛る。
 */
import { describe, expect, test } from "bun:test";
import { SETTINGS_PREVIEW_KEYS } from "../../shared/settings-keys";
import {
  SITE_MOODS,
  SITE_MOOD_IDS,
  SITE_MOOD_KEYS,
} from "../../shared/site-moods";
import { KNOWN_LAYOUTS } from "../components/PhotoGallery";

// 各キーが取りうる値。API の default 行のコメントと実装に合わせる。
const ALLOWED: Record<string, readonly string[]> = {
  heroMode: ["carousel", "single", "quiet-grid", "editorial", "immersive"],
  heroDisplayMode: ["normal", "fullscreen"],
  heroTitlePosition: [
    "center",
    "bottom-left",
    "bottom-right",
    "top-left",
    "top-right",
  ],
  heroOverlay: ["on", "off"],
  navPosition: ["top", "left", "bottom"],
  navHoverEffect: ["fade", "underline", "dot", "blur"],
  headerBackground: ["solid", "fade", "none"],
  bgTexture: [
    "none",
    "grain-fine",
    "grain-coarse",
    "paper",
    "marble",
    "mist",
  ],
  photoRevealEffect: ["fade", "none", "rise", "scale"],
  profileLayout: ["side", "stack", "quiet"],
  contactLayout: ["center", "left", "split"],
  seriesCardStyle: ["caption", "overlay", "wide"],
  footerLayout: ["center", "left", "split"],
  pageTitleStyle: ["label", "left", "display", "hidden"],
  viewerStyle: ["wall", "cinema", "paper"],
};
const LAYOUT_KEYS = ["galleryLayout", "seriesLayout", "topWorksLayout"];

describe("作風プリセット", () => {
  test("触るキーはすべて settings の許可台帳にある", () => {
    const allowed = new Set<string>(SETTINGS_PREVIEW_KEYS);
    for (const key of SITE_MOOD_KEYS)
      expect(allowed.has(key), `${key} は台帳に無い`).toBe(true);
  });

  test("値はすべて、その設定に実在する選択肢", () => {
    const layouts = new Set<string>(KNOWN_LAYOUTS);
    for (const id of SITE_MOOD_IDS) {
      for (const [key, value] of Object.entries(SITE_MOODS[id])) {
        if (LAYOUT_KEYS.includes(key)) {
          expect(layouts.has(value), `${id}.${key} の ${value} は12種に無い`).toBe(
            true,
          );
          continue;
        }
        expect(ALLOWED[key], `${key} の選択肢が検査表に無い`).toBeDefined();
        expect(
          ALLOWED[key].includes(value),
          `${id}.${key} の ${value} は選択肢に無い`,
        ).toBe(true);
      }
    }
  });

  test("どの作風も同じキーの組を埋める（選ぶ順で結果が変わらない）", () => {
    // 片方にしか無いキーがあると、A→B と B→A で最終状態が変わる。
    const keys = new Set(SITE_MOOD_KEYS);
    for (const id of SITE_MOOD_IDS) {
      const own = new Set(Object.keys(SITE_MOODS[id]));
      expect([...keys].filter((k) => !own.has(k)), `${id} に足りないキー`).toEqual(
        [],
      );
    }
  });

  test("作風どうしは実際に違う（同じ見た目の重複を置かない）", () => {
    const seen = new Map<string, string>();
    for (const id of SITE_MOOD_IDS) {
      const sig = JSON.stringify(
        Object.entries(SITE_MOODS[id]).sort(([a], [b]) => a.localeCompare(b)),
      );
      expect(seen.has(sig), `${id} は ${seen.get(sig)} と中身が同じ`).toBe(false);
      seen.set(sig, id);
    }
  });

  test("色と書体は触らない（選び直した配色を壊さない）", () => {
    const forbidden = SITE_MOOD_KEYS.filter((k) =>
      /^(theme|font|customFont|accentColor|body(Size|Weight)|heading)/.test(k),
    );
    expect(forbidden, "作風が色・書体を書き換えている").toEqual([]);
  });
});
