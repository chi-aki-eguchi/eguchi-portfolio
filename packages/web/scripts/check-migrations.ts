import fs from "node:fs";
import path from "node:path";

/**
 * **台帳（_journal.json）に載っている移行ファイルが、実在するか。**
 *
 * 2026-08-30、`bun run db:migrate` が落ちた。原因は
 * `drizzle/0001_flawless_the_stranger.sql` が**存在しないこと**だった
 * （`git log --all` にも一度も無く、`meta/0001_snapshot.json` だけが残って
 * いた）。台帳は全件を順に読むので、1つ欠けるとそこで必ず止まる。
 *
 * **黙って空ファイルで埋めてはいけない。** それをやると、新しく作った人の
 * DB だけ静かに列が足りない状態になる（欠けた分の変更が誰にも当たらない）。
 * 落ちるのは正しい。**落ちる前に気づけるように、ここで見張る。**
 *
 * 逆向き（ファイルはあるが台帳に無い）も見る。`db:generate` は両方を書くので、
 * 片方だけ commit し忘れた合図になる。
 */
const ROOT = path.resolve(import.meta.dirname, "..");
const DIRS = ["drizzle", "drizzle-postgres"];

const problems: string[] = [];
let counted = 0;

for (const dir of DIRS) {
  const base = path.join(ROOT, dir);
  const journalPath = path.join(base, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    problems.push(`${dir}: meta/_journal.json が無い`);
    continue;
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries?: { tag?: string }[];
  };
  const tags = (journal.entries ?? [])
    .map((e) => e.tag)
    .filter((t): t is string => typeof t === "string");
  counted += tags.length;

  for (const tag of tags) {
    if (!fs.existsSync(path.join(base, `${tag}.sql`)))
      problems.push(
        `${dir}: 台帳にある ${tag}.sql が見つからない（移行が1件失われている）`,
      );
  }

  const onDisk = fs
    .readdirSync(base)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.slice(0, -4));
  for (const file of onDisk) {
    if (!tags.includes(file))
      problems.push(
        `${dir}: ${file}.sql が台帳に登録されていない（meta の commit 漏れ）`,
      );
  }
}

if (problems.length) {
  console.error("[migrations] 台帳と移行ファイルが食い違っています:");
  for (const p of problems) console.error(`- ${p}`);
  console.error(
    "失われたファイルは、前後の meta スナップショットの差分から書き戻せます。" +
      "空ファイルで埋めないでください（新規のDBだけ静かに列が足りなくなります）。",
  );
  process.exitCode = 1;
} else {
  console.log(
    `[migrations] 台帳と移行ファイルが一致しています（${counted}件 / ${DIRS.length}系統）。`,
  );
}
