import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { zoomLevels, zoomTilePaths } from "../shared/photo-zoom";
import { buildZoomTiles, runPooled } from "./photo-zoom-tiles";

const dir = await mkdtemp(join(tmpdir(), "zoom-tiles-test-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

async function source(name: string, width: number, height: number, orientation?: number) {
  const path = join(dir, name);
  let image = sharp({
    create: { width, height, channels: 3, background: { r: 90, g: 120, b: 150 } },
  }).jpeg({ quality: 80 });
  if (orientation) image = image.withMetadata({ orientation });
  await image.toFile(path);
  return path;
}

describe("buildZoomTiles", () => {
  test("元が小さければ作らない", async () => {
    const path = await source("small.jpg", 3000, 2000);
    expect(await buildZoomTiles(path, { minSourcePx: 3520, dir })).toBeNull();
  });

  test("段と四角が、画面が読みに行く置き場所と一致する", async () => {
    const path = await source("large.jpg", 5000, 3000);
    const built = await buildZoomTiles(path, { minSourcePx: 3520, dir });
    expect(built).not.toBeNull();
    if (!built) return;
    try {
      expect(built.size).toEqual({ w: 5000, h: 3000 });
      expect(zoomLevels(built.size).map((l) => [l.w, l.h, l.cols, l.rows])).toEqual([
        [5000, 3000, 5, 3],
        [2500, 1500, 3, 2],
      ]);
      expect(built.tiles.map((t) => t.rel).sort()).toEqual(zoomTilePaths(built.size).sort());
      // 右下の端の四角は、余りの大きさになっている。
      const edge = built.tiles.find((t) => t.rel === "0/4_2.webp");
      const meta = await sharp(edge!.path).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["webp", 5000 - 4096, 3000 - 2048]);
      const half = await sharp(built.tiles.find((t) => t.rel === "1/2_1.webp")!.path).metadata();
      expect([half.width, half.height]).toEqual([2500 - 2048, 1500 - 1024]);
    } finally {
      await built.cleanup();
    }
    expect((await readdir(dir)).filter((n) => n.startsWith("zoom-"))).toEqual([]);
  });

  test("上限より大きい元は縮め、縦位置の印（EXIF）も反映する", async () => {
    const path = await source("portrait.jpg", 6000, 4000, 6);
    const built = await buildZoomTiles(path, { minSourcePx: 3520, maxPx: 4500, dir });
    expect(built?.size).toEqual({ w: 3000, h: 4500 });
    await built?.cleanup();
  });
});

describe("runPooled", () => {
  test("同時に動くのは上限まで。失敗したら残りを始めない", async () => {
    let active = 0;
    let peak = 0;
    const done: number[] = [];
    await runPooled([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await Bun.sleep(5);
      active--;
      done.push(n);
    });
    expect(peak).toBe(3);
    expect(done.length).toBe(7);

    const started: number[] = [];
    await expect(
      runPooled([1, 2, 3, 4, 5, 6], 1, async (n) => {
        started.push(n);
        if (n === 2) throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(started).toEqual([1, 2]);
  });
});

describe("高精細の鍵（削除・取り消し）", () => {
  const { unsharedPhotoStorageKeys, uploadedPhotoStorageKeys } =
    require("./photo-integrity") as typeof import("./photo-integrity");
  const photo = {
    url: "/api/images/photos/1-abc.jpg",
    thumbKey: "thumbs/1-abc.webp",
    mediumKey: "medium/1-abc.webp",
  };

  test("完全削除は四角も消す。ほかの写真が同じ実体を使っていれば何も消さない", () => {
    const keys = unsharedPhotoStorageKeys({ ...photo, zoomSize: "2500x1500" }, false);
    expect(keys).toEqual([
      "photos/1-abc.jpg",
      "thumbs/1-abc.webp",
      "medium/1-abc.webp",
      ...["0_0", "1_0", "2_0", "0_1", "1_1", "2_1"].map((t) => `tiles/1-abc/0/${t}.webp`),
    ]);
    expect(unsharedPhotoStorageKeys({ ...photo, zoomSize: "2500x1500" }, true)).toEqual([]);
    expect(unsharedPhotoStorageKeys({ ...photo, zoomSize: null }, false)).toHaveLength(3);
  });

  test("登録に失敗したときの片付けは、その1枚の鍵から決まる四角だけ", () => {
    const keys = uploadedPhotoStorageKeys({ ...photo, zoomSize: "1200x900" });
    expect(keys).toContain("tiles/1-abc/0/0_0.webp");
    expect(keys).toContain("tiles/1-abc/0/1_0.webp");
    expect(keys).toHaveLength(5);
    // 形の違う大きさ・写真以外の鍵からは、四角の鍵を作らない。
    expect(uploadedPhotoStorageKeys({ ...photo, zoomSize: "../x" })).toHaveLength(3);
    expect(uploadedPhotoStorageKeys({ url: "/api/images/hero/x.jpg", zoomSize: "1200x900" })).toEqual([]);
  });
});
