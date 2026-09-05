import { expect, test } from "bun:test";
import {
  bumpPublicContentVersion,
  publicContentVersion,
} from "./public-content-version";

test("admin writes can advance the public cache generation", () => {
  const before = publicContentVersion();
  bumpPublicContentVersion();
  expect(publicContentVersion()).toBe(before + 1);
});
