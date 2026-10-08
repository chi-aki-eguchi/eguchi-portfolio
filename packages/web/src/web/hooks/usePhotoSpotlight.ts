import { useEffect } from "react";

/** マウスが止まってから、まわりの写真が元の濃さへ戻るまでの時間。 */
export const SPOTLIGHT_IDLE_MS = 1300;

/**
 * 写真の並びの上でマウスを動かしているあいだだけ、触れた1枚を残して
 * まわりを少し沈める（幕そのものは styles.css の `.photo-card::after`）。
 *
 * **動かしているあいだだけ**にしている理由: PC では画面のほとんどが写真なので、
 * 「触れているあいだずっと」にすると、マウスを置いたまま眺めている人には
 * 壁の写真がいつも薄く見えてしまう。止めれば全部が元の濃さへ戻り、
 * 送る（スクロールする）あいだも戻す。
 *
 * ここでするのは `<body data-spot>` の付け外しだけ。指で触る端末では何もしない。
 */
export function usePhotoSpotlight() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const body = document.body;
    let on = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const off = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (!on) return;
      on = false;
      body.removeAttribute("data-spot");
    };
    // 送り終わった直後、ブラウザは「下の写真が替わった」ことを知らせるために、
    // マウスが動いていなくても同じ座標で move を出す（Safari で実測）。
    // それを「動かした」と数えると、送るたびに壁が一度沈んで戻る。
    let lastX = -1;
    let lastY = -1;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (e.clientX === lastX && e.clientY === lastY) return;
      lastX = e.clientX;
      lastY = e.clientY;
      const overPhoto = e.target instanceof Element && e.target.closest("main .photo-card");
      if (!overPhoto) {
        if (on) off();
        return;
      }
      if (!on) {
        on = true;
        body.setAttribute("data-spot", "");
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(off, SPOTLIGHT_IDLE_MS);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", off, { passive: true });
    window.addEventListener("blur", off);
    return () => {
      document.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", off);
      window.removeEventListener("blur", off);
      off();
    };
  }, []);
}
