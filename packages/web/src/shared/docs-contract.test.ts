import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatUploadSizeLimit } from "./upload-limits";
import { IMAGE_PROXY_ALLOWED_PREFIXES } from "../api/security";

// 利用案内と実装が同じ値を指しているか。2026-09-17 の監査で、API資料の上限
// （60MB）と実装（300MB）、画像形式の出し分けの有効条件が食い違っていた。
// 文章の書き方までは縛らず、読み手が誤る数値と参照先だけを見る。
const root = resolve(import.meta.dir, "../../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("docs match the implementation", () => {
  test("upload limit", () => {
    const limit = formatUploadSizeLimit();
    const uploadRow = read("docs/api.md")
      .split("\n")
      .find((line) => line.includes("| `/api/admin/upload` | Upload image"));
    expect(uploadRow).toContain(`Max ${limit}`);
    expect(read("docs/admin-guide.md")).toContain(`${limit}まで`);
  });

  test("image proxy format and prefixes", () => {
    const api = read("docs/api.md");
    // 形式の出し分けは常に有効。環境変数で切り替える説明を残さない。
    expect(api).not.toContain("IMAGE_FORMAT_NEGOTIATION");
    for (const prefix of IMAGE_PROXY_ALLOWED_PREFIXES) {
      expect(api).toContain(`\`${prefix}\``);
    }
  });

  test("the startup migration log points at a README section that exists", () => {
    const pointer = read("packages/web/src/api/database/migrate.ts").match(
      /See README → "([^"]+)"/,
    )?.[1];
    expect(pointer).toBeDefined();
    expect(read("README.md")).toContain(`## ${pointer}\n`);
    expect(read("DISTRIBUTION.md")).toContain(`See README → "${pointer}"`);
  });
});
