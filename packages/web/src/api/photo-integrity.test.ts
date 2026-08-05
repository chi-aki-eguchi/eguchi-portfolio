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
          thumbKey: "thumbs/a.webp",
          mediumKey: "medium/a.webp",
        },
        false,
      ),
    ).toEqual(["photos/a.jpg", "thumbs/a.webp", "medium/a.webp"]);
  });

  // The real key layout: the master lives under photos/, and its two derived
  // versions under thumbs/ and medium/ (thumbKeyFrom / mediumKeyFrom in
  // api/index.ts). The previous fixtures put every key under photos/, which is
  // why they could not catch the derived images being skipped.
  test("registration compensation covers the derived images, not just the master", () => {
    expect(
      uploadedPhotoStorageKeys({
        url: "/api/images/photos/1700000000000-a.jpg",
        thumbKey: "thumbs/1700000000000-a.webp",
        mediumKey: "medium/1700000000000-a.webp",
      }),
    ).toEqual([
      "photos/1700000000000-a.jpg",
      "thumbs/1700000000000-a.webp",
      "medium/1700000000000-a.webp",
    ]);
  });

  test("registration compensation cannot delete keys outside its upload area", () => {
    // A master that is not this endpoint's own upload area yields nothing.
    expect(
      uploadedPhotoStorageKeys({
        url: "/api/images/hero/current.jpg",
        thumbKey: "thumbs/current.webp",
        mediumKey: "medium/current.webp",
      }),
    ).toEqual([]);
    // Derived keys that do not belong to the submitted master are dropped, so a
    // crafted body cannot point the cleanup at somebody else's objects.
    expect(
      uploadedPhotoStorageKeys({
        url: "/api/images/photos/mine.jpg",
        thumbKey: "thumbs/someone-else.webp",
        mediumKey: "medium/../../hero/current.webp",
      }),
    ).toEqual(["photos/mine.jpg"]);
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
