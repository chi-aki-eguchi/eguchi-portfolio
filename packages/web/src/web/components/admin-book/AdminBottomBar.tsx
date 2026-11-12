import { useEffect, useId, useRef, useState } from "react";
import { adminApi } from "../../lib/api";
import "./admin-book.css";

/**
 * `?from=` で渡された戻り先を確かめる。同じサイトの /admin から始まる相対の道だけ受け取り、
 * 外のサイト（//example.com・https://…）や /admin 以外は無かったことにして既定へ戻す。
 */
export function safeAdminFrom(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f\s]/.test(raw)) return fallback;
  return /^\/admin(?:[/?#].*)?$/.test(raw) && !raw.startsWith("/admin//") ? raw : fallback;
}

/**
 * 管理画面の「ページの写真」（/admin/pages）と「言葉」（/admin/words）の下の入口（スマホだけ、2026-11-12）。
 *
 * この2画面は管理画面の本体（BookAdminShell）の外にある別ページで、今までは「← 戻る」しか無く、
 * 必ず「写真」へ戻された。本体と同じ 写真／シリーズ／サイト／言葉／メニュー の5つを下に出して、
 * どこへでも1回で行けるようにする。見た目は本体の入口と同じクラス（admin-book.css）を使う。
 *
 * 本体の「メニュー」にある 探す（⌘K）と 暗い表示 は、本体の状態（検索の窓・明暗の保存）に
 * 結ばれているのでここには置かない。サイトを見る・PDF作品集・ログアウトだけ。
 * 言葉の切り替え（JP / EN）も、この2画面が日本語だけなので出さない。
 */
export function AdminBottomBar({ current }: { current: "site" | "words" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toolsId = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-book-menu-button]")) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const logout = async () => {
    setOpen(false);
    try {
      await adminApi.logout.$post();
    } catch {
      // 失敗しても、半分ログアウトした画面に残るよりログインへ送る（本体と同じ）。
    }
    window.location.assign("/admin/login");
  };

  const entries: { id: string; label: string; href: string }[] = [
    { id: "photos", label: "写真", href: "/admin#photos" },
    { id: "series", label: "シリーズ", href: "/admin#series" },
    { id: "site", label: "サイト", href: "/admin#site" },
    { id: "words", label: "言葉", href: "/admin/words" },
  ];
  return (
    <div className="abar" ref={rootRef}>
      <nav className="admin-book__tabs" aria-label="管理画面の入口">
        {entries.map((e) => (
          <a
            key={e.id}
            className="admin-book__tab admin-book__tab--link"
            data-book-tab={e.id}
            href={e.href}
            aria-current={current === e.id ? "page" : undefined}
          >
            {e.label}
          </a>
        ))}
        <button
          type="button"
          className="admin-book__barmenu"
          data-book-menu-button
          aria-expanded={open}
          aria-controls={toolsId}
          onClick={() => setOpen((v) => !v)}
        >
          メニュー
        </button>
      </nav>
      <div id={toolsId} className="admin-book__tools" data-open={open || undefined}>
        <a className="admin-book__tool" href="/" target="_blank" rel="noopener" onClick={() => setOpen(false)}>
          サイトを見る ↗
        </a>
        <a className="admin-book__tool" href="/admin/pdf" target="_blank" rel="noopener" onClick={() => setOpen(false)}>
          PDF作品集
        </a>
        <button type="button" className="admin-book__tool admin-book__tool--quiet" onClick={() => void logout()}>
          ログアウト
        </button>
      </div>
    </div>
  );
}
