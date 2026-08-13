import { expect, test, type Page, type Route } from "@playwright/test";

const ADMIN_SETTINGS = {
  setupCompleted: "true",
  siteName: "Contact validation fixture",
  siteNameEn: "Contact validation fixture",
  siteDescription: "Artificial settings used only by this browser check.",
  servicePageMode: "off",
  contactEmail: "",
  formspreeUrl: "",
};

function json(value: unknown) {
  return (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
}

async function installAdminMocks(
  page: Page,
  initialSettings: Record<string, string> = ADMIN_SETTINGS,
) {
  const currentSettings = { ...initialSettings };
  const settingsWrites: Record<string, string>[] = [];
  const blockedWrites: string[] = [];

  // Register the catch-all first: later, explicit routes win. Any unlisted
  // mutation is fulfilled locally, never sent to the development API/DB.
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      blockedWrites.push(`${request.method()} ${request.url()}`);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "write blocked by contact settings smoke" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.route("**/api/admin/me**", json({ authenticated: true }));
  await page.route("**/api/admin/photos/trash**", json({ photos: [] }));
  await page.route("**/api/photos**", json({ photos: [] }));
  await page.route("**/api/categories**", json({ categories: [] }));
  await page.route("**/api/series**", json({ series: [] }));
  await page.route("**/api/hero-photos**", json({ heroPhotos: [] }));
  await page.route("**/api/pricing**", json({ plans: [] }));
  await page.route("**/api/note-posts**", json({ posts: [] }));
  await page.route("**/api/settings**", json(currentSettings));
  await page.route("**/api/admin/settings**", async (route) => {
    const payload = route.request().postDataJSON() as Record<string, string>;
    settingsWrites.push(payload);
    Object.assign(currentSettings, payload);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, ignoredKeys: [] }),
    });
  });

  return { settingsWrites, blockedWrites };
}

async function openSettings(
  page: Page,
  options: { language: "ja" | "en"; theme: "light" | "dark"; width: number },
) {
  await page.setViewportSize({ width: options.width, height: 900 });
  await page.addInitScript((next) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("admin:tab", JSON.stringify("settings"));
    localStorage.setItem("admin:language", next.language);
    localStorage.setItem("theme-preference", next.theme);
  }, options);
  await page.goto("/admin");
  await page.waitForSelector(".admin-atelier", { timeout: 20_000 });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading..."),
    undefined,
    { timeout: 20_000 },
  );
}

async function openSiteBasicsThroughTheAdminUi(page: Page, width: number) {
  if (width >= 768) {
    await page.locator('[data-settings-section-link="site-basics"]').click();
  } else {
    await page
      .locator('.admin-settings-mobile-current > button[aria-expanded]')
      .click();
    await page
      .locator('[data-settings-mobile-section-list] [data-settings-sheet-link="site-basics"]')
      .click();
  }
  await expect(
    page.locator('[data-settings-section="site-basics"]'),
  ).toBeVisible();
}

async function installPublicMocks(page: Page) {
  const unexpectedRequests: string[] = [];
  await page.route("**/api/**", async (route) => {
    unexpectedRequests.push(`${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "unexpected public API request" }),
    });
  });
  await page.route("**/api/settings**", json({
    contactIntro: "Synthetic fallback copy.",
    contactEmail: "not-an-email",
    formspreeUrl: "http://not-secure.example.test/contact",
    profileInstagram: "https://example.test/instagram",
  }));
  await page.route("**/api/pricing**", json({ plans: [] }));
  // Layout decides whether to show the Series navigation from this read-only
  // list, even on Contact.
  await page.route("**/api/series**", json({ series: [] }));
  return { unexpectedRequests };
}

test.describe("admin — Contact setting validation", () => {
  test("invalid values stay local; corrected values save a trimmed payload", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop" && testInfo.project.name !== "mobile",
      "desktop light/JP と390px dark/ENを1回ずつ確認する",
    );

    const desktop = testInfo.project.name === "desktop";
    const options = desktop
      ? { language: "ja" as const, theme: "light" as const, width: 1440 }
      : { language: "en" as const, theme: "dark" as const, width: 390 };
    const labels = desktop
      ? {
          email: "連絡先メールアドレス",
          endpoint: "お問い合わせフォームの送信先",
          save: "保存",
          emailError: "メールアドレスの形式を確認してください。空欄にすると表示しません。",
          endpointError:
            "送信先は https:// で始まる有効なURLにしてください。空欄にするとフォームを表示しません。",
        }
      : {
          email: "Contact Email",
          endpoint: "Contact Form URL",
          save: "Save",
          emailError: "Enter a valid email address, or leave this blank to hide it.",
          endpointError:
            "Enter a valid https:// URL, or leave this blank to hide the form.",
        };
    const mocks = await installAdminMocks(page);
    await openSettings(page, options);
    await openSiteBasicsThroughTheAdminUi(page, options.width);

    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe(
      options.theme,
    );
    const email = page.getByLabel(labels.email, { exact: true });
    const endpoint = page.getByLabel(labels.endpoint, { exact: true });
    const save = (desktop
      ? page.locator("[data-settings-save-panel]")
      : page.locator(".admin-settings-mobile-save")
    ).getByRole("button", { name: labels.save, exact: true });
    await expect(email).toHaveAttribute("type", "email");
    await expect(endpoint).toHaveAttribute("type", "url");

    await email.fill("not-a-url");
    await endpoint.fill("http://compatible.example.test/contact");
    await save.click();

    const emailError = page.locator("#settings-contactEmail-error");
    const endpointError = page.locator("#settings-formspreeUrl-error");
    await expect(emailError).toHaveText(labels.emailError);
    await expect(endpointError).toHaveText(labels.endpointError);
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAttribute(
      "aria-describedby",
      "settings-contactEmail-error",
    );
    await expect(endpoint).toHaveAttribute("aria-invalid", "true");
    await expect(endpoint).toHaveAttribute(
      "aria-describedby",
      "settings-formspreeUrl-error",
    );
    await expect(email).toBeFocused();
    await expect.poll(() => mocks.settingsWrites.length).toBe(0);

    const errorSurface = await emailError.evaluate((element) => {
      const style = getComputedStyle(element);
      return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
    });
    expect(errorSurface.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(errorSurface.boxShadow).toBe("none");

    await email.fill(" valid@example.test ");
    await endpoint.fill(" https://compatible.example.test/contact ");
    await expect(emailError).toHaveCount(0);
    await expect(endpointError).toHaveCount(0);
    await save.click();
    await expect.poll(() => mocks.settingsWrites.length).toBe(1);
    expect(mocks.settingsWrites).toEqual([
      {
        contactEmail: "valid@example.test",
        formspreeUrl: "https://compatible.example.test/contact",
      },
    ]);

    // Empty remains the explicit, valid way to remove either contact channel.
    await email.fill("");
    await endpoint.fill("");
    await save.click();
    await expect.poll(() => mocks.settingsWrites.length).toBe(2);
    expect(mocks.settingsWrites[1]).toEqual({
      contactEmail: "",
      formspreeUrl: "",
    });
    expect(mocks.blockedWrites).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });

  test("legacy invalid contact values do not block an unrelated Settings save", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "既存不正値の互換性はdesktopで1回確認する");
    const mocks = await installAdminMocks(page, {
      ...ADMIN_SETTINGS,
      contactEmail: "old-not-an-email",
      formspreeUrl: "http://old.example.test/contact",
    });
    await openSettings(page, { language: "ja", theme: "light", width: 1440 });
    await openSiteBasicsThroughTheAdminUi(page, 1440);

    const description = page.getByLabel("サイトの説明文", { exact: true });
    await description.fill("連絡先とは無関係な説明文だけを更新します。");
    await page
      .locator("[data-settings-save-panel]")
      .getByRole("button", { name: "保存", exact: true })
      .click();
    await expect.poll(() => mocks.settingsWrites.length).toBe(1);
    expect(mocks.settingsWrites[0]).toEqual({
      siteDescription: "連絡先とは無関係な説明文だけを更新します。",
    });
    await expect(page.locator("#settings-contactEmail-error")).toHaveCount(0);
    await expect(page.locator("#settings-formspreeUrl-error")).toHaveCount(0);
    expect(mocks.blockedWrites).toEqual([]);
  });
});

test.describe("public Contact — malformed saved settings", () => {
  test("does not render a broken form or mailto, while keeping a social fallback", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "1440px/390pxをdesktopで明示測定する");
    const mocks = await installPublicMocks(page);

    for (const scene of [
      { path: "/contact", language: "ja", theme: "light", width: 1440 },
      { path: "/en/contact", language: "en", theme: "dark", width: 390 },
    ] as const) {
      await page.setViewportSize({ width: scene.width, height: 900 });
      await page.addInitScript((theme) => {
        localStorage.setItem("theme-preference", theme);
      }, scene.theme);
      await page.goto(scene.path);
      await expect(page.locator("main h1")).toBeVisible();
      await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe(
        scene.theme,
      );
      await expect(page.locator("main form")).toHaveCount(0);
      await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0);
      await expect(
        page.locator('main a[href="https://example.test/instagram"]'),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    expect(mocks.unexpectedRequests).toEqual([]);
  });
});
