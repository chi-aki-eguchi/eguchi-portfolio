import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM(
  "<!doctype html><html><body><div id='root'></div></body></html>",
  { url: "http://localhost/", pretendToBeVisual: true },
);

Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  HTMLButtonElement: dom.window.HTMLButtonElement,
  localStorage: dom.window.localStorage,
  StorageEvent: dom.window.StorageEvent,
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const {
  ADMIN_LANGUAGE_STORAGE_KEY,
  ADMIN_DICTIONARY,
  AdminLanguageProvider,
  AdminLanguageToggle,
  useAdminI18n,
} = await import("./admin-i18n");

test("common action copy keeps Japanese wording and provides English labels", () => {
  expect(ADMIN_DICTIONARY.ja.common.cancel).toBe("キャンセル");
  expect(ADMIN_DICTIONARY.ja.common.deleteAction).toBe("削除する");
  expect(ADMIN_DICTIONARY.en.common.cancel).toBe("Cancel");
  expect(ADMIN_DICTIONARY.en.common.deleteAction).toBe("Delete");
});

test("Phase 2b copy preserves JP and uses standard photography terms in EN", () => {
  const ja = ADMIN_DICTIONARY.ja.phase2b;
  const en = ADMIN_DICTIONARY.en.phase2b;

  expect(ja.library.sort.label).toBe("並び替え");
  expect(ja.library.sort.options.manual).toBe("手動（保存されている順）");
  expect(ja.library.inspector.shotDate).toBe("撮影日");
  expect(ja.series.coverPhoto).toBe("表紙写真");
  expect(ja.categories.description).toBe(
    "ギャラリーのフィルターとして使用。↑↓で並び替え（この順で表示されます）。",
  );
  expect(ja.hero.slidesTitle).toBe("トップページの写真");
  expect(ja.hero.galleryTitle).toBe("ギャラリー");
  expect(ja.profile.photoTitle).toBe("プロフィール写真（Aboutページ）");
  expect(ja.profile.uploadPhoto).toBe("写真を選ぶ");
  expect(ja.profile.fields.nameLabel).toBe("名前（日本語）");
  expect(ja.profile.fields.nameEnLabel).toBe("名前（英語）");
  expect(ja.profile.fields.bioLabel).toBe("自己紹介");
  expect(ja.profile.fields.bioEnLabel).toBe("自己紹介（英語）");
  expect(ja.pricing.titleLabel).toBe("タイトル");
  expect(ja.pricing.priceLabel).toBe("料金");
  expect(ja.pricing.descriptionLabel).toBe("説明文");
  expect(ja.service.examples.ctaLabel).toBe("CTA");
  expect(ja.service.pricing.stripePaymentLink).toBe("Stripe の決済リンク");
  expect(ja.settingsDesign.themeColors.backgroundLabel).toBe("背景色");
  expect(ja.settingsDesign.themeColors.textLabel).toBe("文字色");
  expect(ja.settingsBasic.adminPasswordTitle).toBe("管理パスワード");
  expect(ja.settingsBasic.previewTitle).toBe("プレビュー");

  expect(en.library.sort.label).toBe("Sort");
  expect(en.library.sort.options.displaySize).toBe("Display size (S→L)");
  expect(en.library.import.film).toBe("Film");
  expect(en.library.import.digital).toBe("Digital");
  expect(en.library.inspector.shotDate).toBe("Date taken");
  expect(en.library.inspector.focalPoint).toBe("Focal point");
  expect(en.library.inspector.sortOrder).toBe("Sort order");
  expect(en.series.cardSummary(1, "Still life")).toBe(
    "1 photo · Cover: Still life",
  );
  expect(en.hero.slidesTitle).toBe("Hero Slides");
  expect(en.hero.galleryTitle).toBe("Gallery");
  expect(en.profile.photoTitle).toBe("Profile Photo (About page)");
  expect(en.profile.uploadPhoto).toBe("Upload photo");
  expect(en.profile.fields.nameLabel).toBe("Name (JP)");
  expect(en.profile.fields.nameEnLabel).toBe("Name (EN)");
  expect(en.profile.fields.bioLabel).toBe("Bio");
  expect(en.profile.fields.bioEnLabel).toBe("Bio (EN)");
  expect(en.pricing.titleLabel).toBe("Title");
  expect(en.pricing.priceLabel).toBe("Price");
  expect(en.pricing.descriptionLabel).toBe("Description");
  expect(en.service.examples.ctaLabel).toBe("CTA");
  expect(en.service.pricing.stripePaymentLink).toBe("Stripe Payment Link");
  expect(en.settingsDesign.themeColors.backgroundLabel).toBe("Background");
  expect(en.settingsDesign.themeColors.textLabel).toBe("Text");
  expect(en.settingsBasic.adminPasswordTitle).toBe("Admin Password");
  expect(en.settingsBasic.previewTitle).toBe("Preview");
});

test("日本語辞書の表示文は固有名詞と入力例を除いて日本語を含む", () => {
  const englishOnly: string[] = [];
  const allowedExact = new Set([
    "login.eyebrow",
    "headers.dotSeparator",
    "phase2b.profile.fields.instagramLabel",
    "phase2b.profile.fields.xUrlLabel",
    "phase2b.profile.fields.noteUrlLabel",
    "phase2b.service.examples.ctaLabel",
    "phase2b.settingsBasic.portfolioKit.title",
    // 単位記号。日本語のUIでも px と書く（px/秒 のほうは日本語を含むので対象外）。
    "phase2b.settingsBasic.units.px",
    "phase2b.settingsDesign.siteCopy.fields.snsLabelInstagram.label",
    "phase2b.settingsDesign.siteCopy.fields.snsLabelTwitter.label",
    "phase2b.settingsDesign.siteCopy.fields.snsLabelNote.label",
  ]);
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (
        value &&
        !/[ぁ-んァ-ヶ一-龠々]/.test(value) &&
        !path.startsWith("navigation.tabs.") &&
        !/(placeholder|Placeholder)$/.test(path) &&
        !allowedExact.has(path)
      ) {
        englishOnly.push(`${path}: ${value}`);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        walk(nested, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(ADMIN_DICTIONARY.ja, "");
  expect(englishOnly).toEqual([]);
});

function CopyProbe() {
  const { language, t } = useAdminI18n();
  return createElement(
    "div",
    null,
    createElement(AdminLanguageToggle),
    createElement("span", { "data-copy": true }, t.login.submit),
    createElement("span", { "data-probe-language": true }, language),
  );
}

async function mountProbe() {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        AdminLanguageProvider,
        null,
        createElement(CopyProbe),
      ),
    );
  });
  return {
    host,
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function languageButton(host: Element, label: "JP" | "EN") {
  return Array.from(host.querySelectorAll("button")).find(
    (button) => button.textContent === label,
  ) as HTMLButtonElement;
}

test("admin language defaults to JP and persists EN across remounts", async () => {
  dom.window.localStorage.clear();
  const first = await mountProbe();
  expect(first.host.querySelector("[data-copy]")?.textContent).toBe("ログイン");
  expect(dom.window.document.documentElement.lang).toBe("ja");
  expect(languageButton(first.host, "JP").getAttribute("aria-pressed")).toBe(
    "true",
  );

  await act(async () => languageButton(first.host, "EN").click());
  expect(first.host.querySelector("[data-copy]")?.textContent).toBe("Sign in");
  expect(dom.window.document.documentElement.lang).toBe("en");
  expect(dom.window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY)).toBe(
    "en",
  );
  await first.unmount();

  const second = await mountProbe();
  expect(second.host.querySelector("[data-probe-language]")?.textContent).toBe(
    "en",
  );
  expect(languageButton(second.host, "EN").getAttribute("aria-pressed")).toBe(
    "true",
  );
  await act(async () => languageButton(second.host, "JP").click());
  expect(dom.window.document.documentElement.lang).toBe("ja");
  expect(dom.window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY)).toBe(
    "ja",
  );
  await second.unmount();
  dom.window.localStorage.clear();
});

test("invalid stored admin language safely falls back to JP", async () => {
  dom.window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, "zh");
  const mounted = await mountProbe();
  expect(mounted.host.querySelector("[data-probe-language]")?.textContent).toBe(
    "ja",
  );
  expect(mounted.host.querySelector("[data-copy]")?.textContent).toBe(
    "ログイン",
  );
  await mounted.unmount();
  dom.window.localStorage.clear();
});

test("nested providers share one admin language state", async () => {
  dom.window.localStorage.clear();
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        AdminLanguageProvider,
        null,
        createElement(
          AdminLanguageProvider,
          null,
          createElement(CopyProbe),
        ),
      ),
    );
  });
  await act(async () => languageButton(host, "EN").click());
  expect(host.querySelector("[data-copy]")?.textContent).toBe("Sign in");
  expect(host.querySelectorAll("[data-admin-language-toggle]")).toHaveLength(
    1,
  );
  await act(async () => root.unmount());
  host.remove();
  dom.window.localStorage.clear();
});
