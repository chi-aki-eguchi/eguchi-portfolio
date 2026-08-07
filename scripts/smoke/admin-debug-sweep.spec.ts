import { test, expect } from "@playwright/test";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin } from "./helpers";

const OLD_DARK_COLORS = [
  "rgb(17, 17, 17)",
  "rgb(26, 26, 26)",
  "rgb(32, 32, 32)",
  "rgb(44, 44, 44)",
  "rgb(56, 56, 56)",
] as const;

// Settingsの本文は目次で選んだ1節だけを出す（2026-07-30）。PCは左の目次、
// スマホは上部1行の「切り替え」→節一覧シートから目的の節を出す。
async function openSettingsSection(
  page: Parameters<typeof loginAsAdmin>[0],
  sectionId: string,
) {
  const tocLink = page.locator(
    `.admin-form-toc [data-settings-section-link="${sectionId}"]`,
  );
  // `isVisible()` は待たない。PC幅でも目次が描画される前に呼ぶと false が返り、
  // スマホ用の分岐へ落ちて、存在しないボタンを30秒待って死ぬ。実際にこの形で
  // 3回落ちた（2026-08-07）。少しだけ待ってから分岐する。
  const hasToc = await tocLink
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (hasToc) {
    await tocLink.click();
  } else {
    await page
      .locator(".admin-settings-mobile-current")
      .getByRole("button", { name: /切り替え|Switch/ })
      .click();
    await page.locator(`[data-settings-sheet-link="${sectionId}"]`).click();
  }
  await expect(
    page.locator(`[data-settings-section="${sectionId}"]`),
  ).toBeVisible();
}

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

    for (const tab of ADMIN_TABS) {
      await gotoAdminTab(page, tab);
      await expect(page.locator(".admin-atelier")).toBeVisible();

      const adminShell = await page.locator(".admin-atelier").evaluate((el) => {
        const root = getComputedStyle(document.documentElement);
        const style = getComputedStyle(el);
        return {
          siteBackground: root.getPropertyValue("--background").trim(),
          adminPaper: style.getPropertyValue("--admin-paper").trim(),
          sidebarFont: getComputedStyle(
            document.querySelector(".admin-sidebar__tab span") ?? el,
          ).fontFamily,
        };
      });
      // 道具は公開サイトの見た目から独立している。色は 2026-08-07（`03f3c53`）、
      // 書体は同日オーナー判断で切り離した。ここは以前「admin は公開サイトに
      // 追従する」ことを検査していたが、それは撤回された契約なので、逆向きに
      // 「追従していない」ことを検査する。単体テストは
      // `admin-theme-independence.test.ts`（宣言の検査）。ここは実ブラウザで
      // 解決後の値を見る。
      // 明暗それぞれの admin 自身の紙。公開サイトの色ではない。
      expect(["#f7f7f7", "#121212"]).toContain(
        adminShell.adminPaper.toLowerCase(),
      );
      // 「公開サイトの書体でないこと」を否定形で書かない。オーナーが偶然
      // 同じ書体を選ぶと誤検知する。admin 自身の書体が出ていることを直接見る。
      expect(adminShell.sidebarFont).toContain("Hiragino Sans");

      const title = page.locator(".admin-page-header__title").first();
      if ((await title.count()) > 0) {
        const titleFont = await title.evaluate(
          (el) => getComputedStyle(el).fontFamily,
        );
        expect(titleFont).toContain("Cormorant Garamond");
      }

      if (tab === "settings") {
        await openSettingsSection(page, "theme");
        const themeBg = await page
          .locator('[data-admin-setting="themeBg-color"]')
          .evaluate((el) => (el as HTMLInputElement).value);
        const themeBgPlaceholder = await page
          .locator('[data-admin-setting="themeBg-text"]')
          .getAttribute("placeholder");
        expect(themeBg.toLowerCase()).toBe(
          adminShell.siteBackground.toLowerCase(),
        );
        expect(themeBgPlaceholder?.toLowerCase()).toBe(
          adminShell.siteBackground.toLowerCase(),
        );
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
            const text = el.textContent
              ?.trim()
              .replace(/\s+/g, " ")
              .slice(0, 40);
            return `${tabName}: <${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}>${text ? ` "${text}"` : ""}`;
          };
          const adminInk = getComputedStyle(
            document.querySelector(".admin-atelier")!,
          ).color;
          const offenders: string[] = [];
          for (const el of Array.from(
            document.querySelectorAll(".admin-content *"),
          )) {
            if (!isVisible(el)) continue;
            if (el.closest("iframe")) continue;
            const style = getComputedStyle(el);
            const checks = [
              ["background", style.backgroundColor],
              [
                "border-top",
                style.borderTopStyle !== "none" &&
                Number.parseFloat(style.borderTopWidth) > 0
                  ? style.borderTopColor
                  : "",
              ],
              [
                "border-right",
                style.borderRightStyle !== "none" &&
                Number.parseFloat(style.borderRightWidth) > 0
                  ? style.borderRightColor
                  : "",
              ],
              [
                "border-bottom",
                style.borderBottomStyle !== "none" &&
                Number.parseFloat(style.borderBottomWidth) > 0
                  ? style.borderBottomColor
                  : "",
              ],
              [
                "border-left",
                style.borderLeftStyle !== "none" &&
                Number.parseFloat(style.borderLeftWidth) > 0
                  ? style.borderLeftColor
                  : "",
              ],
            ] as const;
            for (const [prop, value] of checks) {
              if (
                value === adminInk &&
                (el.tagName === "BUTTON" || el.closest("button,a"))
              ) {
                continue;
              }
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
    // Threshold tracks admin:thumbSize's default (larger thumbs → fewer
    // columns → smaller renderedCount) — margin below the real measured
    // value at 220px, not an exact pixel-perfect count.
    if (testInfo.project.name === "desktop")
      expect(gridMetrics.renderedCount).toBeGreaterThan(40);
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
