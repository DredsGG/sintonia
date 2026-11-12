// Sintonia — fase 7: imagem e vídeo. Filtros por vídeo (brilho, contraste, saturação, cinza, inverter, girar) com "zerar",
// 3 temas escuros próprios (trocam as variáveis de cor do próprio YouTube no tema escuro), screenshot do quadro em PNG
// (baixado com o nome do vídeo e o tempo) e as chaves do codec (evitar 60 fps, forçar H.264; o embrulho está no src/main.js).
(() => {
  'use strict';
  const SINT = globalThis.SINT;
  if (!SINT || SINT.dead) return;
  const { ext, C } = SINT;
  const { esc } = C;
  const S = SINT.S, L = () => SINT.L();
  const mp = () => document.getElementById('movie_player');
  const video = () => document.querySelector('#movie_player video');
  const naVideo = () => SINT.page.kind === 'watch' && !!SINT.page.videoId;

  // ───────────────────────── filtros (por vídeo; zeram na troca) ─────────────────────────
  const ZERO = { brilho: 100, contraste: 100, saturacao: 100, cinza: 0, inverter: false, girar: 0 };
  let f = Object.assign({}, ZERO), estF = null;
  const mexido = () => JSON.stringify(f) !== JSON.stringify(ZERO);
  function aplicarFiltros() {
    const on = SINT.ativo() && S.filtros && naVideo() && mexido();
    if (!on) { if (estF) estF.remove(); estF = null; return; }
    if (!estF) { estF = document.createElement('style'); estF.id = 'sintonia-filtros'; }
    const p = mp(), giro = ((f.girar % 360) + 360) % 360;
    let escala = 1;
    if (p && (giro === 90 || giro === 270)) { const w = p.clientWidth, h = p.clientHeight; const v = video(); const vw = v ? v.clientWidth : w, vh = v ? v.clientHeight : h; escala = Math.min(h / vw, w / vh) || 1; }
    const filtro = `brightness(${f.brilho}%) contrast(${f.contraste}%) saturate(${f.saturacao}%) grayscale(${f.cinza}%)${f.inverter ? ' invert(1)' : ''}`;
    estF.textContent = `#movie_player video.html5-main-video, #movie_player video { filter: ${filtro} !important; ${giro ? `transform: rotate(${giro}deg) scale(${escala.toFixed(4)}) !important; transform-origin: center center !important;` : ''} }`;
    if (!estF.isConnected) (document.head || document.documentElement).appendChild(estF);
  }
  function mudarFiltro(k, v) { f[k] = v; aplicarFiltros(); }
  function zerar() { f = Object.assign({}, ZERO); aplicarFiltros(); SINT.painel.redesenhar(); }

  // ───────────────────────── temas escuros próprios ─────────────────────────
  // Cores próprias (não copiadas de nenhum tema de terceiro). Valem com o tema escuro do YouTube ligado (html[dark]).
  const TEMAS = {
    grafite: { base: '#161616', raised: '#202020', menu: '#262626', add: 'rgba(255,255,255,.09)', hov: 'rgba(255,255,255,.16)', line: 'rgba(255,255,255,.14)', opaque: '#333', tx: '#ececec', tx2: '#a3a3a3' },
    noite: { base: '#0e131b', raised: '#151c27', menu: '#1a2230', add: 'rgba(160,190,255,.09)', hov: 'rgba(160,190,255,.16)', line: 'rgba(160,190,255,.16)', opaque: '#26303f', tx: '#e8edf5', tx2: '#9aa6b8' },
    preto: { base: '#000', raised: '#0b0b0b', menu: '#121212', add: 'rgba(255,255,255,.08)', hov: 'rgba(255,255,255,.14)', line: 'rgba(255,255,255,.12)', opaque: '#1f1f1f', tx: '#f1f1f1', tx2: '#9e9e9e' },
  };
  let estT = null;
  function aplicarTema() {
    const t = SINT.ativo() && TEMAS[S.tema];
    if (!t) { if (estT) estT.remove(); estT = null; return; }
    if (!estT) { estT = document.createElement('style'); estT.id = 'sintonia-tema'; }
    const b = '--yt-sys-color-baseline--';
    estT.textContent = `html[dark], html[dark] [dark] {
  ${b}base-background: ${t.base} !important; ${b}raised-background: ${t.raised} !important; ${b}menu-background: ${t.menu} !important;
  ${b}additive-background: ${t.add} !important; ${b}button-chip-background-hover: ${t.hov} !important; ${b}outline: ${t.line} !important; ${b}outline-opaque: ${t.opaque} !important;
  ${b}text-primary: ${t.tx} !important; ${b}text-secondary: ${t.tx2} !important;
  --yt-spec-base-background: ${t.base} !important; --yt-spec-raised-background: ${t.raised} !important; --yt-spec-menu-background: ${t.menu} !important;
  --yt-spec-general-background-a: ${t.base} !important; --yt-spec-general-background-b: ${t.base} !important; --yt-spec-general-background-c: ${t.raised} !important;
  --yt-spec-brand-background-solid: ${t.base} !important; --yt-spec-brand-background-primary: ${t.base} !important; --yt-spec-brand-background-secondary: ${t.raised} !important;
  --yt-spec-badge-chip-background: ${t.add} !important; --yt-spec-10-percent-layer: ${t.line} !important; --yt-spec-text-primary: ${t.tx} !important; --yt-spec-text-secondary: ${t.tx2} !important;
}
html[dark] body, html[dark] ytd-app { background: ${t.base} !important; }`;
    if (!estT.isConnected) (document.head || document.documentElement).appendChild(estT);
  }

  // ───────────────────────── screenshot ─────────────────────────
  const fmtT = (t) => { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? h + 'h' : '') + (h || m ? m + 'm' : '') + s + 's'; };
  const limpo = (s) => String(s || 'video').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'video';
  async function foto() {
    const v = video();
    if (!v || !v.videoWidth) return false;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const g = c.getContext('2d');
    try { g.drawImage(v, 0, 0, c.width, c.height); } catch (_) { SINT.log('foto', false); return false; }
    let url;
    try { url = c.toDataURL('image/png'); } catch (_) { SINT.log('foto-bloqueada', false); SINT.toast(L().fotoErro); return false; }
    const titulo = (SINT.page.info && SINT.page.info.title) || document.title.replace(/ - YouTube$/, '');
    const nome = `${limpo(titulo)} - ${fmtT(v.currentTime)}.png`;
    let r = null;
    try { r = await ext.runtime.sendMessage({ type: 'sintonia:foto', url, nome }); } catch (_) {}
    if (r && r.ok) { SINT.toast(L().fotoOk); SINT.log('foto'); return nome; }
    SINT.toast(L().fotoErro); return false;
  }

  // ───────────────────────── codec: grava as chaves para o mundo MAIN ─────────────────────────
  function gravarCodec() {
    const on = SINT.ativo();
    const liga = !!(on && (S.semHfr || S.h264));
    try {
      if (!liga) { if (localStorage.getItem('sintonia.codec') !== null) localStorage.removeItem('sintonia.codec'); return; } // desligado: nada no storage do YouTube
      const v = JSON.stringify({ semHfr: !!S.semHfr, h264: !!S.h264 });
      if (localStorage.getItem('sintonia.codec') !== v) localStorage.setItem('sintonia.codec', v);
    } catch (_) {}
  }

  const tudo = () => { aplicarFiltros(); aplicarTema(); gravarCodec(); };
  let ultimoId = '';
  const offs = [
    SINT.on('video', () => { if (SINT.page.videoId !== ultimoId) { ultimoId = SINT.page.videoId; f = Object.assign({}, ZERO); } aplicarFiltros(); }),
    SINT.on('settings', (m) => { tudo(); if (('semHfr' in m || 'h264' in m) && naVideo()) SINT.toast(L().codecRecarregar); }),
    SINT.on('ativo', tudo), SINT.on('nav', aplicarFiltros),
  ];
  const onRes = () => { if (f.girar) aplicarFiltros(); };
  addEventListener('resize', onRes);
  SINT.onStop(() => { offs.forEach((x) => x()); removeEventListener('resize', onRes); if (estF) estF.remove(); if (estT) estT.remove(); });
  SINT.ready.then(tudo);
  if (SINT.barra) SINT.barra.add({ id: 'foto', ordem: 20, mostrar: () => S.screenshot && naVideo(), click: () => foto(), titulo: (T) => T.fotoBotao,
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5h3l1.8-2.5h6.4L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>' });
  SINT.imagem = { foto, zerar, mudarFiltro, get filtros() { return Object.assign({}, f); }, TEMAS };

  // ───────────────────────── painel ─────────────────────────
  SINT.addBloco({
    id: 'imagem', ordem: 39,
    html(T) {
      const sl = (k, min, max) => `<label class="pvr"><span class="pvl">${esc(T.filtro[k])}</span><input type="range" min="${min}" max="${max}" step="1" value="${f[k]}" data-fi="${k}" style="flex:1;accent-color:#3ea6ff" aria-label="${esc(T.filtro[k])}"><b class="pvv" style="min-width:48px">${f[k]}%</b></label>`;
      const filtros = S.filtros && naVideo() ? `<div class="pv">${sl('brilho', 0, 200)}${sl('contraste', 0, 200)}${sl('saturacao', 0, 300)}${sl('cinza', 0, 100)}
          <div class="pvc"><button type="button" data-fa="inverter" aria-pressed="${f.inverter}">${esc(T.filtro.inverter)}</button><button type="button" data-fa="girar" aria-pressed="${!!f.girar}">${esc(T.filtro.girar)}${f.girar ? ' ' + f.girar + '°' : ''}</button>
          <button type="button" data-fa="zerar">${esc(T.filtro.zerar)}</button></div></div>` : '';
      const fotoB = S.screenshot && naVideo() ? `<div class="pv"><div class="pvc"><button type="button" data-fa="foto">${esc(T.fotoBotao)}</button></div></div>` : '';
      if (!filtros && !fotoB) return ''; // desligado = não aparece (relato do André, 2026-11-11)
      return `<h4>${esc(T['sec.imagem'])}</h4>${filtros}${fotoB}`;
    },
    wire(el) {
      el.querySelectorAll('[data-fi]').forEach((i) => i.addEventListener('input', () => { mudarFiltro(i.dataset.fi, +i.value); const b = i.parentElement.querySelector('.pvv'); if (b) b.textContent = i.value + '%'; }));
      el.querySelectorAll('[data-fa]').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.fa;
        if (a === 'inverter') { mudarFiltro('inverter', !f.inverter); SINT.painel.redesenhar(); }
        if (a === 'girar') { mudarFiltro('girar', (f.girar + 90) % 360); SINT.painel.redesenhar(); }
        if (a === 'zerar') zerar();
        if (a === 'foto') foto();
      }));
      el.querySelectorAll('[data-im-sw]').forEach((b) => b.addEventListener('click', async () => { await SINT.setSetting(b.dataset.imSw, !S[b.dataset.imSw]); SINT.painel.redesenhar(); }));
    },
  });
})();
