// Figure 2: every capture of one scene (Test13); a cell loads into Figure 1.
(() => {
  'use strict';
  const { $, el, getData, pad, ILLS, swatch, reducedMotion } = CM.util;
  const mixer = CM.mixer.api;

  async function init(root) {
    const [D, SCENES] = await Promise.all([getData('mixer'), getData('scenes')]);
    const linearSet = new Set(SCENES.find(s => s.id === 'Test13').captures);
    const B = Object.fromEntries(D.levels.map(l => [l.level, l.B]));

    const grid = $('.lvl-grid', root);
    grid.append(el('span'));
    for (let L = 1; L <= 11; L++) grid.append(el('span', { class: 'cl' + (L === 11 ? ' ref' : ''), text: L === 11 ? '11 ref' : String(L) }));
    grid.append(el('span'));   // empty last column, so the images sit centred under the text
    ILLS.forEach((k, i) => {
      grid.append(el('span', { class: 'rl', title: `${k} light` }, swatch(...D.illuminants[k].xy)));
      for (let L = 1; L <= 11; L++) {
        if (!linearSet.has(`${k}_L${pad(L)}`)) { grid.append(el('div', { class: 'cell missing', title: 'Not in the dataset', text: 'n/a' })); continue; }
        const b = el('button', {
          type: 'button', class: 'cell' + (k === 'white' && L === 11 ? ' ref-gt' : ''),
          'aria-label': `${k} light, level ${L}, B ${B[L]}: load into Figure 1`, title: `${k}, Level ${L} (B = ${B[L]})`,
          style: `background-position:${(L - 1) / 10 * 100}% ${i / 3 * 100}%`,
        });
        b.addEventListener('click', () => {
          if (!mixer.setIll) return;
          mixer.setIll(k, L);
          $('#mixer').scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
        });
        grid.append(b);
      }
      grid.append(el('span'));
    });
  }

  CM.dataset = { init };
})();
