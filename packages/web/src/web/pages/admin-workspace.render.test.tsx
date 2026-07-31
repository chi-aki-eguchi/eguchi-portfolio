import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageShell } from "./admin-page-shell";
import { AdminWorkspace } from "./admin-workspace";

// ページ枠の幅は「用途」で3種類だけ(form / list / wide)。
// 画面名ごとに寸法を足していくと、また画面ごとに規則が割れるため増やさない。
test("PageShellは既定でForm幅、用途を渡すとその幅になる", () => {
  const form = renderToStaticMarkup(
    <PageShell>
      <p>Form本文</p>
    </PageShell>,
  );
  expect(form).toContain('data-admin-page-shell="form"');

  const list = renderToStaticMarkup(
    <PageShell width="list">
      <p>一覧</p>
    </PageShell>,
  );
  expect(list).toContain('data-admin-page-shell="list"');
});

test("Workspaceは全幅のスクロール面と下部操作帯を別の器に置く", () => {
  const html = renderToStaticMarkup(
    <AdminWorkspace
      name="hero"
      actionBar={<div data-test-action-bar>操作帯</div>}
    >
      <p>写真面</p>
    </AdminWorkspace>,
  );

  expect(html).toContain('data-admin-workspace="hero"');
  expect(html).toContain("admin-screen-workspace__scroll");
  expect(html.indexOf("写真面")).toBeLessThan(html.indexOf("操作帯"));
});
