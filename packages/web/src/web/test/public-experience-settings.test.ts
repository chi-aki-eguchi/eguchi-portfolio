import { describe, expect, test } from "bun:test";
import { SETTINGS_PREVIEW_KEYS, makeSettingsPreviewPayload } from "../lib/settings-preview";

const settingsApiSource = await Bun.file(
  new URL("../../api/index.ts", import.meta.url).pathname,
).text();

const adminTabsSource = await Bun.file(
  new URL("../pages/admin-tabs.tsx", import.meta.url).pathname,
).text();

const providerSource = await Bun.file(
  new URL("../components/provider.tsx", import.meta.url).pathname,
).text();

describe("public experience setting", () => {
  test("is allowlisted and included in preview payload", () => {
    expect(SETTINGS_PREVIEW_KEYS.includes("publicExperience" as const)).toBe(true);
    expect(makeSettingsPreviewPayload({}).publicExperience).toBe("");
    expect(
      makeSettingsPreviewPayload({ publicExperience: "photo-app" }).publicExperience,
    ).toBe("photo-app");
    expect(
      makeSettingsPreviewPayload({ publicExperience: "portfolio" }).publicExperience,
    ).toBe("portfolio");
  });

  test("is registered under mood in Settings tab and renders bilingual selector labels", () => {
    expect(adminTabsSource).toMatch(/mood:\s*\["publicExperience"\]/);
    expect(adminTabsSource).toContain("publicExperienceCopy.label");
    expect(adminTabsSource).toContain("Photo app");
    expect(adminTabsSource).toContain("Classic portfolio");
    expect(adminTabsSource).toContain("サイトの表示");
  });

  test("API GET /settings normalizes publicExperience with a reversible default", () => {
    expect(settingsApiSource).toMatch(
      /publicExperience:\s*settings\.publicExperience === "photo-app" \? "photo-app" : "portfolio"/,
    );
  });

  test("provider applies publicExperience onto document.documentElement dataset", () => {
    expect(providerSource).toContain("dataset.publicExperience");
    expect(providerSource).toContain("applyPublicExperience(s.publicExperience)");
    expect(providerSource).toContain("applyPublicExperience(data.publicExperience)");
  });
});
