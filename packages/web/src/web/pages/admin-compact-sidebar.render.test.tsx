import { expect, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminCompactSidebar } from "./admin-compact-sidebar";
import type { AdminTabGroup, Tab } from "./admin-shared";

const groups: AdminTabGroup[] = [
  { key: "photos", label: "写真", tabs: ["gallery"] },
  {
    key: "presentation",
    label: "見せ方",
    tabs: ["hero", "series", "categories"],
  },
  { key: "site", label: "サイト", tabs: ["profile", "settings"] },
];

const tabMeta = Object.fromEntries(
  [
    "setup",
    "gallery",
    "hero",
    "profile",
    "categories",
    "series",
    "pricing",
    "service",
    "settings",
  ].map((tab) => [
    tab,
    { label: tab === "gallery" ? "Library" : tab, icon: <i>{tab}</i> },
  ]),
) as Record<Tab, { label: string; icon: ReactNode }>;

test("1024px用ナビは3グループを記号と短いラベルで示す", () => {
  const html = renderToStaticMarkup(
    <AdminCompactSidebar
      groups={groups}
      tabMeta={tabMeta}
      activeTab="gallery"
      navigationLocked={false}
      onRequestTab={() => true}
      onExpand={() => {}}
      onLogout={() => {}}
      labels={{
        navigation: "管理画面",
        expand: "サイドバーを開く",
        openSite: "公開サイトを開く",
        logout: "ログアウト",
      }}
    />,
  );

  expect(html).toContain('data-compact-sidebar-group="photos"');
  expect(html).toContain('data-compact-sidebar-group="presentation"');
  expect(html).toContain('data-compact-sidebar-group="site"');
  expect(html).toContain('data-active="true"');
  expect(html).toContain("写真");
  expect(html).toContain("見せ方");
  expect(html).toContain("サイト");
});

test("並べ替え中は写真以外のグループを無効にする", () => {
  const html = renderToStaticMarkup(
    <AdminCompactSidebar
      groups={groups}
      tabMeta={tabMeta}
      activeTab="gallery"
      navigationLocked
      onRequestTab={() => true}
      onExpand={() => {}}
      onLogout={() => {}}
      labels={{
        navigation: "管理画面",
        expand: "サイドバーを開く",
        openSite: "公開サイトを開く",
        logout: "ログアウト",
      }}
    />,
  );

  const groupButtons = html.match(
    /<button[^>]+data-compact-sidebar-group=[^>]+>/g,
  );
  expect(groupButtons).toHaveLength(3);
  expect(groupButtons?.[0]).not.toContain("disabled");
  expect(groupButtons?.[1]).toContain("disabled");
  expect(groupButtons?.[2]).toContain("disabled");
});
