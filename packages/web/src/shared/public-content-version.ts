// API writes and HTML/OGP delivery run in the same Bun process. A small
// generation counter lets the server invalidate public caches immediately
// after an admin mutation without adding a database query to every request.
let version = 0;

export function bumpPublicContentVersion(): void {
  version += 1;
}

export function publicContentVersion(): number {
  return version;
}
