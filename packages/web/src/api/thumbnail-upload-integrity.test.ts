import { describe, expect, test } from "bun:test";
import { uploadAllOrCleanup } from "./thumbnail-upload-integrity";

describe("uploadAllOrCleanup", () => {
  test("returns every key when every derivative upload succeeds", async () => {
    const cleaned: string[] = [];
    await expect(
      uploadAllOrCleanup(
        [Promise.resolve("thumbs/a.webp"), Promise.resolve("medium/a.webp")],
        async (keys) => cleaned.push(...keys),
      ),
    ).resolves.toEqual(["thumbs/a.webp", "medium/a.webp"]);
    expect(cleaned).toEqual([]);
  });

  test("waits for an in-flight success then compensates it when its sibling fails", async () => {
    let finishMedium: ((key: string) => void) | undefined;
    const medium = new Promise<string>((resolve) => {
      finishMedium = resolve;
    });
    const cleaned: string[] = [];
    const result = uploadAllOrCleanup(
      [Promise.reject(new Error("thumbnail upload failed")), medium],
      async (keys) => cleaned.push(...keys),
    );

    await Promise.resolve();
    expect(cleaned).toEqual([]);
    finishMedium?.("medium/a.webp");

    await expect(result).rejects.toThrow("thumbnail upload failed");
    expect(cleaned).toEqual(["medium/a.webp"]);
  });
});
