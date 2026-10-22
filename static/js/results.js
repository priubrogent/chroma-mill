// Benchmark table and per-level plot.
(() => {
  'use strict';
  const { $, el, sv, getData, press } = CM.util;

  const MET = [['PSNR_L', 'PSNR<sub>L</sub> ↑', 1], ['PSNR_C', 'PSNR<sub>C</sub> ↑', 1], ['SSIM', 'SSIM ↑', 1], ['LPIPS', 'LPIPS ↓', -1], ['MAE_angular', 'MAE∠ ↓', -1], ['dE76', 'ΔE<sub>76</sub> ↓', -1], ['dE00', 'ΔE<sub>00</sub> ↓', -1]];
  const ORD = { wb_first: 'WB → LLIE', llie_first: 'LLIE → WB', joint: 'joint', none: '–' };
  const PM = [['PSNR_L', 'PSNR_L (dB)', 'PSNR<sub>L</sub>', 1], ['PSNR_C', 'PSNR_C (dB)', 'PSNR<sub>C</sub>', 1], ['dE00', 'ΔE00', 'ΔE<sub>00</sub>', -1], ['MAE_angular', 'MAE angular (°)', 'MAE∠', -1]];
  const HL = ['TI-Retinexformer + DWB', 'Retinexformer + RL-AWB', 'DarkIR + DWB', 'MIRNet + DWB', 'PromptNorm + DWB', 'Retinexformer + DWB'];
  const isOurs = n => n.startsWith('Ours');

  function camToggle(group, st, redraw) {
    group.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      press(group, b); st.cam = b.dataset.c; redraw();
    });
  }

  async function init(root) {
    const R = await getData('results');

    // ---- table ----
    const st = { cam: 'dslr', all: false, sort: null, dir: 1 };
    const t = $('#res-table', root);
    function draw() {
      let rows = R[st.cam].filter(r => st.all || r.sel);
      const scored = rows.filter(r => r.ordering !== 'none');
      const rank = {};
      for (const [k, , d] of MET) rank[k] = [...new Set(scored.map(r => r[k]))].sort((a, b) => d * (b - a)).slice(0, 3);
      if (st.sort) { const [k, , d] = MET.find(m => m[0] === st.sort); rows = rows.slice().sort((a, b) => st.dir * d * (b[k] - a[k])); }
      else rows = rows.slice().sort((a, b) => (a.ordering === 'none' ? -1 : 0) - (b.ordering === 'none' ? -1 : 0) || (isOurs(a.method) ? 1 : 0) - (isOurs(b.method) ? 1 : 0));
      t.innerHTML = '';
      const hr = el('tr', {}, el('th', { text: 'Method' }), el('th', { text: 'Order' }));
      for (const [k, lab] of MET) {
        const b = el('button', { type: 'button', class: 'sort', 'aria-label': `Sort by ${k}`, html: lab + (st.sort === k ? (st.dir === 1 ? ' ▾' : ' ▴') : '') });
        b.addEventListener('click', () => { if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = 1; } draw(); });
        hr.append(el('th', { class: 'n', 'aria-sort': st.sort === k ? (st.dir === 1 ? 'descending' : 'ascending') : 'none' }, b));
      }
      t.append(el('thead', {}, hr));
      const tb = el('tbody');
      for (const r of rows) {
        const ours = isOurs(r.method);
        const tr = el('tr', { class: ours ? 'ours' : '' }, el('td', { text: ours ? 'Ours (CTI-Retinexformer)' : r.method }), el('td', { class: 'ord', text: ORD[r.ordering] || r.ordering }));
        for (const [k] of MET) {
          const i = r.ordering === 'none' ? -1 : rank[k].indexOf(r[k]);
          tr.append(el('td', { class: 'n' + (i >= 0 ? ` r${i + 1}` : ''), text: k === 'SSIM' || k === 'LPIPS' ? r[k].toFixed(3) : r[k].toFixed(2) }));
        }
        tb.append(tr);
      }
      t.append(tb);
    }
    camToggle($('#tbl-cam', root), st, draw);
    $('#tbl-all', root).addEventListener('change', e => { st.all = e.target.checked; draw(); });
    draw();

    // ---- plot ----
    const ps = { m: 'PSNR_L', cam: 'dslr' };
    const pmSeg = $('#plot-metric', root);
    for (const [k, , lab] of PM) {
      const b = el('button', { type: 'button', class: 'button is-small is-rounded' + (k === ps.m ? ' is-dark' : ''), 'aria-pressed': k === ps.m ? 'true' : 'false', html: lab });
      b.addEventListener('click', () => { ps.m = k; press(pmSeg, b); plot(); });
      pmSeg.append(b);
    }
    camToggle($('#plot-cam', root), ps, plot);
    const host = $('#plot', root);
    function plot() {
      host.innerHTML = '';
      const rows = R[`levels_${ps.cam}`].filter(r => r.sel);
      const series = {};
      for (const r of rows) (series[r.method] ||= []).push(r);
      for (const s of Object.values(series)) s.sort((a, b) => a.level - b.level);
      const oursName = Object.keys(series).find(isOurs);
      const [k, ylab, , dir] = PM.find(p => p[0] === ps.m);
      const W = 1000, H = 400, m = { l: 48, r: 110, t: 34, b: 44 };
      const vals = rows.map(r => r[k]);
      let lo = Math.min(...vals), hi = Math.max(...vals);
      const step = (hi - lo) > 12 ? 5 : (hi - lo) > 5 ? 2 : 1;
      lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
      const X = l => m.l + (l - 1) / 9 * (W - m.l - m.r), Y = v => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b);
      const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${ylab} versus input level` });
      const text = (s, a) => { const e = sv('text', a); e.textContent = s; svg.append(e); return e; };
      for (let v = lo; v <= hi + 1e-9; v += step) {
        svg.append(sv('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: '#ededed', 'stroke-width': 1 }));
        text(v, { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' });
      }
      for (let l = 1; l <= 10; l++) text(l, { x: X(l), y: H - m.b + 18, 'text-anchor': 'middle' });
      text('input level (1 = darkest)', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle' });
      text(`${ylab} ${dir > 0 ? '↑' : '↓'}`, { x: m.l - 40, y: 14, 'text-anchor': 'start' });
      const pathOf = s => s.map((r, i) => `${i ? 'L' : 'M'}${X(r.level).toFixed(1)},${Y(r[k]).toFixed(1)}`).join('');
      const order = Object.keys(series).sort((a, b) => (HL.includes(a) ? 1 : 0) - (HL.includes(b) ? 1 : 0) || (isOurs(a) ? 1 : 0) - (isOurs(b) ? 1 : 0));
      for (const name of order) {
        const s = series[name], ours = isOurs(name), un = name === 'Unprocessed', hl = HL.includes(name);
        svg.append(sv('path', {
          d: pathOf(s), fill: 'none', class: ours ? 'ln-ours' : hl || un ? 'ln-mid' : 'ln-faint',
          'stroke-width': ours ? 3 : hl ? 1.6 : 1.2, 'stroke-dasharray': un ? '5 4' : 'none', 'stroke-linejoin': 'round',
        }));
        if (ours || un) {
          let ly = Y(s[s.length - 1][k]) + 4;
          if (un) { const os = series[oursName]; const oy = Y(os[os.length - 1][k]) + 4; if (Math.abs(ly - oy) < 15) ly = oy + (ly >= oy ? 15 : -15); }
          text(ours ? 'Ours' : 'Unprocessed', { x: X(10) + 8, y: ly, class: ours ? 'lab-ours' : '' });
        }
      }
      const cross = sv('line', { y1: m.t, y2: H - m.b, stroke: '#363636', 'stroke-opacity': .35, 'stroke-width': 1, visibility: 'hidden' });
      const dot = sv('circle', { r: 4.5, class: 'dot-ours', stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' });
      const hit = sv('rect', { x: m.l - 10, y: m.t, width: W - m.l - m.r + 20, height: H - m.t - m.b, fill: 'transparent' });
      svg.append(cross, dot, hit);
      const tip = el('div', { class: 'tip', hidden: '' });
      host.append(svg, tip);
      const showAt = cx => {
        const r = svg.getBoundingClientRect(), sx = (cx - r.left) / r.width * W;
        const l = Math.max(1, Math.min(10, Math.round(1 + (sx - m.l) / (W - m.l - m.r) * 9)));
        cross.setAttribute('x1', X(l)); cross.setAttribute('x2', X(l)); cross.setAttribute('visibility', 'visible');
        const os = series[oursName].find(r => r.level === l);
        dot.setAttribute('cx', X(l)); dot.setAttribute('cy', Y(os[k])); dot.setAttribute('visibility', 'visible');
        const at = Object.entries(series).map(([n, s]) => [n, (s.find(r => r.level === l) || {})[k]]).filter(e => e[1] != null).sort((a, b) => dir * (b[1] - a[1]));
        const show = at.filter(([n]) => isOurs(n) || n === 'Unprocessed' || HL.includes(n));
        const rank = at.filter(([n]) => n !== 'Unprocessed').findIndex(([n]) => isOurs(n)) + 1;
        tip.innerHTML = `<div class="t">Level ${l} · ${ylab}</div>` +
          show.map(([n, v]) => `<div class="row${isOurs(n) ? ' o' : ''}"><span>${isOurs(n) ? 'Ours' : n}</span><span>${v.toFixed(2)}</span></div>`).join('') +
          `<div class="row has-text-grey"><span>rank of ours</span><span>${rank} / ${at.length - 1}</span></div>`;
        tip.hidden = false;
        const hx = X(l) / W * r.width;
        tip.style.left = `${Math.min(hx + 14, r.width - tip.offsetWidth - 4)}px`; tip.style.top = '8px';
        if (hx + 14 + tip.offsetWidth > r.width) tip.style.left = `${Math.max(0, hx - tip.offsetWidth - 14)}px`;
      };
      hit.addEventListener('pointermove', e => showAt(e.clientX));
      hit.addEventListener('pointerdown', e => showAt(e.clientX));
      hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); });
    }
    plot();
  }

  CM.results = { init };
})();
