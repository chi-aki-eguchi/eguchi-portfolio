/**
 * 「Series と Pricing の編集が、何も言わずに消える」の回帰テスト。
 *
 * 未保存であることを親へ通知していなかったので、タブ切替とログアウトの確認を
 * すり抜けていた（他4箇所は通知しており、確認は既にあった）。加えて、別の行の
 * 鉛筆を押すと下書きが上書きされ、「閉じる」は確認なしで捨てていた。
 * 一番時間をかけて書く文章（シリーズのステートメント、料金の説明）が
 * 押し間違い1回で消える状態だった。
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(resolve(here, rel), "utf8");

const tabs = src("../pages/admin-tabs.tsx");
const shell = src("../pages/admin.tsx");

describe("行の下書きを守る", () => {
  test("Series と Pricing は、未保存であることを親へ通知する", () => {
    // 親の requestTab / requestLogout はこの通知だけを見ている。
    for (const tab of ["SeriesTab", "PricingTab"]) {
      const i = tabs.indexOf(`export function ${tab}(`);
      expect(i, `${tab} が見つからない`).toBeGreaterThan(-1);
      expect(tabs.slice(i, i + 400)).toContain("onUnsavedChange");
    }
    // 親が実際に渡していること。片方だけ直すと通知が届かない。
    expect(shell).toContain("<LazySeriesTab onUnsavedChange={setHasUnsaved} />");
    expect(shell).toContain(
      "<LazyPricingTab onUnsavedChange={setHasUnsaved} />",
    );
  });

  test("行を離れる操作は必ず guard を通す", () => {
    // 素の setEditId(null) が残っていると、そこだけ確認をすり抜ける。
    expect(tabs).not.toContain("onClick={() => setEditId(null)}");
    expect(tabs).not.toContain("? setEditId(null) : openEdit");
    expect(tabs).toContain("guardRow.guard(");
  });

  test("開いた時点の値を控え、閉じるときに捨てる", () => {
    // 控えが残ったままだと、次に開いた行が「未保存」に見える。
    expect(tabs).toContain("setOpenedDraft(seriesDraftOf(s))");
    expect(tabs).toContain("setOpenedDraft(planDraftOf(p))");
    expect(tabs).toContain("setOpenedDraft(null)");
  });

  test("捨てる前の確認は、取り消しと破棄の2択で出す", () => {
    const uses = [...tabs.matchAll(/guardRow\.confirming && \([\s\S]{0,1400}?<\/Modal>/g)];
    expect(uses.length, "確認ダイアログが2画面ぶん無い").toBe(2);
    for (const u of uses) {
      expect(u[0]).toContain("t.shell.unsavedRowBody");
      expect(u[0]).toContain("guardRow.cancelDiscard");
      expect(u[0]).toContain("guardRow.confirmDiscard");
    }
  });

  test("保存して閉じたときと、行ごと消したときも控えを片づける", () => {
    expect(tabs).toContain("{ onSuccess: () => closeEdit() }");
    expect(tabs).toContain("if (editId === deleteTarget.id) closeEdit();");
  });
});
