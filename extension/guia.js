// Sintonia — guia de instalação nos 4 navegadores (regra 11), atualização e uso. Idioma do ?l=, do salvo ou do navegador.
(() => {
  const I = globalThis.SINT_I18N, ext = globalThis.chrome;
  let lang = (new URLSearchParams(location.search).get('l')) || I.detect(), br = 'chrome';
  const ver = (ext && ext.runtime && ext.runtime.getManifest) ? ext.runtime.getManifest().version : '';
  function render() {
    const T = I.T[lang] || I.T.en, g = T.g;
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang; document.title = g.title;
    document.querySelectorAll('nav.langs button').forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
    const nomes = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave', opera: 'Opera GX' };
    document.getElementById('m').innerHTML = `<h1>${g.title}</h1><p class="works">${g.works}</p>
      <h2 id="instalar">${g.install}</h2><div class="box"><p>${g.dl}</p>
        <div class="tabs">${Object.keys(nomes).map((k) => `<button data-b="${k}" class="${k === br ? 'on' : ''}">${nomes[k]}</button>`).join('')}</div>
        <ol>${g.br[br].map((x) => `<li>${x}</li>`).join('')}</ol></div>
      <div class="box note">${g.enh}</div>
      <h2 id="usar">${g.use}</h2><div class="box"><ol>${T.steps.map(([h, p]) => `<li><b>${h}</b>. ${p}</li>`).join('')}</ol></div>
      <h2 id="atualizar">${g.update}</h2><div class="box"><ol>${g.upd.map((x) => `<li>${x}</li>`).join('')}</ol></div>
      <div class="box note">${g.priv}</div>`;
    document.getElementById('f').innerHTML = `${T.madeBy} <a href="https://github.com/DredsGG" target="_blank" rel="noopener noreferrer">Dreds</a>${ver ? ' · v' + ver : ''}`;
    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { br = b.dataset.b; render(); }));
    if (location.hash) { try { const el = document.querySelector(location.hash); if (el) el.scrollIntoView(); } catch (_) {} }
  }
  document.querySelectorAll('nav.langs button').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.l; render(); try { (ext.storage.sync || ext.storage.local).set({ lang }); } catch (_) {} }));
  const UA = navigator.userAgent; br = /Edg\//.test(UA) ? 'edge' : /OPR\//.test(UA) ? 'opera' : navigator.brave ? 'brave' : 'chrome';
  try { (ext.storage.sync || ext.storage.local).get('lang').then((s) => { if (I.LANGS.includes(s.lang) && !new URLSearchParams(location.search).get('l')) lang = s.lang; render(); }, render); } catch (_) { render(); }
})();
