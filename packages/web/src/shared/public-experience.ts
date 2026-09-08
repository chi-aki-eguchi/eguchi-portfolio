/** The new experience is opt-in; existing sites keep their saved presentation. */
export function usesPhotoApp(
  settings: { publicExperience?: string } | undefined,
) {
  return settings?.publicExperience === "photo-app";
}

export function isPhotoAppPath(pathname: string) {
  return /^(\/|\/gallery|\/(?:series|work)(?:\/[^/]+)?|\/about|\/profile|\/contact|\/en\/(?:about|contact))$/.test(
    pathname,
  );
}
