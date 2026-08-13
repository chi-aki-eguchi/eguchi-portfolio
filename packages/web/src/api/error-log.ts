const MAX_ERROR_CAUSE_DEPTH = 4;

const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"']+/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /(\b(?:password|passwd|pwd|token|secret|api[_-]?key|authorization)\b\s*(?:=|:)\s*)(?:"[^"]*"|'[^']*'|Bearer\s+[^\s,;]+|[^\s,;]+)/gi;

function redactSensitiveErrorText(text: string): string {
  return text
    .replace(URL_PATTERN, "[redacted URL]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1[redacted]");
}

function errorRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function errorPart(record: Record<string, unknown>): string {
  const name =
    typeof record.name === "string" && record.name
      ? redactSensitiveErrorText(record.name)
      : "Error";
  const message =
    typeof record.message === "string" && record.message
      ? redactSensitiveErrorText(record.message)
      : "No error message";
  const code =
    typeof record.code === "string" || typeof record.code === "number"
      ? " [code=" + redactSensitiveErrorText(String(record.code)) + "]"
      : "";

  return name + code + ": " + message;
}

// Drizzle preserves the PostgreSQL error as a cause, while its outer error only
// says that a query failed. Log both messages so missing-column and constraint
// reasons survive in Railway logs, but never print an error object or stack:
// either could include a connection URL or credential-bearing configuration.
export function errorDetailsForLog(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth < MAX_ERROR_CAUSE_DEPTH; depth++) {
    const record = errorRecord(current);
    if (!record || seen.has(current)) break;
    seen.add(current);
    parts.push(errorPart(record));
    current = record.cause;
  }

  return parts.length > 0
    ? parts.join(" <- caused by: ")
    : "Unknown non-object error";
}
