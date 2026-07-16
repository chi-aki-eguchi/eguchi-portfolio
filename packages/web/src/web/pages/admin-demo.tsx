import { useEffect, useState } from "react";
import { isServiceOwnerSite, resolveServiceVisibility } from "../../shared/service-visibility";
import { ADMIN_DEMO_WRITE_EVENT, installAdminDemoFetch } from "../lib/admin-demo-fetch";
import AdminPage from "./admin";

export default function AdminDemoPage() {
  const ownerSite = typeof window !== "undefined" && isServiceOwnerSite(undefined, window.location.hostname);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(ownerSite ? null : false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!ownerSite) return;
    let restore: (() => void) | undefined;
    let cancelled = false;
    const onWrite = () => {
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2400);
    };
    void fetch("/api/settings")
      .then((res) => res.json() as Promise<Record<string, string>>)
      .then((settings) => {
        if (cancelled) return;
        const allowed = resolveServiceVisibility(settings.servicePageMode, settings.siteUrl, window.location.hostname);
        setAvailable(allowed);
        if (!allowed) return;
        restore = installAdminDemoFetch();
        window.addEventListener(ADMIN_DEMO_WRITE_EVENT, onWrite);
        setReady(true);
      })
      .catch(() => setAvailable(false));
    return () => {
      cancelled = true;
      window.removeEventListener(ADMIN_DEMO_WRITE_EVENT, onWrite);
      restore?.();
    };
  }, [ownerSite]);

  if (available === false) return <main className="grid min-h-screen place-items-center"><p>404 — Page not found</p></main>;
  if (!ready) return <div className="h-screen w-full" />;
  return (
    <>
      <AdminPage demoMode />
      {savedNotice && (
        <output className="fixed bottom-20 left-1/2 z-[110] -translate-x-1/2 rounded-sm bg-[#26231d] px-5 py-3 text-center text-xs text-white shadow-xl">
          体験モード: 画面内だけに反映しました。実際には保存されません。
        </output>
      )}
    </>
  );
}
