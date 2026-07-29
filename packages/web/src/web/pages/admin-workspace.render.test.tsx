import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageShell } from "./admin-page-shell";
import { AdminWorkspace } from "./admin-workspace";

test("PageShellはForm専用でwide分岐を持たない", () => {
  const html = renderToStaticMarkup(
    <PageShell>
      <p>Form本文</p>
    </PageShell>,
  );

  expect(html).toContain('data-admin-page-shell="form"');
  expect(html).not.toContain('data-admin-page-shell="wide"');
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
