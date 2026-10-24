import { useEffect } from "react";

/**
 * Lazy sales/guide content may mount after the browser has tried its anchor.
 *
 * `followLayoutMs`（2026-10-24）: 印より上や下の中身が後から届くページ（Info の料金と依頼は、
 * 料金の取り寄せを待って描かれる）。最初の1回の時点ではページが短く、印まで送れずに途中で止まって
 * いた（隔離 smoke で印が画面の上から 180〜380px）。その時間のあいだだけ、ページの高さが変わる
 * たびに印へ合わせ直す。読む人が自分で動かしたら（ホイール・指・キー・押す）、そこでやめる。
 */
export function useInitialHashScroll({ followLayoutMs = 0 }: { followLayoutMs?: number } = {}) {
  useEffect(() => {
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!id) return;
    const land = () =>
      document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" });
    let second = 0;
    // Let the route's initial scroll reset finish. Without followLayoutMs this
    // runs once, with no retry timer that could pull the reader back after they
    // start scrolling.
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(land);
    });
    let stopFollowing = () => {};
    if (followLayoutMs > 0 && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => land());
      observer.observe(document.body);
      const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
      const timer = window.setTimeout(() => stopFollowing(), followLayoutMs);
      stopFollowing = () => {
        observer.disconnect();
        window.clearTimeout(timer);
        for (const e of events) window.removeEventListener(e, stopFollowing);
      };
      for (const e of events) window.addEventListener(e, stopFollowing, { passive: true });
    }
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      stopFollowing();
    };
  }, [followLayoutMs]);
}
