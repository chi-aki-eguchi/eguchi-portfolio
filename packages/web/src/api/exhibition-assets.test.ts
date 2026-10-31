import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { EXHIBITION_BUILT_IN } from "../shared/exhibition";
import { readExhibitionAsset } from "./exhibition-assets";
import { isAllowedImageKey } from "./security";

describe("トップの展示の同梱写真", () => {
  test("一覧の写真は実在し、書いてある縦横の大きさと一致する（切り抜かない枠の比がずれない）", async () => {
    for (const photo of EXHIBITION_BUILT_IN) {
      const key = photo.url.replace("/api/images/", "");
      expect(isAllowedImageKey(key)).toBe(true);
      const { buf, type } = await readExhibitionAsset(key);
      const meta = await sharp(buf).metadata();
      expect(type).toBe("image/jpeg");
      expect([meta.width, meta.height]).toEqual([photo.width, photo.height]);
    }
  });

  test("一覧に無い名前は読まず、保存先に無い写真と同じ扱いにする（住所からほかのファイルへ届かない）", async () => {
    for (const key of ["exhibition/../../package.json", "exhibition/2026-nichigei/nope.jpg"]) {
      await expect(readExhibitionAsset(key)).rejects.toMatchObject({ name: "NotFound" });
    }
  });
});
