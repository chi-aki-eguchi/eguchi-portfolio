// smoke の隔離（開発サーバーの接続先・実行環境）と、fixtures.ts の通信の番人を確かめる。
import { SMOKE_ISOLATION_PATH, smokeDatabasePath } from "../../packages/web/vite/smoke-isolation.ts";
import { expect, test, type Page } from "./fixtures.ts";
import { loginAsAdmin } from "./helpers.ts";
import { SMOKE_RUN_DIR, SMOKE_STORAGE_PORT } from "./smoke-env.ts";

async function isolationReport(page: Page) {
  const res = await page.request.get(SMOKE_ISOLATION_PATH);
  return { status: res.status(), body: await res.json() };
}

test.describe("smoke の隔離", () => {
  test("開発サーバーの API は、この実行の一時SQLiteと偽ストレージだけにつながる", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "サーバー側の確認は1回でよい");
    const { status, body } = await isolationReport(page);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.database).toBe(smokeDatabasePath(SMOKE_RUN_DIR));
    expect(body.storage).toBe(`http://127.0.0.1:${SMOKE_STORAGE_PORT}`);
    expect(body.expiredTrash).toBe(0);
    expect(body.blockedConnections).toEqual([]);
    const settings = await (await page.request.get("/api/settings")).json();
    expect(settings.siteName).toBe("Smoke Fixture Studio");
  });

  test("テストの実行環境に接続情報・資格情報が残っていない", async () => {
    test.skip(test.info().project.name !== "desktop", "1回でよい");
    const leaked = Object.keys(process.env).filter(
      (key) =>
        !key.startsWith("SMOKE_") &&
        /^(DATABASE|TURSO|S3|R2|AWS)_|ADMIN_PASSWORD|SECRET|TOKEN|API_?KEY/i.test(key),
    );
    expect(leaked).toEqual([]);
  });

  test("ゴミ箱を開いても、人工データの写真は消えない（保持期間の内側だけを置いている）", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "サーバー側の確認は1回でよい");
    await loginAsAdmin(page);
    for (let i = 0; i < 2; i += 1) {
      const res = await page.request.get("/api/admin/photos/trash");
      expect(res.status()).toBe(200);
      const { photos } = await res.json();
      expect(photos.map((p: { id: number }) => p.id).sort()).toEqual([7901, 7902]);
    }
    expect((await isolationReport(page)).body.expiredTrash).toBe(0);
  });
});

test.describe("fixtures.ts の番人", () => {
  test.use({ unmockedRequestPolicy: "record" });

  test("モックの無い外部・別ポート・書き込みを止めて記録し、書体だけ空で答える", async ({ page, networkGuard }, info) => {
    test.skip(info.project.name !== "desktop", "番人の確認は1回でよい");
    await page.route("**/api/admin/mocked-write", (route) => route.fulfill({ json: { ok: true } }));
    await page.goto("/about");
    const results = await page.evaluate(async () => {
      const attempt = async (url: string, init?: RequestInit) => {
        try {
          const res = await fetch(url, init);
          return `${res.status}`;
        } catch {
          return "blocked";
        }
      };
      return {
        external: await attempt("https://example.invalid/probe"),
        otherLocalPort: await attempt("http://127.0.0.1:59999/probe"),
        font: await attempt("https://fonts.googleapis.com/css2?family=Smoke"),
        write: await attempt("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
        mockedWrite: await attempt("/api/admin/mocked-write", { method: "POST" }),
      };
    });
    expect(results).toEqual({
      external: "blocked",
      otherLocalPort: "blocked",
      font: "200",
      write: "blocked",
      mockedWrite: "200",
    });
    expect(networkGuard.external).toEqual([
      "GET https://example.invalid/probe",
      "GET http://127.0.0.1:59999/probe",
    ]);
    expect(networkGuard.writes).toEqual(["POST /api/admin/settings"]);
    expect(networkGuard.fonts).toContain("https://fonts.googleapis.com/css2");
  });
});
