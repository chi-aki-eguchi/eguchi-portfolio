import { makeAdminDemoSnapshot, type AdminDemoSnapshot } from "./admin-demo-data";

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

export function installAdminDemoFetch(seed = "demo"): () => void {
  const original = globalThis.fetch.bind(globalThis);
  const memory = new Map<string, unknown>();
  const storageKey = `admin-demo:${seed}`;
  let snapshotPromise: Promise<AdminDemoSnapshot> | undefined;

  const persist = (snapshot: AdminDemoSnapshot) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // The demo remains functional when browser storage is unavailable.
    }
  };

  const getSnapshot = async (): Promise<AdminDemoSnapshot> => {
    if (snapshotPromise) return snapshotPromise;
    snapshotPromise = (async () => {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) return JSON.parse(stored) as AdminDemoSnapshot;
      } catch {
        // Fall through to a fresh public-data snapshot.
      }
      const [photos, categories, series, hero] = await Promise.all([
        original("/api/photos").then((res) => res.json()),
        original("/api/categories").then((res) => res.json()),
        original("/api/series").then((res) => res.json()),
        original("/api/hero-photos").then((res) => res.json()),
      ]) as Array<Record<string, unknown>>;
      const snapshot = makeAdminDemoSnapshot(seed, {
        photos: photos.photos as Array<Record<string, unknown>> | undefined,
        categories: categories.categories as Array<Record<string, unknown>> | undefined,
        series: series.series as Array<Record<string, unknown>> | undefined,
        heroPhotos: hero.heroPhotos as Array<Record<string, unknown>> | undefined,
      });
      persist(snapshot);
      return snapshot;
    })();
    return snapshotPromise;
  };

  const updateSnapshot = async (update: (snapshot: AdminDemoSnapshot) => void) => {
    const snapshot = await getSnapshot();
    update(snapshot);
    persist(snapshot);
  };

  const loadPublic = async (path: string): Promise<unknown> => {
    const key = path.split("?")[0];
    if (memory.has(key)) return memory.get(key);
    const snapshot = await getSnapshot();
    const data = key === "/api/settings" ? snapshot.settings
      : key === "/api/photos" ? { photos: snapshot.photos }
        : key === "/api/categories" ? { categories: snapshot.categories }
          : key === "/api/series" ? { series: snapshot.series }
            : key === "/api/hero-photos" ? { heroPhotos: snapshot.heroPhotos }
              : {};
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
        return jsonResponse({ heroPhotos: (await getSnapshot()).adminHeroPhotos });
      }
      if (path === "/api/admin/series") {
        return jsonResponse({ series: (await getSnapshot()).series });
      }
      if (path === "/api/admin/pricing") return jsonResponse({ plans: [] });
      if (path.startsWith("/api/admin/")) return jsonResponse({});
      if (path === "/api/photos" || path === "/api/settings" || path === "/api/categories" || path === "/api/series" || path === "/api/hero-photos")
        return jsonResponse(await loadPublic(path));
      return original(input, init);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ADMIN_DEMO_WRITE_EVENT));
    }

    if (path === "/api/admin/settings" && body && typeof body === "object") {
      const current = (await loadPublic("/api/settings")) as Record<string, unknown>;
      memory.set("/api/settings", { ...current, ...(body as object) });
      await updateSnapshot((snapshot) => Object.assign(snapshot.settings, body));
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
      await updateSnapshot((snapshot) => {
        snapshot.photos = snapshot.photos.map((photo) => photo.id === id ? { ...photo, ...(body as object) } : photo);
      });
      return jsonResponse({ success: true });
    }

    if (path === "/api/admin/photos/reorder" && body && typeof body === "object") {
      const ids = (body as { ids?: number[] }).ids ?? [];
      const current = (await loadPublic("/api/photos")) as { photos?: Array<Record<string, unknown>> };
      const byId = new Map((current.photos ?? []).map((photo) => [photo.id, photo]));
      memory.set("/api/photos", { ...current, photos: ids.map((id, index) => ({ ...byId.get(id), sortOrder: index })).filter(Boolean) });
      await updateSnapshot((snapshot) => {
        const snapshotById = new Map(snapshot.photos.map((photo) => [photo.id, photo]));
        snapshot.photos = ids.map((id, index): Record<string, unknown> => ({ ...snapshotById.get(id), sortOrder: index })).filter((photo) => photo.id !== undefined);
      });
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
