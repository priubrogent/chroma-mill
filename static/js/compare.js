// Results: compare any two methods on one test image, for either camera.
(() => {
  'use strict';
  const { $, el, getData, f2, press, toggleButton, prettyBlend, swatch, NAMES } = CM.util;
  const { makeSplit, methodSelects } = CM.split;

  const ORDER = ['white', 'red', 'green', 'blue', 'red50_blue50', 'red_green_blue_33'];
  const SHORT = { white: 'W', red: 'R', green: 'G', blue: 'B', red50_blue50: 'R+B', red_green_blue_33: 'R+G+B' };
  const COLS = [['PSNR_L', 'PSNR<sub>L</sub>', 1], ['dE00', 'ΔE<sub>00</sub>', -1], ['SSIM', 'SSIM', 1]];

  async function init(root) {
    const DATA = { dslr: await getData('compare'), phone: await getData('compare_phone') };
    const D = DATA.dslr;
    const M = D.methods;   // sprite order, the same for both cameras
    const scenes = Object.keys(D.scenes);
    const st = { scene: scenes[0], level: 'L02', ill: 'red50_blue50', left: 'input', right: 'ours', cam: 'dslr' };
    const split = makeSplit($('.split', root));
    const conds = Object.keys(D.scenes[scenes[0]]);
    const levels = [...new Set(conds.map(c => c.split('__')[0]))].sort();
    const ills = [...new Set(conds.map(c => c.split('__')[1]))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

    // scene thumbnails: crop the ground-truth (last) frame of the sprite
    const th = $('.cmp-scenes', root);
    for (const s of scenes) {
      const any = D.scenes[s].L08__white || Object.values(D.scenes[s])[0];
      const b = el('button', {
        type: 'button', 'aria-label': `Scene ${s}`, title: s, 'aria-pressed': s === st.scene ? 'true' : 'false',
        style: `background-image:url("${any.sprite}");background-size:${M.length * 100}% 100%;background-position:100% 0`,
      });
      b.addEventListener('click', () => { st.scene = s; press(th, b); update(); });
      th.append(b);
    }
    const lv = $('.cmp-level', root);
    for (const l of levels) {
      const b = toggleButton(String(+l.slice(1)), l === st.level);
      b.addEventListener('click', () => { st.level = l; press(lv, b); update(); });
      lv.append(b);
    }
    const il = $('.cmp-ill', root);
    for (const i of ills) {
      const xy = D.scenes[scenes[0]][`${levels[0]}__${i}`].xy;
      const b = toggleButton([swatch(...xy), el('span', { text: SHORT[i] || i })], i === st.ill, { title: prettyBlend(i) });
      b.addEventListener('click', () => { st.ill = i; press(il, b); update(); });
      il.append(b);
    }
    const cam = $('.cmp-cam', root);
    for (const [k, label] of [['dslr', 'Nikon D5200'], ['phone', 'Galaxy S7']]) {
      const b = toggleButton(label, k === st.cam);
      b.addEventListener('click', () => { st.cam = k; press(cam, b); update(); });
      cam.append(b);
    }
    methodSelects($('.cmp-left', root), $('.cmp-right', root), M, NAMES, st, update);

    function update() {
      const c = DATA[st.cam].scenes[st.scene][`${st.level}__${st.ill}`];
      split.set(c.sprite, M.length, M.indexOf(st.left), M.indexOf(st.right), NAMES[st.left], NAMES[st.right], '3 / 2');
      const rows = M.filter(m => m !== 'gt');
      const meth = rows.filter(m => m !== 'input');
      const best = {};
      for (const [k, , dir] of COLS) best[k] = Math.max(...meth.map(m => dir * c.metrics[m][k]));
      const t = $('.cmp-table', root);
      t.innerHTML = '';
      const hr = el('tr', {}, el('th', { text: 'Method' }));
      for (const [, lab] of COLS) hr.append(el('th', { html: lab }));
      t.append(el('thead', {}, hr));
      const tb = el('tbody');
      for (const m of rows) {
        const tr = el('tr', { class: (m === st.left || m === st.right) ? 'is-selected-row' : '' }, el('td', { text: NAMES[m] }));
        for (const [k, , dir] of COLS) {
          const v = c.metrics[m][k];
          tr.append(el('td', { class: 'n' + (m !== 'input' && dir * v === best[k] ? ' best' : ''), text: k === 'SSIM' ? v.toFixed(3) : f2(v) }));
        }
        tb.append(tr);
      }
      t.append(tb);
    }
    update();
  }

  CM.compare = { init };
})();
