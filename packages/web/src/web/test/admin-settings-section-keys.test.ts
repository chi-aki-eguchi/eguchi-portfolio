import { describe, expect, test } from "bun:test";
import { SETTINGS_PREVIEW_KEYS } from "../../shared/settings-keys";
import { SETTINGS_SECTION_KEYS } from "../pages/admin-tabs";

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
});
