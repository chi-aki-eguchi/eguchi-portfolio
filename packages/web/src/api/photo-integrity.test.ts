import { describe, expect, test } from "bun:test";
import {
  purgeEligibility,
  unsharedPhotoStorageKeys,
  uploadedPhotoStorageKeys,
  withUploadRegistrationCompensation,
  purgeDbThenStorage,
} from "./photo-integrity";

describe("photo purge integrity", () => {
  test("a photo restored after the retention candidate list was built is skipped", () => {
    expect(purgeEligibility({ deletedAt: null }, new Date("2026-06-21"))).toBe(
      "restored",
    );
  });

  test("a normal public photo cannot be purged directly", () => {
    expect(purgeEligibility({ deletedAt: null })).toBe("not-trashed");
  });

  test("a newly trashed photo no longer older than the cutoff is skipped", () => {
    expect(
      purgeEligibility(
        { deletedAt: new Date("2026-07-20") },
        new Date("2026-06-21"),
      ),
    ).toBe("restored");
  });

  test("shared R2 objects are retained after one duplicate row is purged", () => {
    expect(
      unsharedPhotoStorageKeys(
        {
          url: "/api/images/photos/a.jpg",
          thumbKey: "photos/a-thumb.webp",
          mediumKey: "photos/a-medium.webp",
        },
        true,
      ),
    ).toEqual([]);
  });

  test("unshared master and derivatives are all cleanup candidates", () => {
    expect(
      unsharedPhotoStorageKeys(
        {
          url: "/api/images/photos/a.jpg",
          thumbKey: "photos/a-thumb.webp",
          mediumKey: "photos/a-medium.webp",
        },
        false,
      ),
    ).toEqual([
      "photos/a.jpg",
      "photos/a-thumb.webp",
      "photos/a-medium.webp",
    ]);
  });

  test("registration compensation cannot delete keys outside its upload area", () => {
    expect(
      uploadedPhotoStorageKeys({
        url: "/api/images/hero/current.jpg",
        thumbKey: "photos/new-thumb.webp",
        mediumKey: "photos/new-thumb.webp",
      }),
    ).toEqual(["photos/new-thumb.webp"]);
  });

  test("registration failure compensates by deleting the newly uploaded objects", async () => {
    const deleted: string[] = [];
    await expect(
      withUploadRegistrationCompensation(
        ["photos/new.jpg", "photos/new-thumb.webp"],
        async () => {
          throw new Error("DB insert failed");
        },
        async (keys) => deleted.push(...keys),
      ),
    ).rejects.toThrow("DB insert failed");
    expect(deleted).toEqual(["photos/new.jpg", "photos/new-thumb.webp"]);
  });

  test("storage deletion starts only after the DB purge succeeds", async () => {
    const events: string[] = [];
    await purgeDbThenStorage(
      async () => {
        events.push("db-committed");
        return { storageKeys: ["photos/a.jpg"] };
      },
      async () => events.push("r2-deleted"),
    );
    expect(events).toEqual(["db-committed", "r2-deleted"]);
  });

  test("storage is untouched when the DB purge fails", async () => {
    let storageTouched = false;
    await expect(
      purgeDbThenStorage(
        async () => {
          throw new Error("DB delete failed");
        },
        async () => {
          storageTouched = true;
        },
      ),
    ).rejects.toThrow("DB delete failed");
    expect(storageTouched).toBe(false);
  });
});
