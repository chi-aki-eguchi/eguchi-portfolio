import { SETTINGS_PREVIEW_KEYS } from "../../shared/settings-keys";
import { CLIENT_SITE_FALLBACKS } from "./site-fallbacks";

export const ADMIN_DEMO_PHOTO_LIMIT = 20;
export const ADMIN_DEMO_PREVIEW_PARAM = "admin-demo-preview";

type JsonRecord = Record<string, unknown>;

export type AdminDemoSnapshot = {
  settings: Record<string, string>;
  photos: JsonRecord[];
  categories: JsonRecord[];
  series: JsonRecord[];
  heroPhotos: JsonRecord[];
  adminHeroPhotos: JsonRecord[];
};

export function makeAdminDemoSettings(): Record<string, string> {
  const settings = Object.fromEntries(
    SETTINGS_PREVIEW_KEYS.map((key) => [key, ""]),
  ) as Record<string, string>;
  return {
    ...settings,
    ...CLIENT_SITE_FALLBACKS,
    siteDescription: "Photography portfolio.",
    profileBio: "Photographer.",
    fontJa: "Shippori Mincho",
    fontEn: "Cormorant Garamond",
    contactIntro: "撮影のご相談やご質問は、こちらからお問い合わせください。",
    navLabelTop: "Top",
    navLabelGallery: "Gallery",
    navLabelAbout: "About",
    navLabelContact: "Contact",
    worksLabel: "Works",
    galleryLabel: "Gallery",
    profileLabel: "About",
    contactLabel: "Contact",
    servicePageMode: "off",
  };
}

function seededShuffle<T>(values: T[], seed: string): T[] {
  let state = 2166136261;
  for (const char of seed) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) {
    state += 0x6d2b79f5;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    const random = ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(random * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function makeAdminDemoSnapshot(
  seed: string,
  sources: {
    photos?: JsonRecord[];
    categories?: JsonRecord[];
    series?: JsonRecord[];
    heroPhotos?: JsonRecord[];
  },
): AdminDemoSnapshot {
  const photos: JsonRecord[] = seededShuffle<JsonRecord>(sources.photos ?? [], seed)
    .slice(0, ADMIN_DEMO_PHOTO_LIMIT)
    .map((photo, sortOrder): JsonRecord => ({ ...photo, sortOrder }));
  const photoIds = new Set(photos.map((photo) => Number(photo.id)));
  const categorySlugs = new Set(photos.map((photo) => String(photo.category ?? "")));
  const seriesIds = new Set(
    photos.map((photo) => Number(photo.seriesId)).filter(Number.isFinite),
  );
  const categories = (sources.categories ?? []).filter((category) =>
    categorySlugs.has(String(category.slug ?? "")),
  );
  const series = (sources.series ?? [])
    .filter((item) => seriesIds.has(Number(item.id)))
    .map((item) => ({
      ...item,
      coverPhotoId: photoIds.has(Number(item.coverPhotoId))
        ? item.coverPhotoId
        : photos.find((photo) => Number(photo.seriesId) === Number(item.id))?.id ?? null,
    }));
  const selectedHeroes = (sources.heroPhotos ?? []).filter((photo) =>
    photoIds.has(Number(photo.id)),
  );
  const heroPhotos = (selectedHeroes.length ? selectedHeroes : photos).slice(0, 5);
  const adminHeroPhotos = heroPhotos.map((photo, index) => ({
    id: index + 1,
    photoId: photo.id,
    sortOrder: index,
  }));
  return {
    settings: makeAdminDemoSettings(),
    photos,
    categories,
    series,
    heroPhotos,
    adminHeroPhotos,
  };
}
