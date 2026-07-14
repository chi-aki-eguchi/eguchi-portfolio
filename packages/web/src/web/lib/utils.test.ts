import { describe, test, expect } from "bun:test";
import { num, clamp, httpHrefOrNull, safeHref } from "./utils";

describe("num", () => {
  test("parses a valid number string", () => {
    expect(num("42", 0)).toBe(42);
    expect(num("3.14", 0)).toBe(3.14);
  });

  test("returns default for undefined", () => {
    expect(num(undefined, 10)).toBe(10);
  });

  test("returns default for empty string", () => {
    expect(num("", 5)).toBe(5);
  });

  test("returns default for non-numeric string", () => {
    expect(num("abc", 7)).toBe(7);
  });

  test("parses negative numbers", () => {
    expect(num("-1.5", 0)).toBe(-1.5);
  });
});

describe("clamp", () => {
  test("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test("clamps to lower bound", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  test("clamps to upper bound", () => {
    expect(clamp(20, 0, 10)).toBe(10);
  });

  test("handles equal bounds", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

describe("safeHref", () => {
  test("allows http URLs", () => {
    expect(safeHref("http://example.com")).toBe("http://example.com");
  });

  test("allows https URLs", () => {
    expect(safeHref("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
  });

  test("allows mailto links", () => {
    expect(safeHref("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  test("blocks javascript: protocol", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
  });

  test("blocks javascript: with mixed case", () => {
    expect(safeHref("JavaScript:alert(1)")).toBe("#");
    expect(safeHref("JAVASCRIPT:void(0)")).toBe("#");
  });

  test("blocks data: URIs", () => {
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  test("blocks vbscript: protocol", () => {
    expect(safeHref("vbscript:MsgBox")).toBe("#");
  });

  test("blocks empty string", () => {
    expect(safeHref("")).toBe("#");
  });

  test("blocks relative paths (no protocol)", () => {
    expect(safeHref("/some/path")).toBe("#");
  });

  test("is case insensitive for allowed protocols", () => {
    expect(safeHref("HTTPS://example.com")).toBe("HTTPS://example.com");
    expect(safeHref("HTTP://example.com")).toBe("HTTP://example.com");
    expect(safeHref("MAILTO:x@y.z")).toBe("MAILTO:x@y.z");
  });
});

describe("httpHrefOrNull", () => {
  test("allows absolute HTTP and HTTPS URLs", () => {
    expect(httpHrefOrNull("http://example.com")).toBe("http://example.com");
    expect(httpHrefOrNull(" https://example.com/service ")).toBe(
      "https://example.com/service",
    );
  });

  test("blocks executable and non-web schemes", () => {
    expect(httpHrefOrNull("javascript:alert(1)")).toBeNull();
    expect(httpHrefOrNull("data:text/html,test")).toBeNull();
    expect(httpHrefOrNull("mailto:user@example.com")).toBeNull();
  });

  test("blocks empty, relative, and malformed URLs", () => {
    expect(httpHrefOrNull("")).toBeNull();
    expect(httpHrefOrNull("/service")).toBeNull();
    expect(httpHrefOrNull("not a URL")).toBeNull();
  });
});
