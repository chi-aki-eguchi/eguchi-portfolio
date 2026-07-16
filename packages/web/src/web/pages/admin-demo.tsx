import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isServiceOwnerSite, resolveServiceVisibility } from "../../shared/service-visibility";
import { ADMIN_DEMO_WRITE_EVENT, installAdminDemoFetch } from "../lib/admin-demo-fetch";
import AdminPage from "./admin";

export default function AdminDemoPage() {
  const queryClient = useQueryClient();
  const ownerSite = typeof window !== "undefined" && isServiceOwnerSite(undefined, window.location.hostname);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(ownerSite ? null : false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [demoSeed] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

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
        restore = installAdminDemoFetch(demoSeed);
        // The app shell may have warmed the real public settings before the demo
        // route mounted. Remove that cache before any admin field can render it.
        queryClient.removeQueries({ queryKey: ["settings"] });
        window.addEventListener(ADMIN_DEMO_WRITE_EVENT, onWrite);
        setReady(true);
      })
      .catch(() => setAvailable(false));
    return () => {
      cancelled = true;
      window.removeEventListener(ADMIN_DEMO_WRITE_EVENT, onWrite);
      restore?.();
    };
  }, [demoSeed, ownerSite, queryClient]);

  if (available === false) return <main className="grid min-h-screen place-items-center"><p>404 — Page not found</p></main>;
  if (!ready) return <div className="h-screen w-full" />;
  return (
    <>
      <AdminPage demoMode demoSeed={demoSeed} />
      {showGuide && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/25 px-5" role="presentation">
          <dialog open className="relative w-full max-w-md rounded-sm bg-[#f7f4ec] p-6 text-[#332f28] shadow-2xl" aria-labelledby="admin-demo-guide-title" data-admin-demo-guide>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#817868]">Quick tour</p>
                <h1 id="admin-demo-guide-title" className="mt-1 text-lg font-medium">まず、3つだけ触ってみてください</h1>
              </div>
              <button type="button" onClick={() => setShowGuide(false)} className="text-xs text-[#746c60] underline underline-offset-4">閉じる</button>
            </div>
            <ol className="mt-5 space-y-4 text-sm leading-relaxed">
              <li><span className="mr-2 text-[#8b7650]">01</span>Galleryで写真のレイアウトを変える</li>
              <li><span className="mr-2 text-[#8b7650]">02</span>Settingsでフォントを選び、ライブプレビューを見る</li>
              <li><span className="mr-2 text-[#8b7650]">03</span>Libraryで写真を並び替え、「サイトで確認」を開く</li>
            </ol>
            <p className="mt-5 border-t border-[#d9d2c5] pt-4 text-xs leading-relaxed text-[#746c60]">変更はプレビューへその場で反映されます。保存しても本物のサイトには影響しません。</p>
            <button type="button" onClick={() => setShowGuide(false)} className="mt-5 w-full rounded-sm bg-[#332f28] px-4 py-3 text-xs text-white">体験をはじめる</button>
          </dialog>
        </div>
      )}
      {savedNotice && (
        <output className="fixed bottom-20 left-1/2 z-[110] -translate-x-1/2 rounded-sm bg-[#26231d] px-5 py-3 text-center text-xs text-white shadow-xl">
          体験モード: 画面内だけに反映しました。実際には保存されません。
        </output>
      )}
    </>
  );
}
