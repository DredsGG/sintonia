// YouTube simulado para os testes da Sintonia, fiel ao que foi medido ao vivo em 2026-11-11
// (Jarvis/02-projetos/extensoes/telao/sintonia-engenharia-reversa.md):
//  - <html dark>, ytd-app, ytd-watch-flexy[video-id], #movie_player.html5-video-player com video.video-stream.html5-main-video;
//  - barra .ytp-chrome-bottom > .ytp-right-controls > .ytp-right-controls-left (… .ytp-settings-button) + -right + .ytp-pip-button;
//  - API do player com os mesmos nomes (getVideoData, getPlayerResponse().videoDetails.channelId, setPlaybackRate, setVolume, …);
//  - navegação interna: pushState + troca do vídeo + 'yt-navigate-finish', com o ytd-watch-flexy/dono atualizando DEPOIS (como no site).
// Parâmetros da URL do mock: api=full (padrão) | noresp (sem getPlayerResponse) | none (sem API) · theme=dark|light
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { inscricoesHtml, FEED } from './mock-inscricoes.mjs';
import crypto from 'crypto';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = fs.readFileSync(path.join(DIR, 'media', 'ep.webm'));

export const VIDEOS = {
  AAAAAAAAAA1: { title: 'Vídeo um do Canal Um', author: 'Canal Um', channelId: 'UCaaaaaaaaaaaaaaaaaaaaa1', handle: '@canalum' },
  BBBBBBBBBB2: { title: 'Vídeo do Canal Dois', author: 'Canal Dois', channelId: 'UCbbbbbbbbbbbbbbbbbbbbb2', handle: '@canaldois' },
  AAAAAAAAAA3: { title: 'Vídeo três do Canal Um', author: 'Canal Um', channelId: 'UCaaaaaaaaaaaaaaaaaaaaa1', handle: '@canalum' },
  LIVEVIDEO04: { title: 'Ao vivo agora', author: 'Canal Dois', channelId: 'UCbbbbbbbbbbbbbbbbbbbbb2', handle: '@canaldois', live: true },
};

export function watchHtml(vid, q, lista) {
  const theme = q.get('theme') || 'dark', api = q.get('api') || 'full';
  const DB0 = Object.assign({}, VIDEOS);
  for (const it of FEED) DB0[it.id] = { title: it.titulo, author: it.canal, channelId: 'UC' + it.canal.replace(/\W/g, '').padEnd(22, 'x').slice(0, 22), handle: '@' + it.canal.replace(/\W/g, '').toLowerCase() };
  for (const id of (lista || [])) if (!DB0[id]) DB0[id] = { title: 'Vídeo ' + id, author: 'Canal Fila', channelId: 'UCfilafilafilafilafila00', handle: '@canalfila' };
  DB0.FORA0000001 = { title: 'Sugestão de fora', author: 'Canal Fora', channelId: 'UCforaforaforaforafora00', handle: '@fora' };
  return `<!doctype html><html lang="pt-BR" ${theme === 'dark' ? 'dark' : ''}><head><meta charset="utf-8"><title>YouTube (simulado)</title>
<style>
html{background:${theme === 'dark' ? '#0f0f0f' : '#fff'};color:${theme === 'dark' ? '#f1f1f1' : '#0f0f0f'};font-family:Roboto,Arial,sans-serif}body{margin:0}
#masthead{height:56px;display:flex;align-items:center;padding:0 16px}
#columns{display:flex;gap:24px;padding:0 24px}#primary{width:854px}
#movie_player{position:relative;width:854px;height:480px;background:#000;border-radius:12px;overflow:hidden}
video.html5-main-video{width:100%;height:100%;display:block;object-fit:contain}
.ytp-chrome-bottom{position:absolute;left:12px;right:12px;bottom:0;height:56px;display:flex;align-items:center;justify-content:space-between}
.ytp-right-controls{display:flex;height:40px}.ytp-right-controls-left,.ytp-right-controls-right{display:flex;height:40px}
.ytp-button{width:48px;height:40px;padding:0;border:0;background:transparent;color:#fff;cursor:pointer;opacity:1}
.ytp-button svg{width:24px;height:24px}
#related a{display:block;color:inherit;margin:8px 0}
ytd-watch-metadata h1{font-size:20px;line-height:28px;font-weight:700;margin:12px 0}
</style></head><body>
<ytd-app><div id="masthead">YouTube simulado ${q.get('login') === '1' ? '<button id="avatar-btn" aria-label="Conta">A</button>' : '<a href="https://accounts.google.com/ServiceLogin">Fazer login</a>'}</div>
<ytd-watch-flexy video-id="${vid}"><div id="columns"><div id="primary">
<div id="player-container-outer" style="width:854px;height:480px"><div id="movie_player" class="html5-video-player ytp-delhi-modern" tabindex="-1">
  <div class="html5-video-container"><video class="video-stream html5-main-video" src="/media/ep.webm" muted playsinline autoplay></video></div>
  <div class="ytp-autonav-endscreen-countdown-overlay" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,.6)"><button class="ytp-autonav-endscreen-upnext-cancel-button">Cancelar</button></div>
  <div class="ytp-ce-element" style="position:absolute;right:20px;top:20px;width:120px;height:68px;background:#555">card final</div><div class="ytp-cards-teaser" style="position:absolute;right:20px;top:100px">card</div><div class="ytp-endscreen-content" style="position:absolute;left:20px;top:20px;width:200px;height:100px;background:#333">tela final</div>
  <div class="ytp-progress-bar-container" style="position:absolute;left:12px;right:12px;bottom:56px;height:5px"><div class="ytp-progress-bar" style="position:relative;height:100%;background:rgba(255,255,255,.2)"></div></div>
  <yt-player-quick-action-buttons style="display:none"><like-button-view-model><toggle-button-view-model><button-view-model><button aria-pressed="false" class="qa-like">Gostei</button></button-view-model></toggle-button-view-model></like-button-view-model><dislike-button-view-model><toggle-button-view-model><button-view-model><button aria-pressed="false">Não gostei</button></button-view-model></toggle-button-view-model></dislike-button-view-model></yt-player-quick-action-buttons>
  <div class="ytp-chrome-bottom"><div class="ytp-left-controls"><button class="ytp-play-button ytp-button" aria-label="Reproduzir (k)">▶</button></div>
    <div class="ytp-right-controls"><div class="ytp-right-controls-left">
      <button class="ytp-button ytp-autonav-toggle" aria-label="Reprodução automática"><div class="ytp-autonav-toggle-button-container"><div class="ytp-autonav-toggle-button" aria-checked="true"></div></div></button>
      <button class="ytp-subtitles-button ytp-button" aria-label="Legendas">CC</button>
      <button class="ytp-button ytp-settings-button" aria-label="Detalhes" aria-haspopup="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2"/></svg></button></div>
    <div class="ytp-right-controls-right"><button class="ytp-size-button ytp-button" aria-label="Modo Teatro (t)">▭</button><button class="ytp-fullscreen-button ytp-button" aria-label="Tela inteira (f)">⛶</button></div>
    <button class="ytp-pip-button ytp-button" style="display:none"></button></div></div>
</div></div>
<div id="below"><ytd-watch-metadata><h1 class="style-scope ytd-watch-metadata"><span id="ttl"></span></h1>
  <div id="top-level-buttons-computed"><segmented-like-dislike-button-view-model>
    <like-button-view-model><toggle-button-view-model><button-view-model><button id="b-like" aria-pressed="${q.get('liked') === '1'}" aria-label="marcar este vídeo como Gostei">Gostei</button></button-view-model></toggle-button-view-model></like-button-view-model>
    <dislike-button-view-model><toggle-button-view-model><button-view-model><button id="b-dis" aria-pressed="${q.get('disliked') === '1'}" aria-label="Não gostei deste vídeo">Não gostei</button></button-view-model></toggle-button-view-model></dislike-button-view-model>
  </segmented-like-dislike-button-view-model></div>
  <div id="owner"><ytd-video-owner-renderer><a id="owner-a" href=""></a><div id="channel-name"><a id="owner-n" href=""></a></div></ytd-video-owner-renderer></div></ytd-watch-metadata><ytd-comments id="comments"><ytd-comments-header-renderer><h2>Comentários</h2><div id="sort-menu"><tp-yt-paper-listbox id="ordem"><a id="o-top" class="iron-selected" aria-selected="true">Principais</a><a id="o-rec" aria-selected="false">Mais recentes</a></tp-yt-paper-listbox></div></ytd-comments-header-renderer><p>Um comentário</p></ytd-comments></div>
</div>
<div id="secondary">${(DB0[vid] || {}).live ? '<ytd-live-chat-frame id="chat"><div>chat ao vivo</div></ytd-live-chat-frame>' : ''}<div id="related">${Object.keys(VIDEOS).map((k) => `<a href="/watch?v=${k}" class="rel" data-v="${k}">${VIDEOS[k].title}</a>`).join('')}<a href="/feed/subscriptions" class="rel" data-p="subs">Inscrições</a><a href="/" class="rel" data-p="home">Início</a></div></div>
</div></ytd-watch-flexy></ytd-app>
<script>
(() => {
const DB = ${JSON.stringify(DB0)}, API = ${JSON.stringify(api)}, LISTA = ${JSON.stringify(lista || null)};
const mp = document.getElementById('movie_player'), v = mp.querySelector('video'), fl = document.querySelector('ytd-watch-flexy');
let cur = ${JSON.stringify(vid)}, rate = 1, vol = ${+(q.get('vol') || 100)}, muted = ${q.get('muted') === '1'}, quality = 'hd720', loop = false;
const ouv = {}; const disparar = (n, d) => (ouv[n] || []).forEach((f) => { try { f(d); } catch (_) {} });
window.__mock = { clicks: 0, toggles: 0, navs: [], setRate: [], setVol: [], setQ: [], likes: 0, likeCliques: 0, disCliques: 0, loginPopup: 0, autoplayFora: 0, cancelou: 0 };
const LOGADO = ${q.get('login') === '1'};
window.ytcfg = { get: (k) => (k === 'LOGGED_IN' ? LOGADO : undefined) }; // como no site real (medido 2026-11-11)
const bl = document.getElementById('b-like'), bd = document.getElementById('b-dis');
window.__mock.ordemCliques = 0;
for (const a of document.querySelectorAll('#ordem a')) a.addEventListener('click', () => { window.__mock.ordemCliques++; for (const b of document.querySelectorAll('#ordem a')) { b.classList.toggle('iron-selected', b === a); b.setAttribute('aria-selected', String(b === a)); } });
bl.addEventListener('click', () => { window.__mock.likeCliques++; if (!LOGADO) { window.__mock.loginPopup++; return; } const on = bl.getAttribute('aria-pressed') !== 'true'; setTimeout(() => { bl.setAttribute('aria-pressed', String(on)); if (on) { bd.setAttribute('aria-pressed', 'false'); window.__mock.likes++; } else window.__mock.likes--; }, 200); });
bd.addEventListener('click', () => { window.__mock.disCliques++; });
// clique no vídeo pausa/continua, como no site (botões da barra não)
mp.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) return; window.__mock.toggles++; v.paused ? v.play() : v.pause(); });
function dono() {
  if (!document.getElementById('ttl')) return; // a página já virou outra (navegação interna para as Inscrições)
  const d = DB[cur] || {};
  document.getElementById('ttl').textContent = d.title || '';
  const a = document.getElementById('owner-a'), n = document.getElementById('owner-n');
  a.setAttribute('href', '/' + d.handle); n.setAttribute('href', '/' + d.handle); n.textContent = d.author || '';
  fl.setAttribute('video-id', cur);
}
dono();
v.volume = vol / 100; v.muted = muted;
// na troca de vídeo o player real devolve o <video> para a velocidade da API (medido): o mock faz igual
v.addEventListener('loadeddata', () => { if (v.playbackRate !== rate) { window.__mock.resets = (window.__mock.resets || 0) + 1; v.playbackRate = rate; } });
// anúncio simulado: classe ad-showing, velocidade 1 durante o anúncio
window.__anuncio = (ms) => { mp.classList.add('ad-showing'); v.playbackRate = 1; setTimeout(() => { mp.classList.remove('ad-showing'); v.playbackRate = rate; }, ms); };
const api = {
  getVideoData: () => { const d = DB[cur] || {}; return { video_id: cur, author: d.author, title: d.title, isLive: !!d.live, isPremiere: false, isPlayable: true, video_quality: quality }; },
  getPlayerResponse: () => { const d = DB[cur] || {}; return { videoDetails: { videoId: cur, channelId: d.channelId, author: d.author, isLive: !!d.live, isLiveContent: !!d.live }, playabilityStatus: { status: 'OK', playableInEmbed: ${q.get('embed') !== '0'} } }; },
  pauseVideoDownload: () => { window.__mock.pararDownload = (window.__mock.pararDownload || 0) + 1; },
  getPlaybackRate: () => rate, getAvailablePlaybackRates: () => [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  // como o real (medido 2026-11-11): a API corta em 0,25–2 (pedir 3 dá 2)
  setPlaybackRate: (r) => { window.__mock.setRate.push(r); rate = Math.max(0.25, Math.min(2, +r)); v.playbackRate = rate; disparar('onPlaybackRateChange', rate); },
  getVolume: () => vol, setVolume: (x) => { window.__mock.setVol.push(x); vol = Math.max(0, Math.min(100, Math.round(x))); v.volume = vol / 100; disparar('onVolumeChange', { volume: vol, muted, unstorable: false }); },
  isMuted: () => muted, mute: () => { muted = true; v.muted = true; disparar('onVolumeChange', { volume: vol, muted }); }, unMute: () => { muted = false; v.muted = false; disparar('onVolumeChange', { volume: vol, muted }); },
  getPlaybackQuality: () => quality, getAvailableQualityLevels: () => ['hd1080', 'hd720', 'large', 'medium', 'small', 'tiny', 'auto'],
  setPlaybackQualityRange: (a) => { window.__mock.setQ.push(a); quality = a; disparar('onPlaybackQualityChange', a); },
  getPlaylistId: () => new URLSearchParams(location.search).get('list'), getPlaylistIndex: () => (LISTA ? LISTA.indexOf(cur) : -1),
  getPlaylist: () => (LISTA ? LISTA.slice() : null), nextVideo: () => { const i = LISTA ? LISTA.indexOf(cur) : -1; if (LISTA && i + 1 < LISTA.length) irLista(i + 1); },
  playVideoAt: (i) => { if (LISTA && LISTA[i]) irLista(i); }, setAutonav: () => {},
  getDuration: () => v.duration || 100, getCurrentTime: () => v.currentTime, seekTo: (t) => { v.currentTime = t; },
  playVideo: () => v.play(), pauseVideo: () => v.pause(), getPlayerState: () => (v.ended ? 0 : v.paused ? 2 : 1),
  setLoopVideo: (b) => { loop = !!b; }, getLoopVideo: () => loop,
  addEventListener: (n, f) => { (ouv[n] = ouv[n] || []).push(f); }, removeEventListener: (n, f) => { ouv[n] = (ouv[n] || []).filter((x) => x !== f); },
};
if (API === 'full' || API === 'noresp') for (const k of Object.keys(api)) mp[k] = api[k];
if (API === 'noresp') delete mp.getPlayerResponse;
// navegação interna (SPA): troca o vídeo na hora; o ytd-watch-flexy e o dono atualizam 300 ms depois (como no site)
window.__ir = (href) => {
  history.pushState({}, '', href);
  const u = new URL(href, location.href), nv = u.searchParams.get('v');
  window.__mock.navs.push(u.pathname + u.search);
  if (u.pathname === '/watch' && nv) { bl.setAttribute('aria-pressed', 'false'); bd.setAttribute('aria-pressed', 'false'); cur = nv; clearTimeout(contagem); ov.style.display = 'none'; v.src = '/media/ep.webm?' + nv; v.play().catch(() => {}); setTimeout(dono, 300); }
  if (u.pathname === '/feed/subscriptions') { // navegação interna para as Inscrições: troca o conteúdo sem recarregar (window.__semRecarga persiste)
    fetch(u.pathname).then((r) => r.text()).then((html) => {
      const d = new DOMParser().parseFromString(html, 'text/html');
      for (const e of d.querySelectorAll('head style')) document.head.appendChild(e.cloneNode(true));
      document.body.replaceChildren(...[...d.body.childNodes].filter((n) => n.nodeName !== 'SCRIPT'));
      for (const sc of d.body.querySelectorAll('script')) { const n = document.createElement('script'); n.textContent = sc.textContent; document.body.appendChild(n); }
      document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true }));
    });
  }
  document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true }));
};
// o evento interno do YouTube que a ponte da Sintonia dispara (yt-navigate com o endpoint): vira a mesma navegação
document.querySelector('ytd-app').addEventListener('yt-navigate', (e) => { const w = e.detail && e.detail.endpoint && e.detail.endpoint.commandMetadata && e.detail.endpoint.commandMetadata.webCommandMetadata; if (w && !window.__mock.semNavegar) { window.__mock.ytNavigate = (window.__mock.ytNavigate || 0) + 1; window.__ir(w.url); } });
// playlist (como a temporária do /watch_videos): no fim do vídeo vai para o próximo; no fim da lista (ou vídeo solto),
// a tela final conta 3 s e, com a reprodução automática ligada, puxa uma sugestão de fora — a menos que cancelem.
function irLista(i) { window.__ir('/watch?v=' + LISTA[i] + '&list=' + new URLSearchParams(location.search).get('list') + '&index=' + (i + 1)); }
const tog = document.querySelector('.ytp-autonav-toggle-button'), ov = document.querySelector('.ytp-autonav-endscreen-countdown-overlay');
try { if (localStorage.getItem('mockAutonav') === '0') tog.setAttribute('aria-checked', 'false'); } catch (_) {}
document.querySelector('.ytp-autonav-toggle').addEventListener('click', () => { const on = tog.getAttribute('aria-checked') !== 'true'; tog.setAttribute('aria-checked', String(on)); try { localStorage.setItem('mockAutonav', on ? '1' : '0'); } catch (_) {} });
let contagem = 0;
ov.querySelector('button').addEventListener('click', () => { clearTimeout(contagem); ov.style.display = 'none'; window.__mock.cancelou++; });
v.addEventListener('ended', () => {
  if (window.__mock.posroll) { const ms = window.__mock.posroll; window.__mock.posroll = 0; mp.classList.add('ad-showing'); return setTimeout(() => mp.classList.remove('ad-showing'), ms); } // anúncio no fim: o 'ended' vem durante o anúncio e nada avisa depois
  if (window.__mock.semAvanco) return; // reprodução automática desligada na conta: o YouTube não avança sozinho
  const i = LISTA ? LISTA.indexOf(cur) : -1;
  if (LISTA && i >= 0 && i + 1 < LISTA.length) return setTimeout(() => irLista(i + 1), 300);
  if (tog.getAttribute('aria-checked') !== 'true') return;
  ov.style.display = 'block';
  contagem = setTimeout(() => { ov.style.display = 'none'; window.__mock.autoplayFora++; window.__ir('/watch?v=FORA0000001'); }, 3000);
});
document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a.rel'); if (!a) return; e.preventDefault(); window.__ir(a.getAttribute('href')); });
const menu = document.createElement('div'); menu.className = 'ytp-popup ytp-settings-menu'; menu.style.cssText = 'display:none;position:absolute;right:12px;bottom:64px;background:rgba(0,0,0,.6);color:#eee;padding:8px;border-radius:12px;z-index:60';
menu.innerHTML = [0.25, 0.5, 1, 1.25, 1.5, 2].map((r) => '<div class="ytp-menuitem" data-rate="' + r + '">' + r + '</div>').join('') + ['hd1080', 'hd720', 'large', 'tiny'].map((x) => '<div class="ytp-menuitem" data-q="' + x + '">' + x + '</div>').join('');
mp.appendChild(menu);
document.querySelector('.ytp-settings-button').addEventListener('click', () => { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; });
menu.addEventListener('click', (e) => { const it = e.target.closest('.ytp-menuitem'); if (!it) return; if (it.dataset.rate) api.setPlaybackRate(+it.dataset.rate); if (it.dataset.q) api.setPlaybackQualityRange(it.dataset.q, it.dataset.q); menu.style.display = 'none'; });
document.querySelector('.ytp-size-button').addEventListener('click', () => { if (fl.hasAttribute('theater')) fl.removeAttribute('theater'); else fl.setAttribute('theater', ''); window.__mock.teatro = (window.__mock.teatro || 0) + 1; });
document.addEventListener('keydown', (e) => { // teclas do próprio YouTube
  const t = e.target; if (t && /INPUT|TEXTAREA/.test(t.tagName || '')) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.code === 'ArrowUp') { api.setVolume(vol + 5); e.preventDefault(); }
  if (e.code === 'ArrowDown') { api.setVolume(vol - 5); e.preventDefault(); }
  if (e.shiftKey && e.code === 'Period') api.setPlaybackRate(rate + 0.25);
  if (e.shiftKey && e.code === 'Comma') api.setPlaybackRate(rate - 0.25);
  if (e.code === 'KeyK') { window.__mock.k = (window.__mock.k || 0) + 1; }
});
document.getElementsByClassName('ytp-fullscreen-button')[0].addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else mp.requestFullscreen(); });
setTimeout(() => document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true })), 50);
})();
</script></body></html>`;
}

// página de Shorts simulada (fase 3): ytd-shorts > ytd-reel-video-renderer[is-active] com like/dislike e o vídeo
export const shortsHtml = (id, q) => `<!doctype html><html lang="pt-BR" dark><head><meta charset="utf-8"><title>Shorts</title></head><body style="background:#0f0f0f;color:#fff">
<ytd-app><div id="masthead">${q.get('login') === '1' ? '<button id="avatar-btn">A</button>' : ''}</div><ytd-shorts><ytd-reel-video-renderer is-active>
<div id="shorts-player"><video src="/media/ep.webm?${id}" muted autoplay playsinline style="width:360px;height:640px"></video></div>
<like-button-view-model><toggle-button-view-model><button-view-model><button id="b-like" aria-pressed="false">Gostei</button></button-view-model></toggle-button-view-model></like-button-view-model>
<dislike-button-view-model><toggle-button-view-model><button-view-model><button id="b-dis" aria-pressed="false">Não gostei</button></button-view-model></toggle-button-view-model></dislike-button-view-model>
</ytd-reel-video-renderer></ytd-shorts></ytd-app><script>window.__mock = { likes: 0 }; const b = document.getElementById('b-like'); b.addEventListener('click', () => { b.setAttribute('aria-pressed', 'true'); window.__mock.likes++; });
setTimeout(() => document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true })), 50);</script></body></html>`;

export const simpleHtml = (title) => `<!doctype html><html lang="pt-BR" dark><head><meta charset="utf-8"><title>${title}</title></head><body style="background:#0f0f0f;color:#fff;font-family:Roboto,Arial"><ytd-app><div id="masthead">YouTube simulado</div><h1>${title}</h1></ytd-app></body></html>`;

// gh: { status: 404 } | { tag: 'v0.2.0', name, body, urgente }
export async function rotas(ctx, opts = {}) {
  const st = { gh: opts.gh || { status: 404 }, ghCalls: 0, issues: [], extra: opts.extra || null, listas: {}, wv: opts.wv !== false, watchVideos: [], feedback: 0 };
  await ctx.route('https://www.youtube.com/**', async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/media/')) { // com Range (206), senão o vídeo não deixa pular para o fim
      const rg = (r.request().headers().range || '').match(/bytes=(\d+)-(\d*)/);
      if (!rg) return r.fulfill({ status: 200, contentType: 'video/webm', headers: { 'accept-ranges': 'bytes' }, body: VIDEO });
      const a = +rg[1], b = rg[2] ? Math.min(+rg[2], VIDEO.length - 1) : VIDEO.length - 1;
      return r.fulfill({ status: 206, contentType: 'video/webm', headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${b}/${VIDEO.length}` }, body: VIDEO.subarray(a, b + 1) });
    }
    if (st.extra) { const res = await st.extra(u, r); if (res) return; }
    if (u.pathname.startsWith('/shorts/')) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: shortsHtml(u.pathname.split('/')[2], u.searchParams) });
    if (u.pathname === '/feed/subscriptions') return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: inscricoesHtml(u.searchParams) });
    if (/^\/youtubei\/v1\/(feedback|like|subscription)/.test(u.pathname)) { st.feedback++; return r.fulfill({ status: 200, body: '{}' }); }
    if (u.pathname === '/watch_videos') { // playlist temporária: até 50 IDs (medido); st.wv=false simula a playlist não vindo (plano B)
      const ids = (u.searchParams.get('video_ids') || '').split(',').filter(Boolean).slice(0, 50);
      st.watchVideos.push(ids);
      const lid = 'TLGGmock' + Object.keys(st.listas).length;
      st.listas[lid] = ids;
      // (o YouTube redireciona no servidor; aqui o redirecionamento é na página, porque o Playwright não intercepta o pedido seguinte a um 302 simulado)
      const destino = st.wv ? `/watch?v=${ids[0]}&list=${lid}` : `/watch?v=${ids[0]}`;
      return r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><script>location.replace(${JSON.stringify(destino)})</script>` });
    }
    if (u.pathname === '/watch') { const l = u.searchParams.get('list'); return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: watchHtml(u.searchParams.get('v') || 'AAAAAAAAAA1', u.searchParams, l && st.listas[l]) }); }
    return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: simpleHtml(u.pathname) });
  });
  await ctx.route('https://api.github.com/**', (r) => {
    st.ghCalls++;
    const g = st.gh;
    if (g.status && g.status !== 200) return r.fulfill({ status: g.status, contentType: 'application/json', body: '{"message":"Not Found"}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tag_name: g.tag, name: g.name || g.tag, body: g.body || '- Coisa nova', html_url: 'https://github.com/DredsGG/sintonia/releases/tag/' + g.tag,
      assets: [{ name: `sintonia-${g.tag}.zip`, browser_download_url: `https://github.com/DredsGG/sintonia/releases/download/${g.tag}/sintonia-${g.tag}.zip` }] }) });
  });
  await ctx.route('https://github.com/**', (r) => { st.issues.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>github simulado</h1>' }); });
  // miniaturas: nunca do CDN de verdade nos testes
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await ctx.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  // SponsorBlock simulado: responde pelo prefixo do sha256, com vizinhos de isca (o filtro pelo videoID é da Sintonia)
  st.sb = opts.sb || {}; st.sbPedidos = [];
  await ctx.route('https://sponsor.ajay.app/**', (r) => {
    const u = new URL(r.request().url()); st.sbPedidos.push(u.pathname + u.search);
    const pre = (u.pathname.match(/\/api\/skipSegments\/([0-9a-f]+)$/) || [])[1];
    const lista = Object.keys(st.sb).filter((v) => crypto.createHash('sha256').update(v).digest('hex').startsWith(pre)).map((v) => ({ videoID: v, segments: st.sb[v] }));
    if (!lista.length) return r.fulfill({ status: 404, body: 'Not Found' });
    lista.push({ videoID: 'VIZINHO0001', segments: [{ category: 'sponsor', actionType: 'skip', segment: [1, 99], UUID: 'isca' }] });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lista) });
  });
  return st;
}
