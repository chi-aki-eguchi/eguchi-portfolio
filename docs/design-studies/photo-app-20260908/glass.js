/* Web optical treatment: a bounded edge-displacement map plus a CSS fallback.
   This does not load Apple resources or modify photograph pixels. */
(() => {
  const root = document.documentElement;
  const defs = document.querySelector('#glass-filters');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const moreContrast = matchMedia('(prefers-contrast: more)');
  // WebKit currently gets the blur/specular implementation. URL filter support
  // advertised by its CSS parser alone does not establish working backdrop lensing.
  const canLens = /Chrome|Chromium/.test(navigator.userAgent) && CSS.supports('backdrop-filter', 'url("#test")');
  const groups = [...document.querySelectorAll('.primary-nav, .mobile-nav, .segmented')];
  const lenses = [...document.querySelectorAll('[data-lens]')];
  const sizes = new WeakMap();
  let scheduled = false;

  for (const group of groups) {
    const indicator = document.createElement('span');
    indicator.className = group.matches('.segmented') ? 'segment-indicator' : 'nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    group.prepend(indicator);
  }

  function selections() {
    for (const group of groups) {
      const selected = group.querySelector('a[aria-current="page"]');
      const indicator = group.firstElementChild;
      indicator.hidden = !selected || !group.offsetWidth;
      if (!selected || !group.offsetWidth) continue;
      indicator.style.width = `${selected.offsetWidth}px`;
      indicator.style.height = `${selected.offsetHeight}px`;
      indicator.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`;
    }
  }

  function displacementMap(width, height, radius) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const map = context.createImageData(width, height);
    const edge = Math.min(14, height / 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x + .5, py = y + .5;
        const cx = Math.max(radius, Math.min(width - radius, px));
        const cy = Math.max(radius, Math.min(height - radius, py));
        let nx = px - cx, ny = py - cy;
        const length = Math.hypot(nx, ny);
        let distance;
        if (length > 0) {
          distance = radius - length;
          nx /= length;
          ny /= length;
        } else {
          const sides = [px, width - px, py, height - py];
          distance = Math.min(...sides);
          const side = sides.indexOf(distance);
          nx = side === 0 ? -1 : side === 1 ? 1 : 0;
          ny = side === 2 ? -1 : side === 3 ? 1 : 0;
        }
        const amount = Math.pow(Math.max(0, 1 - Math.max(0, distance) / edge), 2) * 91;
        const i = (y * width + x) * 4;
        map.data[i] = Math.round(128 + nx * amount);
        map.data[i + 1] = Math.round(128 + ny * amount);
        map.data[i + 2] = 128;
        map.data[i + 3] = 255;
      }
    }
    context.putImageData(map, 0, 0);
    return canvas.toDataURL();
  }

  function updateLens(element, index) {
    const width = Math.ceil(element.offsetWidth), height = Math.ceil(element.offsetHeight);
    if (!width || !height) return;
    const id = `photo-glass-${index}`;
    const previous = sizes.get(element);
    if (previous?.width === width && previous?.height === height) return;
    sizes.set(element, { width, height });
    let filter = document.getElementById(id);
    if (!filter) {
      filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.id = id;
      defs.append(filter);
    }
    const radius = Math.min(parseFloat(getComputedStyle(element).borderRadius) || 24, height / 2);
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', width);
    filter.setAttribute('height', height);
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.innerHTML = `<feImage href="${displacementMap(width, height, radius)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" result="edge"/><feDisplacementMap in="SourceGraphic" in2="edge" scale="20" xChannelSelector="R" yChannelSelector="G"/>`;
    element.style.backdropFilter = `blur(10px) saturate(1.4) url("#${id}")`;
    element.dataset.refraction = 'edge-map';
  }

  function refresh() {
    scheduled = false;
    selections();
    const enabled = canLens && !reducedTransparency.matches && !moreContrast.matches;
    root.dataset.glass = enabled ? 'refraction' : 'translucent';
    lenses.forEach((element, index) => {
      if (enabled) updateLens(element, index);
      else {
        element.style.removeProperty('backdrop-filter');
        delete element.dataset.refraction;
        sizes.delete(element);
      }
    });
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); }
  }
  const observer = new ResizeObserver(schedule);
  [...groups, ...lenses].forEach(element => observer.observe(element));
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.querySelector('.app'), { subtree: true, attributes: true, attributeFilter: ['aria-current', 'hidden'] });
  viewer.addEventListener('close', schedule);
  window.addEventListener('resize', schedule);
  for (const preference of [reducedMotion, reducedTransparency, moreContrast]) preference.addEventListener('change', schedule);

  for (const surface of document.querySelectorAll('.glass')) {
    let point = null, frame = false;
    surface.addEventListener('pointermove', event => {
      if (reducedMotion.matches || event.pointerType === 'touch') return;
      point = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = true;
      requestAnimationFrame(() => {
        frame = false;
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty('--light-x', `${point.x - rect.left}px`);
        surface.style.setProperty('--light-y', `${point.y - rect.top}px`);
      });
    });
    surface.addEventListener('pointerdown', () => surface.classList.add('is-pressed'));
    for (const event of ['pointerup', 'pointercancel', 'pointerleave']) {
      surface.addEventListener(event, () => surface.classList.remove('is-pressed'));
    }
  }
  window.PhotoGlass = { refresh: schedule };
  refresh();
})();
