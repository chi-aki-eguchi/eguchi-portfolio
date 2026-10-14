import { readFileSync } from "node:fs";

/**
 * コンテナに割り当てられたメモリの上限（バイト）。読めない・上限なしは null。
 *
 * 2026-10-14、配布先で rss が 459MB まで増えた後に起動が9回続いた。rss だけでは
 * 上限に近かったのか分からない（Railway の上限はプランで違う）。cgroup v2 / v1 の順に読む。
 */
export function containerMemoryLimitBytes(
  read: (path: string) => string = (path) => readFileSync(path, "utf8"),
): number | null {
  for (const path of [
    "/sys/fs/cgroup/memory.max",
    "/sys/fs/cgroup/memory/memory.limit_in_bytes",
  ]) {
    let text: string;
    try {
      text = read(path).trim();
    } catch {
      continue;
    }
    if (text === "max") return null;
    const bytes = Number(text);
    // v1 は上限なしを巨大な数で表す。
    if (Number.isFinite(bytes) && bytes > 0 && bytes < 2 ** 60) return bytes;
    return null;
  }
  return null;
}

export const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024);
