import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assess,
  render,
  extractSections,
  headingName,
  matchesProject,
  projectKeys,
  parseIsoDate,
  readFrontmatterField,
  vaultRoot,
  ALLOWED_DIR,
  DENY,
  DEFAULT_MAX_AGE_DAYS,
} from "./vault-context.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = resolve(REPO, "scripts/ai/vault-context.mjs");
const TODAY = new Date("2026-08-23T00:00:00Z");

function note(name, lastVerified, body = "## 現在地\n動いている\n") {
  const lv = lastVerified === null ? "" : `last_verified: ${lastVerified}\n`;
  return {
    path: `${ALLOWED_DIR}/${name}`,
    text: `---\ntags: [プロジェクト]\n${lv}---\n\n# ${name}\n\n${body}`,
  };
}

test("45日ちょうどは古いと言わない。46日から古いと言う", () => {
  const { stale } = assess(
    [note("a.md", "2026-07-09"), note("b.md", "2026-07-08")],
    ["zzz"],
    TODAY,
  );
  assert.deepEqual(
    stale.map((s) => s.path),
    [`${ALLOWED_DIR}/b.md`],
  );
});

test("古いノートの一覧に経過日数を出さない。日付だけ出す", () => {
  const { stale } = assess([note("old.md", "2026-01-01")], ["zzz"], TODAY);
  assert.equal(stale[0].lastVerified, "2026-01-01");
  assert.ok(!("age" in stale[0]), "経過日数を持たせると出力が毎日変わる");
});

test("出力に今日の日付・経過日数・時刻が混ざらない", () => {
  const result = assess(
    [note("eguchi-portfolio-app AI運用.md", "2026-01-01"), note("other.md", "2026-08-20")],
    ["eguchi-portfolio-app"],
    TODAY,
  );
  const text = render(result, { vault: "/v", maxAgeDays: DEFAULT_MAX_AGE_DAYS });
  assert.ok(!text.includes("2026-08-23"), "今日の日付が混ざっている");
  assert.ok(!/\d+\s*日前/.test(text), "経過日数が混ざっている");
  assert.ok(!/\d{2}:\d{2}/.test(text), "時刻が混ざっている");
  assert.ok(text.includes("2026-01-01"), "last_verified はそのまま出す");
});

test("同じ入力なら出力も毎回同じ（prompt cache を効かせるため）", () => {
  const notes = [note("b.md", "2026-01-02"), note("a.md", "2026-01-01")];
  const once = render(assess(notes, ["a"], TODAY), { vault: "/v", maxAgeDays: 45 });
  const twice = render(assess([...notes].reverse(), ["a"], TODAY), {
    vault: "/v",
    maxAgeDays: 45,
  });
  assert.equal(once, twice, "ファイルの読み順で出力が変わってはいけない");
});

test("last_verified が無い／読めないノートは別枠にする", () => {
  const { undated } = assess(
    [note("none.md", null), note("bad.md", "きのう")],
    ["zzz"],
    TODAY,
  );
  assert.deepEqual(
    undated.map((u) => [u.path, u.raw]),
    [
      [`${ALLOWED_DIR}/bad.md`, "きのう"],
      [`${ALLOWED_DIR}/none.md`, null],
    ],
  );
});

test("プロジェクト名がファイル名に入っているノートだけ現状として出す", () => {
  const { mine } = assess(
    [note("eguchi-portfolio-app AI運用.md", "2026-08-20"), note("Ivy's House.md", "2026-08-22")],
    ["eguchi-portfolio-app"],
    TODAY,
  );
  assert.deepEqual(
    mine.map((m) => m.path),
    [`${ALLOWED_DIR}/eguchi-portfolio-app AI運用.md`],
  );
});

test("該当ノートが古いときは現状のそばに印を付ける", () => {
  const { mine } = assess([note("proj.md", "2026-01-01")], ["proj"], TODAY);
  assert.equal(mine[0].stale, true);
  const text = render({ mine, stale: [], undated: [] }, { vault: "/v", maxAgeDays: 45 });
  assert.ok(text.includes("ずれている可能性"));
});

test("見出し末尾の注記を落として名前で判定する", () => {
  assert.equal(headingName("## 現在地（2026-08-17更新）"), "現在地");
  assert.equal(headingName("### 次にやること"), "次にやること");
});

test("見出しの書き方が揃っていなくても現状の節を拾う", () => {
  const body = [
    "## 目的",
    "拾わない",
    "## 現在の進行中作業",
    "いま作っているもの",
    "## 未解決事項",
    "決まっていないこと",
    "## 次にやること",
    "つぎ",
    "## 関連ログ",
    "拾わない",
  ].join("\n");
  assert.deepEqual(
    extractSections(body).map((s) => s.heading),
    ["現在の進行中作業", "未解決事項", "次にやること"],
  );
});

test("長い節は途中で切って、切ったことを明示する", () => {
  const long = `## 現在地\n${"あ".repeat(2000)}\n`;
  const [section] = extractSections(long);
  assert.ok(section.body.length < 1000);
  assert.ok(section.body.includes("以下省略"));
});

test("中身が空の節は出さない", () => {
  assert.deepEqual(extractSections("## 現在地\n\n## 目的\n本文\n"), []);
});

test("読むのは 30_プロジェクト だけで、個人的なフォルダは対象に入れない", () => {
  assert.equal(ALLOWED_DIR, "30_プロジェクト");
  for (const dir of ["10_写真制作", "20_学校", "01_デイリーノート", "50_資料", "90_添付ファイル"]) {
    assert.ok(DENY.includes(dir), `${dir} が除外一覧から消えている`);
  }
  const source = execFileSync("cat", [SCRIPT], { encoding: "utf8" });
  // 走査する場所は resolve(vault, ALLOWED_DIR) の1か所だけ。
  assert.equal(source.match(/readDir\(/g).length, 1);
});

test("frontmatter と日付の読み取り", () => {
  assert.equal(readFrontmatterField("---\na: 1\nb: x\n---\n本文", "b"), "x");
  assert.equal(readFrontmatterField("frontmatterなし", "b"), null);
  assert.equal(parseIsoDate("2026-08-23")?.toISOString(), "2026-08-23T00:00:00.000Z");
  assert.equal(parseIsoDate("2026/08/23"), null);
  assert.equal(parseIsoDate(null), null);
});

test("プロジェクト名は既定でフォルダ名。別名ファイルがあれば足す", () => {
  assert.deepEqual(projectKeys("/x/eguchi-portfolio-app", () => {
    throw new Error("no file");
  }), ["eguchi-portfolio-app"]);
  assert.deepEqual(
    projectKeys("/x/repo", () => "# コメント\nポートフォリオ\n\n別名2\n"),
    ["repo", "ポートフォリオ", "別名2"],
  );
  assert.ok(matchesProject("30_プロジェクト/Ivy's House.md", ["ivy's house"]));
  assert.ok(!matchesProject("30_プロジェクト/Ivy's House.md", ["film-log"]));
});

test("Vault の場所は環境変数で差し替えられる", () => {
  assert.equal(vaultRoot({ AKI_VAULT: "/tmp/v" }, "/home/x"), "/tmp/v");
  assert.equal(vaultRoot({}, "/home/x"), "/home/x/aki-vault");
});

test("Vault が無くても落ちず、何も出さず、終了コードは0", () => {
  const out = execFileSync("node", [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, AKI_VAULT: "/nonexistent-vault-for-test" },
  });
  assert.equal(out, "");
});

test("実際の Vault を読んでも終了コードは0", () => {
  execFileSync("node", [SCRIPT], { encoding: "utf8" });
});

test("古いノートが無いときも「無い」と明示する", () => {
  const result = assess([note("a.md", "2026-08-20")], ["zzz"], TODAY);
  const text = render(result, { vault: "/v", maxAgeDays: 45 });
  assert.ok(text.includes("45日より前に確認したきりのノートは"), "黙ると見ていないのか区別できない");
});

test("古いノートがあるときは日付つきで一覧に出す", () => {
  const result = assess([note("a.md", "2026-01-01")], ["zzz"], TODAY);
  const text = render(result, { vault: "/v", maxAgeDays: 45 });
  assert.ok(text.includes("2026-01-01"));
  assert.ok(text.includes(`${ALLOWED_DIR}/a.md`));
});
