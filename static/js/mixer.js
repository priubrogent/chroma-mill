// Figure 1: relight one CHROMA-MILL scene from its four aligned linear captures.
(() => {
  'use strict';
  const { $, sv, getData, loadScript, pad, ILLS, xyToCss, lightCss, reducedMotion } = CM.util;

  const api = {};

  async function init(root) {
    const [D, SCENES] = await Promise.all([getData('mixer'), getData('scenes')]);
    const XY = {}, S = {};
    for (const k of ILLS) { XY[k] = D.illuminants[k].xy; S[k] = D.illuminants[k].reading.L11; }
    const sceneCaps = Object.fromEntries(SCENES.map(s => [s.id, new Set(s.captures)]));

    // ---- colour maths (matches generate_combinations.mix_xy) ----
    function mixXY(w) {
      let X = 0, Y = 0, Z = 0;
      for (const k of ILLS) {
        const L = (w[k] || 0) * S[k]; if (!L) continue;
        const [x, y] = XY[k]; X += L * x / y; Y += L; Z += L * (1 - x - y) / y;
      }
      const s = X + Y + Z; return [X / s, Y / s];
    }
    function bary(p, a, b, c) {
      const v0x = b[0] - a[0], v0y = b[1] - a[1], v1x = c[0] - a[0], v1y = c[1] - a[1], v2x = p[0] - a[0], v2y = p[1] - a[1];
      const d = v0x * v1y - v1x * v0y;
      const l1 = (v2x * v1y - v1x * v2y) / d, l2 = (v0x * v2y - v2x * v0y) / d;
      return [1 - l1 - l2, l1, l2];
    }
    const SUBTRI = [['red', 'green'], ['green', 'blue'], ['blue', 'red']];
    // xy point -> linear blend weights, using the white LED plus the two coloured LEDs of its sub-triangle.
    function weightsFor(p) {
      for (const [a, b] of SUBTRI) {
        const l = bary(p, XY[a], XY[b], XY.white);
        if (l.every(v => v >= -1e-9)) {
          // barycentric weights in xy are proportional to L_c / y_c; alpha_c = L_c / S_c
          const w = { white: 0, red: 0, green: 0, blue: 0 };
          w[a] = Math.max(l[0], 0) * XY[a][1] / S[a];
          w[b] = Math.max(l[1], 0) * XY[b][1] / S[b];
          w.white = Math.max(l[2], 0) * XY.white[1] / S.white;
          const s = w.white + w.red + w.green + w.blue;
          for (const k of ILLS) w[k] /= s;
          return w;
        }
      }
      return null;
    }
    function clampToHull(p) {
      const tri = [XY.red, XY.green, XY.blue];
      if (bary(p, ...tri).every(v => v >= 0)) return p;
      let best = null, bd = Infinity;
      for (let i = 0; i < 3; i++) {
        const a = tri[i], b = tri[(i + 1) % 3];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
        const q = [a[0] + t * dx, a[1] + t * dy], d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
        if (d < bd) { bd = d; best = q; }
      }
      return best;
    }
    api.mixXY = mixXY; api.weightsFor = weightsFor;

    // ---- diagram: horseshoe, locus, LED triangle, current point ----
    const svg = $('.cie-svg', root);
    const px = x => x * 1000, py = y => (0.9 - y) * 1000;   // 1.0 in xy = 1000 svg units
    const toXY = (sx, sy) => [sx / 1000, 0.9 - sy / 1000];
    svg.append(sv('image', { href: 'static/img/cie1931.png', x: 0, y: 0, width: 800, height: 900, preserveAspectRatio: 'none' }));
    const loc = D.locus.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`);
    svg.append(sv('path', { d: `M${loc.join('L')}Z`, fill: 'none', stroke: '#4a4a4a', 'stroke-width': 3 }));
    const hull = [XY.red, XY.green, XY.blue].map(([x, y]) => `${px(x)},${py(y)}`).join(' ');
    svg.append(sv('polygon', { points: hull, fill: 'rgba(255,255,255,.15)', stroke: '#363636', 'stroke-width': 3, 'stroke-dasharray': '12 9' }));
    for (const k of ILLS) {
      const [x, y] = XY[k];
      svg.append(sv('circle', { cx: px(x), cy: py(y), r: k === 'white' ? 13 : 16, fill: xyToCss(x, y), stroke: '#363636', 'stroke-width': 3 }));
    }
    const ring = sv('g', { style: 'pointer-events:none' });
    ring.append(sv('circle', { r: 24, fill: 'none', stroke: '#fff', 'stroke-width': 8 }));
    ring.append(sv('circle', { r: 24, fill: 'none', stroke: '#363636', 'stroke-width': 3.5 }));
    svg.append(ring);

    // ---- state + rendering ----
    const st = { p: null, w: null, level: 2, scene: 'Test13' };
    const has = name => sceneCaps[st.scene].has(name);
    const cache = new Map();
    const cv = $('.mixer-canvas', root), ctx = cv.getContext('2d');
    const note = $('.mixer-note', root), slider = $('.mixer-level', root), lvlVal = $('.mixer-level-val', root);
    // the title's lamps show the same light: this chromaticity at this level's measured intensity
    const titleStage = $('.wm-stage');
    const gtImg = $('.mixer-gt', root);
    const lamps = {};
    for (const s of root.querySelectorAll('.rig > span')) { lamps[s.dataset.k] = s; s.style.setProperty('--c', xyToCss(...XY[s.dataset.k])); }
    const reading = L => D.illuminants.white.reading[`L${pad(L)}`];
    const intensity = x => { const lo = Math.floor(x), f = x - lo; return (f ? reading(lo) * (1 - f) + reading(lo + 1) * f : reading(lo)) / S.white; };
    // captures to blend for light k at a (possibly fractional) level x: the nearest captured
    // levels below and above, weighted linearly. A whole level that exists gives just itself.
    function levelTerms(k, x) {
      let lo = 0, hi = 0;
      for (let L = 1; L <= 11; L++) if (has(`${k}_L${pad(L)}`)) { if (L <= x) lo = L; if (L >= x && !hi) hi = L; }
      if (!lo) return [[hi, 1]];
      if (!hi || lo === hi) return [[lo, 1]];
      const f = (x - lo) / (hi - lo);
      return [[lo, 1 - f], [hi, f]];
    }
    // 4081-entry sRGB OETF LUT indexed by floor(16 * linear value in 0-255 units)
    const LUT = new Uint8ClampedArray(4081);
    for (let i = 0; i <= 4080; i++) { const v = Math.min(1, i / 16 / 255); LUT[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
    const outBuf = ctx.createImageData(600, 400);

    function loadCapture(name, scene = st.scene) {
      const key = `${scene}/${name}`;
      if (cache.has(key)) return cache.get(key);
      const pr = (async () => {
        // captures arrive as data: URIs (tools/make_js_data.py) so the canvas stays readable on file://
        await loadScript(`static/mixer/linear_js/${key}.js`);
        const blob = await fetch(CM.captures[key]).then(r => r.blob());
        let src;
        try { src = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); }
        catch (e) { src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(blob); }); }
        const c = document.createElement('canvas'); c.width = 600; c.height = 400;
        const x = c.getContext('2d'); x.drawImage(src, 0, 0, 600, 400);
        return x.getImageData(0, 0, 600, 400).data;
      })();
      cache.set(key, pr);
      return pr;
    }

    let renderToken = 0;
    async function render() {
      const tok = ++renderToken;
      const L = st.level, w = st.w, shown = Math.round(L);
      ring.setAttribute('transform', `translate(${px(st.p[0])},${py(st.p[1])})`);
      lvlVal.textContent = String(shown);
      // the title and the rig only use the top of the range: Levels 1-11 map onto the light of Levels 9-11
      const k0 = intensity(1), k9 = intensity(9);
      const kTop = k9 + (intensity(L) - k0) / (1 - k0) * (1 - k9);
      if (titleStage) titleStage.style.setProperty('--light', lightCss(st.p[0], st.p[1], kTop));
      const wMax = Math.max(...ILLS.map(k => w[k]));
      for (const k of ILLS) lamps[k].style.setProperty('--a', (w[k] / wMax * kTop).toFixed(3));
      const lights = ILLS.filter(k => w[k] > 1e-6);
      // a chosen whole level whose capture is missing is reported; in-between levels interpolate
      const missing = Number.isInteger(L) ? lights.filter(k => !has(`${k}_L${pad(L)}`)) : [];
      if (missing.length) {
        // no capture to show: blank the frame rather than leave the previous level on screen
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 600, 400);
        note.hidden = false;
        note.textContent = `No ${missing.join(' or ')} capture at Level ${L} for this scene.`;
        return;
      }
      note.hidden = true;
      const terms = lights.flatMap(k => levelTerms(k, L).filter(([, f]) => f > 0).map(([lv, f]) => [`${k}_L${pad(lv)}`, w[k] * f]));
      const datas = await Promise.all(terms.map(([n]) => loadCapture(n)));
      if (tok !== renderToken) return;
      const ws = terms.map(([, a]) => a * 16);
      const o = outBuf.data, N = 600 * 400 * 4, n = datas.length;
      for (let i = 0; i < N; i += 4) {
        let r = 0, g = 0, b = 0;
        for (let j = 0; j < n; j++) { const d = datas[j], a = ws[j]; r += d[i] * a; g += d[i + 1] * a; b += d[i + 2] * a; }
        o[i] = LUT[r > 4080 ? 4080 : r | 0]; o[i + 1] = LUT[g > 4080 ? 4080 : g | 0]; o[i + 2] = LUT[b > 4080 ? 4080 : b | 0]; o[i + 3] = 255;
      }
      ctx.putImageData(outBuf, 0, 0);
      api.rendered = true;
    }
    let raf = 0;
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

    function setFree(p) { p = clampToHull(p); st.p = p; st.w = weightsFor(p); schedule(); }
    function setWeights(w, xy) { st.w = { white: 0, red: 0, green: 0, blue: 0, ...w }; st.p = xy.slice(); schedule(); }
    function setLevel(L) { st.level = L; slider.step = 1; slider.value = L; schedule(); }
    // Used by Figure 3: one LED at full weight, at the chosen level.
    // Used by Figure 2 (captures of Test13): one LED at full weight, at the chosen level.
    api.setIll = (ill, L) => { stopAuto(); setScene('Test13'); setLevel(L); setWeights({ [ill]: 1 }, XY[ill]); };

    // scene buttons: switching scene keeps the light and the level
    const sceneBar = $('.mixer-scenes', root);
    const sceneBtns = {};
    function setScene(id) {
      st.scene = id;
      gtImg.src = SCENES.find(s => s.id === id).gt;
      for (const [k, b] of Object.entries(sceneBtns)) { const on = k === id; b.classList.toggle('is-dark', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
      schedule();
    }
    SCENES.forEach((sc, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'button is-rounded';
      b.innerHTML = `<span class="scene-thumb" style="background-image:url('${sc.gt}')"></span><span>Scene ${i + 1}</span>`;
      b.addEventListener('click', () => setScene(sc.id));
      sceneBtns[sc.id] = b; sceneBar.append(b);
    });
    setScene(st.scene);

    // pointer + keyboard
    function evtXY(e) {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      return toXY(q.x, q.y);
    }
    let dragging = false;
    svg.addEventListener('pointerdown', e => { dragging = true; svg.setPointerCapture(e.pointerId); setFree(evtXY(e)); });
    svg.addEventListener('pointermove', e => { if (dragging) setFree(evtXY(e)); });
    svg.addEventListener('pointerup', () => { dragging = false; });
    svg.addEventListener('pointercancel', () => { dragging = false; });
    svg.addEventListener('keydown', e => {
      const s = e.shiftKey ? 0.02 : 0.005;
      const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
      if (!d) return; e.preventDefault(); setFree([st.p[0] + d[0], st.p[1] + d[1]]);
    });
    slider.addEventListener('input', e => setLevel(+e.target.value));

    // initial state: the red/blue blend from the paper's Fig. 3, Level 2 (exact dataset weights)
    const init = D.conditions.find(c => c.level === 2 && c.blend === 'red50_blue50');
    const showInitial = () => { setLevel(2); setWeights(init.w, init.xy); };
    showInitial();

    // ---- autoplay: until someone touches the figure, the light wanders through the whole
    // triangle (three slow, unrelated sines set the R, G, B weights) while the intensity glides
    // between Level 2 and Level 11, blending neighbouring captures in linear light.
    const COLOR_S = [11.3, 17.9, 23.7], LEVEL_S = 12;
    let auto = !reducedMotion(), onScreen = true, t0 = 0;
    function stopAuto() {
      if (!auto) return;
      auto = false;
      setLevel(Math.round(st.level));   // hand back a whole level; the slider snaps from here on
    }
    api.stopAuto = stopAuto;
    api.showInitial = () => { stopAuto(); showInitial(); };
    const corners = [XY.red, XY.green, XY.blue];
    function colorAt(t) {
      const b = COLOR_S.map((T, i) => (1 + Math.sin(2 * Math.PI * t / T + i * 2.1)) ** 2);
      const s = b[0] + b[1] + b[2];
      return [0, 1].map(j => corners.reduce((acc, c, i) => acc + c[j] * b[i] / s, 0));
    }
    const levelAt = t => 2 + 9 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / LEVEL_S));
    function tick(now) {
      if (!auto) return;
      if (onScreen) {
        if (!t0) t0 = now;
        const t = (now - t0) / 1000;
        const p = colorAt(t);
        st.p = p; st.w = weightsFor(p);
        st.level = levelAt(t); slider.value = st.level;
        render();
      }
      requestAnimationFrame(tick);
    }
    // any interaction with the figure hands control to the visitor
    // (picking a scene is not taking control: the animation carries on in the new scene)
    const takeOver = e => { if (!e.target.closest('.mixer-scenes')) stopAuto(); };
    root.addEventListener('pointerdown', takeOver, true);
    root.addEventListener('keydown', takeOver, true);
    slider.addEventListener('input', stopAuto);
    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(root);
    if (auto) {
      slider.step = 'any';
      // load every capture up front, nearest levels first, then start moving
      const order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].flatMap(L => ILLS.map(k => `${k}_L${pad(L)}`)).filter(has);
      Promise.all(order.slice(0, 8).map(n => loadCapture(n))).then(() => requestAnimationFrame(tick));
      order.slice(8).reduce((pr, n) => pr.then(() => loadCapture(n)), Promise.resolve());
    } else {
      setTimeout(() => {
        for (const L of [3, 5, 8]) for (const k of ILLS) { const n = `${k}_L${pad(L)}`; if (has(n)) loadCapture(n); }
      }, 1500);
    }
  }

  CM.mixer = { init, api };
})();
