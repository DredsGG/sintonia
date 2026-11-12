// Sintonia — fase 2: todo vídeo abre do seu jeito.
// Velocidade de 0,07× a 16× (a API do YouTube só aceita 0,25–2; o resto vai direto no <video>), qualidade e volume por canal,
// volume no máximo ao abrir, roda do mouse (volume / velocidade), atalhos configuráveis, teatro automático e modo cinema.
// Medido ao vivo em 2026-11-11: na troca de vídeo o player devolve o <video> para a velocidade da API (é a "velocidade voltando
// para 1×" do Enhancer). Por isso a Sintonia reaplica a velocidade escolhida a cada vídeo, depois de anúncio e quando o YouTube
// a muda sozinho. Mudança feita pela pessoa (menu do YouTube, teclas < >, painel, roda, atalho) vira a nova escolha.
(() => {
  'use strict';
  const SINT = globalThis.SINT, A = globalThis.SINT_ATALHOS;
  if (!SINT || SINT.dead || !A) return;
  const { ext, C } = SINT;
  const { esc } = C;
  const S = SINT.S, L = () => SINT.L();
  const VMIN = 0.07, VMAX = 16;
  const arred = (x) => Math.round(x * 100) / 100;
  const limita = (r) => arred(Math.max(VMIN, Math.min(VMAX, r)));
  const fmtVel = (r) => (r == null ? '—' : String(arred(r)).replace('.', SINT.lang === 'en' ? '.' : ','));
  const mp = () => document.getElementById('movie_player');
  const video = () => document.querySelector('#movie_player video.html5-main-video, #movie_player video');
  const emAnuncio = () => { const p = mp(); return !!(p && p.classList.contains('ad-showing')); };
  const aoVivo = () => !!(SINT.page.info && SINT.page.info.live);
  const naVideo = () => SINT.page.kind === 'watch' && !!SINT.page.videoId;
  const canalId = () => (SINT.page.canal && SINT.page.canal.id) || null;
  const perfil = () => (S.perfilCanal && canalId() ? SINT.perfil.ajustes(canalId()) : {});

  // última velocidade escolhida nesta aba (sem perfil por canal): não volta para 1× entre vídeos da fila ou da playlist.
  // Fica no sessionStorage da aba, para sobreviver à fila própria (que recarrega a página).
  const SESS = 'sintonia.vel';
  const sessao = {
    get() { try { const x = parseFloat(sessionStorage.getItem(SESS)); return isFinite(x) ? x : null; } catch (_) { return null; } },
    set(r) { try { sessionStorage.setItem(SESS, String(r)); } catch (_) {} },
  };

  // ───────────────────────── o que vale para este vídeo ─────────────────────────
  function velDesejada() {
    if (!SINT.ativo()) return null;
    const pf = perfil();
    if (pf.rate) return limita(pf.rate);
    if (!S.velocidade) return null;
    if (!S.perfilCanal || !canalId()) { const s = sessao.get(); if (s) return limita(s); } // sem perfil por canal (ou canal desconhecido): a última escolha desta aba
    return limita(+S.velPadrao || 1);
  }
  function volDesejado() {
    if (!SINT.ativo()) return null;
    const pf = perfil();
    if (pf.vol != null) return Math.max(0, Math.min(100, Math.round(pf.vol)));
    return S.volMax ? 100 : null;
  }
  function qualDesejada() {
    if (!SINT.ativo()) return null;
    const pf = perfil();
    if (pf.q) return pf.q;
    return S.qualidade ? S.qualPadrao : null;
  }

  // ───────────────────────── velocidade ─────────────────────────
  let vid = null, meuRate = 0, reaplicacoes = 0, gestoVel = 0, gestoVol = 0, gestoQual = 0, volAtual = null;
  function aplicarVel(motivo) {
    const r = velDesejada(), v = video();
    if (r == null || !v || emAnuncio() || aoVivo()) return false;
    if (Math.abs(v.playbackRate - r) < 1e-3) return false;
    meuRate = Date.now();
    try { v.playbackRate = r; } catch (_) {}
    SINT.bridge('setRate', r);
    if (motivo !== 'abrir') SINT.log('vel-reaplicada');
    pintarBotaoVel();
    return true;
  }
  // a pessoa escolheu uma velocidade (painel, roda, atalho, menu do YouTube)
  async function escolherVel(r, mostrar) {
    r = limita(r);
    const v = video();
    gestoVel = Date.now(); meuRate = Date.now();
    if (v) { try { v.playbackRate = r; } catch (_) {} }
    SINT.bridge('setRate', r);
    if (S.velocidade || S.perfilCanal) sessao.set(r);
    if (S.perfilCanal && canalId()) await SINT.perfil.set(canalId(), { rate: r });
    if (mostrar) osd(`${fmtVel(r)}×`);
    pintarBotaoVel();
    if (SINT.painel.redesenhar) SINT.painel.redesenhar();
  }
  const onRate = () => {
    const v = video(); if (!v || v !== vid) return;
    pintarBotaoVel();
    if (Date.now() - meuRate < 400 || emAnuncio()) return;
    if (Date.now() - gestoVel < 1500) { escolherVel(v.playbackRate, false); return; } // menu ou teclas do YouTube
    // o YouTube mudou sozinho (troca de vídeo, fim de anúncio, troca de qualidade): volta para a escolhida (com freio)
    if (reaplicacoes < 12 && velDesejada() != null) { reaplicacoes++; setTimeout(() => aplicarVel('youtube'), 30); }
  };

  // ───────────────────────── volume e qualidade ─────────────────────────
  async function aplicarVolQual() {
    if (!naVideo() || emAnuncio()) return;
    const vol = volDesejado();
    if (vol != null) { const r = await SINT.bridge('setVolume', vol, true); if (r && r.volume != null) volAtual = r.volume; }
    const q = qualDesejada();
    if (q) SINT.bridge('setQuality', q);
  }
  async function escolherVol(n, mostrar) {
    n = Math.max(0, Math.min(100, Math.round(n)));
    gestoVol = Date.now();
    const r = await SINT.bridge('setVolume', n, true);
    volAtual = r && r.volume != null ? r.volume : n;
    if (S.perfilCanal && canalId()) await SINT.perfil.set(canalId(), { vol: volAtual });
    if (mostrar) osd(`${L().volume} ${volAtual}%`);
    if (SINT.painel.redesenhar) SINT.painel.redesenhar();
  }
  const offVol = SINT.on('vol', (d) => {
    if (!d || d.volume == null) return;
    const mudou = d.volume !== volAtual;
    volAtual = d.volume;
    if (mudou && Date.now() - gestoVol < 1500 && S.perfilCanal && canalId()) SINT.perfil.set(canalId(), { vol: d.volume });
  });
  const offQual = SINT.on('qual', (d) => {
    if (!d || !d.q || d.q === 'auto' || Date.now() - gestoQual > 3000) return;
    if (S.perfilCanal && canalId()) SINT.perfil.set(canalId(), { q: d.q });
  });

  // gestos da pessoa no próprio player (para saber que a mudança foi dela)
  const onPointer = (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    const em = (sel) => path.some((x) => x && x.matches && x.matches(sel));
    if (em('.ytp-settings-menu, .ytp-popup, .ytp-panel')) { gestoVel = gestoQual = Date.now(); }
    if (em('.ytp-volume-area, .ytp-volume-panel, .ytp-mute-button, .ytp-volume-slider')) gestoVol = Date.now();
  };
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('click', onPointer, true);

  // ───────────────────────── troca de vídeo ─────────────────────────
  let ultimoVid = '', ultimoCanal = '', eraWatch = false;
  function prender() {
    const v = video();
    if (v === vid) return;
    if (vid) { vid.removeEventListener('ratechange', onRate); vid.removeEventListener('loadeddata', onCarregou); vid.removeEventListener('playing', onTocando); vid.removeEventListener('pause', onPausa); }
    vid = v;
    if (vid) { vid.addEventListener('ratechange', onRate); vid.addEventListener('loadeddata', onCarregou); vid.addEventListener('playing', onTocando); vid.addEventListener('pause', onPausa); }
  }
  const onCarregou = () => { aplicarVel('abrir'); };
  const onTocando = () => { aplicarVel('abrir'); cinemaPintar(true); };
  const onPausa = () => cinemaPintar(false);
  async function aoTrocar() {
    prender();
    if (!naVideo()) { eraWatch = false; ultimoVid = ''; ultimoCanal = ''; pintarBotaoVel(); cinemaPintar(); return; }
    const id = SINT.page.videoId, can = canalId() || '';
    if (id === ultimoVid && can && can !== ultimoCanal) { ultimoCanal = can; reaplicacoes = 0; aplicarVel('perfil'); await aplicarVolQual(); } // o canal chegou depois do vídeo
    if (id !== ultimoVid) {
      ultimoVid = id; ultimoCanal = can; reaplicacoes = 0;
      const inf = SINT.page.info || {};
      if (inf.volume != null) volAtual = inf.volume;
      aplicarVel('abrir');
      setTimeout(() => aplicarVel('abrir'), 600);
      await aplicarVolQual();
      if (!eraWatch) teatro();
    }
    eraWatch = true;
    pintarBotaoVel();
  }
  const offs = [
    SINT.on('video', aoTrocar), SINT.on('nav', () => setTimeout(aoTrocar, 250)),
    SINT.on('ad', (ad) => { if (!ad) { reaplicacoes = 0; setTimeout(() => { aplicarVel('anuncio'); aplicarVolQual(); }, 200); } }),
    SINT.on('perfis', () => { reaplicacoes = 0; aplicarVel('perfil'); }),
    SINT.on('settings', (m) => {
      if (['velocidade', 'velPadrao', 'perfilCanal', 'on'].some((k) => k in m)) { reaplicacoes = 0; aplicarVel('ajuste'); }
      if (['volMax', 'qualidade', 'qualPadrao'].some((k) => k in m)) aplicarVolQual();
      if ('cinema' in m) cinemaPintar();
      if ('teatroAuto' in m && m.teatroAuto) teatro();
      pintarBotaoVel();
    }),
    SINT.on('lang', () => pintarBotaoVel()),
  ];

  // ───────────────────────── teatro automático e modo cinema ─────────────────────────
  // o clique só vale com a barra do player pronta: tenta até confirmar (no máximo 3 cliques em 10 s)
  let teatroT = 0;
  function teatro(forcar) {
    if (!SINT.ativo() || (!S.teatroAuto && !forcar) || document.fullscreenElement) return;
    const fl0 = document.querySelector('ytd-watch-flexy');
    if (forcar) { const b = document.querySelector('#movie_player .ytp-size-button'); if (b) b.click(); return; }
    if (fl0 && fl0.hasAttribute('theater')) return;
    clearInterval(teatroT);
    let cliques = 0, ultimo = 0; const t0 = Date.now();
    teatroT = setInterval(() => {
      const fl = document.querySelector('ytd-watch-flexy'), b = document.querySelector('#movie_player .ytp-size-button');
      if (!S.teatroAuto || !naVideo() || (fl && fl.hasAttribute('theater')) || cliques >= 3 || Date.now() - t0 > 10000) { clearInterval(teatroT); return; }
      if (fl && b && b.getClientRects().length && Date.now() - ultimo > 2500) { cliques++; ultimo = Date.now(); b.click(); }
    }, 400);
  }
  // cinema: quatro faixas escuras em volta do player (não encostam no vídeo nem roubam o clique dele).
  // Posição só quando algo muda (rolagem, tamanho da janela, tamanho do player), nada de laço por quadro (pesava: medido na revisão).
  // Desligado = display:none (opacity 0 ainda pegaria o clique da página: achado da revisão).
  let cine = null, cineFolga = false, cineRO = null, cineUlt = '';
  const cinemaDeveria = () => { const p = mp(), v = video(); return !!(SINT.ativo() && S.cinema && naVideo() && p && p.isConnected && v && !v.paused && !document.fullscreenElement && !cineFolga); };
  const cinemaMostrando = () => !!(cine && cine.isConnected && cine.style.display !== 'none');
  function cinemaPosicionar() {
    if (!cinemaMostrando()) return;
    const p = mp();
    if (!p || !p.isConnected) { cinemaPintar(); return; }
    const r = p.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const k = [r.left, r.top, r.right, r.bottom, W, H].map(Math.round).join(',');
    if (k === cineUlt) return;
    cineUlt = k;
    const [a, b, c, d] = cine.children;
    Object.assign(a.style, { left: '0', top: '0', width: W + 'px', height: Math.max(0, r.top) + 'px' });
    Object.assign(b.style, { left: '0', top: Math.min(H, r.bottom) + 'px', width: W + 'px', height: Math.max(0, H - r.bottom) + 'px' });
    Object.assign(c.style, { left: '0', top: Math.max(0, r.top) + 'px', width: Math.max(0, r.left) + 'px', height: Math.max(0, r.height) + 'px' });
    Object.assign(d.style, { left: Math.min(W, r.right) + 'px', top: Math.max(0, r.top) + 'px', width: Math.max(0, W - r.right) + 'px', height: Math.max(0, r.height) + 'px' });
  }
  function cinemaPintar(tocando) {
    if (tocando === true) cineFolga = false;
    const on = cinemaDeveria();
    if (!on) {
      if (cine) { cine.style.opacity = '0'; cine.style.display = 'none'; }
      if (cineRO) { cineRO.disconnect(); cineRO = null; }
      return;
    }
    if (!cine) {
      cine = document.createElement('sintonia-cinema');
      cine.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2021;opacity:0;transition:opacity .3s cubic-bezier(0,0,.2,1)';
      for (let i = 0; i < 4; i++) {
        const f = document.createElement('div');
        f.style.cssText = 'position:fixed;background:rgba(0,0,0,.92);pointer-events:auto';
        f.addEventListener('click', () => { cineFolga = true; cinemaPintar(); });
        cine.appendChild(f);
      }
    }
    if (!cine.isConnected) document.documentElement.appendChild(cine);
    cine.style.display = '';
    cineUlt = '';
    cinemaPosicionar();
    if (!cineRO && window.ResizeObserver) { cineRO = new ResizeObserver(cinemaPosicionar); cineRO.observe(mp()); }
    requestAnimationFrame(() => { if (cine && cine.style.display !== 'none') cine.style.opacity = '1'; });
  }
  addEventListener('scroll', cinemaPosicionar, { passive: true });
  addEventListener('resize', cinemaPosicionar);

  // ───────────────────────── aviso rápido no player (como o do próprio YouTube) ─────────────────────────
  let osdEl = null, osdT = 0;
  function osd(txt) {
    const p = mp(); if (!p) return;
    if (!osdEl) {
      osdEl = document.createElement('sintonia-osd');
      const r = osdEl.attachShadow({ mode: 'open' });
      r.innerHTML = '<style>div{position:absolute;left:50%;top:48px;transform:translateX(-50%);padding:6px 14px;border-radius:16px;background:rgba(0,0,0,.6);color:#fff;font:500 16px/22px Roboto,Arial,sans-serif;pointer-events:none;opacity:0;transition:opacity .15s;white-space:nowrap}div.on{opacity:1}</style><div role="status"></div>';
      osdEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:69';
    }
    if (osdEl.parentNode !== p) p.appendChild(osdEl);
    const d = osdEl.shadowRoot.querySelector('div');
    d.textContent = txt; d.classList.add('on');
    clearTimeout(osdT); osdT = setTimeout(() => d.classList.remove('on'), 900);
  }

  // ───────────────────────── botão de velocidade na barra ─────────────────────────
  const VEL_ID = 'sintonia-vel';
  function pintarBotaoVel() {
    let b = document.getElementById(VEL_ID);
    const mostrar = SINT.ativo() && (S.velocidade || S.rodaVelocidade || S.perfilCanal) && naVideo();
    const sint = document.getElementById('sintonia-btn');
    if (!mostrar || !sint) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('button');
      b.id = VEL_ID; b.type = 'button'; b.className = 'ytp-button sintonia-vel';
      b.style.cssText = 'width:auto;min-width:48px;padding:0 6px;font:500 13px/40px Roboto,Arial,sans-serif;color:#fff;text-align:center';
      // clique: próxima velocidade da lista (1 → 1,25 → … → 3 → 1); botão direito ou Shift+clique: a anterior; roda: ajuste fino
      // (2026-11-11, pedido do André: antes o clique abria o mesmo painel do botão ao lado)
      b.addEventListener('click', (e) => { e.stopPropagation(); passoPreset(e.shiftKey ? -1 : 1); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); passoPreset(-1); });
    }
    const v = video();
    b.textContent = `${fmtVel(v ? v.playbackRate : 1)}×`;
    b.setAttribute('aria-label', `${L().velocidade}: ${b.textContent}`); b.title = L().velDica;
    if (b.nextElementSibling !== sint) sint.parentElement.insertBefore(b, sint);
  }

  function passoPreset(dir) {
    const v = video(); if (!v) return;
    const r = v.playbackRate;
    let alvo = dir > 0 ? PRESETS.find((x) => x > r + 1e-3) : PRESETS.slice().reverse().find((x) => x < r - 1e-3);
    if (alvo == null) alvo = dir > 0 ? PRESETS[0] : PRESETS[PRESETS.length - 1];
    escolherVel(alvo, true);
  }

  // ───────────────────────── roda do mouse ─────────────────────────
  const onWheel = (e) => {
    if (!SINT.ativo() || !naVideo()) return;
    const path = e.composedPath ? e.composedPath() : [];
    const p = mp();
    const sobreVel = path.some((x) => x && x.id === VEL_ID); // em cima do botão 1× a roda sempre ajusta a velocidade
    if (!sobreVel && !S.rodaVolume && !S.rodaVelocidade) return;
    if (!sobreVel && !path.includes(p)) return;
    if (path.some((x) => x && x.matches && x.matches('.ytp-popup, .ytp-settings-menu, sintonia-player'))) return; // menus têm rolagem própria
    const dy = e.deltaY || e.deltaX;
    if (!dy) return;
    const sobe = dy < 0;
    if (sobreVel || (e.shiftKey && S.rodaVelocidade)) {
      e.preventDefault(); e.stopPropagation();
      const v = video(); if (!v) return;
      escolherVel(v.playbackRate + (sobe ? 1 : -1) * (+S.velPasso || 0.1), true);
    } else if (!e.shiftKey && !sobreVel && S.rodaVolume) {
      e.preventDefault(); e.stopPropagation();
      const base = volAtual != null ? volAtual : Math.round((video() || { volume: 1 }).volume * 100);
      escolherVol(base + (sobe ? 1 : -1) * (+S.volPasso || 5), true);
    }
  };
  addEventListener('wheel', onWheel, { capture: true, passive: false });

  // ───────────────────────── atalhos ─────────────────────────
  const onKey = (e) => {
    // teclas de velocidade do próprio YouTube ( < > ) e de volume (setas, m) = gesto da pessoa
    if (e.shiftKey && (e.code === 'Period' || e.code === 'Comma') && !e.altKey && !e.ctrlKey) gestoVel = Date.now();
    if (!e.altKey && !e.ctrlKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyM')) gestoVol = Date.now();
    if (!SINT.ativo() || !S.atalhos) return;
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    const combo = A.doEvento(e);
    if (!combo) return;
    const mapa = A.mapa(S.atalhoMap);
    const acao = A.ACOES.find((k) => mapa[k] === combo);
    if (!acao) return;
    const usa = { loop: S.loopAB, pontoA: S.loopAB, pontoB: S.loopAB, popup: S.popup, foto: S.screenshot }[acao];
    if (usa === false || (!naVideo() && !['painel', 'cinema'].includes(acao))) return; // recurso desligado: a tecla segue para o YouTube
    e.preventDefault(); e.stopPropagation();
    const v = video(), passo = +S.velPasso || 0.1;
    if (acao === 'painel') { SINT.painel.abrir(document.getElementById('sintonia-btn') ? 'player' : 'page'); return; }
    if (acao === 'velMais' && v) escolherVel(v.playbackRate + passo, true);
    else if (acao === 'velMenos' && v) escolherVel(v.playbackRate - passo, true);
    else if (acao === 'vel1') escolherVel(1, true);
    else if (acao === 'volMais' || acao === 'volMenos') escolherVol((volAtual != null ? volAtual : 100) + (acao === 'volMais' ? 1 : -1) * (+S.volPasso || 5), true);
    else if (acao === 'cinema') { SINT.setSetting('cinema', !S.cinema); osd(`${L()['set.cinema']}: ${!S.cinema ? L().on : L().off}`); }
    else if (acao === 'teatro') teatro(true);
    else if (SINT.player2 && acao === 'loop' && S.loopAB) SINT.player2.alternarLoop();
    else if (SINT.player2 && acao === 'pontoA' && S.loopAB) SINT.player2.pontoA();
    else if (SINT.player2 && acao === 'pontoB' && S.loopAB) SINT.player2.pontoB();
    else if (SINT.player2 && acao === 'popup' && S.popup) SINT.player2.popup();
    else if (SINT.imagem && acao === 'foto' && S.screenshot) SINT.imagem.foto();
  };
  addEventListener('keydown', onKey, true);

  // ───────────────────────── bloco no painel ─────────────────────────
  const PRESETS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  SINT.addBloco({
    id: 'vel', ordem: 30,
    html(T) {
      const v = video(), r = v ? v.playbackRate : null;
      const temVel = S.velocidade || S.perfilCanal || S.rodaVelocidade, temVol = S.volMax || S.rodaVolume || S.perfilCanal;
      if (!naVideo() || !(temVel || temVol)) return '';
      const ctrl = `<div class="pv">${temVel ? `
          <div class="pvr"><span class="pvl">${esc(T.velocidade)}</span><button type="button" class="pvb" data-pv="vel-" aria-label="${esc(T.menos)}">−</button><b class="pvv" data-pv-val="vel">${fmtVel(r)}×</b><button type="button" class="pvb" data-pv="vel+" aria-label="${esc(T.mais)}">+</button></div>
          <div class="pvc">${PRESETS.map((x) => `<button type="button" data-pv-set="${x}" aria-pressed="${r != null && Math.abs(r - x) < 1e-3}">${fmtVel(x)}</button>`).join('')}</div>` : ''}${temVol ? `
          <div class="pvr"><span class="pvl">${esc(T.volume)}</span><button type="button" class="pvb" data-pv="vol-" aria-label="${esc(T.menos)}">−</button><b class="pvv">${volAtual != null ? volAtual + '%' : '—'}</b><button type="button" class="pvb" data-pv="vol+" aria-label="${esc(T.mais)}">+</button></div>` : ''}</div>`;
      return `<h4>${esc(T['sec.video'])}</h4>${ctrl}<p class="nota">${esc(S.perfilCanal && SINT.page.canal ? T.velNotaCanal : T.velNotaVideo)}</p>`;
    },
    wire(el) {
      el.querySelectorAll('[data-pv-sw]').forEach((b) => b.addEventListener('click', async () => { await SINT.setSetting(b.dataset.pvSw, !S[b.dataset.pvSw]); SINT.painel.redesenhar(); }));
      el.querySelectorAll('[data-pv-set]').forEach((b) => b.addEventListener('click', () => escolherVel(+b.dataset.pvSet, true)));
      el.querySelectorAll('[data-pv]').forEach((b) => b.addEventListener('click', () => {
        const v = video(), a = b.dataset.pv;
        if (a === 'vel+' && v) escolherVel(v.playbackRate + (+S.velPasso || 0.1), true);
        if (a === 'vel-' && v) escolherVel(v.playbackRate - (+S.velPasso || 0.1), true);
        if (a === 'vol+' || a === 'vol-') escolherVol((volAtual != null ? volAtual : 100) + (a === 'vol+' ? 1 : -1) * (+S.volPasso || 5), true);
      }));
    },
  });

  const tk = setInterval(() => { prender(); pintarBotaoVel(); if (cinemaDeveria() !== cinemaMostrando()) cinemaPintar(); else cinemaPosicionar(); }, 1000);
  const onFs = () => cinemaPintar();
  document.addEventListener('fullscreenchange', onFs);
  SINT.onStop(() => {
    offs.forEach((f) => f()); offVol(); offQual(); clearInterval(tk); clearInterval(teatroT); if (cineRO) cineRO.disconnect();
    removeEventListener('scroll', cinemaPosicionar); removeEventListener('resize', cinemaPosicionar);
    if (vid) { vid.removeEventListener('ratechange', onRate); vid.removeEventListener('loadeddata', onCarregou); vid.removeEventListener('playing', onTocando); vid.removeEventListener('pause', onPausa); }
    removeEventListener('wheel', onWheel, { capture: true }); removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onPointer, true); document.removeEventListener('click', onPointer, true);
    document.removeEventListener('fullscreenchange', onFs);
    for (const id of [VEL_ID]) { const b = document.getElementById(id); if (b) b.remove(); }
    if (cine) cine.remove(); if (osdEl) osdEl.remove();
  });
  SINT.ready.then(() => { prender(); aoTrocar(); });
  SINT.player = { escolherVel, escolherVol, osd, get volAtual() { return volAtual; } };
})();
