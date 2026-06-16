import { describe, test, expect } from "bun:test";
import { moveRelativeToViewNeighbor, moveToViewEdge } from "./reorder";

// Library: a..d are other photos; s/c belong to the filtered series view.
// all = [a(1), s(2), b(3), c(4), d(5)]   view = [s(2), c(4)]
const all = [1, 2, 3, 4, 5];
const view = [2, 4];

describe("moveRelativeToViewNeighbor", () => {
  test("unfiltered: behaves as a plain adjacent move", () => {
    expect(moveRelativeToViewNeighbor(all, all, 2, 1)).toEqual([1, 3, 2, 4, 5]);
    expect(moveRelativeToViewNeighbor(all, all, 2, -1)).toEqual([2, 1, 3, 4, 5]);
  });

  test("series scope: ±1 means swapping with the next/prev SERIES member", () => {
    // s down past c: must land AFTER c globally (a global +1 would only pass b
    // and change nothing visibly in the series view).
    expect(moveRelativeToViewNeighbor(all, view, 2, 1)).toEqual([1, 3, 4, 2, 5]);
    // c up past s: lands immediately BEFORE s.
    expect(moveRelativeToViewNeighbor(all, view, 4, -1)).toEqual([1, 4, 2, 3, 5]);
  });

  test("visible edges are no-ops (null)", () => {
    expect(moveRelativeToViewNeighbor(all, view, 2, -1)).toBeNull(); // s is first in view
    expect(moveRelativeToViewNeighbor(all, view, 4, 1)).toBeNull();  // c is last in view
    expect(moveRelativeToViewNeighbor(all, view, 99, 1)).toBeNull(); // unknown id
  });
});

describe("moveToViewEdge", () => {
  test("unfiltered: start/end of the whole library", () => {
    expect(moveToViewEdge(all, all, 3, "start")).toEqual([3, 1, 2, 4, 5]);
    expect(moveToViewEdge(all, all, 3, "end")).toEqual([1, 2, 4, 5, 3]);
  });

  test("series scope: anchored to the first/last series member, not the library", () => {
    // c to series start: before s — NOT position 0 of the library.
    expect(moveToViewEdge(all, view, 4, "start")).toEqual([1, 4, 2, 3, 5]);
    // s to series end: after c — NOT the library tail.
    expect(moveToViewEdge(all, view, 2, "end")).toEqual([1, 3, 4, 2, 5]);
  });

  test("single visible photo is a no-op (null)", () => {
    expect(moveToViewEdge(all, [2], 2, "start")).toBeNull();
  });
});
