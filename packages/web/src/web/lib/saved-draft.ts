export function draftAfterSuccessfulSave(
  saved: Readonly<Record<string, string>>,
  current: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => saved[key] !== value),
  );
}

/**
 * A persisted settings draft can retain keys after a value is changed back.
 * Once saved settings are available, compare only those draft keys and treat
 * a missing saved key as the same value as an empty string (the form renders
 * both as an empty field).
 */
export function hasUnsavedSettingsDraft(
  draft: Readonly<Record<string, string>>,
  saved: Readonly<Record<string, string>> | undefined,
): boolean {
  if (!saved) return Object.keys(draft).length > 0;

  return Object.entries(draft).some(
    ([key, value]) => value !== (saved[key] ?? ""),
  );
}
