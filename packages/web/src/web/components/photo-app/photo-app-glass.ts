import { useEffect, type RefObject } from "react";

/** One small optical layer, created after first paint. No scroll/pointer render loop. */
export function usePhotoAppGlass(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (
      !element ||
      !/Chrome|Chromium/.test(navigator.userAgent) ||
      !CSS.supports("backdrop-filter", 'url("#glass")')
    )
      return;
    const contrast = matchMedia("(prefers-contrast: more)"),
      transparency = matchMedia("(prefers-reduced-transparency: reduce)");
    const touch = matchMedia("(pointer: coarse)");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("pa-glass-definitions");
    svg.setAttribute("aria-hidden", "true");
    element.append(svg);
    const surfaces = [
      ...element.querySelectorAll<HTMLElement>("[data-pa-lens]"),
    ];
    const sizes = new WeakMap<HTMLElement, string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const enabled =
        !contrast.matches && !transparency.matches && !touch.matches;
      surfaces.forEach((surface, index) => {
        if (!enabled) {
          surface.style.removeProperty("backdrop-filter");
          sizes.delete(surface);
          return;
        }
        const width = Math.ceil(surface.offsetWidth),
          height = Math.ceil(surface.offsetHeight);
        if (!width || !height) return;
        const size = `${width}:${height}`;
        if (sizes.get(surface) === size) return;
        sizes.set(surface, size);
        // A width cap bounds texture work even on an ultra-wide display.
        const mapWidth = Math.min(width, 1200),
          scaleX = mapWidth / width;
        const canvas = document.createElement("canvas");
        canvas.width = mapWidth;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return;
        const data = context.createImageData(mapWidth, height),
          radius = Math.min(24, height / 2),
          edge = 12;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < mapWidth; x++) {
            const px = (x + 0.5) / scaleX,
              py = y + 0.5;
            const cx = Math.max(radius, Math.min(width - radius, px)),
              cy = Math.max(radius, Math.min(height - radius, py));
            let nx = px - cx,
              ny = py - cy;
            const length = Math.hypot(nx, ny);
            const distance = length
              ? radius - length
              : Math.min(px, width - px, py, height - py);
            if (length) {
              nx /= length;
              ny /= length;
            } else {
              nx = distance === px ? -1 : distance === width - px ? 1 : 0;
              ny = distance === py ? -1 : distance === height - py ? 1 : 0;
            }
            const amount =
                Math.max(0, 1 - Math.max(0, distance) / edge) ** 2 * 80,
              offset = (y * mapWidth + x) * 4;
            data.data[offset] = 128 + nx * amount;
            data.data[offset + 1] = 128 + ny * amount;
            data.data[offset + 2] = 128;
            data.data[offset + 3] = 255;
          }
        context.putImageData(data, 0, 0);
        const id = `pa-lens-${index}`,
          filter = document.createElementNS(svg.namespaceURI, "filter");
        filter.id = id;
        filter.setAttribute("filterUnits", "userSpaceOnUse");
        filter.setAttribute("x", "0");
        filter.setAttribute("y", "0");
        filter.setAttribute("width", String(width));
        filter.setAttribute("height", String(height));
        filter.setAttribute("color-interpolation-filters", "sRGB");
        const map = document.createElementNS(svg.namespaceURI, "feImage");
        map.setAttribute("href", canvas.toDataURL());
        map.setAttribute("width", String(width));
        map.setAttribute("height", String(height));
        map.setAttribute("preserveAspectRatio", "none");
        map.setAttribute("result", "edge");
        const displacement = document.createElementNS(
          svg.namespaceURI,
          "feDisplacementMap",
        );
        displacement.setAttribute("in", "SourceGraphic");
        displacement.setAttribute("in2", "edge");
        displacement.setAttribute("scale", "14");
        displacement.setAttribute("xChannelSelector", "R");
        displacement.setAttribute("yChannelSelector", "G");
        filter.append(map, displacement);
        svg.querySelector(`#${id}`)?.remove();
        svg.append(filter);
        surface.style.backdropFilter = `blur(10px) saturate(1.25) url("#${id}")`;
      });
    };
    // Resize changes are coalesced; the optical map never blocks row scrolling.
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 150);
    };
    const observer = new ResizeObserver(schedule);
    surfaces.forEach((surface) => observer.observe(surface));
    [contrast, transparency, touch].forEach((query) =>
      query.addEventListener("change", schedule),
    );
    schedule();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      svg.remove();
      surfaces.forEach((surface) =>
        surface.style.removeProperty("backdrop-filter"),
      );
      [contrast, transparency, touch].forEach((query) =>
        query.removeEventListener("change", schedule),
      );
    };
  }, [root]);
}
