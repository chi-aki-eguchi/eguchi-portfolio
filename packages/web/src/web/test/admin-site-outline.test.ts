import { describe, expect, test } from "bun:test";
import {
  DEVELOP_SECTIONS_EDITED_ELSEWHERE,
  DEVELOP_UNUSED_KEYS,
  DEVELOP_UNUSED_SECTIONS,
  SETTING_KEY_WORDS,
  SETTINGS_SECTION_KEYS,
  SITE_LOOK_PARTS,
  SITE_MORE_PARTS,
  SITE_PAGES,
  SITE_PARTS,
  pagesHref,
  partHome,
  searchSite,
  sectionsForPart,
  siteOutline,
  siteStructureFrom,
  type SiteOutlineContext,
  type SitePart,
} from "../pages/admin-settings-navigation";
import { developDoorCopy } from "../../shared/develop-structure";

// 「サイト」の並び（2026-11-12、spec admin-redesign-20261112 §2.1・§2.4）。
// 新しい構成のサイトでは、並びが公開サイトのページそのものになっていることを固定する。

const develop: SiteOutlineContext = { structure: "develop", showService: true, exhibition: true, tokyo: true };
const classic: SiteOutlineContext = { structure: "classic", showService: true };
const part = (id: string) => (SITE_PARTS as Record<string, SitePart>)[id]!;
const listedParts = (ctx: SiteOutlineContext) => {
  const outline = siteOutline(ctx);
  return [...outline.pages.flatMap((p) => p.parts), ...outline.groups.flatMap((g) => [...g.parts, ...g.advanced])];
};
/** 部分が「その場で」出す節（写真を選ぶ行・同じ設定を指す行は節を持たない）。 */
const homeSections = (id: string, ctx: SiteOutlineContext) =>
  part(id).ref || part(id).pagesTab || part(id).view ? [] : sectionsForPart(part(id), "classic", ctx.structure);

describe("サイトの並び — 新しい構成", () => {
  test("構成は siteDesign から決まる", () => {
    expect(siteStructureFrom("develop")).toBe("develop");
    expect(siteStructureFrom("classic")).toBe("classic");
    expect(siteStructureFrom(undefined)).toBe("classic");
    expect(siteStructureFrom("book")).toBe("classic");
  });

  test("ページは公開サイトと同じ名前・順・住所", () => {
    const outline = siteOutline(develop);
    expect(outline.pages.map((p) => [p.id, p.ja, p.path])).toEqual([
      ["top", "トップ", "/"],
      ["portrait", "Portrait", "/portrait"],
      ["works", "Works", "/works"],
      ["info", "Info", "/info"],
      ["exhibition", "展示", "/exhibition"],
      ["tokyo", "東京プラン", "/tokyo/ja"],
      ["card", "名刺のQR", "/card.html"],
    ]);
    expect(outline.groups.map((g) => g.ja)).toEqual(["共通", "見た目", "そのほか"]);
    // 新しい構成は「詳しい設定」にしまわない（探さないと見つからない画面を作らない）。
    expect(outline.groups.flatMap((g) => g.advanced)).toEqual([]);
  });

  test("展示は展示があり得るサイト、東京プランは持ち主のサイトだけ", () => {
    const ids = siteOutline({ ...develop, exhibition: false, tokyo: false }).pages.map((p) => p.id);
    expect(ids).toEqual(["top", "portrait", "works", "info", "card"]);
  });

  test("扉の名前を変えたら、Portrait・Info・Life の名前も変わる", () => {
    const doors = developDoorCopy(JSON.stringify({ portrait: ["人", ""], info: ["案内", ""], life: ["日々", ""] }));
    const outline = siteOutline({ ...develop, doors });
    expect(outline.pages.find((p) => p.id === "portrait")?.ja).toBe("人");
    expect(outline.pages.find((p) => p.id === "info")?.ja).toBe("案内");
  });

  test("トップの部分は、トップの形 → 入口の写真 → 名前 → 撮影のご依頼 → 扉の名前", () => {
    expect(siteOutline(develop).pages[0]!.parts).toEqual(["top-style", "cover-photos", "name", "cta", "doors"]);
    expect(homeSections("top-style", develop)).toEqual(["home"]);
    expect(SETTINGS_SECTION_KEYS.home).toContain("developTopStyle");
  });

  test("並べた部分は、どれも節・写真を選ぶ画面・ほかの編集画面・同じ設定を指す行のどれか", () => {
    for (const id of listedParts(develop)) {
      const p = part(id);
      const kinds = [
        homeSections(id, develop).length > 0,
        Boolean(p.pagesTab),
        Boolean(p.tab),
        Boolean(p.view),
        Boolean(p.ref),
      ].filter(Boolean);
      expect(kinds.length, `${id} はちょうど1種類`).toBe(1);
      for (const sid of homeSections(id, develop)) expect(sid in SETTINGS_SECTION_KEYS, `${id} の節 ${sid}`).toBe(true);
      if (p.ref) expect(listedParts(develop), `${id} の指す先 ${p.ref} も並んでいる`).toContain(p.ref as never);
    }
  });

  test("使わない節は並べず、使う節はちょうど1か所に置く", () => {
    const owners = new Map<string, string[]>();
    for (const id of listedParts(develop)) {
      for (const sid of homeSections(id, develop)) owners.set(sid, [...(owners.get(sid) ?? []), id]);
    }
    for (const sid of DEVELOP_UNUSED_SECTIONS) expect(owners.get(sid), `${sid} は使わない`).toBeUndefined();
    for (const sid of DEVELOP_SECTIONS_EDITED_ELSEWHERE) expect(owners.get(sid), `${sid} はページの写真で直す`).toBeUndefined();
    for (const sid of Object.keys(SETTINGS_SECTION_KEYS)) {
      if (DEVELOP_UNUSED_SECTIONS.includes(sid) || DEVELOP_SECTIONS_EDITED_ELSEWHERE.includes(sid)) continue;
      expect(owners.get(sid) ?? [], `${sid} の置き場所`).toHaveLength(1);
    }
  });

  test("使わない節は、中のキーが全部「効かない」と実測された物", () => {
    for (const sid of DEVELOP_UNUSED_SECTIONS) {
      for (const key of (SETTINGS_SECTION_KEYS as Record<string, readonly string[]>)[sid]!) {
        expect(DEVELOP_UNUSED_KEYS.has(key), `${sid}.${key}`).toBe(true);
      }
    }
    // 効かないキーは、どれも台帳にある（打ち間違いで隠れない欄を作らない）。
    const all = new Set(Object.values(SETTINGS_SECTION_KEYS as Record<string, readonly string[]>).flat());
    for (const key of DEVELOP_UNUSED_KEYS) expect(all.has(key), key).toBe(true);
    expect(DEVELOP_UNUSED_KEYS.size).toBe(43);
  });

  test("ページの写真で直す設定は、どれも写真を選ぶ行から行ける（構成の切り替えを除く）", () => {
    const viaLinks = new Set(listedParts(develop).flatMap((id) => part(id).keys ?? []));
    for (const key of SETTINGS_SECTION_KEYS["page-layout"]) {
      if (key === "siteDesign") continue;
      expect(viaLinks.has(key), key).toBe(true);
    }
  });

  test("表紙の写真の場所は1つ、SNS の住所の欄は1つ", () => {
    const listed = listedParts(develop);
    expect(listed.filter((id) => part(id).pagesTab === "cover")).toEqual(["cover-photos"]);
    expect(listed).not.toContain("hero-photos");
    expect(listed).not.toContain("top-photos");
    const snsOwners = listed.filter((id) => homeSections(id, develop).some((sid) =>
      (SETTINGS_SECTION_KEYS as Record<string, readonly string[]>)[sid]!.includes("profileInstagram")));
    expect(snsOwners).toEqual(["about"]);
    expect(partHome(siteOutline(develop), "about")).toEqual({ page: "info" });
  });

  test("一覧から構成を切り替えられない（サイトの構成の節は並べない）", () => {
    for (const id of listedParts(develop)) expect(homeSections(id, develop)).not.toContain("page-layout");
  });

  test("写真を選ぶ行は /admin/pages の該当のタブへ、戻る先は来た場所", () => {
    const href = pagesHref(part("portrait-photos"), "/admin#site/page/portrait");
    const url = new URL(href, "https://example.test");
    expect(url.pathname).toBe("/admin/pages");
    expect(url.searchParams.get("tab")).toBe("portrait");
    expect(url.searchParams.get("from")).toBe("/admin#site/page/portrait");
    expect(new URL(pagesHref(part("doors"), "/admin#site/page/top"), "https://example.test").searchParams.get("focus")).toBe("doors");
  });
});

describe("サイトの並び — 今までの構成は変えない", () => {
  test("ページと部分は 2026-09-30 の形のまま", () => {
    const outline = siteOutline(classic);
    expect(outline.pages.map((p) => [p.id, p.ja, p.path, p.parts])).toEqual(
      SITE_PAGES.map((p) => [p.id, p.ja, p.path, p.parts]),
    );
    expect(outline.groups.map((g) => [g.id, g.ja, [...g.parts, ...g.advanced].sort()])).toEqual([
      ["look", "全体の見た目", SITE_LOOK_PARTS.filter((id) => id !== "structure").slice().sort()],
      ["more", "そのほか", SITE_MORE_PARTS.slice().sort()],
    ]);
    // 新しい構成だけの部分は出さない。
    expect(listedParts(classic).filter((id) => part(id).structure === "develop")).toEqual([]);
  });

  test("制作案内を出さないサイトでは、制作案内の部分を出さない", () => {
    expect(listedParts({ ...classic, showService: false })).not.toContain("service");
    expect(listedParts({ ...develop, showService: false })).not.toContain("service");
  });
});

describe("探す — 欄の名前でも当たる", () => {
  test("節の台帳のどのキーにも、日本語と英語の欄の名前がある", () => {
    for (const [sid, keys] of Object.entries(SETTINGS_SECTION_KEYS as Record<string, readonly string[]>)) {
      for (const key of keys) {
        const words = SETTING_KEY_WORDS[key];
        expect(words, `${sid}.${key} に名前が無い`).toBeDefined();
        expect(words![0].trim().length > 0 && words![1].trim().length > 0, `${sid}.${key}`).toBe(true);
      }
    }
    const known = new Set(Object.values(SETTINGS_SECTION_KEYS as Record<string, readonly string[]>).flat());
    expect(Object.keys(SETTING_KEY_WORDS).filter((key) => !known.has(key))).toEqual([]);
  });

  const top = (query: string, ctx: SiteOutlineContext) => searchSite(query, siteOutline(ctx), ctx, "ja");

  test("Instagram・ロゴ・メール・料金・フォント・QR で、欄のある画面が出る（新しい構成）", () => {
    const targets = (q: string) => top(q, develop).map((row) => row.target);
    expect(targets("Instagram")[0]).toBe("about");
    expect(targets("instagram")).toContain("footer"); // 表示名の欄（住所とは別のキー）
    expect(targets("ロゴ")).toEqual(expect.arrayContaining(["name", "menu"]));
    expect(targets("メール")).toEqual(expect.arrayContaining(["contact-info", "contact-words"]));
    expect(targets("料金")).toEqual(expect.arrayContaining(["pricing", "cta"]));
    expect(targets("フォント")[0]).toBe("fonts");
    expect(targets("QR")).toEqual(expect.arrayContaining(["card", "card-profile"]));
    // 名前・一言で当たった画面が先（Enter で開くのは先頭）。
    expect(targets("QR")[0]).toBe("card");
    expect(targets("料金")[0]).toBe("pricing");
    expect(top("Instagram", develop)[0]!.field).toBe("Instagram の住所");
  });

  test("英語でも当たる", () => {
    const targets = (q: string) => top(q, develop).map((row) => row.target);
    expect(targets("typeface")[0]).toBe("fonts");
    expect(targets("email")).toContain("contact-info");
    expect(targets("logo")).toContain("name");
  });

  test("今の構成で使わない節は「使いません」の印付きで出る", () => {
    const rows = top("スクロール演出", develop);
    expect(rows).toEqual([{ target: "section:hero", field: "スクロール演出", unused: true }]);
    // 構成の切り替えの節は、探しても出さない。
    expect(top("サイトの構成", develop).map((row) => row.target)).not.toContain("section:page-layout");
  });

  test("今までの構成でも欄の名前で当たる", () => {
    const targets = (q: string) => top(q, classic).map((row) => row.target);
    expect(targets("Instagram")).toContain("about");
    expect(targets("ロゴ")).toContain("name");
    expect(targets("QR")).toContain("about");
    expect(top("スクロール演出", classic)[0]!.unused).toBeUndefined();
  });
});
