#!/usr/bin/env node
/**
 * knowledge/wiki/ の各ページの `last_verified`（最後に内容を確認した日）を見て、
 * 45日を過ぎたページを一覧で警告する。
 *
 * **警告どまりで、絶対に失敗しない。**`bun run check` の `&&` 連鎖に入るため、
 * ここで終了コードを1にすると作業全体が止まる。古い文書より止まるほうが害が大きい。
 * 終了コードは常に 0（`--strict` を明示した時だけ 1 を返す。CI用の逃げ道で、
 * 既定の `bun run check` では使わない）。
 *
 * ファイルは一切書き換えない。`last_verified` が無いページには、
 * **今日の日付ではなく**そのファイルが実際に最後に変更されたcommitの日付を
 * 「これを入れよ」として提示する。今日の日付を入れると、確認していないものを
 * 確認済みに見せかけることになり、古い記述をまた見逃す。
 *
 *   node scripts/ai/check-wiki-freshness.mjs
 *   node scripts/ai/check-wiki-freshness.mjs --days 30
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WIKI = resolve(REPO, "knowledge");

export const DEFAULT_MAX_AGE_DAYS = 45;

/** frontmatter から1つのキーを読む。frontmatter が無ければ null。 */
export function readFrontmatterField(text, field) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const m = text.slice(4, end).match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

/** YYYY-MM-DD を UTC の Date にする。読めなければ null。 */
export function parseIsoDate(value) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ageInDays(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function listMarkdown(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...listMarkdown(full));
    else if (name.endsWith(".md")) out.push(full);
  }
  return out.sort();
}

/** そのファイルを実際に最後に変更した commit の日付。取れなければ null。 */
function lastCommitDate(file) {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%ad", "--date=short", "--", relative(REPO, file)],
      { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * 判定だけを行う純粋関数。テストから呼ぶ。
 * pages: [{ path, text, gitDate }]
 */
export function assess(pages, today, maxAgeDays = DEFAULT_MAX_AGE_DAYS) {
  const stale = [];
  const missing = [];
  const unreadable = [];
  for (const page of pages) {
    const raw = readFrontmatterField(page.text, "last_verified");
    if (raw === null) {
      missing.push({ path: page.path, suggested: page.gitDate });
      continue;
    }
    const date = parseIsoDate(raw);
    if (!date) {
      unreadable.push({ path: page.path, raw });
      continue;
    }
    const age = ageInDays(date, today);
    if (age > maxAgeDays) {
      stale.push({
        path: page.path,
        lastVerified: raw,
        age,
        status: readFrontmatterField(page.text, "status") ?? "-",
      });
    }
  }
  stale.sort((a, b) => b.age - a.age);
  return { stale, missing, unreadable };
}

function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes("--strict");
  const daysArg = argv.indexOf("--days");
  const maxAgeDays =
    daysArg !== -1 && argv[daysArg + 1]
      ? Number(argv[daysArg + 1])
      : DEFAULT_MAX_AGE_DAYS;

  let files;
  try {
    files = listMarkdown(WIKI);
  } catch {
    console.log("[wiki-freshness] knowledge/ が読めないため確認を飛ばした。");
    return 0;
  }

  const pages = files
    .map((f) => {
      let text;
      try {
        text = readFileSync(f, "utf8");
      } catch {
        return null;
      }
      // frontmatter を持たないものは wiki ページではない（raw/README.md 等）
      if (!text.startsWith("---\n")) return null;
      return { path: relative(REPO, f), text, gitDate: lastCommitDate(f) };
    })
    .filter(Boolean);

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const { stale, missing, unreadable } = assess(pages, today, maxAgeDays);

  if (!stale.length && !missing.length && !unreadable.length) {
    console.log(
      `[wiki-freshness] ${pages.length}ページすべて ${maxAgeDays}日以内に確認済み。`,
    );
    return 0;
  }

  console.log(
    `[wiki-freshness] 警告のみ。${maxAgeDays}日を過ぎたページが ${stale.length}件` +
      `（全${pages.length}ページ中）。**このチェックは check を失敗させない。**`,
  );
  for (const s of stale) {
    console.log(
      `  ${String(s.age).padStart(4)}日前  ${s.lastVerified}  [${s.status}]  ${s.path}`,
    );
  }
  for (const m of missing) {
    console.log(
      `  last_verified が無い: ${m.path}` +
        (m.gitDate
          ? `  → 最終変更commitの日付 ${m.gitDate} を入れる（今日の日付を入れない）`
          : "  → git から日付を取れなかった。手で調べて入れる"),
    );
  }
  for (const u of unreadable) {
    console.log(`  last_verified が読めない: ${u.path}（値: ${u.raw}）`);
    }
  console.log(
    "  直し方: 内容をソースと突き合わせて確認 → last_verified を確認した日へ更新 →\n" +
      "  knowledge/wiki/log.md へ1件追記（knowledge/WIKI_SCHEMA.md の手順）。\n" +
      "  中身を見ずに日付だけ進めない。それをやると古い記述が「確認済み」で埋もれる。",
  );
  return strict ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // 何があっても check を止めない。想定外の例外も飲み込む。
  let code = 0;
  try {
    code = main();
  } catch (error) {
    console.log(`[wiki-freshness] 確認できなかった: ${error?.message ?? error}`);
    code = 0;
  }
  process.exit(code);
}
