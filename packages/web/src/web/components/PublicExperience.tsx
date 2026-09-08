import { lazy, Suspense, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { isPhotoAppPath, usesPhotoApp } from "../../shared/public-experience";

const PhotoApp = lazy(() => import("./photo-app/PhotoApp"));

export function PublicExperience({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data, isPending } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  if (!isPhotoAppPath(location)) return children;
  if (isPending) return <div className="min-h-screen" aria-busy="true" />;
  if (!usesPhotoApp(data)) return children;
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <PhotoApp settings={data!} />
    </Suspense>
  );
}
