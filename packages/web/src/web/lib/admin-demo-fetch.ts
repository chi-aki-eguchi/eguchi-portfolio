export const ADMIN_DEMO_WRITE_EVENT = "admin-demo-write";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  const request = input instanceof Request ? input : null;
  const url = new URL(
    request?.url ?? String(input),
    typeof window === "undefined" ? "https://akieguchi.com" : window.location.origin,
  );
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  let body: unknown = undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      const text = init?.body instanceof FormData
        ? ""
        : typeof init?.body === "string"
          ? init.body
          : request
            ? await request.clone().text()
            : "";
      if (text) body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }
  return { url, method, body };
}

export function installAdminDemoFetch(): () => void {
  const original = globalThis.fetch.bind(globalThis);
  const memory = new Map<string, unknown>();

  const loadPublic = async (path: string): Promise<unknown> => {
    const key = path.split("?")[0];
    if (memory.has(key)) return memory.get(key);
    const res = await original(path);
    const data = await res.json();
    memory.set(key, structuredClone(data));
    return memory.get(key);
  };

  const demoFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { url, method, body } = await requestDetails(input, init);
    const path = url.pathname;

    if (method === "GET") {
      if (path === "/api/admin/me") return jsonResponse({ authenticated: true });
      if (path === "/api/admin/setup-health")
        return jsonResponse({ storageConfigured: true, missingStorageVariables: [] });
      if (path === "/api/admin/photos/trash")
        return jsonResponse({ photos: [], retentionDays: 30 });
      if (path === "/api/admin/hero-photos") {
        const data = await loadPublic("/api/hero-photos");
        return jsonResponse(data);
      }
      if (path === "/api/admin/series") {
        const data = await loadPublic("/api/series");
        return jsonResponse(data);
      }
      if (path === "/api/admin/pricing") return jsonResponse({ plans: [] });
      if (path.startsWith("/api/admin/")) return jsonResponse({});
      if (path === "/api/photos" || path === "/api/settings" || path === "/api/categories" || path === "/api/series" || path === "/api/hero-photos")
        return jsonResponse(await loadPublic(path));
      return original(input, init);
    }

    window.dispatchEvent(new CustomEvent(ADMIN_DEMO_WRITE_EVENT));

    if (path === "/api/admin/settings" && body && typeof body === "object") {
      const current = (await loadPublic("/api/settings")) as Record<string, unknown>;
      memory.set("/api/settings", { ...current, ...(body as object) });
      return jsonResponse({ success: true });
    }

    const photoMatch = path.match(/^\/api\/admin\/photos\/(\d+)$/);
    if (photoMatch && method === "PATCH") {
      const current = (await loadPublic("/api/photos")) as { photos?: Array<Record<string, unknown>> };
      const id = Number(photoMatch[1]);
      memory.set("/api/photos", {
        ...current,
        photos: (current.photos ?? []).map((photo) => photo.id === id ? { ...photo, ...(body as object) } : photo),
      });
      return jsonResponse({ success: true });
    }

    if (path === "/api/admin/photos/reorder" && body && typeof body === "object") {
      const ids = (body as { ids?: number[] }).ids ?? [];
      const current = (await loadPublic("/api/photos")) as { photos?: Array<Record<string, unknown>> };
      const byId = new Map((current.photos ?? []).map((photo) => [photo.id, photo]));
      memory.set("/api/photos", { ...current, photos: ids.map((id, index) => ({ ...byId.get(id), sortOrder: index })).filter(Boolean) });
      return jsonResponse({ success: true });
    }

    if (path.includes("/upload"))
      return jsonResponse({ error: "体験版では画像アップロードを利用できません" }, 409);

    return jsonResponse({ success: true, count: 1 });
  };

  globalThis.fetch = demoFetch as typeof globalThis.fetch;
  return () => {
    if (globalThis.fetch === demoFetch) globalThis.fetch = original;
  };
}
