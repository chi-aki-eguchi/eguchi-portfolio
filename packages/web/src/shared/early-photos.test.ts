import { test, expect } from "bun:test";
import { EARLY_PHOTOS_GLOBAL, EARLY_PHOTOS_URL, earlyPhotosScript } from "./early-photos";

test("HTML の先頭に入れる取り寄せは、画面が読む名前と一覧の URL を使う", () => {
  const html = earlyPhotosScript();
  expect(html.startsWith("<script>")).toBe(true);
  expect(html.endsWith("</script>")).toBe(true);
  expect(html).toContain(`window.${EARLY_PHOTOS_GLOBAL}=fetch("${EARLY_PHOTOS_URL}")`);
  // 失敗しても画面がふだんどおり取り寄せられるよう、null に落とす（未処理の reject を残さない）。
  expect(html).toContain(".catch(function(){return null})");
  // 実行しない data 用の script ではないこと（type を付けると動かない）。
  expect(html).not.toContain("type=");
});
