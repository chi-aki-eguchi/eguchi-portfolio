import { useState } from "react";

/**
 * What a visitor sees while a section's content is still coming, or when it
 * never came. Owner's rule (2026-08-05):
 *
 *   読み込み中なら読み込み中って出して欲しいし、エラーなら再読み込みを出して
 *   欲しい。それでもだめなら原因分かれば原因を出して、ダメだったらエラーでいい。
 *
 * So: say it is loading → offer a reload → if that reload also fails, name the
 * cause when we can tell → otherwise a plain error. The step only escalates
 * after the visitor has actually tried again, so a single blip stays quiet.
 *
 * This replaces sections that simply rendered nothing, which read as "this site
 * has no work" rather than "this did not load".
 */

/** Turn a thrown error into something worth showing a visitor, or null. */
export function describeLoadError(
  error: unknown,
  language: "ja" | "en" = "ja",
): string | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  // jsonOrThrow throws `HTTP <status>`; fetch itself throws a TypeError when the
  // request never reached the server at all.
  const status = Number(message.match(/^HTTP (\d{3})$/)?.[1]);
  if (status === 429)
    return language === "en"
      ? "Too many requests just now. Please wait a moment."
      : "アクセスが集中しています。少し待ってから試してください。";
  if (status === 404)
    return language === "en" ? "This content is no longer here." : "この内容は見つかりませんでした。";
  if (status >= 500)
    return language === "en"
      ? "The server had trouble responding."
      : "サーバーが応答できませんでした。";
  if (/fetch|network|Load failed/i.test(message))
    return language === "en"
      ? "The connection dropped."
      : "通信が切れているようです。";
  return null; // cause unknown — the caller falls back to a plain error
}

export function ContentStatus({
  state,
  onRetry,
  error,
  language = "ja",
  className = "",
}: {
  state: "loading" | "error";
  onRetry?: () => void;
  error?: unknown;
  language?: "ja" | "en";
  className?: string;
}) {
  const [retried, setRetried] = useState(false);

  if (state === "loading")
    return (
      // <output> is the semantic element for a live status region; oxlint's
      // prefer-tag-over-role rejects role="status" on a div.
      <output
        aria-live="polite"
        className={`block py-16 text-center ${className}`}
      >
        <p
          className="font-en text-xs tracking-[0.08em]"
          style={{ color: "var(--section-label-color)" }}
        >
          {language === "en" ? "Loading…" : "読み込み中…"}
        </p>
      </output>
    );

  // Only after the visitor has tried again do we get more specific — one blip
  // does not deserve a diagnosis.
  const cause = retried ? describeLoadError(error, language) : null;
  const headline = !retried
    ? language === "en"
      ? "Could not load this."
      : "読み込めませんでした。"
    : (cause ??
      (language === "en"
        ? "Still could not load this."
        : "やはり読み込めませんでした。"));

  return (
    <div role="alert" className={`py-16 text-center ${className}`}>
      <p
        className="text-xs tracking-[0.04em] mb-5"
        style={{ color: "var(--text-quiet)" }}
      >
        {headline}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={() => {
            setRetried(true);
            onRetry();
          }}
          className="tap-target font-en text-xs tracking-[0.08em] pt-1.5 pb-1.5 border-b-[1.5px] border-[rgba(var(--foreground-rgb),0.3)] text-[color:var(--text-quiet)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors duration-300"
        >
          {language === "en" ? "Reload" : "再読み込み"}
        </button>
      )}
    </div>
  );
}
