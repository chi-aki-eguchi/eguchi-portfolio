import { expect, test } from "bun:test";
import { containerMemoryLimitBytes } from "./process-diagnostics";

const files = (map: Record<string, string>) => (path: string) => {
  if (path in map) return map[path];
  throw new Error("ENOENT");
};

test("cgroup v2 の上限を読む。max は上限なし", () => {
  expect(containerMemoryLimitBytes(files({ "/sys/fs/cgroup/memory.max": "536870912\n" }))).toBe(536870912);
  expect(containerMemoryLimitBytes(files({ "/sys/fs/cgroup/memory.max": "max\n" }))).toBeNull();
});

test("v2 が無ければ v1 を読み、上限なしを表す巨大な数は null", () => {
  const v1 = "/sys/fs/cgroup/memory/memory.limit_in_bytes";
  expect(containerMemoryLimitBytes(files({ [v1]: "1073741824" }))).toBe(1073741824);
  expect(containerMemoryLimitBytes(files({ [v1]: "9223372036854771712" }))).toBeNull();
  expect(containerMemoryLimitBytes(files({}))).toBeNull();
});
