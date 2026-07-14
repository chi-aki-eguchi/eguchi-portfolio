import { describe, expect, test } from "bun:test";
import { createSerialQueue } from "./serial-queue";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createSerialQueue", () => {
  test("2つのタスクが重ならず順番に実行される", async () => {
    const queue = createSerialQueue();
    const events: string[] = [];
    const a = queue(async () => {
      events.push("a-start");
      await tick();
      await tick();
      events.push("a-end");
    });
    const b = queue(async () => {
      events.push("b-start");
      events.push("b-end");
    });
    await Promise.all([a, b]);
    expect(events).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });

  test("前のタスクが失敗しても後続は実行され、失敗は伝播しない", async () => {
    const queue = createSerialQueue();
    const first = queue(async () => {
      throw new Error("boom");
    });
    const second = queue(async () => "ok");
    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
  });

  test("タスクの戻り値がそのまま返る", async () => {
    const queue = createSerialQueue();
    await expect(queue(async () => 42)).resolves.toBe(42);
  });
});
