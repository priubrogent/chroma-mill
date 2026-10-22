// Page entry point: start every demo independently so one failure does not break the others.
(() => {
  'use strict';
  const { $ } = CM.util;
  const demos = [
    ['mixer', '#mixer'], ['dataset', '#dataset-fig'],
    ['compare', '#compare-fig'], ['results', '#results-fig'], ['generalization', '#gen-fig'],
  ];
  for (const [name, sel] of demos) {
    const root = $(sel);
    if (!root) continue;
    CM[name].init(root).catch(e => console.error(`${name} failed to load`, e));
  }

  // verification hook: window.__chroma.mixXY / weightsFor
  window.__chroma = CM.mixer.api;

  const bib = $('#bib'), copy = $('#bib-copy');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(bib.textContent); copy.lastChild.textContent = 'Copied'; }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents(bib);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      copy.lastChild.textContent = 'Selected, press Ctrl+C';
    }
    setTimeout(() => { copy.lastChild.textContent = 'Copy'; }, 2000);
  });
})();
