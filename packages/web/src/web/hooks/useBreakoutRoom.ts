import { useLayoutEffect, useState, type RefObject } from "react";

export type BreakoutRoom = {
  /** The width the surrounding page hands the element. */
  natural: number;
  /** The widest it can grow while staying inside the viewport. */
  available: number;
};

/**
 * How far an element may break out of its page column.
 *
 * **A plain `100vw` breakout is wrong on this site.** With `navPosition: left`
 * the fixed sidebar pushes the content column off the viewport's centre, so a
 * viewport-width element centred on the column overflows past the right edge.
 * The gallery learnt this the hard way; this is that measurement, extracted so
 * the series cover cannot repeat the mistake.
 *
 * Both numbers are read from the element's **parent**, because callers set a
 * width on the element itself — measuring their own width would feed back into
 * itself. Measured directly rather than through a ResizeObserver alone: the
 * width has to be decided on the first layout pass, and an observer's initial
 * callback is not guaranteed to have arrived by then.
 */
export function useBreakoutRoom(
  ref: RefObject<HTMLElement | null>,
): BreakoutRoom {
  const [room, setRoom] = useState<BreakoutRoom>({ natural: 0, available: 0 });
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const cs = window.getComputedStyle(parent);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const natural =
        parent.clientWidth - padL - (parseFloat(cs.paddingRight) || 0);
      if (natural <= 0) return;
      // Grow symmetrically about the parent's centre, so the shorter side is
      // the limit.
      const centre = parent.getBoundingClientRect().left + padL + natural / 2;
      const viewport = document.documentElement.clientWidth; // excludes scrollbar
      const available = 2 * Math.min(centre, viewport - centre) - 32;
      setRoom((prev) =>
        prev.natural === natural && prev.available === available
          ? prev
          : { natural, available },
      );
    };
    measure();
    // Re-measure on viewport changes, and on anything that resizes the shell
    // without one (sidebar collapse, zoom, a late web font).
    window.addEventListener("resize", measure);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    ro?.observe(parent);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [ref]);
  return room;
}
