// Before/after split viewer used by Figures 6 and 7. Sprites are one row of n images.
(() => {
  'use strict';
  const { el } = CM.util;

  function makeSplit(root) {
    root.innerHTML = '';
    const L = el('div', { class: 'layer' }), R = el('div', { class: 'layer' });
    const bar = el('div', { class: 'bar' });
    const knob = el('button', { type: 'button', class: 'knob', 'aria-label': 'Move divider (arrow keys)' },
      el('i', { class: 'fas fa-arrows-alt-h', 'aria-hidden': 'true' }));
    const ll = el('span', { class: 'lab l' }), rl = el('span', { class: 'lab r' });
    root.append(L, R, bar, knob, ll, rl);
    let pos = 0.5, n = 1, sprite = '';
    const place = () => { R.style.clipPath = `inset(0 0 0 ${pos * 100}%)`; bar.style.left = knob.style.left = `${pos * 100}%`; };
    const bg = (layer, i) => {
      layer.style.backgroundImage = `url("${sprite}")`;
      layer.style.backgroundSize = `${n * 100}% 100%`;
      layer.style.backgroundPosition = `${n > 1 ? i / (n - 1) * 100 : 0}% 0`;
    };
    let down = false;
    const move = e => { const r = root.getBoundingClientRect(); pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); place(); };
    root.addEventListener('pointerdown', e => { down = true; root.setPointerCapture(e.pointerId); move(e); });
    root.addEventListener('pointermove', e => { if (down) move(e); });
    root.addEventListener('pointerup', () => { down = false; });
    root.addEventListener('pointercancel', () => { down = false; });
    knob.addEventListener('keydown', e => {
      const d = { ArrowLeft: -0.05, ArrowRight: 0.05 }[e.key];
      if (d) { e.preventDefault(); pos = Math.max(0, Math.min(1, pos + d)); place(); }
    });
    place();
    return {
      set(src, count, li, ri, lname, rname, aspect) {
        sprite = src; n = count; bg(L, li); bg(R, ri);
        ll.textContent = lname; rl.textContent = rname;
        if (aspect) root.style.aspectRatio = aspect;
      },
    };
  }

  // Thumbnail strip + left/right selects + split viewer, shared by Figures 6 and 7.
  function methodSelects(leftSel, rightSel, methods, names, st, onChange) {
    for (const [s, side] of [[leftSel, 'left'], [rightSel, 'right']]) {
      for (const m of methods) s.append(el('option', { value: m, text: names[m] }));
      s.value = st[side];
      s.addEventListener('change', () => { st[side] = s.value; onChange(); });
    }
  }

  CM.split = { makeSplit, methodSelects };
})();
