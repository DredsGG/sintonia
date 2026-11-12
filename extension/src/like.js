// Sintonia — fase 3: like automático. Desligado de fábrica. Risco de ban/suspensão é do André (REGRA 9 do vault).
// Modos: 'pct' (depois de X% assistido de verdade, padrão 50%), 'abrir' (logo que o vídeo começa) e 'canais' (só nos canais
// marcados, logo que começa). Lista "nunca curtir" por canal.
// Nunca mexe se já tem like ou dislike, nunca tira like, ignora anúncio, live e Shorts (chave própria). Um like por vídeo.
// Sem login não faz nada (o clique abriria o "Fazer login" do YouTube). Botão medido ao vivo em 2026-11-11:
// like-button-view-model … button[aria-pressed] e dislike-button-view-model … button[aria-pressed].
(() => {
  'use strict';
  const SINT = globalThis.SINT;
  if (!SINT || SINT.dead) return;
  const { ext, C } = SINT;
  const { esc } = C;
  const S = SINT.S;
  const K = 'st.like', DIAS = 30;
  let dados = { canais: {}, nunca: {}, feitos: {} };
  let q = Promise.resolve();
  function gravar(f) {
    q = q.then(async () => {
      const cur = Object.assign({ canais: {}, nunca: {}, feitos: {} }, (await ext.storage.local.get(K))[K] || {});
      f(cur);
      const velho = Date.now() - DIAS * 864e5;
      for (const id of Object.keys(cur.feitos)) if (cur.feitos[id] < velho) delete cur.feitos[id];
      dados = cur;
      await ext.storage.local.set({ [K]: cur });
    }).catch(() => {});
    return q;
  }
  const logado = () => !!document.querySelector('#avatar-btn, ytd-topbar-menu-button-renderer #avatar-btn, button#avatar-btn');
  const shorts = () => SINT.page.kind === 'shorts';
  const idAtual = () => (shorts() ? (location.pathname.match(/^\/shorts\/([\w-]{11})/) || [])[1] : SINT.page.videoId) || '';
  const canal = () => SINT.page.canal;
  function botoes() {
    // sem procurar na página inteira (nos Shorts poderia achar o botão do vídeo anterior, escondido): só dentro do vídeo ativo.
    // Vídeo: primeiro o bloco de baixo do vídeo (ytd-watch-metadata). O player novo tem OUTRO like, escondido, nos botões rápidos
    // dentro do #movie_player, que vem antes na página (medido no YouTube logado em 2026-11-11): por isso vale o primeiro VISÍVEL.
    const bases = shorts() ? [document.querySelector('ytd-reel-video-renderer[is-active]'), document.querySelector('ytd-shorts')]
      : [document.querySelector('ytd-watch-metadata'), document.querySelector('ytd-watch-flexy')];
    const visivel = (raiz, sel) => [...raiz.querySelectorAll(sel)].find((e) => e.getClientRects().length > 0) || null;
    for (const raiz of bases.filter(Boolean)) {
      const like = visivel(raiz, 'like-button-view-model button[aria-pressed], #segmented-like-button button[aria-pressed]');
      const dis = visivel(raiz, 'dislike-button-view-model button[aria-pressed], #segmented-dislike-button button[aria-pressed]');
      if (like && dis) return { like, dis };
    }
    return { like: null, dis: null };
  }
  const videoEl = () => (shorts() ? document.querySelector('#shorts-player video, ytd-reel-video-renderer[is-active] video') : document.querySelector('#movie_player video'));
  const emAnuncio = () => { const p = document.getElementById('movie_player'); return !!(p && p.classList.contains('ad-showing')); };

  function elegivel() {
    if (!SINT.ativo() || !S.likeAuto) return false;
    if (shorts() ? !S.likeShorts : SINT.page.kind !== 'watch') return false;
    const id = idAtual(); if (!id || dados.feitos[id]) return false;
    if (!shorts() && (emAnuncio() || (SINT.page.info && SINT.page.info.live))) return false;
    if (shorts()) { const r = document.querySelector('ytd-reel-video-renderer[is-active]'); if (r && r.querySelector('ytd-ad-slot-renderer, [is-ad], ytd-in-feed-ad-layout-renderer')) return false; }
    const c = canal();
    // canal desconhecido com lista "nunca" ou modo "só canais marcados": na dúvida, não curte
    if (!c && !shorts() && (S.likeModo === 'canais' || Object.keys(dados.nunca).length)) return false;
    if (c && dados.nunca[c.id]) return false;
    if (S.likeModo === 'canais' && !(c && dados.canais[c.id])) return false;
    return true;
  }

  let vid = '', assistido = 0, ultimoT = null, ultimoEm = 0, tentado = '', tentativas = 0, esperaAte = 0;
  function tick() {
    const id = idAtual();
    if (id !== vid) { vid = id; assistido = 0; ultimoT = null; tentativas = 0; esperaAte = 0; }
    const v = videoEl(), agora = performance.now();
    if (!v || !elegivel()) { ultimoT = v ? v.currentTime : null; ultimoEm = agora; return; }
    // tempo assistido de verdade: só conta o avanço normal, do tamanho do relógio × velocidade (pular para a frente não conta)
    if (!v.paused && ultimoT != null) {
      const d = v.currentTime - ultimoT, max = ((agora - ultimoEm) / 1000) * (v.playbackRate || 1) * 1.5 + 0.3;
      if (d > 0 && d <= max) assistido += d;
    }
    ultimoT = v.currentTime; ultimoEm = agora;
    const dur = v.duration;
    const alvo = S.likeModo === 'pct' ? (isFinite(dur) && dur > 0 ? dur * Math.max(1, Math.min(100, +S.likePct || 50)) / 100 : Infinity) : 3;
    if (assistido >= alvo && tentado !== id && Date.now() > esperaAte) curtir(id);
  }
  async function curtir(id) {
    tentado = id;
    const lg = await SINT.bridge('logado');
    if (!(lg && lg.ok ? lg.logado : logado())) { SINT.log('like-sem-login', false); tentado = ''; return; } // tenta de novo depois (o topo pode não ter carregado)
    const { like, dis } = botoes();
    if (!like || !dis) { SINT.log('like-sem-botao', false); if (++tentativas < 6) { tentado = ''; esperaAte = Date.now() + 2000; } return; } // botões ainda não apareceram: tenta de novo (até 6 vezes)
    if (like.getAttribute('aria-pressed') === 'true' || (dis && dis.getAttribute('aria-pressed') === 'true')) {
      await gravar((d) => { d.feitos[id] = Date.now(); }); SINT.log('like-ja-tinha'); return;
    }
    like.click();
    await new Promise((r) => setTimeout(r, 1500));
    const ok = like.isConnected ? like.getAttribute('aria-pressed') === 'true' : botoes().like && botoes().like.getAttribute('aria-pressed') === 'true';
    if (ok) { await gravar((d) => { d.feitos[id] = Date.now(); }); SINT.log('like', true); SINT.toast(SINT.L().likeFeito); }
    else SINT.log('like', false);
  }
  const tk = setInterval(tick, 500);
  const onStore = (ch, area) => { if (area === 'local' && ch[K] && SINT.alive()) { dados = Object.assign({ canais: {}, nunca: {}, feitos: {} }, ch[K].newValue || {}); if (SINT.painel.redesenhar) SINT.painel.redesenhar(); } };
  ext.storage.onChanged.addListener(onStore);
  SINT.onStop(() => { clearInterval(tk); try { ext.storage.onChanged.removeListener(onStore); } catch (_) {} });
  ext.storage.local.get(K).then((l) => { dados = Object.assign({ canais: {}, nunca: {}, feitos: {} }, l[K] || {}); }, () => {});
  SINT.like = { gravar, get dados() { return dados; } };

  // painel: chave + este canal (curtir sempre / nunca curtir)
  SINT.addBloco({
    id: 'like', ordem: 40, grupo: 'canal',
    html(T) {
      const c = canal();
      if (!S.likeAuto || !c || SINT.page.kind !== 'watch') return '';
      const linha = (k, on, txt) => `<button type="button" class="row" role="switch" aria-checked="${on}" data-lk="${k}"><span class="lb"><span>${esc(txt)}</span></span><span class="sw"></span></button>`;
      return `<h4>${esc(T['sec.like'])}</h4>${S.likeModo === 'canais' ? linha('canal', !!dados.canais[c.id], T.likeEsteCanal) : ''}${linha('nunca', !!dados.nunca[c.id], T.likeNunca)}`;
    },
    wire(el) {
      el.querySelectorAll('[data-lk]').forEach((b) => b.addEventListener('click', async () => {
        const c = canal(), k = b.dataset.lk;
        if (k === 'auto') await SINT.setSetting('likeAuto', !S.likeAuto);
        else if (c) await gravar((d) => { const l = k === 'canal' ? d.canais : d.nunca; if (l[c.id]) delete l[c.id]; else l[c.id] = c.nome || c.id; });
        SINT.painel.redesenhar();
      }));
    },
  });
})();
