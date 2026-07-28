import { describe, expect, test } from "bun:test";
import {
  draftAfterSuccessfulSave,
  hasUnsavedSettingsDraft,
} from "./saved-draft";

describe("draftAfterSuccessfulSave", () => {
  test("clears only values that were actually included in the save", () => {
    expect(
      draftAfterSuccessfulSave(
        { bio: "sent", location: "Tokyo" },
        { bio: "edited while saving", location: "Tokyo", note: "new" },
      ),
    ).toEqual({ bio: "edited while saving", note: "new" });
  });

  test("clears the whole draft when nothing changed during the request", () => {
    expect(draftAfterSuccessfulSave({ bio: "sent" }, { bio: "sent" })).toEqual(
      {},
    );
  });
});

describe("hasUnsavedSettingsDraft", () => {
  test("does not report a draft value that was changed back to its saved value", () => {
    expect(
      hasUnsavedSettingsDraft(
        { siteName: "Akiko Eguchi" },
        { siteName: "Akiko Eguchi" },
      ),
    ).toBe(false);
  });

  test("reports a draft value that differs from the saved value", () => {
    expect(
      hasUnsavedSettingsDraft(
        { siteName: "New name" },
        { siteName: "Akiko Eguchi" },
      ),
    ).toBe(true);
  });

  test("keeps a non-empty persisted draft unsafe until saved settings load", () => {
    expect(hasUnsavedSettingsDraft({ siteName: "New name" }, undefined)).toBe(
      true,
    );
    expect(hasUnsavedSettingsDraft({}, undefined)).toBe(false);
  });

  test("treats a missing saved key and an empty string as the same field value", () => {
    expect(hasUnsavedSettingsDraft({ footerText: "" }, {})).toBe(false);
    expect(hasUnsavedSettingsDraft({ footerText: "x" }, {})).toBe(true);
  });
});
