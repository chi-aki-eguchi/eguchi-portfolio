import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MAX_ID_LIST_LENGTH,
  idListError,
  isJsonObject,
  parseIdList,
} from "./request-input";

describe("isJsonObject", () => {
  test("accepts a plain object", () => {
    expect(isJsonObject({})).toBe(true);
    expect(isJsonObject({ ids: [1] })).toBe(true);
  });

  // ここを通していたせいで、各ルートの分解代入が TypeError になり 500 で
  // 返っていた。呼び出し側の誤りはサーバ障害と区別できる必要がある。
  test("rejects the shapes that used to crash the handlers", () => {
    expect(isJsonObject(null)).toBe(false);
    expect(isJsonObject(undefined)).toBe(false);
    expect(isJsonObject([1, 2, 3])).toBe(false);
    expect(isJsonObject("ids")).toBe(false);
    expect(isJsonObject(42)).toBe(false);
    expect(isJsonObject(true)).toBe(false);
  });
});

describe("parseIdList", () => {
  test("keeps the existing behavior of dropping non-integer entries", () => {
    expect(parseIdList([1, "2", 3.5, null, 4])).toEqual({
      ok: true,
      ids: [1, 4],
    });
  });

  test("rejects anything that is not a list", () => {
    for (const value of [null, undefined, "1,2", 7, { 0: 1 }]) {
      expect(parseIdList(value)).toEqual({ ok: false, reason: "NOT_A_LIST" });
    }
  });

  test("accepts a list right at the limit", () => {
    const ids = Array.from({ length: MAX_ID_LIST_LENGTH }, (_, i) => i + 1);
    expect(parseIdList(ids)).toEqual({ ok: true, ids });
  });

  test("rejects one item past the limit instead of building a huge query", () => {
    const ids = Array.from({ length: MAX_ID_LIST_LENGTH + 1 }, (_, i) => i + 1);
    expect(parseIdList(ids)).toEqual({ ok: false, reason: "TOO_MANY" });
  });

  test("drops zero and negatives only when asked", () => {
    expect(parseIdList([-1, 0, 2])).toEqual({ ok: true, ids: [-1, 0, 2] });
    expect(parseIdList([-1, 0, 2], { positiveOnly: true })).toEqual({
      ok: true,
      ids: [2],
    });
  });

  test("an empty list is a valid list, not a malformed one", () => {
    expect(parseIdList([])).toEqual({ ok: true, ids: [] });
  });
});

describe("idListError", () => {
  test("tells the user what to do about a too-large selection", () => {
    expect(idListError("TOO_MANY")).toContain(String(MAX_ID_LIST_LENGTH));
    expect(idListError("NOT_A_LIST")).not.toContain(
      String(MAX_ID_LIST_LENGTH),
    );
  });
});

// 入口のミドルウェアは実ルートを起動しないと動かせないため、ここは配線だけを
// 見る。検証の中身は上のテストが実際に動かして確かめている。
describe("write-entry validation wiring", () => {
  const source = readFileSync(import.meta.dir + "/index.ts", "utf8");

  test("the JSON body guard runs before any route and skips non-JSON bodies", () => {
    const guard = source.slice(
      source.indexOf("if (c.req.method === \"GET\" || c.req.method === \"HEAD\")"),
      source.indexOf("// ── Health"),
    );
    expect(guard).toContain("application/json");
    expect(guard).toMatch(/if \(!isJsonObject\(body\)\)/);
    expect(guard).toContain("400");
    // ルート定義より前に置かれていること。あとに置くと素通りする。
    expect(source.indexOf("isJsonObject(body)")).toBeLessThan(
      source.indexOf('.post("/admin/'),
    );
  });

  test("no route builds an id list without the shared limit", () => {
    // 上限を通さない自前の整数フィルタが復活していないことを見る。
    expect(source).not.toMatch(/filter\(\(n\): n is number => Number\.isInteger/);
    expect(source).toContain("parseIdList(ids)");
    expect(source).toContain("parseIdList(photoIds, { positiveOnly: true })");
  });
});
