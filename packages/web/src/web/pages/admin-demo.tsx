import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isServiceOwnerSite, resolveServiceVisibility } from "../../shared/service-visibility";
import { ADMIN_DEMO_WRITE_EVENT, installAdminDemoFetch } from "../lib/admin-demo-fetch";
import { api } from "../lib/api";
import AdminPage from "./admin";
import {
  AdminLanguageProvider,
  AdminLanguageToggle,
  useAdminI18n,
} from "./admin-i18n";

export default function AdminDemoPage() {
  return (
    <AdminLanguageProvider>
      <AdminDemoContent />
    </AdminLanguageProvider>
  );
}

function AdminDemoContent() {
  const queryClient = useQueryClient();
  const { t } = useAdminI18n();
  const ownerSite = typeof window !== "undefined" && isServiceOwnerSite(undefined, window.location.hostname);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(ownerSite ? null : false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const guideDialogRef = useRef<HTMLDialogElement>(null);
  const [demoSeed] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!ownerSite) return;
    let restore: (() => void) | undefined;
    let cancelled = false;
    const onWrite = () => {
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2400);
    };
    void api.settings
      .$get()
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
      if (restore) {
        restore();
        // デモ中に共有Query cacheへ入った偽のsettings/カテゴリ等を破棄する。
        // fetchを戻すだけではstaleTime内(設定60s・一覧5分)の通常ページが
        // デモ内容を表示し続ける(Codexデバッグ 2026-07-20 P2)
        queryClient.removeQueries();
      }
    };
  }, [demoSeed, ownerSite, queryClient]);

  useEffect(() => {
    if (!ready || !showGuide) return;
    const dialog = guideDialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    dialog.querySelector<HTMLElement>("[data-admin-demo-guide-start]")?.focus();
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
    };
  }, [ready, showGuide]);

  if (available === false) return <main className="grid min-h-screen place-items-center"><p>404 — Page not found</p></main>;
  if (!ready) return <div className="h-screen w-full" />;
  return (
    <>
      <AdminPage demoMode demoSeed={demoSeed} />
      {showGuide && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/25 px-5" role="presentation">
          <dialog ref={guideDialogRef} onCancel={(event) => { event.preventDefault(); setShowGuide(false); }} className="relative w-full max-w-md rounded-sm bg-[#f7f4ec] p-6 text-[#332f28] shadow-2xl" aria-labelledby="admin-demo-guide-title" data-admin-demo-guide>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#817868]">{t.demo.guideEyebrow}</p>
                <h1 id="admin-demo-guide-title" className="mt-1 text-lg font-medium">{t.demo.guideTitle}</h1>
              </div>
              <div className="flex items-center gap-3">
                <AdminLanguageToggle className="text-[#746c60]" />
                <button type="button" onClick={() => setShowGuide(false)} className="text-xs text-[#746c60] underline underline-offset-4">{t.common.close}</button>
              </div>
            </div>
            <ol className="mt-5 space-y-4 text-sm leading-relaxed">
              {t.demo.guideSteps.map((step, index) => (
                <li key={step}>
                  <span className="mr-2 text-[#8b7650]">{String(index + 1).padStart(2, "0")}</span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-[#d9d2c5] pt-4 text-xs leading-relaxed text-[#746c60]">{t.demo.guideNote}</p>
            <button type="button" data-admin-demo-guide-start onClick={() => setShowGuide(false)} className="mt-5 w-full rounded-sm bg-[#332f28] px-4 py-3 text-xs text-white">{t.demo.guideStart}</button>
          </dialog>
        </div>
      )}
      {savedNotice && (
        <output className="fixed bottom-20 left-1/2 z-[110] -translate-x-1/2 rounded-sm bg-[#26231d] px-5 py-3 text-center text-xs text-white shadow-xl">
          {t.demo.savedNotice}
        </output>
      )}
    </>
  );
}
