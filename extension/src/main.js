// Sintonia — ponte no mundo MAIN (o da página). Só aqui dá para falar com a API do player (#movie_player).
// Conversa com o content script (mundo isolado) por eventos no document, com JSON em texto:
//   pedido:   'sintonia:c'  { id, op, args }
//   resposta: 'sintonia:e'  { id, type: 'res', data }   ·   aviso: { type: 'video' | 'ad', data }
// Nada aqui guarda nem lê storage. A única conversa com a rede é a leitura da lista de inscrições (v1.2.0, listarInscricoes): um pedido de
// leitura ao próprio youtube.com, o mesmo que a página Canais faz. Nada vai para outro servidor. Mapa da API em Jarvis/02-projetos/extensoes/telao/sintonia-engenharia-reversa.md
(() => {
  'use strict';
  // ───────────── fase 7: codec (antes de tudo, em document_start) ─────────────
  // Evitar 60 fps e forçar H.264, para PC fraco: o YouTube pergunta ao MediaSource.isTypeSupported (e ao mediaCapabilities) o que o
  // navegador toca; a Sintonia responde "não" para quadro > 30 e/ou para VP9/AV1. As chaves vêm do localStorage do YouTube
  // ('sintonia.codec'), gravado pelo mundo isolado quando o ajuste muda: o mundo MAIN não lê o storage da extensão.
  // Uma vez por página (a versão reinjetada não embrulha de novo).
  const flags = () => { try { return JSON.parse(localStorage.getItem('sintonia.codec') || '{}') || {}; } catch (_) { return {}; } };
  const fl0 = flags();
  if (!window.__sintCodec && window.MediaSource && (fl0.semHfr || fl0.h264)) { // desligado: o MediaSource do YouTube fica intocado
    window.__sintCodec = true;
    const barra = (tipo) => {
      const f = flags(), t = String(tipo || '').toLowerCase();
      if (!/^video\//.test(t)) return false;
      if (f.h264 && /vp0?9|av01|av1/.test(t)) return true;
      const m = t.match(/framerate=(\d+)/);
      if (f.semHfr && m && +m[1] > 30) return true;
      return false;
    };
    const orig = MediaSource.isTypeSupported.bind(MediaSource);
    MediaSource.isTypeSupported = function (tipo) { return barra(tipo) ? false : orig(tipo); };
    if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
      const di = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
      navigator.mediaCapabilities.decodingInfo = function (cfg) {
        try { const v = cfg && cfg.video; if (v && barra(v.contentType + (v.framerate ? `;framerate=${Math.round(v.framerate)}` : ''))) return Promise.resolve({ supported: false, smooth: false, powerEfficient: false }); } catch (_) {}
        return di(cfg);
      };
    }
  }
  if (window.__sintMainStop) { try { window.__sintMainStop(); } catch (_) {} } // instância única: a nova (reinjetada) desliga a velha
  let dead = false;
  const timers = [];
  const emit = (type, data, id) => document.dispatchEvent(new CustomEvent('sintonia:e', { detail: JSON.stringify({ type, data, id }) }));
  const mp = () => {
    const p = document.getElementById('movie_player');
    return p && typeof p.getVideoData === 'function' ? p : null;
  };
  const safe = (f, d) => { try { const v = f(); return v === undefined ? d : v; } catch (_) { return d; } };

  // ID do canal, em ordem de confiança (medido ao vivo em 2026-11-11):
  //  A) API do player: getPlayerResponse().videoDetails.channelId (atualiza na navegação interna)
  //  B) ytInitialPlayerResponse, só se for do mesmo vídeo (fica velho depois da navegação interna)
  //  C) link do dono no DOM (/channel/UC… ou /@handle), só se o ytd-watch-flexy já é do mesmo vídeo
  function canal(p, vid) {
    const pr = safe(() => p.getPlayerResponse(), null);
    const vd = pr && pr.videoDetails;
    if (vd && vd.channelId && (!vd.videoId || vd.videoId === vid)) return { id: vd.channelId, nome: vd.author || '', fonte: 'api' };
    const ip = safe(() => window.ytInitialPlayerResponse.videoDetails, null);
    if (ip && ip.channelId && ip.videoId === vid) return { id: ip.channelId, nome: ip.author || '', fonte: 'inicial' };
    const fl = document.querySelector('ytd-watch-flexy');
    if (fl && fl.getAttribute('video-id') === vid) {
      const a = document.querySelector('ytd-watch-metadata ytd-video-owner-renderer a[href], #owner ytd-video-owner-renderer a[href]');
      const href = a ? a.getAttribute('href') || '' : '';
      const nome = (document.querySelector('ytd-watch-metadata #channel-name a, #owner #channel-name a') || {}).textContent || '';
      let m = href.match(/\/channel\/(UC[\w-]{20,})/);
      if (m) return { id: m[1], nome: nome.trim(), fonte: 'dom' };
      m = href.match(/\/(@[^/?#]+)/);
      if (m) return { id: 'h:' + decodeURIComponent(m[1]).toLowerCase(), nome: nome.trim(), fonte: 'dom-handle' };
    }
    return null;
  }

  function info() {
    const p = mp();
    const shorts = location.pathname.startsWith('/shorts/');
    if (!p) return { player: false, shorts, url: location.pathname };
    const vd = safe(() => p.getVideoData(), {}) || {};
    const vid = vd.video_id || '';
    const ch = vid ? canal(p, vid) : null;
    return {
      player: true, shorts, url: location.pathname, videoId: vid, title: vd.title || '', author: vd.author || '',
      live: !!(vd.isLive || safe(() => p.getPlayerResponse().videoDetails.isLive, false)), premiere: !!vd.isPremiere,
      canal: ch, ad: p.classList.contains('ad-showing'),
      playlist: safe(() => p.getPlaylistId(), null) || null, index: safe(() => p.getPlaylistIndex(), -1),
      rate: safe(() => p.getPlaybackRate(), null), volume: safe(() => p.getVolume(), null), muted: safe(() => p.isMuted(), null),
      quality: safe(() => p.getPlaybackQuality(), null), qualities: safe(() => p.getAvailableQualityLevels(), []),
      duration: safe(() => p.getDuration(), 0),
    };
  }

  // ───────────────────────── áudio (fase 4): reforço até 400% e volume igualado, Web Audio no próprio <video> ─────────────────────────
  // O grafo fica guardado na página (window.__sintAudio), não nesta instância: createMediaElementSource só pode ser chamado uma vez
  // por <video>, e a versão nova da extensão (reinjetada) precisa reaproveitar o mesmo grafo. O vídeo só entra no grafo com o
  // AudioContext RODANDO (criado/retomado num gesto da pessoa): ligar num contexto suspenso deixaria o vídeo mudo.
  const AUD = window.__sintAudio || (window.__sintAudio = { ctx: null, nos: new WeakMap() });
  let audCfg = AUD.cfg || { ganho: 1, igualar: false }; // a instância nova herda a configuração da velha
  const precisaAudio = () => audCfg.ganho !== 1 || audCfg.igualar;
  const videoEl = () => document.querySelector('#movie_player video.html5-main-video, #movie_player video, #shorts-player video');
  function montar(v) {
    let g = AUD.nos.get(v);
    if (g) return g;
    if (!AUD.ctx || AUD.ctx.state !== 'running') return null;
    const c = AUD.ctx;
    g = { src: c.createMediaElementSource(v), ganho: c.createGain(), comp: c.createDynamicsCompressor(), compSaida: c.createGain(), lim: c.createDynamicsCompressor(), ana: c.createAnalyser() };
    // igualar: comprime as partes altas e sobe o todo (aproxima vídeos baixos e altos)
    g.comp.threshold.value = -30; g.comp.knee.value = 20; g.comp.ratio.value = 6; g.comp.attack.value = 0.01; g.comp.release.value = 0.3; g.compSaida.gain.value = 1.8;
    // limitador quando há reforço (evita estourar)
    g.lim.threshold.value = -1.5; g.lim.knee.value = 0; g.lim.ratio.value = 20; g.lim.attack.value = 0.002; g.lim.release.value = 0.1;
    g.ana.fftSize = 2048;
    AUD.nos.set(v, g);
    return g;
  }
  function religar(g) {
    for (const n of [g.src, g.ganho, g.comp, g.compSaida, g.lim, g.ana]) { try { n.disconnect(); } catch (_) {} }
    let ult = g.src;
    g.ganho.gain.value = audCfg.ganho;
    if (audCfg.ganho !== 1) { ult.connect(g.ganho); ult = g.ganho; }
    if (audCfg.igualar) { ult.connect(g.comp); g.comp.connect(g.compSaida); ult = g.compSaida; }
    if (audCfg.ganho > 1 || audCfg.igualar) { ult.connect(g.lim); ult = g.lim; }
    ult.connect(g.ana); g.ana.connect(AUD.ctx.destination);
  }
  function aplicarAudio() {
    const v = videoEl(); if (!v) return;
    let g = AUD.nos.get(v);
    if (!g && !precisaAudio()) return; // nada a fazer: o vídeo continua fora do Web Audio
    if (!g) g = montar(v);
    if (!g) return; // contexto ainda não roda: espera um gesto
    const k = JSON.stringify(audCfg);
    if (g.cfg === k) return; // já ligado assim: não desmonta e remonta à toa (achado da revisão)
    g.cfg = k;
    religar(g);
  }
  // gesto da pessoa: cria/retoma o AudioContext e liga o grafo
  const onGesto = () => {
    if (!precisaAudio() && !AUD.ctx) return;
    try {
      if (!AUD.ctx) AUD.ctx = new AudioContext({ latencyHint: 'interactive' });
      if (AUD.ctx.state !== 'running') AUD.ctx.resume().then(aplicarAudio, () => {}); else aplicarAudio();
    } catch (_) {}
  };
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, onGesto, true);
  // contexto parou (raro): tenta retomar; o vídeo nunca pode ficar mudo
  const vigiaAudio = () => { if (AUD.ctx && AUD.ctx.state === 'suspended' && AUD.nos.get(videoEl() || {})) AUD.ctx.resume().catch(() => {}); aplicarAudio(); };
  function nivelAudio() {
    const v = videoEl(), g = v && AUD.nos.get(v);
    if (!g) return { ligado: false, estado: AUD.ctx ? AUD.ctx.state : null };
    const a = new Float32Array(g.ana.fftSize); g.ana.getFloatTimeDomainData(a);
    let s = 0; for (const x of a) s += x * x;
    return { ligado: true, estado: AUD.ctx.state, rms: Math.sqrt(s / a.length), ganho: g.ganho.gain.value, igualar: audCfg.igualar };
  }

  // operações que o content script pode pedir (cresce a cada fase)
  const OPS = {
    ping: () => ({ ok: true }),
    info: () => info(),
    // fase 2: velocidade (a API só aceita 0,25–2: o resto vai direto no <video>), volume e qualidade
    setRate: (r) => {
      const p = mp(); const v = document.querySelector('#movie_player video');
      r = Math.max(0.07, Math.min(16, +r || 1));
      // a API fica no valor mais perto que ela aceita (0,25–2): assim o "reset" do player na troca de vídeo é o menor possível
      if (p) { try { p.setPlaybackRate(Math.max(0.25, Math.min(2, r))); } catch (_) {} }
      if (v && Math.abs(v.playbackRate - r) > 1e-3) v.playbackRate = r;
      return { rate: v ? v.playbackRate : null, api: p ? safe(() => p.getPlaybackRate(), null) : null };
    },
    setVolume: (vol, desmutar) => {
      const p = mp(); if (!p) return { ok: false };
      if (desmutar) { try { p.unMute(); } catch (_) {} }
      try { p.setVolume(Math.max(0, Math.min(100, Math.round(vol)))); } catch (_) {}
      return { ok: true, volume: safe(() => p.getVolume(), null), muted: safe(() => p.isMuted(), null) };
    },
    setQuality: (q) => {
      const p = mp(); if (!p) return { ok: false };
      const ORD = ['highres', 'hd2880', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
      const tem = (safe(() => p.getAvailableQualityLevels(), []) || []).filter((x) => ORD.includes(x));
      if (!tem.length) return { ok: false, motivo: 'sem-niveis' };
      const lim = ORD.indexOf(q);
      const alvo = tem.find((x) => ORD.indexOf(x) >= lim) || tem[tem.length - 1];
      try { p.setPlaybackQualityRange(alvo, alvo); } catch (_) { try { p.setPlaybackQuality(alvo); } catch (__) {} }
      return { ok: true, alvo, agora: safe(() => p.getPlaybackQuality(), null) };
    },
    audioConfig: (cfg) => { audCfg = AUD.cfg = { ganho: Math.max(1, Math.min(4, +cfg.ganho || 1)), igualar: !!cfg.igualar }; aplicarAudio(); return nivelAudio(); },
    audioNivel: () => nivelAudio(),
    // login pelo próprio YouTube (ytcfg), mais firme que procurar o avatar no topo da página
    logado: () => { try { const v = window.ytcfg && ytcfg.get ? ytcfg.get('LOGGED_IN') : undefined; return v === undefined ? { ok: false } : { ok: true, logado: !!v }; } catch (_) { return { ok: false }; } }, // sem o sinal: vale o plano B (avatar)
    // fase 7: codec e quadros que estão tocando agora (para conferir)
    codecAgora: () => { const p = mp(); const st = p && safe(() => p.getStatsForNerds(), null); const vs = p && safe(() => p.getVideoStats(), null);
      return { codecs: st && st.codecs, resolucao: st && (st.resolution || st.optimal_res), fmt: vs && vs.fmt, qualidade: p && safe(() => p.getPlaybackQuality(), null), flags: (() => { try { return localStorage.getItem('sintonia.codec'); } catch (_) { return null; } })() }; },
    // fase 6: player
    setLoop: (b) => { const p = mp(); if (!p) return { ok: false }; try { p.setLoopVideo(!!b); } catch (_) {} return { ok: true, loop: safe(() => p.getLoopVideo(), null) }; },
    playlist: () => { const p = mp(); if (!p) return null; return { ids: safe(() => p.getPlaylist(), null) || [], idx: safe(() => p.getPlaylistIndex(), -1), lista: safe(() => p.getPlaylistId(), null) }; },
    playAt: (i) => { const p = mp(); if (!p) return { ok: false }; try { p.playVideoAt(+i); return { ok: true }; } catch (_) { return { ok: false }; } },
    embed: () => { const p = mp(); const ps = p && safe(() => p.getPlayerResponse().playabilityStatus, null); return { embed: ps ? ps.playableInEmbed !== false : null, t: p ? safe(() => p.getCurrentTime(), 0) : 0 }; },
    pausar: () => { const p = mp(); if (p) { try { p.pauseVideo(); } catch (_) {} } return { ok: !!p }; },
    tocar: () => { const p = mp(); if (p) { try { p.playVideo(); } catch (_) {} } return { ok: !!p }; },
    pararDownload: () => { const p = mp(); if (p && typeof p.pauseVideoDownload === 'function') { try { p.pauseVideoDownload(); return { ok: true }; } catch (_) {} } return { ok: false }; },
    redimensionar: () => { window.dispatchEvent(new Event('resize')); return { ok: true }; },
    // fase 5: pular trecho pela API do player (mexer direto no <video> trava o MSE do YouTube — medido)
    seek: (t) => { const p = mp(); if (p) { try { p.seekTo(+t, true); return { ok: true }; } catch (_) {} } const v = videoEl(); if (v) { v.currentTime = +t; return { ok: true, plano: 'video' }; } return { ok: false }; },
    // fila: navegação interna do YouTube (sem recarregar; a tela cheia e o miniplayer sobrevivem). Só destinos que a Sintonia conhece.
    navegar: (alvo) => {
      const app = document.querySelector('ytd-app'); if (!app || !alvo) return { ok: false };
      let ep = null;
      if (alvo.tipo === 'watch' && /^[\w-]{11}$/.test(alvo.id || '')) ep = { commandMetadata: { webCommandMetadata: { url: '/watch?v=' + alvo.id, webPageType: 'WEB_PAGE_TYPE_WATCH', rootVe: 3832 } }, watchEndpoint: { videoId: alvo.id } };
      else if (alvo.tipo === 'subs') ep = { commandMetadata: { webCommandMetadata: { url: '/feed/subscriptions', webPageType: 'WEB_PAGE_TYPE_BROWSE', rootVe: 96368, apiUrl: '/youtubei/v1/browse' } }, browseEndpoint: { browseId: 'FEsubscriptions' } };
      if (!ep) return { ok: false };
      app.dispatchEvent(new CustomEvent('yt-navigate', { detail: { endpoint: ep }, bubbles: true, composed: true }));
      return { ok: true };
    },
    // estado do player (0 = acabou): pega o fim que o evento 'ended' não avisou (ex.: depois de anúncio no fim)
    estadoPlayer: () => { const p = mp(); return { state: p ? safe(() => p.getPlayerState(), null) : null, loop: p ? safe(() => p.getLoopVideo(), null) : null }; },
    // v1.2.0 · selo "Inscrito": lista de inscrições, SÓ LEITURA. Pede ao próprio youtube.com (POST /youtubei/v1/browse, FEchannels + continuações,
    // o mesmo pedido da página Canais) com a autorização que o site usa. Medido ao vivo em 2026-11-16: 226 canais em 3 páginas, 0,7 s.
    // Nunca chama subscribe/unsubscribe nem nada que escreva na conta. Responde na hora; o resultado vem no aviso 'inscritos'.
    listarInscricoes: () => {
      if (listando) return { ok: true, jaIndo: true };
      const cfg = window.ytcfg;
      if (!cfg || typeof cfg.get !== 'function' || !cfg.get('LOGGED_IN')) return { ok: false, motivo: 'deslogado' };
      listando = true;
      lerInscricoes().then((r) => { listando = false; emit('inscritos', r); }, (e) => { listando = false; emit('inscritos', { ok: false, motivo: 'erro', detalhe: String((e && e.message) || e).slice(0, 60) }); });
      return { ok: true };
    },
    // v1.2.0: lê, no card, a qual canal ele pertence (a página guarda isso em JS, não no DOM) e anota em data-sint-ch / data-sint-h / data-sint-vid
    canaisCards: () => marcarCards(),
    // fila (fase 1): vai para o vídeo `id` dentro da playlist nativa (temporária) que está tocando
    filaProximo: (id) => {
      const p = mp(); if (!p) return { ok: false };
      const pl = safe(() => p.getPlaylist(), null) || [];
      const i = pl.indexOf(id);
      if (i < 0) return { ok: false, motivo: 'fora-da-lista' };
      if (i === safe(() => p.getPlaylistIndex(), -1) + 1) p.nextVideo(); else p.playVideoAt(i);
      return { ok: true };
    },
  };
  // ───────────── v1.2.0 · selo "Inscrito" ─────────────
  let listando = false;
  async function lerInscricoes() {
    const cfg = window.ytcfg;
    const ctx = cfg.get('INNERTUBE_CONTEXT'), ver = cfg.get('INNERTUBE_CONTEXT_CLIENT_VERSION');
    const ck = {}; for (const c of document.cookie.split('; ')) { const i = c.indexOf('='); if (i > 0) ck[c.slice(0, i)] = c.slice(i + 1); }
    const sap = ck.SAPISID || ck['__Secure-3PAPISID'];
    if (!ctx || !sap) return { ok: false, motivo: 'sem-sessao' };
    const org = location.origin;
    const post = async (corpo) => {
      const ts = Math.floor(Date.now() / 1000);
      const h = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ts} ${sap} ${org}`)))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const r = await fetch('/youtubei/v1/browse?prettyPrint=false', { method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-youtube-client-name': '1', 'x-youtube-client-version': ver, 'x-origin': org, authorization: `SAPISIDHASH ${ts}_${h}`, 'x-goog-authuser': '0' },
        body: JSON.stringify(Object.assign({ context: ctx }, corpo)) });
      if (!r.ok) throw new Error('http ' + r.status);
      return r.text();
    };
    const ids = new Set(), hs = new Set(); let tok = null, pags = 0;
    const colher = (t) => {
      for (const m of t.matchAll(/"browseId":"(UC[\w-]{22})"/g)) ids.add(m[1]);
      for (const m of t.matchAll(/"canonicalBaseUrl":"\/(@[^"]+)"/g)) { try { hs.add(decodeURIComponent(m[1]).toLowerCase()); } catch (_) {} }
      const k = t.match(/"continuationCommand":\{"token":"([^"]+)"/); return k ? k[1] : null;
    };
    tok = colher(await post({ browseId: 'FEchannels' })); pags = 1;
    while (tok && pags < 40 && ids.size < 5000) { tok = colher(await post({ continuation: tok })); pags++; }
    if (!ids.size) return { ok: false, motivo: 'vazio' };
    return { ok: true, ids: [...ids], handles: [...hs], paginas: pags };
  }
  const cacheCard = new WeakMap();
  const donoDe = (e) => {
    let d; try { d = e.rawProps && typeof e.rawProps.data === 'function' ? e.rawProps.data() : (e.data || (e.__data && e.__data.data)); } catch (_) { d = null; }
    const uc = new Set(), h = new Set(), vis = new WeakSet();
    (function w(o, dep) {
      if (!o || typeof o !== 'object' || dep > 14 || vis.has(o)) return; vis.add(o);
      for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string') { if (/^UC[\w-]{22}$/.test(v)) uc.add(v); const m = v.match(/^\/?(@[\w.%-]+)$/); if (m) { try { h.add(decodeURIComponent(m[1]).toLowerCase()); } catch (_) {} } } else w(v, dep + 1); }
    })(d, 0);
    return { uc: [...uc].slice(0, 6), h: [...h].slice(0, 6) };
  };
  function marcarCards() {
    const p = location.pathname;
    const sel = p === '/' ? 'ytd-rich-grid-renderer yt-lockup-view-model, ytd-rich-grid-renderer ytd-rich-grid-media'
      : p === '/watch' ? 'ytd-watch-next-secondary-results-renderer yt-lockup-view-model, ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer'
      : p === '/results' ? 'ytd-search ytd-video-renderer, ytd-search yt-lockup-view-model' : '';
    if (!sel) return { n: 0 };
    let n = 0;
    for (const e of document.querySelectorAll(sel)) {
      const a = e.querySelector('a[href*="/watch?v="]'); if (!a) continue;
      const m = (a.getAttribute('href') || '').match(/[?&]v=([\w-]{11})/); const vid = m ? m[1] : '';
      let c = cacheCard.get(e);
      if (!c || c.vid !== vid) { c = Object.assign({ vid }, donoDe(e)); cacheCard.set(e, c); } // card reaproveitado com outro vídeo: lê de novo
      e.setAttribute('data-sint-vid', vid); e.setAttribute('data-sint-ch', c.uc.join(' ')); e.setAttribute('data-sint-h', c.h.join(' '));
      n++;
    }
    return { n };
  }
  const onCmd = (e) => {
    let m; try { m = JSON.parse(e.detail); } catch (_) { return; }
    if (!m || typeof m.op !== 'string' || !Object.prototype.hasOwnProperty.call(OPS, m.op)) return;
    let data; try { data = OPS[m.op].apply(null, Array.isArray(m.args) ? m.args : []); } catch (err) { data = { erro: String(err && err.message || err) }; }
    emit('res', data, m.id);
  };
  document.addEventListener('sintonia:c', onCmd);

  // troca de vídeo sem recarregar: confere o videoId e o anúncio a cada 400 ms (barato) e também nos eventos do YouTube
  let ultimo = '', ultimoAd = null, ultimoCanal = '';
  function conferir() {
    if (dead) return;
    const p = mp();
    if (!p) return;
    const vid = safe(() => p.getVideoData().video_id, '') || '';
    const ad = p.classList.contains('ad-showing');
    const ch = vid ? (canal(p, vid) || {}).id || '' : '';
    if (vid !== ultimo || ch !== ultimoCanal) { ultimo = vid; ultimoCanal = ch; emit('video', info()); }
    if (ad !== ultimoAd) { ultimoAd = ad; emit('ad', { ad, videoId: vid }); }
  }
  timers.push(setInterval(conferir, 400));
  timers.push(setInterval(vigiaAudio, 1000));
  // qualidade e volume mudados no player (a parte isolada decide se foi a pessoa, pelo clique/tecla recente)
  let ouvindo = null;
  const onQual = (q) => emit('qual', { q });
  const onVol = (d) => emit('vol', d && typeof d === 'object' ? { volume: d.volume, muted: d.muted } : null);
  timers.push(setInterval(() => {
    const p = mp();
    if (!p || p === ouvindo) return;
    try { p.addEventListener('onPlaybackQualityChange', onQual); p.addEventListener('onVolumeChange', onVol); ouvindo = p; } catch (_) {}
  }, 1000));
  const onNav = () => setTimeout(conferir, 0);
  document.addEventListener('yt-navigate-finish', onNav);
  document.addEventListener('yt-page-data-updated', onNav);

  window.__sintMainStop = () => {
    dead = true;
    if (ouvindo) { try { ouvindo.removeEventListener('onPlaybackQualityChange', onQual); ouvindo.removeEventListener('onVolumeChange', onVol); } catch (_) {} }
    timers.forEach(clearInterval);
    document.removeEventListener('sintonia:c', onCmd);
    for (const ev of ['pointerdown', 'keydown']) document.removeEventListener(ev, onGesto, true);
    document.removeEventListener('yt-navigate-finish', onNav);
    document.removeEventListener('yt-page-data-updated', onNav);
  };
  emit('main-ready', { at: Date.now() });
})();
