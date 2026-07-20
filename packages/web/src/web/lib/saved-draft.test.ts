import { describe, expect, test } from "bun:test";
import { draftAfterSuccessfulSave } from "./saved-draft";

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
