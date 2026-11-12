// Sintonia — fase 6: player. Loop do vídeo inteiro e de um trecho A–B, mini player flutuante ao rolar (arrastável, tamanho
// lembrado), player pop-up em janela própria no ponto atual (plano B: a página normal quando o vídeo bloqueia embed), playlist
// ao contrário e não tocar sozinho em aba de fundo (com opção de parar de baixar). Uma chave para cada.
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
  const fmtT = (t) => { t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const osd = (t) => SINT.player && SINT.player.osd(t);

  // ───────────────────────── loop e A–B ─────────────────────────
  let loopVideo = false, A = null, B = null;
  async function alternarLoop() {
    loopVideo = !loopVideo;
    await SINT.bridge('setLoop', loopVideo);
    const v = video(); if (v) v.loop = loopVideo; // plano B (o player também respeita)
    osd(loopVideo ? L().loopOn : L().loopOff); redesenhar();
  }
  function pontoA() { const v = video(); if (!v) return; A = v.currentTime; if (B != null && B <= A) B = null; osd(`A ${fmtT(A)}`); redesenhar(); }
  function pontoB() { const v = video(); if (!v) return; const t = v.currentTime; if (A == null) A = 0; if (t <= A + 0.5) { osd(L().abCedo); return; } B = t; osd(`A–B ${fmtT(A)}–${fmtT(B)}`); SINT.bridge('seek', A); redesenhar(); }
  function limparAB() { A = null; B = null; osd(L().abLimpo); redesenhar(); }
  const onTimeRev = () => vigiaReverso();
  const onTime = () => { const v = video(); if (!v || A == null || B == null || !SINT.ativo() || !S.loopAB) return; if (v.currentTime >= B) SINT.bridge('seek', A); };

  // ───────────────────────── playlist ao contrário ─────────────────────────
  const K_REV = 'st.reverso';
  let reverso = {};
  const listaAtual = () => new URLSearchParams(location.search).get('list');
  const naFila = () => { const f = SINT.fila && SINT.fila.estado(); return !!(f && f.ativa && f.ids.includes(SINT.page.videoId)); };
  let revFeito = '';
  async function vigiaReverso() {
    const v = video(), l = listaAtual();
    if (!v || !l || !reverso[l] || !S.playlistReversa || !SINT.ativo() || naFila() || !isFinite(v.duration) || v.paused) return;
    if ((v.duration - v.currentTime) / (v.playbackRate || 1) > 0.8 || revFeito === SINT.page.videoId) return; // janela em tempo real (vale em 2×, 3×)
    revFeito = SINT.page.videoId;
    const pl = await SINT.bridge('playlist');
    if (pl && pl.idx > 0) { SINT.log('playlist-reversa'); SINT.bridge('playAt', pl.idx - 1); }
  }
  async function alternarReverso() {
    const l = listaAtual(); if (!l) return;
    const cur = (await ext.storage.local.get(K_REV))[K_REV] || {};
    if (cur[l]) delete cur[l]; else cur[l] = Date.now();
    reverso = cur; await ext.storage.local.set({ [K_REV]: cur });
    osd(cur[l] ? L().reversoOn : L().reversoOff); redesenhar();
  }

  // ───────────────────────── aba de fundo: não toca sozinho ─────────────────────────
  let segurado = false;
  // (gancho de teste: o Chromium headless deixa todas as abas "visíveis"; o atributo simula a aba de fundo)
  const oculta = () => document.visibilityState === 'hidden' || document.documentElement.hasAttribute('data-sint-teste-oculta');
  function vigiaFundo() {
    const v = video();
    if (!v || !SINT.ativo() || !S.fundoSemAutoplay || !naVideo() || naFila()) return; // a fila da Em Dia anda sozinha em aba de fundo
    if (oculta() && !v.paused && !jaVisivel) {
      segurado = true; SINT.bridge('pausar'); try { v.pause(); } catch (_) {}
      if (S.fundoNaoBaixar) SINT.bridge('pararDownload');
      SINT.log('fundo-segurado');
    }
  }
  let jaVisivel = !oculta(); // a pessoa já viu esta aba: daí para frente, tocar em fundo é escolha dela
  const onVis = () => {
    if (oculta()) return;
    jaVisivel = true;
    if (segurado) { segurado = false; SINT.bridge('tocar'); const v = video(); if (v && v.paused) v.play().catch(() => {}); }
  };
  document.addEventListener('visibilitychange', onVis);
  const onPlay = () => vigiaFundo();

  // ───────────────────────── mini player ao rolar ─────────────────────────
  const K_MINI = 'st.mini';
  let mini = null, flutuando = false, fechadoAte = '', pegador = null, estiloAntes = null;
  const slot = () => document.querySelector('ytd-watch-flexy #player-container-outer, ytd-watch-flexy #player-container, ytd-watch-flexy #player, ytd-watch-flexy ytd-player');
  function deveFlutuar() {
    if (!SINT.ativo() || !S.miniPlayer || !naVideo() || document.fullscreenElement) return false;
    if (fechadoAte === SINT.page.videoId) return false;
    const yt = document.querySelector('ytd-miniplayer[active], ytd-miniplayer[enabled][active]');
    if (yt) return false;
    const s = slot(); if (!s) return false;
    const r = s.getBoundingClientRect();
    const v = video();
    return r.bottom < 60 && !!v && !v.paused;
  }
  async function flutuar() {
    const p = mp(); if (!p || flutuando) return;
    const cfg = Object.assign({ w: 400, h: 225, right: 16, bottom: 16 }, mini || {});
    const s = slot();
    if (s) { s.style.minHeight = s.getBoundingClientRect().height + 'px'; }
    estiloAntes = p.getAttribute('style') || '';
    p.style.cssText = estiloAntes + `;position:fixed !important;right:${cfg.right}px !important;bottom:${cfg.bottom}px !important;left:auto !important;top:auto !important;width:${cfg.w}px !important;height:${cfg.h}px !important;z-index:2030 !important;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.5)`;
    p.setAttribute('data-sint-mini', '');
    flutuando = true;
    pegar(p);
    SINT.bridge('redimensionar');
    SINT.log('mini-player');
  }
  function pousar() {
    const p = mp();
    if (p && flutuando) { p.setAttribute('style', estiloAntes || ''); p.removeAttribute('data-sint-mini'); }
    const s = slot(); if (s) s.style.minHeight = '';
    if (pegador) pegador.remove();
    flutuando = false;
    SINT.bridge('redimensionar');
  }
  function pegar(p) {
    if (!pegador) {
      pegador = document.createElement('sintonia-mini');
      const r = pegador.attachShadow({ mode: 'open' });
      r.innerHTML = `<style>.b{position:absolute;left:0;right:0;top:0;height:32px;display:flex;align-items:center;gap:8px;padding:0 4px 0 12px;background:linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,0));color:#fff;font:500 13px Roboto,Arial,sans-serif;cursor:move;opacity:0;transition:opacity .15s;pointer-events:auto}
        :host(:hover) .b,.b:focus-within{opacity:1}.b span{flex:1}.x{width:28px;height:28px;border:0;border-radius:14px;background:none;color:#fff;cursor:pointer;font-size:16px}.x:hover{background:rgba(255,255,255,.2)}
        .r{position:absolute;left:0;bottom:0;width:18px;height:18px;cursor:nesw-resize;pointer-events:auto}</style>
        <div class="b" part="barra"><span>Sintonia</span><button class="x" type="button" aria-label="${SINT.C.esc(L().close)}" title="${SINT.C.esc(L().close)}">✕</button></div><div class="r" title="${SINT.C.esc(L().miniTamanho)}" aria-label="${SINT.C.esc(L().miniTamanho)}"></div>`;
      pegador.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:80';
      for (const ev of ['click', 'dblclick', 'pointerdown', 'mousedown']) pegador.addEventListener(ev, (e) => e.stopPropagation());
      const bar = r.querySelector('.b'), x = r.querySelector('.x'), rs = r.querySelector('.r');
      x.addEventListener('click', () => { fechadoAte = SINT.page.videoId; pousar(); });
      const arrastar = (modo) => (e) => {
        if (e.button !== 0 || e.target === x) return;
        e.preventDefault();
        const p0 = mp().getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
        const mv = (ev) => {
          const dx = ev.clientX - x0, dy = ev.clientY - y0;
          const c = Object.assign({ w: 400, h: 225, right: 16, bottom: 16 }, mini || {});
          if (modo === 'mover') { c.right = Math.max(0, Math.round(innerWidth - p0.right - dx)); c.bottom = Math.max(0, Math.round(innerHeight - p0.bottom - dy)); }
          else { c.w = Math.max(240, Math.min(innerWidth - 32, Math.round(p0.width - dx))); c.h = Math.round(c.w * 9 / 16); }
          mini = c; aplicarGeo();
        };
        const up = () => { removeEventListener('pointermove', mv, true); removeEventListener('pointerup', up, true); try { ext.storage.local.set({ [K_MINI]: mini }); } catch (_) {} SINT.bridge('redimensionar'); };
        addEventListener('pointermove', mv, true); addEventListener('pointerup', up, true);
      };
      bar.addEventListener('pointerdown', arrastar('mover'));
      rs.addEventListener('pointerdown', arrastar('tamanho'));
    }
    if (pegador.parentNode !== p) p.appendChild(pegador);
  }
  function aplicarGeo() {
    const p = mp(); if (!p || !flutuando || !mini) return;
    for (const [k, v] of Object.entries({ right: mini.right, bottom: mini.bottom, width: mini.w, height: mini.h })) p.style.setProperty(k, v + 'px', 'important');
  }
  const onScroll = () => {
    const quer = deveFlutuar();
    if (quer && !flutuando) flutuar();
    else if (!quer && flutuando) { const s = slot(); const vis = s && s.getBoundingClientRect().bottom >= 60; if (vis || !naVideo() || !S.miniPlayer || !SINT.ativo()) pousar(); }
    if (fechadoAte && slot() && slot().getBoundingClientRect().bottom >= 60) fechadoAte = '';
  };
  addEventListener('scroll', onScroll, { passive: true });

  // ───────────────────────── pop-up em janela própria ─────────────────────────
  async function popup() {
    const id = SINT.page.videoId; if (!id) return;
    const e = (await SINT.bridge('embed')) || {};
    const t = Math.floor(e.t || (video() ? video().currentTime : 0));
    const url = e.embed === false ? `https://www.youtube.com/watch?v=${id}&t=${t}s` : `https://www.youtube.com/embed/${id}?start=${t}&autoplay=1`;
    const w = 640, h = 360;
    window.open(url, 'sintonia-popup', `popup,width=${w},height=${h},left=${Math.max(0, screen.availWidth - w - 40)},top=${Math.max(0, screen.availHeight - h - 80)}`);
    SINT.bridge('pausar');
    SINT.log(e.embed === false ? 'popup-planoB' : 'popup');
  }

  // ───────────────────────── ciclo de vida ─────────────────────────
  let vEl = null;
  const prender = () => { const v = video(); if (v === vEl) return; if (vEl) { vEl.removeEventListener('timeupdate', onTimeRev); vEl.removeEventListener('timeupdate', onTime); vEl.removeEventListener('play', onPlay); vEl.removeEventListener('playing', onPlay); } vEl = v; if (vEl) { vEl.addEventListener('timeupdate', onTimeRev); vEl.addEventListener('timeupdate', onTime); vEl.addEventListener('play', onPlay); vEl.addEventListener('playing', onPlay); } };
  let ultimoId = '';
  const aoTrocar = () => {
    prender();
    if (SINT.page.videoId !== ultimoId) { ultimoId = SINT.page.videoId; A = null; B = null; if (loopVideo) { loopVideo = false; const v = video(); if (v) v.loop = false; } revFeito = ''; }
    if (!naVideo() && flutuando) pousar();
    vigiaFundo();
  };
  const tk = setInterval(() => { prender(); vigiaReverso(); vigiaFundo(); onScroll(); }, 400);
  const offs = [SINT.on('video', aoTrocar), SINT.on('nav', () => { if (flutuando && SINT.page.kind !== 'watch') pousar(); setTimeout(aoTrocar, 200); }),
    SINT.on('settings', (m) => { if ('miniPlayer' in m || 'on' in m) onScroll(); redesenhar(); })];
  const onStore = (ch, area) => { if (area === 'local' && ch[K_REV] && SINT.alive()) reverso = ch[K_REV].newValue || {}; };
  ext.storage.onChanged.addListener(onStore);
  ext.storage.local.get([K_REV, K_MINI]).then((l) => { reverso = l[K_REV] || {}; mini = l[K_MINI] || null; }, () => {});
  SINT.onStop(() => {
    clearInterval(tk); offs.forEach((f) => f()); removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVis);
    try { ext.storage.onChanged.removeListener(onStore); } catch (_) {}
    if (vEl) { vEl.removeEventListener('timeupdate', onTimeRev); vEl.removeEventListener('timeupdate', onTime); vEl.removeEventListener('play', onPlay); vEl.removeEventListener('playing', onPlay); }
    if (flutuando) pousar();
  });
  SINT.ready.then(() => { aoTrocar(); });
  SINT.player2 = { alternarLoop, pontoA, pontoB, limparAB, popup, alternarReverso, get ab() { return { A, B }; }, get loop() { return loopVideo; }, get flutuando() { return flutuando; } };
  function redesenhar() { if (SINT.painel && SINT.painel.redesenhar) SINT.painel.redesenhar(); if (SINT.barra) SINT.barra.pintar(); }

  // botões na barra do player (pedido do André, 2026-11-11: "tudo tem que estar ali"); só aparecem com o recurso ligado
  const SV = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  if (SINT.barra) {
    SINT.barra.add({ id: 'loop', ordem: 10, mostrar: () => S.loopAB && naVideo(), ativo: () => loopVideo, click: alternarLoop,
      svg: SV('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h16"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
      titulo: (T) => (loopVideo ? T.loopOn : T.loopVideo) });
    SINT.barra.add({ id: 'ab', ordem: 11, mostrar: () => S.loopAB && naVideo(), ativo: () => A != null,
      texto: () => (A == null ? 'A–B' : B == null ? `A ${fmtT(A)}` : `${fmtT(A)}–${fmtT(B)}`),
      titulo: (T) => (A == null ? T.barAB0 : B == null ? T.barAB1(fmtT(A)) : T.barAB2(fmtT(A), fmtT(B))),
      click: () => (A == null ? pontoA() : B == null ? pontoB() : limparAB()), direito: () => { if (A != null || B != null) limparAB(); } });
    SINT.barra.add({ id: 'popup', ordem: 30, mostrar: () => S.popup && naVideo(), click: () => popup(),
      svg: SV('<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1"/>'), titulo: (T) => T.popupAbrir });
    SINT.barra.add({ id: 'rev', ordem: 40, mostrar: () => S.playlistReversa && naVideo() && !!listaAtual(), ativo: () => !!reverso[listaAtual()], click: () => alternarReverso(),
      svg: SV('<path d="M7 20V4"/><path d="M3 8l4-4 4 4"/><path d="M17 4v16"/><path d="M13 16l4 4 4-4"/>'), titulo: (T) => (reverso[listaAtual()] ? T.reversoOn : T.reversoEsta) });
  }

  // ───────────────────────── painel ─────────────────────────
  SINT.addBloco({
    id: 'player2', ordem: 38,
    html(T) {
      const l = listaAtual();
      if (!naVideo() || !(S.loopAB || S.popup || (S.playlistReversa && l))) return '';
      const acoes = naVideo() ? `<div class="pv"><div class="pvc">
          ${S.loopAB ? `<button type="button" data-p2="loop" aria-pressed="${loopVideo}">${esc(T.loopVideo)}</button><button type="button" data-p2="a" aria-pressed="${A != null}">A${A != null ? ' ' + fmtT(A) : ''}</button><button type="button" data-p2="b" aria-pressed="${B != null}">B${B != null ? ' ' + fmtT(B) : ''}</button>${A != null || B != null ? `<button type="button" data-p2="limpar">${esc(T.abLimpar)}</button>` : ''}` : ''}
          ${S.popup ? `<button type="button" data-p2="popup">${esc(T.popupAbrir)}</button>` : ''}
          ${S.playlistReversa && l ? `<button type="button" data-p2="rev" aria-pressed="${!!reverso[l]}">${esc(T.reversoEsta)}</button>` : ''}</div></div>` : '';
      return `<h4>${esc(T['sec.player'])}</h4>${acoes}`;
    },
    wire(el) {
      el.querySelectorAll('[data-p2sw]').forEach((b) => b.addEventListener('click', async () => { await SINT.setSetting(b.dataset.p2sw, !S[b.dataset.p2sw]); redesenhar(); }));
      const acao = { loop: alternarLoop, a: pontoA, b: pontoB, limpar: limparAB, popup, rev: alternarReverso };
      el.querySelectorAll('[data-p2]').forEach((b) => b.addEventListener('click', () => acao[b.dataset.p2]()));
    },
  });
})();
