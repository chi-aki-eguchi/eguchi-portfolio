import { describe, expect, test } from "bun:test";
import { SETTINGS_PREVIEW_KEYS } from "../../shared/settings-keys";
import {
  SETTINGS_SECTION_GROUPS,
  SETTINGS_SECTION_KEYS,
} from "../pages/admin-tabs";

// site_settings の許可台帳には、Settingsタブ以外が直接管理する値と
// 旧バージョン互換の値も含まれる。ここへ明示したもの以外は、
// Settingsの19節のどれか1つだけに所属しなければならない。
const KEYS_OUTSIDE_SETTINGS_TAB = {
  heroPhotoUrl: "Hero",
  profilePhotoUrl: "Profile",
  metaDescriptionHome: "legacy metadata",
  metaDescriptionGallery: "legacy metadata",
  metaDescriptionAbout: "legacy metadata",
  metaDescriptionSeries: "legacy metadata",
  metaDescriptionContact: "legacy metadata",
  profileName: "Profile",
  profileNameKata: "Profile",
  profileNameEn: "Profile",
  profileBio: "Profile",
  profileBioEn: "Profile",
  profileInstagram: "Profile",
  profileTwitter: "Profile",
  profileNote: "Profile",
  profileStatement: "Profile",
  profileStatementEn: "Profile",
  profileGear: "Profile",
  smartAlbums: "Library",
  servicePageConfig: "Service",
  setupCompleted: "Setup",
} as const;

describe("Settings section key registry", () => {
  test("Settingsの全設定キーは必ず1つの節に所属する", () => {
    const allowedKeys = new Set<string>(SETTINGS_PREVIEW_KEYS);
    const outsideKeys = new Set<string>(Object.keys(KEYS_OUTSIDE_SETTINGS_TAB));
    const owners = new Map<string, string[]>();

    for (const [sectionId, keys] of Object.entries(SETTINGS_SECTION_KEYS)) {
      for (const key of keys) {
        expect(allowedKeys.has(key), `${sectionId} の未知の設定キー: ${key}`).toBe(
          true,
        );
        owners.set(key, [...(owners.get(key) ?? []), sectionId]);
      }
    }

    for (const key of SETTINGS_PREVIEW_KEYS) {
      if (outsideKeys.has(key)) {
        expect(owners.get(key) ?? [], `${key} はSettings外の管理キー`).toEqual(
          [],
        );
      } else {
        expect(
          owners.get(key) ?? [],
          `${key} はSettingsの1節だけに所属する`,
        ).toHaveLength(1);
      }
    }
  });

  test("同じ設定キーの節への重複所属を拒否する", () => {
    const owners = new Map<string, string[]>();
    for (const [sectionId, keys] of Object.entries(SETTINGS_SECTION_KEYS)) {
      for (const key of keys) {
        owners.set(key, [...(owners.get(key) ?? []), sectionId]);
      }
    }

    expect(
      [...owners.entries()].filter(([, sectionIds]) => sectionIds.length > 1),
    ).toEqual([]);
  });

  // 単節表示では、現在の節を含まないグループの見出しを描かない。台帳から
  // 漏れた節はグループ見出しごと消えて到達できなくなるため、ここで固定する。
  // smoke 側（scripts/smoke/helpers.ts の SETTINGS_SECTION_COUNT）は目次の
  // リンク数をこの数で検査する。写しがずれると full smoke（10分）で4件まとめて
  // 落ちるので、ここで先に、速く気づけるようにする。
  // **節を足したら、この数と helpers.ts の両方を直す。**
  test("節の数は smoke の写し(SETTINGS_SECTION_COUNT)と一致する", () => {
    expect(
      Object.keys(SETTINGS_SECTION_KEYS).length,
      "節を増減したら scripts/smoke/helpers.ts の SETTINGS_SECTION_COUNT も直す",
    ).toBe(21);
  });

  test("グループ台帳は全節をちょうど1回ずつ含む", () => {
    const grouped: string[] = Object.values(SETTINGS_SECTION_GROUPS).flat();
    expect(new Set(grouped).size, "同じ節を2つのグループへ入れていない").toBe(
      grouped.length,
    );
    expect([...grouped].sort()).toEqual(
      Object.keys(SETTINGS_SECTION_KEYS).sort(),
    );
  });
});
