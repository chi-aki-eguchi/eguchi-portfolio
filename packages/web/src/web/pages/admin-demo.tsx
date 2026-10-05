import { X } from "lucide-react";
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
  const { t, language } = useAdminI18n();
  const ownerSite = typeof window !== "undefined" && isServiceOwnerSite(undefined, window.location.hostname);
  // The read-only local preview can show the owner's demo as well. Production
  // customer hosts stay closed; local access still checks the fetched site URL.
  const localPreview = import.meta.env.DEV && typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const canCheckAvailability = ownerSite || localPreview;
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(canCheckAvailability ? null : false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const guideDialogRef = useRef<HTMLDialogElement>(null);
  const [demoSeed] = useState(() => `${new URLSearchParams(window.location.search).get("intro") === "1" ? "intro-" : ""}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const introDemo = demoSeed.startsWith("intro-");
  const guideSteps = introDemo ? language === "ja"
    ? ["見本の紹介ページで、文章・画像・外部リンク・制作情報を編集できます。", "部品を並べ替えて「紹介ページを保存」。上の「サイトで見る」で仕上がりを見られます。", "「文章で伝える実績」の見本では、写真のない仕事の紹介も試せます。"]
    : ["Edit text, images, links and details in the sample introductions.", "Reorder the blocks and save, then open the public page to see the result.", "Try the text-only sample to present work without photographs."]
    : t.demo.guideSteps;

  useEffect(() => {
    if (!canCheckAvailability) return;
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
        const allowed = isServiceOwnerSite(settings.siteUrl, window.location.hostname) && resolveServiceVisibility(settings.servicePageMode, settings.siteUrl, window.location.hostname);
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
  }, [demoSeed, canCheckAvailability, queryClient]);

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
        <div>
          <dialog ref={guideDialogRef} onCancel={(event) => { event.preventDefault(); setShowGuide(false); }} className="admin-demo-guide" aria-labelledby="admin-demo-guide-title" data-admin-demo-guide>
            <div className="admin-demo-guide__heading">
              <h1 id="admin-demo-guide-title" className="text-lg font-medium">{t.demo.guideTitle}</h1>
              <div className="admin-demo-guide__tools">
                <AdminLanguageToggle />
                <button type="button" onClick={() => setShowGuide(false)} aria-label={t.common.close}><X size={18} /></button>
              </div>
            </div>
            {/* 2026-09-29: 金色の番号・茶色のボタン・英字の肩書きをやめ、管理画面と同じ黒と灰の文字で。 */}
            <ol className="admin-demo-guide__steps mt-4 text-sm leading-relaxed">
              {guideSteps.map((step, index) => (
                <li key={step}>
                  <span className="admin-demo-guide__num" aria-hidden="true">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="admin-demo-guide__note mt-5 pt-4 text-[13px] leading-relaxed">{t.demo.guideNote}</p>
            <button type="button" data-admin-demo-guide-start onClick={() => setShowGuide(false)} className="admin-demo-guide__start mt-5 w-full rounded-[2px] px-4 py-3 text-sm">{t.demo.guideStart}</button>
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
