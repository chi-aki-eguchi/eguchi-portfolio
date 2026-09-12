import { expect, test } from "bun:test";
import { matchDateRecoveryPhoto } from "./photo-date-recovery";

test("matches a unique original filename across exported extensions", () => {
  const photos = [{ id: 1, filename: "IMG_6609.tif" }];
  expect(matchDateRecoveryPhoto("IMG_6609.JPG", photos)?.id).toBe(1);
  expect(matchDateRecoveryPhoto("IMG_6610.JPG", photos)).toBeNull();
});
test("refuses ambiguous matches and prefers an exact name", () => {
  const photos = [
    { id: 1, filename: "IMG_6609.tif" },
    { id: 2, filename: "IMG_6609.jpg" },
  ];
  expect(matchDateRecoveryPhoto("IMG_6609.arw", photos)).toBeNull();
  expect(matchDateRecoveryPhoto("IMG_6609.jpg", photos)?.id).toBe(2);
  expect(
    matchDateRecoveryPhoto("IMG_6609.jpg", [photos[1], photos[1]]),
  ).toBeNull();
});
