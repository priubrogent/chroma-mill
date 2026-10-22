// Small helpers shared by every demo.
window.CM = window.CM || { data: {}, captures: {} };
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);

  const el = (t, a = {}, ...kids) => {
    const e = document.createElement(t);
    for (const [k, v] of Object.entries(a)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of kids) if (c != null) e.append(c);
    return e;
  };

  const SVGNS = 'http://www.w3.org/2000/svg';
  const sv = (t, a = {}) => {
    const e = document.createElementNS(SVGNS, t);
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
    return e;
  };

  // Load a <script> once. Unlike fetch(), this also works when the page is opened from disk (file://).
  const scripts = new Map();
  const loadScript = src => {
    if (!scripts.has(src)) scripts.set(src, new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error(`could not load ${src}`));
      document.head.append(s);
    }));
    return scripts.get(src);
  };
  // Page data: static/data/<name>.js, generated from <name>.json by tools/make_js_data.py
  const getData = name => loadScript(`static/data/${name}.js`).then(() => CM.data[name]);
  const pad = n => String(n).padStart(2, '0');
  const f2 = v => v == null ? '–' : v.toFixed(2);
  const ILLS = ['white', 'red', 'green', 'blue'];

  // Bulma-style toggle group: the pressed button is dark, the others plain.
  function press(group, btn) {
    for (const b of group.querySelectorAll('button')) {
      const on = b === btn;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-dark', on);
    }
  }

  function toggleButton(label, on, attrs = {}) {
    const b = el('button', { type: 'button', class: 'button is-small is-rounded' + (on ? ' is-dark' : ''), 'aria-pressed': on ? 'true' : 'false', ...attrs });
    if (typeof label === 'string') b.textContent = label; else b.append(...label);
    return b;
  }

  // xy -> approximate display colour, for swatches
  function xyToCss(x, y) {
    const X = x / y, Y = 1, Z = (1 - x - y) / y;
    let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    r = Math.max(r, 0); g = Math.max(g, 0); b = Math.max(b, 0);
    const m = Math.max(r, g, b) || 1;
    const o = v => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
    return `rgb(${o(r / m)},${o(g / m)},${o(b / m)})`;
  }

  // Colour of a light with chromaticity xy at relative linear intensity k (1 = full power)
  function lightCss(x, y, k) {
    const X = x / y, Y = 1, Z = (1 - x - y) / y;
    const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z].map(v => Math.max(v, 0));
    const m = Math.max(...lin) || 1;
    const o = v => { v = Math.min(1, v / m * k); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
    return `rgb(${lin.map(o).join(',')})`;
  }

  function prettyBlend(id) {
    if (ILLS.includes(id)) return id;
    if (id === 'red_green_blue_33') return 'R+G+B, ⅓ each';
    if (id === 'red_green_white_33') return 'R+G+W, ⅓ each';
    return id.replace(/([a-z]+)(\d+)/g, '$1 $2%').replace('_', ' / ');
  }

  const swatch = (x, y) => el('span', { class: 'sw', style: `background:${xyToCss(x, y)}` });

  const NAMES = {
    input: 'Input', mirnet_dwb: 'MIRNet + DWB', darkir_dwb: 'DarkIR + DWB', promptnorm_rlawb: 'PromptNorm + RL-AWB',
    ti_retinexformer_dwb: 'TI-Retinexformer + DWB', ours: 'Ours', gt: 'Ground truth',
  };

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  CM.util = { $, el, sv, loadScript, getData, pad, f2, ILLS, press, toggleButton, xyToCss, lightCss, prettyBlend, swatch, NAMES, reducedMotion };
})();
