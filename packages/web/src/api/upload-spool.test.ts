import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spoolUpload } from "./upload-spool";

const dir = await mkdtemp(join(tmpdir(), "upload-spool-test-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

const options = {
  maxBytes: 10,
  accept: (file: { name: string }) => file.name.endsWith(".jpg"),
  dir,
};
const raw = (body: string, name = "写真 1.jpg") =>
  new Request("http://x/", {
    method: "POST",
    body,
    headers: {
      "content-type": "image/jpeg",
      "x-upload-filename": encodeURIComponent(name),
    },
  });

describe("spoolUpload", () => {
  test("writes a raw body to a temp file and removes it on cleanup", async () => {
    const result = await spoolUpload(raw("12345"), options);
    if (!result.ok) throw new Error(result.reason);
    expect(result.upload.name).toBe("写真 1.jpg");
    expect(result.upload.type).toBe("image/jpeg");
    expect(result.upload.size).toBe(5);
    expect(await Bun.file(result.upload.path).text()).toBe("12345");
    await result.upload.cleanup();
    expect(await readdir(dir)).toEqual([]);
  });

  test("still accepts a multipart file", async () => {
    const form = new FormData();
    form.append("file", new File(["abc"], "old.jpg", { type: "image/jpeg" }));
    const result = await spoolUpload(
      new Request("http://x/", { method: "POST", body: form }),
      options,
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.upload.name).toBe("old.jpg");
    expect(await Bun.file(result.upload.path).text()).toBe("abc");
    await result.upload.cleanup();
  });

  test("refuses without leaving a file behind", async () => {
    expect(await spoolUpload(raw("12345678901"), options)).toEqual({
      ok: false,
      reason: "too-large",
    });
    expect(await spoolUpload(raw("1", "notes.txt"), options)).toEqual({
      ok: false,
      reason: "type",
    });
    expect(await spoolUpload(raw(""), options)).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(await readdir(dir)).toEqual([]);
  });
});
