// Sintonia — núcleo no mundo isolado: instância única por aba, ajustes, ponte com o mundo MAIN (src/main.js),
// navegação interna do YouTube, troca de vídeo, perfil por canal e log. Os recursos (fases 1 a 7) ouvem os eventos daqui:
//   SINT.on('settings' | 'video' | 'nav' | 'ad' | 'lang' | 'ativo' | 'stop', fn)
(() => {
  'use strict';
  const ext = globalThis.chrome;
  const I = globalThis.SINT_I18N, C = globalThis.SINT_COMUM, DEF = globalThis.SINT_DEF;
  if (!ext || !ext.runtime || !I || !C || !DEF) return;

  // Instância única por aba: a extensão recarregada injeta uma nova, e a antiga (órfã) para sozinha.
  document.dispatchEvent(new Event('sintonia-takeover'));
  let dead = false;
  const onTakeover = () => stop();
  setTimeout(() => document.addEventListener('sintonia-takeover', onTakeover), 0);
  const alive = () => { try { return !dead && !!ext.runtime.id; } catch (_) { return false; } };

  const SYNC = ext.storage.sync || ext.storage.local;
  const K = DEF.LOCAL;
  const VERSION = ext.runtime.getManifest().version;

  // ───────────────────────── barramento interno ─────────────────────────
  const subs = {};
  const on = (ev, fn) => { (subs[ev] = subs[ev] || []).push(fn); return () => { subs[ev] = (subs[ev] || []).filter((f) => f !== fn); }; };
  const emit = (ev, data) => { for (const fn of (subs[ev] || []).slice()) { try { fn(data); } catch (e) { console.warn('[Sintonia]', ev, e); } } };
  const stops = [];
  const onStop = (fn) => stops.push(fn);

  const S = Object.assign({}, DEF.SYNC);
  let lang = I.detect();

  // ───────────────────────── log local (sem URL, título nem canal) ─────────────────────────
  let logQ = Promise.resolve();
  function log(type, ok, extra) {
    logQ = logQ.then(async () => {
      try {
        const l = (await ext.storage.local.get(K.log))[K.log] || [];
        l.push(Object.assign({ em: Date.now(), type: String(type).slice(0, 40), ok: ok !== false }, extra || {}));
        await ext.storage.local.set({ [K.log]: l.slice(-30) });
      } catch (_) {}
    });
    return logQ;
  }

  // ───────────────────────── ponte com o mundo MAIN ─────────────────────────
  let seq = 0, mainOk = false, mainInfo = null; // mainInfo.player = false: a ponte está de pé mas a API do player sumiu
  const pend = new Map();
  function bridge(op, ...args) {
    return new Promise((ok) => {
      const id = 's' + (++seq) + '.' + Math.random().toString(36).slice(2, 6);
      const t = setTimeout(() => { pend.delete(id); ok(null); }, 1500);
      pend.set(id, (d) => { clearTimeout(t); ok(d); });
      document.dispatchEvent(new CustomEvent('sintonia:c', { detail: JSON.stringify({ id, op, args }) }));
    });
  }
  const onEvt = (e) => {
    if (dead) return;
    let m; try { m = JSON.parse(e.detail); } catch (_) { return; }
    if (!m) return;
    if (m.type === 'res') { const f = pend.get(m.id); if (f) { pend.delete(m.id); f(m.data); } return; }
    if (m.type === 'main-ready') { mainOk = true; return; }
    if (m.type === 'video') { mainOk = true; mainInfo = m.data; setVideo(m.data, 'main'); return; }
    if (m.type === 'ad') { page.ad = !!(m.data && m.data.ad); emit('ad', page.ad); }
    if (m.type === 'qual' || m.type === 'vol') emit(m.type, m.data);
  };
  document.addEventListener('sintonia:e', onEvt);

  // ───────────────────────── página e vídeo ─────────────────────────
  const kindOf = (p) => (p === '/watch' ? 'watch' : p.startsWith('/shorts/') ? 'shorts' : p === '/feed/subscriptions' ? 'subs' : p === '/' ? 'home' : 'other');
  const page = { kind: kindOf(location.pathname), videoId: '', canal: null, info: null, ad: false, url: location.pathname };
  function setVideo(inf, fonte) {
    if (!inf) return;
    const prevId = page.videoId, prevCanal = page.canal && page.canal.id;
    page.info = inf;
    page.videoId = inf.videoId || '';
    page.canal = inf.canal || null;
    if (inf.ad !== undefined) page.ad = !!inf.ad;
    if (page.videoId !== prevId || (page.canal && page.canal.id) !== prevCanal) {
      if (page.canal && page.canal.id) lembrarNome(page.canal);
      emit('video', { info: inf, fonte, trocou: page.videoId !== prevId });
    }
  }
  function onNav() {
    const k = kindOf(location.pathname);
    const mudou = k !== page.kind || location.pathname !== page.url;
    page.kind = k; page.url = location.pathname;
    emit('nav', { kind: k, mudou });
    if (mainOk) bridge('info').then((d) => { if (d) { mainInfo = d; if (d.player) setVideo(d, 'nav'); } });
  }
  document.addEventListener('yt-navigate-finish', onNav);
  addEventListener('popstate', onNav);

  // Plano B: se a ponte MAIN não responder (bloqueada ou API mudou), lê o que der do DOM: id pela URL, canal pelo link do dono.
  function infoDom() {
    const v = new URLSearchParams(location.search).get('v') || '';
    let canal = null;
    const fl = document.querySelector('ytd-watch-flexy');
    if (v && fl && fl.getAttribute('video-id') === v) {
      const a = document.querySelector('ytd-watch-metadata ytd-video-owner-renderer a[href], #owner ytd-video-owner-renderer a[href]');
      const href = a ? a.getAttribute('href') || '' : '';
      const nome = ((document.querySelector('ytd-watch-metadata #channel-name a, #owner #channel-name a') || {}).textContent || '').trim();
      let m = href.match(/\/channel\/(UC[\w-]{20,})/);
      if (m) canal = { id: m[1], nome, fonte: 'dom' };
      else if ((m = href.match(/\/(@[^/?#]+)/))) canal = { id: 'h:' + decodeURIComponent(m[1]).toLowerCase(), nome, fonte: 'dom-handle' };
    }
    return { player: !!document.querySelector('#movie_player video'), videoId: v, canal, shorts: location.pathname.startsWith('/shorts/'), url: location.pathname };
  }
  let tPlanoB = 0;
  const planoB = () => {
    if (!dead && !alive()) { stop(); return; } // extensão desativada, removida ou trocada: esta instância órfã para tudo (achado da revisão)
    if (!dead && page.kind === 'watch' && (!mainOk || !mainInfo || !mainInfo.player)) setVideo(infoDom(), 'dom');
  };

  // ───────────────────────── perfil por canal (storage.local) ─────────────────────────
  // { [UC…|h:@handle]: { n: nome, em: última mudança, ...ajustes } }. Recursos gravam com SINT.perfil.set(id, {rate: 1.5}).
  let perfis = {};
  let perfQ = Promise.resolve();
  const perfil = {
    get: (id) => (id && perfis[id]) || null,
    all: () => perfis,
    set(id, patch) {
      if (!id) return Promise.resolve();
      perfQ = perfQ.then(async () => {
        const cur = (await ext.storage.local.get(K.perfis))[K.perfis] || {};
        const p = Object.assign({}, cur[id] || {}, patch, { em: Date.now() });
        for (const k of Object.keys(patch)) if (patch[k] === null) delete p[k];
        if (!p.n && page.canal && page.canal.id === id) p.n = page.canal.nome;
        cur[id] = p; perfis = cur;
        await ext.storage.local.set({ [K.perfis]: cur });
      }).catch(() => {});
      return perfQ;
    },
    forget(id) {
      perfQ = perfQ.then(async () => {
        const cur = (await ext.storage.local.get(K.perfis))[K.perfis] || {};
        delete cur[id]; perfis = cur;
        await ext.storage.local.set({ [K.perfis]: cur });
      }).catch(() => {});
      return perfQ;
    },
    // ajustes de verdade do perfil (sem nome nem data)
    ajustes: (id) => { const p = perfil.get(id); if (!p) return {}; const o = Object.assign({}, p); delete o.n; delete o.em; return o; },
  };
  function lembrarNome(c) { // só atualiza o nome de quem já tem perfil (não cria perfil por só assistir)
    const p = perfis[c.id];
    if (p && c.nome && p.n !== c.nome) perfil.set(c.id, { n: c.nome });
  }

  // ───────────────────────── ajustes ─────────────────────────
  let upd = {};
  const urgente = () => !!(upd.disponivel && upd.urgente && upd.ultima && C.cmpVer(upd.ultima, VERSION) > 0);
  const ativo = () => !!S.on && !urgente(); // versão urgente pausa a automação (regra 14d)
  async function setSetting(k, v) { S[k] = v; try { await SYNC.set({ [k]: v }); } catch (_) {} }
  async function setLang(l) { lang = I.LANGS.includes(l) ? l : I.detect(); await setSetting('lang', I.LANGS.includes(l) ? l : ''); emit('lang', lang); }

  const onStore = (ch, area) => {
    if (!alive()) return;
    if (area === 'sync') {
      const mud = {};
      for (const k of Object.keys(DEF.SYNC)) if (ch[k]) { S[k] = ch[k].newValue === undefined ? DEF.SYNC[k] : ch[k].newValue; mud[k] = S[k]; }
      if (ch.lang) { lang = I.LANGS.includes(S.lang) ? S.lang : I.detect(); emit('lang', lang); }
      if (Object.keys(mud).length) { emit('settings', mud); if ('on' in mud) emit('ativo', ativo()); }
    }
    if (area === 'local') {
      if (ch[K.perfis]) { perfis = ch[K.perfis].newValue || {}; emit('perfis', perfis); }
      if (ch[K.update]) { const antes = ativo(); upd = ch[K.update].newValue || {}; emit('update', upd); if (antes !== ativo()) emit('ativo', ativo()); }
    }
  };
  ext.storage.onChanged.addListener(onStore);
  const onMsg = (m) => { if (alive() && m && typeof m.type === 'string' && m.type.startsWith('sintonia:')) emit('msg', m); };
  ext.runtime.onMessage.addListener(onMsg);

  function stop() {
    if (dead) return;
    dead = true;
    emit('stop');
    for (const f of stops) { try { f(); } catch (_) {} }
    clearInterval(tPlanoB);
    document.removeEventListener('sintonia-takeover', onTakeover);
    document.removeEventListener('sintonia:e', onEvt);
    document.removeEventListener('yt-navigate-finish', onNav);
    removeEventListener('popstate', onNav);
    try { ext.storage.onChanged.removeListener(onStore); ext.runtime.onMessage.removeListener(onMsg); } catch (_) {}
  }

  const SINT = globalThis.SINT = {
    ext, I, C, DEF, K, SYNC, VERSION, S, page, perfil,
    get lang() { return lang; }, L: () => I.T[lang] || I.T.en, setLang, setSetting,
    on, emit, onStop, log, bridge, alive, ativo, urgente, get upd() { return upd; }, get mainOk() { return mainOk; }, get dead() { return dead; },
    ready: null,
  };

  SINT.ready = Promise.all([
    SYNC.get(null).then((s) => { for (const k of Object.keys(DEF.SYNC)) if (k in s) S[k] = s[k]; if (I.LANGS.includes(s.lang)) lang = s.lang; }).catch(() => {}),
    ext.storage.local.get([K.perfis, K.update]).then((l) => { perfis = l[K.perfis] || {}; upd = l[K.update] || {}; }).catch(() => {}),
  ]).then(async () => {
    if (dead) return;
    // a ponte MAIN pode já estar de pé (página aberta antes): pergunta
    const pong = await bridge('ping');
    if (pong && pong.ok) { mainOk = true; const d = await bridge('info'); if (d) { mainInfo = d; if (d.player) setVideo(d, 'main'); } }
    tPlanoB = setInterval(planoB, 1000);
    planoB();
    emit('ready');
  });
})();
