import { afterEach, expect, test } from "bun:test";
import { installAdminDemoFetch } from "./admin-demo-fetch";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("demo fetch keeps every write off the network and updates memory only", async () => {
  const networkMethods: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    networkMethods.push((init?.method ?? "GET").toUpperCase());
    const path = new URL(String(input), "https://akieguchi.com").pathname;
    return new Response(JSON.stringify(path === "/api/settings" ? { siteName: "Before" } : {}));
  }) as typeof fetch;
  const restore = installAdminDemoFetch();
  try {
    await fetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ siteName: "Demo" }),
    });
    await fetch("/api/admin/photos/1", {
      method: "DELETE",
    });
    const settings = await (await fetch("/api/settings")).json() as { siteName: string };
    expect(settings.siteName).toBe("Demo");
    expect(networkMethods.filter((method) => method !== "GET")).toHaveLength(0);
  } finally {
    restore();
  }
});
