import type { AdminDemoSnapshot } from "./admin-demo-data";

type Row = Record<string, unknown>;
const idsOf = (photo: Row): number[] => Array.isArray(photo.seriesIds)
  ? photo.seriesIds.map(Number) : photo.seriesId == null ? [] : [Number(photo.seriesId)];
const numbers = (value: unknown): number[] => Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
const ok = { success: true };

/** The current Studio uses many-to-many membership, not the legacy seriesId field. */
export function demoMemberships(snapshot: AdminDemoSnapshot) {
  return snapshot.photos.flatMap(photo => idsOf(photo).map(seriesId => ({
    photoId: Number(photo.id), seriesId, sortOrder: Number((photo.seriesOrders as Row | undefined)?.[seriesId] ?? photo.sortOrder ?? 0),
  })));
}

/** Mutates only the disposable demo snapshot. Unsupported actions are never reported as saved. */
export function writeDemoStudio(snapshot: AdminDemoSnapshot, path: string, method: string, body: Row): { data: unknown; status?: number } | null {
  const ids = numbers(body.ids);
  const selected = snapshot.photos.filter(p => ids.includes(Number(p.id)));
  const syncHeroes = () => {
    snapshot.heroPhotos = snapshot.adminHeroPhotos.map(row => snapshot.photos.find(p => p.id === row.photoId)).filter((p): p is Row => Boolean(p) && !p?.deletedAt);
  };
  if (path === "/api/admin/photos/batch" && method === "POST") {
    const op = String(body.operation);
    if (!["publish", "unpublish", "feature", "unfeature", "category", "filmType", "rotate_right"].includes(op)) return null;
    for (const photo of selected) {
      if (op === "publish" || op === "unpublish") photo.isPublished = op === "publish";
      if (op === "category" || op === "filmType") photo[op] = body.value;
      if (op === "rotate_right") photo.rotationDeg = (Number(photo.rotationDeg ?? 0) + 90) % 360;
      if (op === "feature" && !snapshot.adminHeroPhotos.some(row => row.photoId === photo.id)) snapshot.adminHeroPhotos.push({ id: Number(photo.id), photoId: photo.id, sortOrder: snapshot.adminHeroPhotos.length });
      if (op === "unfeature") snapshot.adminHeroPhotos = snapshot.adminHeroPhotos.filter(row => row.photoId !== photo.id);
    }
    syncHeroes();
    return { data: { ...ok, count: selected.length } };
  }
  const photoAction = path.match(/^\/api\/admin\/photos\/(\d+)(?:\/(restore))?$/);
  if (photoAction && (method === "DELETE" || photoAction[2] === "restore")) {
    const photo = snapshot.photos.find(p => p.id === Number(photoAction[1]));
    if (!photo) return { data: { error: "Photo not found" }, status: 404 };
    photo.deletedAt = method === "DELETE" ? new Date().toISOString() : null;
    syncHeroes();
    return { data: ok };
  }
  if (path === "/api/admin/series" && method === "POST") {
    const series = { ...body, id: Math.max(0, ...snapshot.series.map(s => Number(s.id))) + 1, sortOrder: snapshot.series.length };
    snapshot.series.push(series);
    return { data: { series } };
  }
  if (path === "/api/admin/series/reorder" && method === "POST") {
    snapshot.series.forEach(s => { const index = ids.indexOf(Number(s.id)); if (index >= 0) s.sortOrder = index; });
    return { data: ok };
  }
  const match = path.match(/^\/api\/admin\/series\/(\d+)(?:\/(photos)(?:\/(reorder))?)?$/);
  if (!match) return null;
  const id = Number(match[1]);
  const series = snapshot.series.find(s => s.id === id);
  if (!series) return { data: { error: "Series not found" }, status: 404 };
  if (match[2] && method === "POST") {
    if (match[3]) {
      snapshot.photos.forEach(p => {
        if (ids.includes(Number(p.id))) p.seriesOrders = { ...(p.seriesOrders as Row), [id]: ids.indexOf(Number(p.id)) };
      });
    } else {
      const add = numbers(body.add), remove = numbers(body.remove);
      snapshot.photos.forEach(p => {
        const members = idsOf(p).filter(sid => sid !== id || !remove.includes(Number(p.id)));
        if (add.includes(Number(p.id)) && !members.includes(id)) members.push(id);
        p.seriesIds = members;
        p.seriesId = members[0] ?? null;
      });
    }
    return { data: ok };
  }
  if (!match[2] && method === "PATCH") { Object.assign(series, body); return { data: { series } }; }
  if (!match[2] && method === "DELETE") {
    snapshot.series = snapshot.series.filter(s => s.id !== id);
    snapshot.photos.forEach(p => { p.seriesIds = idsOf(p).filter(sid => sid !== id); p.seriesId = (p.seriesIds as number[])[0] ?? null; });
    return { data: ok };
  }
  return null;
}
