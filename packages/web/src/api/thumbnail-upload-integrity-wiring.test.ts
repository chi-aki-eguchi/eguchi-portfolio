import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// 補償の中身は `thumbnail-upload-integrity.test.ts` が実際に動かして検査する。
// ここが配線テストのままなのは、後始末が index.ts 内部の R2 削除
// (`deleteStorageKeys`) だからで、テストから安全に実行できない。
// そのぶん「本物の後始末が渡っていること」を式の形で厳しく見る。2026-08-06 の
// 追試 M4 では、no-op を渡しても素通りしていた。
const source = readFileSync(import.meta.dir + "/index.ts", "utf8");

describe("thumbnail upload compensation wiring", () => {
  test("passes the real storage cleanup to uploadAllOrCleanup", () => {
    const helper = source.slice(
      source.indexOf("async function generateAndUploadThumbnails"),
      source.indexOf("async function generateAndUploadThumb(\n"),
    );

    // 第2引数が `deleteStorageKeys` そのものであること。no-op ラッパへ
    // 差し替えるとこの形が崩れる。
    expect(helper).toMatch(
      /uploadAllOrCleanup\(\s*\[[\s\S]*?\],\s*deleteStorageKeys,?\s*\)/,
    );
    // 両方の派生をこの1回の呼び出しで扱う（片方だけ素の await にしない）。
    expect(helper.match(/uploadToStorage\(/g)).toHaveLength(2);
    expect(helper).not.toMatch(/await\s+uploadToStorage\(/);
  });
});
