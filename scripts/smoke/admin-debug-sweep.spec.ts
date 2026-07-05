import { test, expect } from "@playwright/test";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin } from "./helpers";

const OLD_DARK_COLORS = [
  "rgb(17, 17, 17)",
  "rgb(26, 26, 26)",
  "rgb(32, 32, 32)",
  "rgb(44, 44, 44)",
  "rgb(56, 56, 56)",
] as const;

function isLocalRequest(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]" ||
      parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
}

test.describe("admin — 全体デバッグスイープ", () => {
  test("全タブでconsole error・ローカル通信失敗・旧暗色パネルがない", async ({
    page,
  }) => {
    const runtimeProblems: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/fonts\.(googleapis|gstatic)\.com/.test(text)) return;
      runtimeProblems.push(`console: ${text}`);
    });
    page.on("pageerror", (error) => {
      runtimeProblems.push(`pageerror: ${error.message}`);
    });
    page.on("requestfailed", (request) => {
      if (!isLocalRequest(request.url())) return;
      if (request.failure()?.errorText === "net::ERR_ABORTED") return;
      runtimeProblems.push(
        `requestfailed: ${request.method()} ${request.url()} ${
          request.failure()?.errorText ?? ""
        }`,
      );
    });

    await loginAsAdmin(page);
    expect(
      await page
        .locator('link[href*="fonts.googleapis.com"][href*="Cormorant+Garamond"]')
        .count(),
    ).toBeGreaterThan(0);

    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      await expect(page.locator(".admin-atelier")).toBeVisible();

      const title = page.locator(".admin-page-header__title").first();
      if ((await title.count()) > 0) {
        const titleFont = await title.evaluate(
          (el) => getComputedStyle(el).fontFamily,
        );
        const configuredTitleFont = await page.evaluate(() => {
          const value = getComputedStyle(
            document.querySelector(".admin-atelier")!,
          ).getPropertyValue("--admin-font-title");
          return value.split(",")[0]?.trim().replace(/['"]/g, "") ?? "";
        });
        expect(configuredTitleFont).toBe("Cormorant Garamond");
        expect(titleFont).toContain(configuredTitleFont);
      }

      const oldDarkOffenders = await page.evaluate(
        ({ tabName, oldColors }) => {
          const oldColorSet = new Set(oldColors);
          const isVisible = (el: Element): el is HTMLElement => {
            if (!(el instanceof HTMLElement)) return false;
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity) > 0.01
            );
          };
          const describe = (el: HTMLElement) => {
            const cls = el.className
              ? String(el.className).replace(/\s+/g, ".").slice(0, 120)
              : "";
            const text = el.textContent?.trim().replace(/\s+/g, " ").slice(0, 40);
            return `${tabName}: <${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}>${text ? ` "${text}"` : ""}`;
          };
          const offenders: string[] = [];
          for (const el of Array.from(
            document.querySelectorAll(".admin-content *"),
          )) {
            if (!isVisible(el)) continue;
            if (el.closest("iframe")) continue;
            const style = getComputedStyle(el);
            const checks = [
              ["background", style.backgroundColor],
              ["border-top", style.borderTopColor],
              ["border-right", style.borderRightColor],
              ["border-bottom", style.borderBottomColor],
              ["border-left", style.borderLeftColor],
            ] as const;
            for (const [prop, value] of checks) {
              if (oldColorSet.has(value)) {
                offenders.push(`${prop} ${value} ${describe(el)}`);
                break;
              }
            }
            if (offenders.length >= 12) break;
          }
          return offenders;
        },
        { tabName: tab, oldColors: OLD_DARK_COLORS },
      );
      expect(oldDarkOffenders).toEqual([]);
    }

    expect(runtimeProblems).toEqual([]);
  });

  test("Libraryの仮想グリッドとサイトプレビューが安定した寸法・紙色を使う", async ({
    page,
  }, testInfo) => {
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    const grid = page.locator("[data-virtualized]").first();
    await expect(grid).toBeVisible();
    await page.waitForFunction(() => {
      const el = document.querySelector("[data-rendered-count]");
      return Number(el?.getAttribute("data-rendered-count") ?? "0") > 0;
    });

    const gridMetrics = await grid.evaluate((el) => {
      const inner = el.querySelector(".grid") as HTMLElement | null;
      return {
        isVirtualized: el.getAttribute("data-virtualized") === "true",
        renderedCount: Number(el.getAttribute("data-rendered-count") ?? "0"),
        rowGap: inner ? getComputedStyle(inner).rowGap : "",
      };
    });
    test.skip(
      !gridMetrics.isVirtualized,
      "実データ数が少なく、この環境ではLibrary仮想化が動いていない",
    );
    if (testInfo.project.name === "desktop")
      expect(gridMetrics.renderedCount).toBeGreaterThan(60);
    else expect(gridMetrics.renderedCount).toBeGreaterThanOrEqual(10);
    expect(gridMetrics.rowGap).toBe("8px");

    await page.getByRole("button", { name: "サイトで確認" }).click();
    const shell = page.locator("[data-admin-preview-shell]");
    const stage = page.locator("[data-admin-preview-stage]");
    await expect(shell).toBeVisible();
    await expect(stage).toBeVisible();

    const colors = await shell.evaluate((el) => {
      const shellStyle = getComputedStyle(el);
      const stageStyle = getComputedStyle(
        document.querySelector("[data-admin-preview-stage]")!,
      );
      return {
        shellBackground: shellStyle.backgroundColor,
        stageBackground: stageStyle.backgroundColor,
        paper: getComputedStyle(el).getPropertyValue("--admin-paper").trim(),
      };
    });
    expect(colors.shellBackground).not.toBe("rgb(17, 17, 17)");
    expect(colors.stageBackground).not.toBe("rgb(17, 17, 17)");
    expect(colors.paper).not.toBe("");
  });
});
