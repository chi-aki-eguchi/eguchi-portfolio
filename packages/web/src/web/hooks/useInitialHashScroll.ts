import { useEffect, useRef } from "react";

/**
 * Lazy sales/guide content may mount after the browser has tried its anchor.
 *
 * `followLayoutMs`（2026-10-24）: 印より上や下の中身が後から届くページ（Info の料金と依頼は、
 * 料金の取り寄せを待って描かれる）。最初の1回の時点ではページが短く、印まで送れずに途中で止まって
 * いた（隔離 smoke で印が画面の上から 180〜380px）。その時間のあいだだけ、ページの高さが変わる
 * たびに印へ合わせ直す。読む人が自分で動かしたら（ホイール・指・キー・押す）、そこでやめる。
 */
export function useInitialHashScroll({ followLayoutMs = 0, ready = true }: { followLayoutMs?: number; ready?: boolean } = {}) {
  const userMoved = useRef(false);
  useEffect(() => {
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!id || userMoved.current) return;
    const land = () => {
      if (!userMoved.current) document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" });
    };
    let first = 0;
    let second = 0;
    // Let the route's initial scroll reset finish. Without followLayoutMs this
    // runs once, with no retry timer that could pull the reader back after they
    // start scrolling.
    if (ready) first = requestAnimationFrame(() => {
      second = requestAnimationFrame(land);
    });
    let stopFollowing = () => {};
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    const stopForInput = () => {
      userMoved.current = true;
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      stopFollowing();
    };
    // 読み込み待ちの間も操作を記憶し、到着後に読む人を引き戻さない。
    for (const e of events) window.addEventListener(e, stopForInput, { passive: true });
    if (ready && followLayoutMs > 0 && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => land());
      observer.observe(document.body);
      const timer = window.setTimeout(() => stopFollowing(), followLayoutMs);
      stopFollowing = () => {
        observer.disconnect();
        window.clearTimeout(timer);
      };
    }
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      stopFollowing();
      for (const e of events) window.removeEventListener(e, stopForInput);
    };
  }, [followLayoutMs, ready]);
}
