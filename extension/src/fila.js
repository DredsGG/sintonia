// Sintonia — fila de reprodução (fase 1): toca uma lista de vídeos em sequência e, quando um acaba, vai para o próximo.
// Plano A (medido em 2026-11-11): playlist temporária nativa /watch_videos?video_ids=… — o YouTube avança sozinho; aceita até 50 IDs
//   (51+ corta em 50). Fila maior vai em blocos de 50: no fim do bloco a Sintonia abre o próximo.
// Plano B (se a playlist não vier em 10 s): fila própria — a Sintonia navega para cada vídeo e, no fim, para o próximo;
//   enquanto a fila está ativa, a chave de reprodução automática do player fica desligada (setAutonav(false) não segura: medido) e
//   volta como estava quando a fila acaba ou a pessoa sai.
// No fim da fila, o autoplay do YouTube não pode puxar vídeo de fora: a Sintonia cancela a contagem da tela final.
// v1.1.0: a Sintonia garante o avanço (empurra se o YouTube não avançar em 2 s; loop do vídeo inteiro é ignorado na fila; A–B espera a pessoa)
//   e, no fim da fila, mostra o aviso "Fila concluída" e volta para a Em Dia (navegação interna, Em Dia já aberta).
// Estado em st.fila (local): { ids, i, origem, modo: 'lista'|'propria', ativa, bloco: [início, fim), autonavAntes, em }.
(() => {
  'use strict';
  const SINT = globalThis.SINT;
  if (!SINT || SINT.dead) return;
  const { ext, C } = SINT;
  const { esc } = C;
  const L = () => SINT.L();
  const K = 'st.fila', BLOCO = 50;
  let st = null; // estado atual (cópia do storage)

  // dono da fila: a aba que começou (sessionStorage sobrevive à recarga da fila própria; outra aba não mexe)
  const minhaAba = (() => { try { let x = sessionStorage.getItem('sintonia.aba'); if (!x) { x = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('sintonia.aba', x); } return x; } catch (_) { return 'x'; } })();
  const salvar = async (patch) => { st = patch === null ? null : Object.assign({}, st || {}, patch, { em: Date.now() }); try { await ext.storage.local.set({ [K]: st }); } catch (_) {} };
  SINT.fila = { estado: () => st };

  const urlBloco = (ini) => '/watch_videos?video_ids=' + st.ids.slice(ini, ini + BLOCO).join(',');
  function ir(url) { location.assign(url); }

  async function comecar(ids, i, origem) {
    const autonavAntes = autonavLigado();
    await salvar({ ids: ids.slice(0, 1000), i: i || 0, origem: origem || 'emdia', modo: 'lista', ativa: true, bloco: [i || 0, Math.min(ids.length, (i || 0) + BLOCO)], inicioBloco: Date.now(), autonavAntes, fim: false, dono: minhaAba });
    SINT.log('fila-comecar');
    ir(urlBloco(st.i));
  }
  async function continuar() {
    if (!st || st.i >= st.ids.length) return;
    // autonavAntes só se ainda não foi guardado (a Sintonia pode ter desligado o autoplay antes: não perder o valor da pessoa)
    await salvar({ ativa: true, modo: st.modo || 'lista', bloco: [st.i, Math.min(st.ids.length, st.i + BLOCO)], inicioBloco: Date.now(), autonavAntes: st.autonavAntes == null ? autonavLigado() : st.autonavAntes, dono: minhaAba });
    if (st.modo === 'propria') ir('/watch?v=' + st.ids[st.i]); else ir(urlBloco(st.i));
  }
  async function sair() {
    if (!st) return;
    await restaurarAutonav();
    await salvar({ ativa: false });
    SINT.log('fila-sair');
    desenhar();
  }
  // abre o vídeo n da fila na fila própria: navegação interna do YouTube (mantém tela cheia e miniplayer); se não pegar em 3 s, recarrega
  function abrirVideo(n) {
    const id = st.ids[n];
    SINT.bridge('navegar', { tipo: 'watch', id });
    setTimeout(() => { if (st && st.ativa && SINT.page.videoId !== id && !SINT.page.ad) ir('/watch?v=' + id); }, 3000);
  }
  let terminando = false, indoDe = -1, ultimoFimEm = 0, esperadoN = -1;
  // fim da fila (último vídeo acabou ou "Pular" no último): limpa a fila, mostra o aviso e volta para a Em Dia
  async function terminar() {
    if (terminando || !st) return;
    terminando = true;
    const ids = st.ids.slice();
    await restaurarAutonav();
    cancelarTelaFinal(15000);
    if (SINT.emdia) await SINT.emdia.marcar([], 'v'); // espera as marcações pendentes (o último vídeo conta no resumo)
    const m = (SINT.emdia && SINT.emdia.marcas) || {};
    const vistos = ids.filter((x) => m[x] && m[x].s === 'v').length, pulados = ids.filter((x) => m[x] && m[x].s === 'p').length;
    await salvar(null); // uma vez só: sem fila, recarregar a página ou outra aba não dispara de novo
    SINT.log('fila-fim');
    desenhar();
    mostrarFim(vistos, pulados);
    setTimeout(() => { terminando = false; }, 1000);
  }
  // vai para o item seguinte a `de` (id do vídeo que acabou ou foi pulado; sem id, o da página)
  async function proximo(de) {
    if (!st) return;
    const idx = st.ids.indexOf(de || SINT.page.videoId);
    const base = idx >= 0 ? idx : st.i;
    if (indoDe === base) return; // já está indo (fim + empurrão + clique em Pular não pulam dois)
    indoDe = base; setTimeout(() => { if (indoDe === base) indoDe = -1; }, 5000);
    const n = base + 1;
    esperadoN = n;
    if (n >= st.ids.length) return terminar();
    await salvar({ i: n });
    if (st.modo === 'propria') return abrirVideo(n);
    if (n < st.bloco[1]) { // ainda dentro da playlist nativa: o YouTube troca sem recarregar
      const r = await SINT.bridge('filaProximo', st.ids[n]);
      if (!r || !r.ok) ir(urlBloco(n)); // a playlist sumiu: abre de novo a partir daqui
      return;
    }
    await salvar({ bloco: [n, Math.min(st.ids.length, n + BLOCO)], inicioBloco: Date.now() });
    ir(urlBloco(n));
  }
  async function pular() {
    if (!st) return;
    const id = st.ids.indexOf(SINT.page.videoId) >= 0 ? SINT.page.videoId : st.ids[st.i];
    if (SINT.emdia && st.origem === 'emdia') await SINT.emdia.marcar(id, 'p');
    SINT.log('fila-pular');
    await proximo(id);
  }

  // ───────────────────────── aviso "Fila concluída" ─────────────────────────
  const FIM_ID = 'sintonia-fila-fim', FIM_S = 5;
  const CSS_FIM = `.fbg { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); }
.fim { width: min(400px, calc(100vw - 32px)); padding: 24px; border-radius: 16px; background: var(--bg); color: var(--tx); text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,.5); }
.fim .ok { width: 56px; height: 56px; margin: 0 auto 12px; border-radius: 28px; background: var(--accbg); color: var(--acc); display: flex; align-items: center; justify-content: center; } .fim .ok svg { width: 30px; height: 30px; }
.fim h2 { margin: 0 0 4px; font-size: 20px; line-height: 28px; font-weight: 700; } .fim .res { margin: 0; font-size: 14px; line-height: 20px; color: var(--tx2); }
.fim .cont { margin: 16px 0; font-size: 16px; line-height: 22px; } .fim .bt { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }`;
  const ICO_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  let fimHost = null, fimT = 0, fimOffs = [];
  function fecharFim() {
    clearInterval(fimT); fimT = 0;
    fimOffs.forEach((f) => f()); fimOffs = [];
    if (fimHost) { fimHost.remove(); fimHost = null; }
  }
  function mostrarFim(vistos, pulados) {
    fecharFim();
    if (!SINT.ativo() || !SINT.S.emdia) return;
    const T = L();
    fimHost = document.createElement('sintonia-fila-fim'); fimHost.id = FIM_ID;
    const sr = fimHost.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>${C.CSS}${CSS_FIM}</style><div class="sint" data-theme="${document.documentElement.hasAttribute('dark') ? 'dark' : 'light'}"><div class="fbg"><div class="fim" role="alertdialog" aria-live="assertive" aria-label="${esc(T.filaFim)}">
      <div class="ok">${ICO_OK}</div><h2>${esc(T.filaFim)}</h2><p class="res">${esc(T.filaResumo(vistos, pulados))}</p>
      <p class="cont" role="timer"></p>
      <div class="bt"><button class="btn sec" type="button" data-f="ficar">${esc(T.filaFicar)}</button><button class="btn pri" type="button" data-f="ir">${esc(T.filaIrAgora)}</button></div></div></div></div>`;
    for (const ev of ['keydown', 'keyup', 'keypress']) fimHost.addEventListener(ev, (e) => e.stopPropagation());
    (document.fullscreenElement || document.documentElement).appendChild(fimHost);
    let resta = FIM_S;
    const cont = sr.querySelector('.cont');
    const pinta = () => { cont.textContent = L().filaVolta(resta); };
    pinta();
    fimT = setInterval(() => { resta--; if (resta <= 0) { voltarEmDia(); } else pinta(); }, 1000);
    sr.querySelector('[data-f="ficar"]').addEventListener('click', () => { SINT.log('fila-ficar'); fecharFim(); });
    sr.querySelector('[data-f="ir"]').addEventListener('click', voltarEmDia);
    const onEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); SINT.log('fila-ficar'); fecharFim(); } };
    addEventListener('keydown', onEsc, true); fimOffs.push(() => removeEventListener('keydown', onEsc, true));
    // Em Dia ou Sintonia desligadas durante a contagem: não leva a lugar nenhum
    fimOffs.push(SINT.on('settings', (m) => { if (m && ('emdia' in m || 'on' in m) && !(SINT.ativo() && SINT.S.emdia)) fecharFim(); }));
    fimOffs.push(SINT.on('ativo', () => { if (!SINT.ativo()) fecharFim(); }));
  }
  // volta para as Inscrições com a Em Dia aberta, sem recarregar (clique no link do próprio YouTube; plano B: evento do YouTube; último: recarrega)
  async function voltarEmDia() {
    fecharFim();
    if (!SINT.ativo() || !SINT.S.emdia) return;
    SINT.log('fila-volta');
    if (SINT.emdia && SINT.emdia.abrirAoChegar) SINT.emdia.abrirAoChegar();
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (_) {} }
    const alvo = '/feed/subscriptions';
    const la = document.querySelector(`a[href="${alvo}"]`);
    if (la) la.click(); else SINT.bridge('navegar', { tipo: 'subs' });
    setTimeout(() => {
      if (location.pathname === alvo) return;
      SINT.bridge('navegar', { tipo: 'subs' });
      setTimeout(() => { if (location.pathname !== alvo) ir(alvo); }, 3000);
    }, 3000);
  }
  Object.assign(SINT.fila, { comecar, continuar, sair, pular, proximo, fecharFim });

  // ───────────────────────── autoplay do YouTube (chave na barra do player) ─────────────────────────
  const togAutonav = () => document.querySelector('#movie_player .ytp-autonav-toggle .ytp-autonav-toggle-button, #movie_player .ytp-autonav-toggle-button');
  const autonavLigado = () => { const t = togAutonav(); return t ? t.getAttribute('aria-checked') === 'true' : null; };
  function setAutonav(on) {
    const t = togAutonav();
    if (!t || (t.getAttribute('aria-checked') === 'true') === on) return false;
    const b = t.closest('button') || t; b.click(); return true;
  }
  async function restaurarAutonav() { if (st && st.modo === 'propria' && st.autonavAntes === true) setAutonav(true); }
  // tela final: cancela a contagem do "próximo vídeo" (sugestão de fora da fila) por alguns segundos
  function cancelarTelaFinal(ms) {
    const t0 = Date.now();
    const tk = setInterval(() => {
      const c = document.querySelector('#movie_player .ytp-autonav-endscreen-upnext-cancel-button, #movie_player .ytp-upnext-cancel-button');
      if (c && c.getClientRects().length) c.click();
      if (Date.now() - t0 > ms) clearInterval(tk);
    }, 300);
  }

  // ───────────────────────── vigia do vídeo: fim, 90%, troca ─────────────────────────
  let vid = null, ultimoId = '', terminouId = '', marcou90 = '', ultimoT = 0;
  const emMini = () => !!document.querySelector('ytd-miniplayer[active]'); // miniplayer do YouTube: a página não é /watch, o vídeo continua
  const naPagina = () => SINT.page.kind === 'watch' || emMini();
  const doQueue = () => st && st.ativa && SINT.ativo() && SINT.S.emdia && (!st.dono || st.dono === minhaAba) && naPagina() && st.ids.indexOf(SINT.page.videoId) >= 0;
  const emAnuncio = () => { const mp = document.getElementById('movie_player'); return !!(mp && mp.classList.contains('ad-showing')); };
  const abAtivo = () => { const p2 = SINT.player2; return !!(p2 && SINT.S.loopAB && p2.ab && p2.ab.A != null && p2.ab.B != null); }; // A–B é manual: a fila espera a pessoa desligar
  const loopLigado = () => !!(vid && vid.loop) || !!(SINT.player2 && SINT.player2.loop);
  function onTime() {
    if (!doQueue() || emAnuncio() || !vid || !vid.duration) { ultimoT = 0; return; }
    const id = SINT.page.videoId, t = vid.currentTime, d = vid.duration;
    if (t / d >= 0.9 && marcou90 !== id) { marcou90 = id; if (SINT.emdia && st.origem === 'emdia') SINT.emdia.marcar(id, 'v'); }
    // loop do vídeo inteiro ligado: o vídeo volta ao começo sem 'ended'; durante a fila a fila ganha (fora dela o loop vale)
    const voltou = ultimoT / d > 0.9 && t < ultimoT - d * 0.5;
    ultimoT = t;
    if (abAtivo()) return;
    const rate = vid.playbackRate || 1;
    if (voltou || (!vid.paused && d - t < Math.max(0.6, 0.4 * rate))) fimDoVideo(id);
  }
  function fimDoVideo(id) {
    if (!doQueue() || terminouId === id || emAnuncio()) return;
    terminouId = id; ultimoFimEm = Date.now();
    const i = st.ids.indexOf(id);
    if (i < 0) return;
    if (SINT.emdia && st.origem === 'emdia') SINT.emdia.marcar(id, 'v');
    const n = i + 1;
    if (n >= st.ids.length) { terminar(); return; }
    esperadoN = n;
    if (st.modo === 'propria' || n >= st.bloco[1] || loopLigado()) { cancelarTelaFinal(4000); proximo(id); return; }
    // dentro da playlist nativa o YouTube avança sozinho; a Sintonia só anota o índice e, se ele não avançar em 2 s
    // (reprodução automática desligada na conta, vídeo preso no fim), empurra para o próximo
    salvar({ i: n });
    empurrar(id, 2000, 0);
  }
  // se o YouTube não avançou: espera o anúncio acabar (anúncio no fim), respeita quem voltou o vídeo para trás e empurra
  function empurrar(id, ms, k) {
    setTimeout(() => {
      if (!st || !st.ativa || !doQueue() || SINT.page.videoId !== id) return;
      if (emAnuncio()) { if (k < 120) empurrar(id, 1000, k + 1); return; }
      if (vid && !vid.ended && isFinite(vid.duration) && vid.duration - vid.currentTime > 4) { terminouId = ''; return; } // a pessoa voltou o vídeo: vale o fim de verdade
      SINT.log('fila-empurrao', true); cancelarTelaFinal(4000); proximo(id);
    }, ms);
  }
  // fim que o evento não avisou (ex.: anúncio no fim do vídeo): confere o <video> e o estado do player
  async function conferirFim() {
    if (!vid || !doQueue() || emAnuncio()) return;
    const id = SINT.page.videoId;
    if (terminouId === id) return;
    if (vid.ended) return fimDoVideo(id);
    if (!vid.duration || vid.duration - vid.currentTime > 3 || !vid.paused) return;
    const r = await SINT.bridge('estadoPlayer');
    if (r && r.state === 0) fimDoVideo(id);
  }
  const onEnded = () => fimDoVideo(SINT.page.videoId);
  function prenderVideo() {
    const v = document.querySelector('#movie_player video.html5-main-video, #movie_player video');
    if (v === vid) return;
    if (vid) { vid.removeEventListener('timeupdate', onTime); vid.removeEventListener('ended', onEnded); }
    vid = v;
    if (vid) { vid.addEventListener('timeupdate', onTime); vid.addEventListener('ended', onEnded); }
  }

  // troca de vídeo: acompanha o índice; confere se a playlist nativa veio (senão, plano B)
  async function aoTrocar() {
    prenderVideo();
    // fila própria largada (aba fechada no meio): devolve o autoplay como a pessoa tinha
    if (st && !st.ativa && st.modo === 'propria' && st.autonavAntes === true && autonavLigado() === false && SINT.page.kind === 'watch') { setAutonav(true); salvar({ autonavAntes: null }); }
    if (!st || !st.ativa) { desenhar(); return; }
    if (!naPagina()) { desenhar(); return; }
    const id = SINT.page.videoId;
    if (id && id !== ultimoId) { ultimoId = id; terminouId = ''; indoDe = -1; ultimoT = 0; }
    const i = st.ids.indexOf(id);
    // o YouTube puxou vídeo de fora da fila logo depois de um vídeo acabar (tela final/autoplay): volta para o próximo da fila
    if (i < 0 && id && st.dono === minhaAba && st.modo !== undefined && esperadoN >= 0 && esperadoN < st.ids.length && Date.now() - ultimoFimEm < 8000) {
      SINT.log('fila-fora', true); esperadoN = -1;
      if (st.modo === 'propria') abrirVideo(st.i); else ir(urlBloco(st.i));
      return;
    }
    if (i >= 0 && i !== st.i) await salvar({ i });
    if (i >= 0 && st.modo === 'propria') setAutonav(false);
    desenhar();
  }
  // plano B: 10 s depois de abrir o bloco sem a playlist (lista "TL…" na URL), passa para a fila própria
  const conferirLista = setInterval(async () => {
    if (!st || !st.ativa || st.modo !== 'lista' || SINT.page.kind !== 'watch') return;
    const temLista = /[?&]list=TL/.test(location.search);
    if (temLista) { if (!st.listaOk) salvar({ listaOk: true }); return; }
    if (Date.now() - (st.inicioBloco || 0) > 10000 && st.ids.indexOf(SINT.page.videoId) >= 0) {
      SINT.log('fila-planoB', true);
      await salvar({ modo: 'propria', autonavAntes: st.autonavAntes == null ? autonavLigado() : st.autonavAntes });
      setAutonav(false);
      desenhar();
    }
  }, 1000);

  // ───────────────────────── barra da fila (abaixo do player; também no painel, que vale em tela cheia) ─────────────────────────
  const BAR_ID = 'sintonia-fila';
  const CSS_BAR = `.fb { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 6px 8px 6px 16px; margin: 0; border-radius: 12px; background: var(--add); color: var(--tx); }
.fb .ic { color: var(--acc); } .fb .ic svg { width: 22px; height: 22px; } .fb b { font-size: 16px; } .fb .pos { color: var(--tx2); } .fb .sp { flex: 1; }
.fb .tt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tx2); font-size: 14px; }`;
  const ICO_FILA = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M4 12h10M4 18h7"/><path d="M15 17l2.5 2.5L22 15"/></svg>';
  function desenhar() {
    let b = document.getElementById(BAR_ID);
    const mostrar = doQueue();
    if (!mostrar) { if (b) b.remove(); if (SINT.painel && SINT.painel.redesenhar) SINT.painel.redesenhar(); return; }
    const alvo = document.querySelector('ytd-watch-flexy #below');
    if (!b) {
      b = document.createElement('div'); b.id = BAR_ID;
      const sr = b.attachShadow({ mode: 'open' });
      sr.innerHTML = `<style>${C.CSS}${CSS_BAR}</style><div class="sint"></div>`;
      b._r = sr;
      for (const ev of ['keydown', 'keyup', 'keypress']) b.addEventListener(ev, (e) => e.stopPropagation());
    }
    const T = L();
    const w = b._r.querySelector('.sint');
    w.dataset.theme = document.documentElement.hasAttribute('dark') ? 'dark' : 'light';
    w.innerHTML = `<div class="fb" role="region" aria-label="Em Dia"><span class="ic">${ICO_FILA}</span><b>Em Dia</b><span class="pos">${st.i + 1}/${st.ids.length}</span><span class="sp"></span>
      <button class="btn sec" type="button" data-f="pular">${esc(T.filaPular)}</button><button class="btn sec" type="button" data-f="sair">${esc(T.filaSair)}</button></div>`;
    w.querySelector('[data-f="pular"]').addEventListener('click', pular);
    w.querySelector('[data-f="sair"]').addEventListener('click', sair);
    // Sempre no fluxo da página, logo abaixo do player e antes do título. Sem lugar ainda: espera (o painel também mostra a fila).
    // (2026-11-11, relato do André: o plano B antigo, fixo no rodapé da tela, ficava preso e cobria o like.)
    b.style.cssText = 'display:block;margin:0 0 12px';
    if (alvo) { if (alvo.firstElementChild !== b) alvo.insertBefore(b, alvo.firstChild); }
    else if (b.isConnected) b.remove();
    if (SINT.painel && SINT.painel.redesenhar) SINT.painel.redesenhar();
  }
  SINT.addBloco({
    id: 'fila', ordem: 10,
    html(T) {
      if (!doQueue()) return '';
      return `<h4>Em Dia ${st.i + 1}/${st.ids.length}</h4><button type="button" class="more" data-fp="pular"><span>${esc(T.filaPular)}</span></button><button type="button" class="more" data-fp="sair"><span>${esc(T.filaSair)}</span></button>`;
    },
    wire(el) {
      const p = el.querySelector('[data-fp="pular"]'); if (p) p.addEventListener('click', pular);
      const s = el.querySelector('[data-fp="sair"]'); if (s) s.addEventListener('click', () => { SINT.painel.fechar(); sair(); });
    },
  });

  const offs = [SINT.on('video', aoTrocar), SINT.on('nav', () => setTimeout(aoTrocar, 300)), SINT.on('lang', desenhar),
    SINT.on('settings', (m) => { if (m && ('emdia' in m || 'on' in m)) desenhar(); }), SINT.on('ativo', () => desenhar())];
  const onStore = (ch, area) => { if (area === 'local' && ch[K] && SINT.alive()) { st = ch[K].newValue || null; desenhar(); } };
  ext.storage.onChanged.addListener(onStore);
  const tk = setInterval(() => {
    prenderVideo();
    if (!doQueue()) return;
    conferirFim();
    const b = document.getElementById(BAR_ID), a = document.querySelector('ytd-watch-flexy #below');
    if (!b ? !!a : (a ? a.firstElementChild !== b : true)) desenhar();
  }, 1000);
  SINT.onStop(() => {
    offs.forEach((f) => f()); clearInterval(tk); clearInterval(conferirLista); fecharFim();
    try { ext.storage.onChanged.removeListener(onStore); } catch (_) {}
    if (vid) { vid.removeEventListener('timeupdate', onTime); vid.removeEventListener('ended', onEnded); }
    const b = document.getElementById(BAR_ID); if (b) b.remove();
  });
  ext.storage.local.get(K).then((l) => { st = l[K] || null; SINT.ready.then(aoTrocar); }, () => {});
})();
