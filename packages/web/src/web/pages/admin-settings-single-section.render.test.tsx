/**
 * 目次で選んだ1節だけを本文へ出す仕組みの回帰テスト。
 * 左の目次と本文に同じ節名の一覧が二重に並ぶのをやめた構造
 * （オーナー確定 2026-07-30）を、現在地・強制表示の2経路で固定する。
 */
import { expect, test } from "bun:test";
import { setupDom, flush } from "../test/jsdom-setup";
import type { AdminSettingsFormCopy } from "./admin-settings-form-layout";

setupDom();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// 他のrender testが独自のjsdomをglobalへ入れる場合があるため、部品が実際に
// 使う `document`（globalThis側）へ組み立て、同じdocumentから読む。
const doc = () => globalThis.document;

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { AdminSettingsFormLayout, useAdminSettingsActiveSection } = await import(
  "./admin-settings-form-layout"
);

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
  basicSettings: "ふだんの設定",
  advancedSettings: "詳しい設定",
};

const sections = [
  {
    id: "basics",
    label: "基本",
    summary: "サイト名",
    changed: false,
    failed: false,
  },
  {
    id: "hero",
    label: "Hero",
    summary: "カルーセル",
    changed: false,
    failed: false,
  },
  {
    id: "theme",
    label: "配色",
    summary: "淡い青",
    changed: false,
    failed: true,
  },
];

// 本文側の節を模したプローブ。実際の Section と同じく、現在地の節だけを描く。
function SectionProbe({ id }: { id: string }) {
  const activeId = useAdminSettingsActiveSection();
  if (activeId !== null && activeId !== id) return null;
  return (
    <div id={`settings-section-${id}`} data-settings-section={id}>
      <h2 data-settings-section-heading tabIndex={-1}>
        {id} の本文
      </h2>
    </div>
  );
}

async function mount(focusSectionId: string | null) {
  const container = doc().createElement("div");
  doc().body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <div className="admin-atelier">
        <AdminSettingsFormLayout
          sections={sections}
          changedCount={0}
          pending={false}
          saveError={false}
          lastSavedAt={null}
          focusSectionId={focusSectionId}
          onSave={() => {}}
          onDiscard={() => {}}
          copy={copy}
        >
          {sections.map((section) => (
            <SectionProbe key={section.id} id={section.id} />
          ))}
        </AdminSettingsFormLayout>
      </div>,
    );
  });
  await act(async () => flush(5));
  return { container, root };
}

const visibleSections = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-settings-section]")).map((el) =>
    el.getAttribute("data-settings-section"),
  );

test("本文には現在地の1節だけを出し、目次は全節ぶんの入口を保つ", async () => {
  const { container, root } = await mount(null);

  expect(
    container.querySelectorAll("[data-settings-section-link]"),
  ).toHaveLength(3);
  expect(visibleSections(container)).toEqual(["basics"]);

  const heroLink = container.querySelector<HTMLButtonElement>(
    '[data-settings-section-link="hero"]',
  );
  expect(heroLink).not.toBeNull();
  await act(async () => {
    heroLink!.click();
  });
  await act(async () => flush(5));

  expect(visibleSections(container)).toEqual(["hero"]);
  expect(heroLink!.getAttribute("aria-current")).toBe("location");
  expect(
    container
      .querySelector('[data-settings-section-link="basics"]')
      ?.getAttribute("aria-current"),
  ).toBeNull();
  // 節を切り替えたら見出しへフォーカスが移り、キーボードでも現在地を失わない。
  expect(
    doc().activeElement?.hasAttribute("data-settings-section-heading"),
  ).toBe(true);

  await act(async () => root.unmount());
});

test("保存に失敗した節は目次操作なしで本文へ出す", async () => {
  const { container, root } = await mount("theme");
  expect(visibleSections(container)).toEqual(["theme"]);
  expect(
    container
      .querySelector('[data-settings-section-link="theme"]')
      ?.getAttribute("aria-current"),
  ).toBe("location");
  await act(async () => root.unmount());
});
