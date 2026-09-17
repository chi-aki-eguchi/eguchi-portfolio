// R2: ブラウザからは外へ何も出さず、サーバー側だけで外部への接続を1件起こす。
// API は失敗を吸収して 200・空で返すので、このテスト自体は成功する。
// 実行全体は global-setup.ts の終了時の判定で失敗しなければならない。
// note の設定は、この実行の一時SQLiteにだけ入れる。接続は smoke-egress-guard.ts が送る前に止める。
import { createClient } from "@libsql/client";
import { smokeDatabasePath } from "../../../../packages/web/vite/smoke-isolation.ts";
import { expect, test } from "../../fixtures.ts";
import { SMOKE_RUN_DIR } from "../../smoke-env.ts";

test("a server-side attempt is absorbed by the API, so the test itself passes", async ({ api }) => {
  const client = createClient({ url: `file:${smokeDatabasePath(SMOKE_RUN_DIR)}` });
  await client.execute(
    "INSERT INTO site_settings (key, value) VALUES ('noteEnabled','on'), ('noteUsername','smoke-egress-probe')",
  );
  client.close();
  const res = await api.get("/api/note-posts");
  expect(res.status()).toBe(200);
  expect((await res.json()).posts).toEqual([]);
});
