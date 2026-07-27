import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const apiSource = readFileSync(import.meta.dir + "/index.ts", "utf8");
const adminSource = readFileSync(
  import.meta.dir + "/../web/pages/admin.tsx",
  "utf8",
);

function section(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe("photo source metadata wiring", () => {
  test("the upload route reads original metadata once and returns every extracted value", () => {
    const route = section(
      apiSource,
      '.post("/admin/upload"',
      "// ── Admin: Hero image upload",
    );
    expect(route.match(/sharp\(inputBuf\)\.metadata\(\)/g)).toHaveLength(1);
    expect(route).toContain(
      "sourceMetadataFromSharpMetadata(originalMetadata)",
    );
    for (const key of [
      "sourceWidth",
      "sourceHeight",
      "sourceFormat",
      "exifMake",
      "exifModel",
      "exifDateDigitized",
    ]) {
      expect(route).toContain(`${key},`);
    }
  });

  test("the admin passes all seven values to photo registration without displaying them", () => {
    const upload = section(
      adminSource,
      "const uploadOne = async",
      "const workers =",
    );
    expect(upload).toContain("shotAtWithSourceForUploadedPhoto(");
    for (const mapping of [
      "shotAtSource: shotAtSourceVal",
      "shotAtDigitized: (exifDateDigitized as string) ?? \"\"",
      "sourceWidth: (sourceWidth as number) ?? null",
      "sourceHeight: (sourceHeight as number) ?? null",
      "sourceFormat: (sourceFormat as string) ?? null",
      'cameraMake: isDigital ? ((exifMake as string) ?? "") : ""',
      'cameraModel: isDigital ? ((exifModel as string) ?? "") : ""',
    ]) {
      expect(upload).toContain(mapping);
    }
  });

  test("photo registration saves the seven columns and normalizes their closed-set values", () => {
    const route = section(
      apiSource,
      '.post("/admin/photos"',
      "// ── Admin: Update photo",
    );
    expect(route).toContain(
      "shotAtSource: normalizeShotAtSourceForInsert(body.shotAtSource)",
    );
    expect(route).toContain(
      "sourceFormat: normalizeSourceFormatForInsert(body.sourceFormat)",
    );
    for (const key of [
      "shotAtDigitized",
      "sourceWidth",
      "sourceHeight",
      "sourceFormat",
      "cameraMake",
      "cameraModel",
    ]) {
      expect(route).toContain(`${key}:`);
    }
    expect(route).not.toContain('"legacy"');
  });

  test("all three manual date paths update shotAtSource in the same write", () => {
    const patch = section(
      apiSource,
      '.patch("/admin/photos/:id"',
      "// ── Admin: Duplicate a photo",
    );
    expect(patch).toContain("buildShotAtPatchUpdate(body.shotAt");

    const batch = section(
      apiSource,
      'case "shotAt_missing_only"',
      'case "size"',
    );
    expect(batch).toContain(
      '.set({ shotAt: date, shotAtSource: "manual" })',
    );
    expect(batch).toContain(
      '.set({ shotAt: null, shotAtSource: "none" })',
    );
  });
});
