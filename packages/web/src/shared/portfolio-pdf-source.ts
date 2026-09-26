/** Keys come only from a DB row, never from a client-provided URL. Japanese filenames are valid. */
export function portfolioSourceKey(reference: string): string | null {
  const match = /^\/api\/images\/(photos\/[^/\\?#]+)$/.exec(reference);
  if (!match || Array.from(match[1]).some(c => c.charCodeAt(0) < 32)) return null;
  return match[1];
}
