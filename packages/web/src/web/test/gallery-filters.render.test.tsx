/**
 * Gallery filter state regression coverage.
 *
 * The public page inherits the site's configurable body weight. Keep the
 * inactive filter weight explicit so a bold site body cannot make inactive
 * labels heavier than the active label.
 */
import { test, expect } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } =
  await import("@tanstack/react-query");

test("Gallery filters keep active medium and inactive weight distinct", async () => {
  const previousSettings = canned["/api/settings"];
  const previousCategories = canned["/api/categories"];
  const previousSearch = dom.window.location.search;
  canned["/api/settings"] = { bodyWeight: "700", filterAllLabel: "All" };
  canned["/api/categories"] = {
    categories: [
      { id: 1, slug: "portrait", label: "Portrait", sortOrder: 0 },
      { id: 2, slug: "nature", label: "Nature", sortOrder: 1 },
    ],
  };
  dom.reconfigure({ url: "http://localhost/gallery" });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  try {
    const GalleryPage = (await import("../pages/gallery")).default;
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(GalleryPage),
      ),
    );
    await flush(120);

    const rows = host.querySelectorAll<HTMLElement>(".gallery-filter-row");
    expect(rows).toHaveLength(2);

    const categoryActive = rows[0]!.querySelector(
      'button[aria-pressed="true"]',
    );
    const categoryInactive = rows[0]!.querySelector(
      'button[aria-pressed="false"]',
    );
    expect(categoryActive?.className).toContain("font-medium");
    expect(categoryActive?.className).not.toContain("font-normal");
    expect(categoryInactive?.className).toContain("font-normal");
    expect(categoryInactive?.className).not.toContain("font-medium");

    const mediumActive = rows[1]!.querySelector(
      'button[aria-pressed="true"]',
    );
    const mediumInactive = rows[1]!.querySelector(
      'button[aria-pressed="false"]',
    );
    expect(mediumActive?.textContent?.trim()).toBe("All");
    expect(mediumActive?.className).toContain("font-medium");
    expect(mediumInactive?.className).toContain("font-normal");

    categoryInactive?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await flush(40);
    expect(dom.window.location.search).toContain("c=portrait");

    const film = Array.from(rows[1]!.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Film",
    );
    film?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await flush(40);
    expect(dom.window.location.search).toContain("c=portrait");
    expect(dom.window.location.search).toContain("medium=film");
  } finally {
    root.unmount();
    host.remove();
    queryClient.clear();
    canned["/api/settings"] = previousSettings;
    canned["/api/categories"] = previousCategories;
    dom.reconfigure({ url: `http://localhost/gallery${previousSearch}` });
  }
});
