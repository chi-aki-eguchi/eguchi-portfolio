export function draftAfterSuccessfulSave(
  saved: Readonly<Record<string, string>>,
  current: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => saved[key] !== value),
  );
}
