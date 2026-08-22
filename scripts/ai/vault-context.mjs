#!/usr/bin/env node
/**
 * SessionStart フックで、Obsidian Vault（~/aki-vault）に書かれている
 * 「このプロジェクトの現状」と「確認が古いノート」を、セッション開始時の
 * 文脈へ流し込む。
 *
 * なぜ文書ではなく仕組みなのか:
 *   「毎回 Vault を読む」という決まりは CLAUDE.md にも AI記録ルール.md にも
 *   前から書かれているが、2026-08-20 のセッションでは丸一日読まれなかった。
 *   読むかどうかを判断に委ねている限り抜ける。読ませるのではなく、
 *   最初から文脈に入れてしまう。
 *
 * 守っていること:
 *   - **読み取りのみ。** Vault へは一切書かない。
 *   - **絶対に失敗しない。** 例外は全部飲み込み、終了コードは常に 0。
 *     ここで落ちるとセッションが起動しなくなる。Vault が無い Mac、
 *     権限が無い状態、壊れた frontmatter、どれでも黙って諦める。
 *   - **読むのは 30_プロジェクト/ だけ。** 写真・学校・デイリーノート・資料・
 *     添付は個人的な内容なので開かない（DENY を参照）。
 *   - **出力は毎回同じ。** 今日の日付・経過日数・時刻を出さない。
 *     last_verified は書かれている日付をそのまま出す。プロンプトが毎回
 *     変わると prompt cache が効かず、起動のたびに課金される。
 *     45日の判定にだけ今日を使うが、出るのは「古い」という印だけで、
 *     これが変わるのはノートが閾値をまたいだ日だけ。
 *
 *   node scripts/ai/vault-context.mjs
 *   node scripts/ai/vault-context.mjs --days 30
 */
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, basename } from "node:path";

export const DEFAULT_MAX_AGE_DAYS = 45;

/** Vault の中で読んでよい唯一の場所。 */
export const ALLOWED_DIR = "30_プロジェクト";

/**
 * 個人的な内容。開かない。
 * ここに触れる変更を入れるときは、必ずオーナーへ確認すること。
 */
export const DENY = [
  "10_写真制作",
  "20_学校",
  "01_デイリーノート",
  "50_資料",
  "90_添付ファイル",
];

/**
 * ノートから抜き出す節。「今どうなっているか」に当たるものだけ。
 * 見出しの書き方は揃っていない（「現在の進捗」「現在の進行中作業」「現在地」
 * 「次の優先作業」「次にやること」…）ので、完全一致ではなく前方一致で拾う。
 * 見出し末尾の「（2026-08-17更新）」のような注記は落としてから判定する。
 */
export const SECTION_PATTERNS = [/^現在/, /^未解決/, /^次の/, /^次に/];

/** 1ノートから拾う節の上限。多すぎると常時読み込みが太る。 */
const MAX_SECTIONS_PER_NOTE = 4;

/** 1ノートあたりの上限。長いノートで文脈を食い潰さないため。 */
const MAX_CHARS_PER_SECTION = 700;
const MAX_STALE_LISTED = 12;
const MAX_FILES = 60;

export function vaultRoot(env = process.env, home = homedir()) {
  return env.AKI_VAULT || resolve(home, "aki-vault");
}

/** frontmatter から1つのキーを読む。無ければ null。 */
export function readFrontmatterField(text, field) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const m = text.slice(4, end).match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

export function parseIsoDate(value) {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * このプロジェクトを指す語。既定はリポジトリのフォルダ名。
 * 別名がある場合は .claude/vault-project-keys.txt に1行1件で足す。
 */
export function projectKeys(repoRoot, readFile = readFileSync) {
  const keys = [basename(repoRoot)];
  try {
    const extra = readFile(resolve(repoRoot, ".claude/vault-project-keys.txt"), "utf8");
    for (const line of extra.split("\n")) {
      const key = line.trim();
      if (key && !key.startsWith("#")) keys.push(key);
    }
  } catch {
    // 別名ファイルは任意。無いのが普通。
  }
  return keys.map((k) => k.toLowerCase()).filter(Boolean);
}

export function matchesProject(notePath, keys) {
  const name = basename(notePath).toLowerCase();
  return keys.some((k) => name.includes(k));
}

/** 見出し行から「## 」と末尾の注記（…）を落とした名前。 */
export function headingName(line) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/[（(][^（）()]*[）)]\s*$/, "")
    .trim();
}

/**
 * 「今どうなっているか」に当たる節を、名前で拾って返す。
 * 行番号ではなく節の名前で参照する — 行番号は中身が動くたびにずれる。
 * 返り値: [{ heading, body }]
 */
export function extractSections(text) {
  const lines = text.split("\n");
  const found = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^#{1,6}\s/.test(lines[i])) continue;
    const name = headingName(lines[i]);
    if (!SECTION_PATTERNS.some((re) => re.test(name))) continue;

    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^#{1,6}\s/.test(lines[j])) break;
      body.push(lines[j]);
    }
    let out = body.join("\n").trim();
    if (!out) continue;
    if (out.length > MAX_CHARS_PER_SECTION) {
      out = `${out.slice(0, MAX_CHARS_PER_SECTION).trimEnd()}…（以下省略。全文はノートを開く）`;
    }
    found.push({ heading: lines[i].replace(/^#{1,6}\s+/, "").trim(), body: out });
    if (found.length >= MAX_SECTIONS_PER_NOTE) break;
  }
  return found;
}

/**
 * 判定だけを行う純粋関数。テストから呼ぶ。
 * notes: [{ path, text }]
 * 返り値に今日の日付・経過日数は含めない。含めると出力が毎日変わる。
 */
export function assess(notes, keys, today, maxAgeDays = DEFAULT_MAX_AGE_DAYS) {
  const mine = [];
  const stale = [];
  const undated = [];

  for (const note of notes) {
    const raw = readFrontmatterField(note.text, "last_verified");
    const date = parseIsoDate(raw);
    const isStale = date ? today.getTime() - date.getTime() > maxAgeDays * 86_400_000 : false;

    if (date === null) undated.push({ path: note.path, raw });
    else if (isStale) stale.push({ path: note.path, lastVerified: raw });

    if (matchesProject(note.path, keys)) {
      const sections = extractSections(note.text);
      mine.push({ path: note.path, lastVerified: raw, stale: isStale, sections });
    }
  }

  // 経過日数ではなく日付で並べる。古い順。出力を安定させるため同日はパス順。
  const byDate = (a, b) =>
    a.lastVerified === b.lastVerified
      ? a.path.localeCompare(b.path)
      : a.lastVerified.localeCompare(b.lastVerified);
  stale.sort(byDate);
  mine.sort((a, b) => a.path.localeCompare(b.path));
  undated.sort((a, b) => a.path.localeCompare(b.path));

  return { mine, stale, undated };
}

export function render({ mine, stale, undated }, { vault, maxAgeDays }) {
  const out = [];
  out.push(
    `[vault] ${vault} の ${ALLOWED_DIR}/ を読んだ（読み取りのみ・書き込みなし）。` +
      `個人的なフォルダ（${DENY.join("・")}）は開いていない。`,
  );

  if (mine.length === 0) {
    out.push(
      `  このプロジェクトに該当するノートは ${ALLOWED_DIR}/ に無い。` +
        `作るときは ${ALLOWED_DIR}/<プロジェクト名>.md へ（規則は Vault の AI記録ルール.md）。`,
    );
  }
  for (const note of mine) {
    out.push("");
    out.push(`  ■ ${note.path}`);
    out.push(
      `    last_verified: ${note.lastVerified ?? "（未記入）"}` +
        (note.stale ? `  ← ${maxAgeDays}日より前。下の「現状」は実物とずれている可能性がある。` : ""),
    );
    if (note.sections.length === 0) {
      out.push("    「現在」「未解決」「次の」で始まる節が無い。現状は本文を直接読む。");
    }
    for (const { heading, body } of note.sections) {
      out.push(`    【${heading}】`);
      for (const line of body.split("\n")) out.push(`      ${line}`);
    }
  }

  out.push("");
  if (stale.length === 0) {
    // 「無い」も明示する。黙っていると、確認したのか見ていないだけなのかが
    // 読む側から区別できない。
    out.push(`  ■ ${maxAgeDays}日より前に確認したきりのノートは ${ALLOWED_DIR}/ に無い。`);
  } else {
    out.push(
      `  ■ ${maxAgeDays}日より前に確認したきりのノート（${ALLOWED_DIR}/ 全体・古い順）`,
    );
    for (const s of stale.slice(0, MAX_STALE_LISTED)) {
      out.push(`      ${s.lastVerified}  ${s.path}`);
    }
    if (stale.length > MAX_STALE_LISTED) {
      out.push(`      （ほか ${stale.length - MAX_STALE_LISTED} 件は省略）`);
    }
  }
  if (undated.length > 0) {
    out.push("");
    out.push("  ■ last_verified が無い／読めないノート");
    for (const u of undated.slice(0, MAX_STALE_LISTED)) {
      out.push(`      ${u.path}${u.raw ? `（値: ${u.raw}）` : ""}`);
    }
  }
  if (stale.length > 0 || undated.length > 0) {
    out.push(
      "    直し方: 内容を実物と突き合わせて確認 → last_verified を確認した日へ更新。" +
        "中身を見ずに日付だけ進めない。",
    );
  }

  out.push("");
  out.push(
    "  ここに出ているのは Vault の「今どうなっているか」だけ。" +
      "日付つきの経緯は Vault の 40_開発ログ/ にある。必要になったら固有名詞で検索して読む。",
  );
  return out.join("\n");
}

function listProjectNotes(vault, readDir = readdirSync, readFile = readFileSync) {
  const dir = resolve(vault, ALLOWED_DIR);
  const names = readDir(dir)
    .filter((n) => n.endsWith(".md"))
    .sort()
    .slice(0, MAX_FILES);
  const notes = [];
  for (const name of names) {
    try {
      notes.push({ path: `${ALLOWED_DIR}/${name}`, text: readFile(resolve(dir, name), "utf8") });
    } catch {
      // 1枚読めなくても残りは出す。
    }
  }
  return notes;
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const daysArg = argv.indexOf("--days");
  const maxAgeDays =
    daysArg !== -1 && argv[daysArg + 1] ? Number(argv[daysArg + 1]) : DEFAULT_MAX_AGE_DAYS;

  const vault = vaultRoot();
  let notes;
  try {
    notes = listProjectNotes(vault);
  } catch {
    // Vault が無い Mac でも、ここで黙って終われば起動は妨げない。
    return 0;
  }
  if (notes.length === 0) return 0;

  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const result = assess(notes, projectKeys(cwd), today, maxAgeDays);
  console.log(render(result, { vault, maxAgeDays }));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exit(main());
  } catch {
    // 何があってもセッションは起動させる。黙って 0。
    process.exit(0);
  }
}
