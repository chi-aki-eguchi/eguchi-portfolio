import { makeAdminDemoSnapshot, type AdminDemoSnapshot } from "./admin-demo-data";

import { demoMemberships, writeDemoStudio } from "./admin-demo-studio";

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
  const sharedKey = `admin-demo-preview-snapshot:${seed}`;
  let snapshotPromise: Promise<AdminDemoSnapshot> | undefined;

  const persist = (snapshot: AdminDemoSnapshot) => {
    // noopener preview tabs do not inherit sessionStorage. Share only this
    // random demo session, never admin credentials or the owner's settings.
    try { localStorage.setItem(sharedKey, JSON.stringify({ savedAt: Date.now(), snapshot })); } catch { /* private mode/quota */ }
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
        const shared = JSON.parse(localStorage.getItem(sharedKey) ?? "null");
        if (shared?.snapshot && Date.now() - shared.savedAt < 24 * 60 * 60 * 1000) return shared.snapshot as AdminDemoSnapshot;
      } catch { /* unavailable or expired: fall back to this tab */ }
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
    memory.clear();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ADMIN_DEMO_WRITE_EVENT));
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
        return jsonResponse({ photos: (await getSnapshot()).photos.filter(p => p.deletedAt), automaticDeletion: false });
      if (path === "/api/admin/hero-photos") {
        return jsonResponse({ heroPhotos: (await getSnapshot()).adminHeroPhotos });
      }
      if (path === "/api/admin/series-photos") return jsonResponse({ memberships: demoMemberships(await getSnapshot()) });
      if (path === "/api/admin/series") {
        return jsonResponse({ series: (await getSnapshot()).series });
      }
      if (path === "/api/admin/pricing") return jsonResponse({ plans: [] });
      if (path.startsWith("/api/admin/")) return jsonResponse({});
      const detail = path.match(/^\/api\/series\/([^/]+)$/);
      if (detail) {
        const snapshot = await getSnapshot();
        const series = snapshot.series.find(s => s.slug === decodeURIComponent(detail[1]));
        if (!series) return jsonResponse({ error: "Series not found" }, 404);
        const members = demoMemberships(snapshot).filter(m => m.seriesId === series.id).sort((a, b) => a.sortOrder - b.sortOrder);
        return jsonResponse({ series, photos: members.map(m => snapshot.photos.find(p => p.id === m.photoId)).filter(p => p && !p.deletedAt && p.isPublished !== false) });
      }
      if (path === "/api/photos" && url.searchParams.get("all") !== "1") return jsonResponse({ photos: (await getSnapshot()).photos.filter(p => !p.deletedAt && p.isPublished !== false) });
      if (path === "/api/series" && url.searchParams.has("kind")) return jsonResponse({ series: (await getSnapshot()).series.filter(s => s.kind === url.searchParams.get("kind")) });
      if (path === "/api/photos" || path === "/api/settings" || path === "/api/categories" || path === "/api/series" || path === "/api/hero-photos")
        return jsonResponse(await loadPublic(path));
      return original(input, init);
    }

    if (path === "/api/admin/logout") return jsonResponse({ success: true });

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

    const snapshot = await getSnapshot();
    const studio = writeDemoStudio(snapshot, path, method, (body && typeof body === "object" ? body : {}) as Record<string, unknown>);
    if (studio) {
      if (!studio.status || studio.status < 400) await updateSnapshot(() => {});
      return jsonResponse(studio.data, studio.status);
    }

    if (path.includes("/upload"))
      return jsonResponse({ error: "体験版では画像アップロードを利用できません" }, 409);

    return jsonResponse({ error: "この操作は体験版では利用できません。変更は保存されていません。" }, 409);
  };

  globalThis.fetch = demoFetch as typeof globalThis.fetch;
  return () => {
    if (globalThis.fetch === demoFetch) globalThis.fetch = original;
  };
}
