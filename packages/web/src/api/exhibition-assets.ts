import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { EXHIBITION_ASSET_KEYS, EXHIBITION_ASSET_PREFIX } from "../shared/exhibition";

const ASSET_ROOT = new URL("../../assets/exhibition/", import.meta.url);

/**
 * トップの展示の同梱写真を読む（shared/exhibition.ts）。
 * 読むのは一覧にある名前だけなので、住所からほかのファイルへは届かない。
 */
export async function readExhibitionAsset(key: string): Promise<{ buf: Buffer; type: string }> {
  if (!EXHIBITION_ASSET_KEYS.has(key)) {
    const missing = new Error(`exhibition asset ${key} is not listed`);
    missing.name = "NotFound";
    throw missing;
  }
  const file = new URL(key.slice(EXHIBITION_ASSET_PREFIX.length), ASSET_ROOT);
  return { buf: await readFile(fileURLToPath(file)), type: "image/jpeg" };
}
