import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assess,
  readFrontmatterField,
  parseIsoDate,
  ageInDays,
  DEFAULT_MAX_AGE_DAYS,
} from "./check-wiki-freshness.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = resolve(REPO, "scripts/ai/check-wiki-freshness.mjs");
const TODAY = new Date("2026-08-20T00:00:00Z");

function page(path, lastVerified, status = "current") {
  const lv = lastVerified === null ? "" : `last_verified: ${lastVerified}\n`;
  return {
    path,
    text: `---\ntitle: T\nstatus: ${status}\n${lv}sources: []\n---\n\n本文\n`,
    gitDate: "2026-07-02",
  };
}

test("45日ちょうどは警告しない。46日から警告する", () => {
  const { stale } = assess(
    [page("a.md", "2026-07-06"), page("b.md", "2026-07-05")],
    TODAY,
  );
  assert.equal(ageInDays(parseIsoDate("2026-07-06"), TODAY), 45);
  assert.equal(ageInDays(parseIsoDate("2026-07-05"), TODAY), 46);
  assert.deepEqual(
    stale.map((s) => s.path),
    ["b.md"],
  );
});

test("古い順に並ぶ", () => {
  const { stale } = assess(
    [page("new.md", "2026-07-01"), page("old.md", "2026-06-01")],
    TODAY,
  );
  assert.deepEqual(
    stale.map((s) => s.path),
    ["old.md", "new.md"],
  );
});

test("last_verified が無いページには、今日ではなく最終commitの日付を提案する", () => {
  const { missing, stale } = assess([page("x.md", null)], TODAY);
  assert.equal(stale.length, 0, "欠落は stale ではなく missing に入る");
  assert.equal(missing.length, 1);
  assert.equal(missing[0].suggested, "2026-07-02");
  assert.notEqual(
    missing[0].suggested,
    "2026-08-20",
    "今日の日付を提案してはいけない",
  );
});

test("読めない日付は unreadable として分ける（stale に混ぜない）", () => {
  const { unreadable, stale } = assess([page("x.md", "2026/07/02")], TODAY);
  assert.equal(stale.length, 0);
  assert.deepEqual(unreadable, [{ path: "x.md", raw: "2026/07/02" }]);
});

test("frontmatter が無いテキストからは null を返す", () => {
  assert.equal(readFrontmatterField("# 見出し\n本文\n", "last_verified"), null);
});

test("閾値の既定は45日", () => {
  assert.equal(DEFAULT_MAX_AGE_DAYS, 45);
});

test("閾値は引数で変えられる", () => {
  const pages = [page("a.md", "2026-08-10")]; // 10日前
  assert.equal(assess(pages, TODAY, 45).stale.length, 0);
  assert.equal(assess(pages, TODAY, 5).stale.length, 1);
});

test("全ページが古くても終了コードは0（checkを止めない）", () => {
  // --days -1 で必ず全ページが「古い」側に倒れる。wikiの実状に依存させない。
  const out = execFileSync("node", [SCRIPT, "--days", "-1"], {
    cwd: REPO,
    encoding: "utf8",
  });
  assert.match(out, /このチェックは check を失敗させない/);
});

test("警告が無いときも終了コードは0", () => {
  const out = execFileSync("node", [SCRIPT, "--days", "100000"], {
    cwd: REPO,
    encoding: "utf8",
  });
  assert.match(out, /すべて/);
});

test("--strict のときだけ 1 を返す（bun run check では使わない）", () => {
  let status = 0;
  try {
    execFileSync("node", [SCRIPT, "--strict", "--days", "-1"], {
      cwd: REPO,
      stdio: "ignore",
    });
  } catch (error) {
    status = error.status;
  }
  assert.equal(status, 1, "--strict は警告があれば 1。既定の実行と区別する");
});
