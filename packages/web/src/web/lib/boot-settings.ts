import type { QueryClient } from "@tanstack/react-query";

/**
 * サーバーが HTML に入れた設定（`api/boot-settings.ts`、/api/settings と同じ中身）を、
 * 取り寄せずにそのまま使う（2026-10-02）。無い・壊れているときは null（今までどおり取り寄せる）。
 */
export function readBootSettings(doc: Document = document): Record<string, unknown> | null {
  const text = doc.getElementById("boot-settings")?.textContent;
  if (!text) return null;
  try {
    const data: unknown = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 設定を先に入れられたら true。入れた設定は取り寄せた物と同じく 60 秒は新しいまま扱われる。 */
export function seedBootSettings(queryClient: QueryClient, doc: Document = document): boolean {
  const data = readBootSettings(doc);
  if (!data) return false;
  queryClient.setQueryData(["settings"], data);
  return true;
}
