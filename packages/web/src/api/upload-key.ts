import { randomUUID } from "node:crypto";

type UploadPrefix = "photos" | "hero" | "profile" | "fonts";

// Date.now() alone can repeat for simultaneous uploads with the same filename.
// Keep the readable timestamp/name, but add a UUID so one upload can never
// overwrite another object's master, thumbnail, or medium key.
export function uniqueUploadStorageKey(
  prefix: UploadPrefix,
  filename: string,
  timestamp = Date.now(),
  id = randomUUID(),
): string {
  return `${prefix}/${timestamp}-${id}-${filename}`;
}
