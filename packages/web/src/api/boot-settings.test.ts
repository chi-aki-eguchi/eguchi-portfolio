import { describe, expect, test } from "bun:test";
import { bootSettingsScript } from "./boot-settings";

describe("bootSettingsScript", () => {
  test("設定の文に </script> があっても閉じさせず、JSON として同じ値に戻る", () => {
    const settings = { profileBio: '写真家。</script><script>alert(1)</script><!-- x', siteName: "江口秋" };
    const tag = bootSettingsScript(JSON.stringify(settings));
    expect(tag.startsWith('<script id="boot-settings" type="application/json">')).toBe(true);
    // 閉じタグは最後の1つだけ
    expect(tag.match(/<\/script>/g)).toHaveLength(1);
    expect(tag).not.toContain("<!--");
    const inner = tag.slice(tag.indexOf(">") + 1, tag.lastIndexOf("</script>"));
    expect(JSON.parse(inner)).toEqual(settings);
  });
});
