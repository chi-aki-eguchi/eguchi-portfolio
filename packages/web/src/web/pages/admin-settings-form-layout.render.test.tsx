import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AdminSettingsFormLayout,
  type AdminSettingsFormCopy,
} from "./admin-settings-form-layout";

const copy: AdminSettingsFormCopy = {
  navigationLabel: "設定の節一覧",
  currentSection: "現在地",
  switchSection: "切り替え",
  closeSectionList: "節一覧を閉じる",
  changed: "変更あり",
  failed: "保存できず",
  noChanges: "未保存の変更はありません",
  unsavedCount: (count) => `未保存の変更 ${count}件`,
  changedSections: (labels) => `変更した節: ${labels}`,
  saving: "保存中...",
  save: "保存",
  discard: "破棄",
  saveFailed: "保存に失敗しました",
  goToFailed: "原因の節へ移動",
  savedAt: (time) => `${time} に保存`,
};

const sections = [
  {
    id: "basics",
    label: "基本",
    summary: "サイト名",
    changed: true,
    failed: false,
  },
  {
    id: "appearance",
    label: "見た目",
    summary: "淡い青",
    changed: true,
    failed: true,
  },
];

test("PC用の節目次は現在地・変更点・失敗点と保存操作を同じ列に置く", () => {
  const html = renderToStaticMarkup(
    <AdminSettingsFormLayout
      sections={sections}
      changedCount={3}
      pending={false}
      saveError
      lastSavedAt={null}
      onSave={() => {}}
      onDiscard={() => {}}
      copy={copy}
    >
      <div>本文</div>
    </AdminSettingsFormLayout>,
  );

  expect(html).toContain('aria-label="設定の節一覧"');
  expect(html).toContain('data-settings-section-link="basics"');
  expect(html).toContain('data-settings-section-changed="true"');
  expect(html).toContain('data-settings-section-failed="true"');
  expect(html).toContain("保存に失敗しました");
  expect(html).toContain("原因の節へ移動");
  expect(html).toContain('data-settings-save-panel="true"');
});

test("スマホ用の上部1行は現在節・警告点・節一覧の切り替えを持つ", () => {
  const html = renderToStaticMarkup(
    <AdminSettingsFormLayout
      sections={sections}
      changedCount={3}
      pending={false}
      saveError={false}
      lastSavedAt="17:45"
      onSave={() => {}}
      onDiscard={() => {}}
      copy={copy}
    >
      <div>本文</div>
    </AdminSettingsFormLayout>,
  );

  expect(html).toContain("admin-settings-mobile-current");
  expect(html).toContain("現在地");
  expect(html).toContain("基本");
  expect(html).toContain("切り替え");
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("未保存の変更 3件");
});
