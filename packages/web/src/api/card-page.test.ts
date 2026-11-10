import { describe, expect, test } from "bun:test";
import { cardLinks, renderCardPage } from "./card-page";

const base = {
  profileName: "江口秋",
  profileNameEn: "Aki Eguchi",
  profileInstagram: "https://www.instagram.com/example_user/",
  profileTwitter: "https://x.com/example_user",
};

describe("名刺の QR のページ", () => {
  test("Website・Instagram・X が並び、足した行き先は住所を入れてから並ぶ", () => {
    expect(cardLinks(base, "https://example.com").map((link) => link.label)).toEqual(["Website", "Instagram", "X"]);
    const withExtra = cardLinks({ ...base, cardExtraUrl: "https://still.example.com/" }, "https://example.com/");
    expect(withExtra.map((link) => [link.label, link.href])).toEqual([
      ["Website", "https://example.com/"],
      ["Instagram", "https://www.instagram.com/example_user/"],
      ["X", "https://x.com/example_user"],
      ["still,life", "https://still.example.com/"],
    ]);
  });

  test("住所の無い行き先・http(s) でない住所は出さない", () => {
    const links = cardLinks(
      { profileInstagram: "", profileTwitter: "javascript:alert(1)", cardExtraUrl: "not a url" },
      "https://example.com",
    );
    expect(links.map((link) => link.label)).toEqual(["Website"]);
  });

  test("名前と行き先の名前は、そのまま HTML に入れない", () => {
    const html = renderCardPage(
      { ...base, profileName: '<b>"x"</b>', cardExtraLabel: "<script>", cardExtraUrl: "https://a.example/?q=\"1\"" },
      "https://example.com",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('<b>"x"</b>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
  });

  test("かな・漢字の短い名前は縦に組む", () => {
    expect(renderCardPage(base, "https://example.com")).toContain('<h1 class="v">江口秋</h1>');
    expect(renderCardPage({ ...base, profileName: "Jane Doe" }, "https://example.com")).toContain("<h1>Jane Doe</h1>");
  });
});
