import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { prefetchSettings } from "./api";

test("settings prefetch — 500のJSON本文を成功データとしてキャッシュしない", async () => {
  let jsonRead = false;
  const request = async () => ({
    ok: false,
    status: 500,
    json: async () => {
      jsonRead = true;
      return { error: "settings unavailable" };
    },
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  try {
    await prefetchSettings(queryClient, request);

    expect(queryClient.getQueryData(["settings"])).toBeUndefined();
    expect(queryClient.getQueryState(["settings"])?.status).toBe("error");
    expect(jsonRead).toBe(false);
  } finally {
    queryClient.clear();
  }
});
