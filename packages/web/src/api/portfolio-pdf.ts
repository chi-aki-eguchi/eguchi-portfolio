import { Hono, type MiddlewareHandler } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import { portfolioSourceKey } from "../shared/portfolio-pdf-source";
import { db, schema, withRetry } from "./database";

// Only authenticated, read-only access. No caller-controlled storage URL/key.
export function portfolioPdfRoutes(
  auth: MiddlewareHandler,
  read: (key: string) => Promise<{ buf: Buffer }>,
  transform: <T>(signal: AbortSignal, run: () => Promise<T>) => Promise<T>,
) {
  return new Hono()
    .use("*", async (c, next) => {
      c.header("Cache-Control", "private, no-store");
      await next();
    })
    .use("*", auth)
    .get("/photos", async (c) => {
      const photos = await withRetry(() =>
        db
          .select({
            id: schema.photos.id,
            sourceAssetReference: schema.photos.url,
            title: schema.photos.title,
            description: schema.photos.description,
            rotation: schema.photos.rotationDeg,
            isPublished: schema.photos.isPublished,
          })
          .from(schema.photos)
          .where(isNull(schema.photos.deletedAt))
          .orderBy(schema.photos.sortOrder),
      );
      return c.json({ photos });
    })
    .get("/photos/:id/image", async (c) => {
      const id = Number(c.req.param("id"));
      if (!Number.isSafeInteger(id) || id <= 0)
        return c.json({ error: "画像が見つかりません" }, 404);
      const [photo] = await withRetry(() =>
        db
          .select({ url: schema.photos.url })
          .from(schema.photos)
          .where(and(eq(schema.photos.id, id), isNull(schema.photos.deletedAt)))
          .limit(1),
      );
      if (!photo) return c.json({ error: "画像が見つかりません" }, 404);
      // Uploads store /api/images/photos/<key>. Reject legacy/external URLs rather than fetch them.
      const key = portfolioSourceKey(photo.url);
      if (!key)
        return c.json(
          { error: "この保存形式はPDF出力に対応していません" },
          422,
        );
      try {
        const quality = c.req.query("quality");
        const edge =
          quality === "print" ? 3200 : quality === "thumb" ? 320 : 1600;
        // sharp removes EXIF/ICC by default; pixels converted to sRGB, never upscaled.
        // Share the public image queue so HTTP/2 thumbnail bursts cannot decode
        // many full-size source images at once. Read inside the same bound.
        const data = await transform(c.req.raw.signal, async () => {
          const { buf } = await read(key);
          return sharp(buf)
          .rotate()
          .resize({
            width: edge,
            height: edge,
            fit: "inside",
            withoutEnlargement: true,
          })
          .flatten({ background: "#fff" })
          .jpeg({ quality: quality === "print" ? 95 : 78 })
          .toBuffer();
        });
        c.header("Content-Type", "image/jpeg");
        return c.body(new Uint8Array(data));
      } catch {
        return c.json(
          {
            error:
              "保存画像を読み込めません。接続と元画像を確認して再試行してください",
          },
          502,
        );
      }
    });
}
