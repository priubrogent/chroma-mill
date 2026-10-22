// Figure 7: models trained on CHROMA-MILL only, applied to other datasets.
(() => {
  'use strict';
  const { $, el, getData, press, NAMES } = CM.util;
  const { makeSplit, methodSelects } = CM.split;

  async function init(root) {
    const D = await getData('gen');
    const M = D.methods;
    const st = { i: 0, left: 'input', right: 'ours' };
    const split = makeSplit($('.split', root));
    const th = $('.gen-thumbs', root);
    D.items.forEach((it, i) => {
      const b = el('button', {
        type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false', title: it.id.replace(/_/g, ' '), 'aria-label': it.id,
        style: `background-image:url("${it.sprite}");background-size:${M.length * 100}% 100%;background-position:0 0`,
      });
      b.addEventListener('click', () => { st.i = i; press(th, b); update(); });
      th.append(b);
    });
    methodSelects($('.gen-left', root), $('.gen-right', root), M, NAMES, st, update);
    function update() {
      const it = D.items[st.i];
      split.set(it.sprite, M.length, M.indexOf(st.left), M.indexOf(st.right), NAMES[st.left], NAMES[st.right], `${it.w} / ${it.h}`);
    }
    update();
  }

  CM.generalization = { init };
})();
