// Mock do selo "Inscrito" (v1.2.0): início, busca e relacionados com cards de canais misturados, e o POST /youtubei/v1/browse (FEchannels)
// com continuações. Os cards seguem o que foi medido ao vivo em 2026-11-16 (Jarvis/.../sintonia-engenharia-reversa.md):
//  - início: ytd-rich-item-renderer > yt-lockup-view-model; o canal é um <a href="/@handle"> dentro de yt-content-metadata-view-model;
//  - relacionados: yt-lockup-view-model SEM link do canal (só o nome em texto); o canal só existe em rawProps.data() (função, no JS da página);
//  - busca: ytd-video-renderer com ytd-channel-name e link (/@handle ou /channel/UC…); o canal também está em .data.
// card = { vid, titulo, nome, uc, h }  (uc e h podem faltar: "inscrito por UC", "por @handle" ou sem canal)
export const ucDe = (n) => 'UCi' + String(n).padStart(21, '0'); // 24 caracteres: UC + 22
export const handleDe = (n) => '@insc' + n;
export const TEXTO = { pt: { insc: 'Inscrever-se', ja: 'Inscrito' }, en: { insc: 'Subscribe', ja: 'Subscribed' }, es: { insc: 'Suscribirse', ja: 'Suscrito' } };

const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svgVer = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>';

function lockup(c, comLink) {
  const nome = c.nome ? (comLink && (c.h || c.uc) ? `<a href="${c.h ? '/' + c.h : '/channel/' + c.uc}">${esc(c.nome)}</a>` : esc(c.nome)) : '';
  return `<yt-lockup-view-model data-i="${esc(c.vid)}"><div class="thumb"><a href="/watch?v=${c.vid}"><img alt=""></a></div>
<yt-lockup-metadata-view-model><div><yt-decorated-avatar-view-model><yt-avatar-shape><div role="button" tabindex="0"></div></yt-avatar-shape></yt-decorated-avatar-view-model></div>
<div><h3><a href="/watch?v=${c.vid}" title="${esc(c.titulo)}"><span dir="auto" role="text">${esc(c.titulo)}</span></a></h3>
<yt-content-metadata-view-model><div role="group"><span dir="auto" role="text">${nome}</span>${c.verificado ? `<span>${svgVer}</span>` : ''}</div><div role="group"><span dir="auto" role="text">1 mi de visualizações</span></div></yt-content-metadata-view-model></div></yt-lockup-metadata-view-model></yt-lockup-view-model>`;
}
function videoRenderer(c) {
  const href = c.h ? '/' + c.h : c.uc ? '/channel/' + c.uc : '';
  return `<ytd-video-renderer data-i="${esc(c.vid)}"><a id="thumbnail" href="/watch?v=${c.vid}"><img alt=""></a><div id="meta"><h3><a id="video-title" href="/watch?v=${c.vid}">${esc(c.titulo)}</a></h3>
<div id="byline-container" style="display:none"><ytd-channel-name><div id="container"><div id="text-container">${esc(c.nome || '')}</div></div></ytd-channel-name></div>
<ytd-channel-name id="channel-name"><div id="container"><div id="text-container">${href ? `<a href="${href}">${esc(c.nome || '')}</a>` : esc(c.nome || '')}</div></div></ytd-channel-name></div></ytd-video-renderer>`;
}

// script comum: dá a cada card o que o YouTube dá (rawProps.data() nos lockups, .data nos renderers antigos) e o reaproveitamento de cards
const SCRIPT = (cards) => `<script>
(() => {
const CARDS = ${JSON.stringify(cards)};
const dados = (c) => ({ a: { b: { c: [c.uc ? { browseId: c.uc } : null, c.h ? { url: '/' + c.h } : null].filter(Boolean) } }, videoId: c.vid, titulo: c.titulo });
const porVid = {}; for (const c of CARDS) porVid[c.vid] = c;
for (const e of document.querySelectorAll('[data-i]')) {
  const c = porVid[e.dataset.i]; if (!c) continue;
  if (e.tagName === 'YT-LOCKUP-VIEW-MODEL') e.rawProps = { data: () => dados(e.__c || c) }; else e.data = dados(c);
  e.__c = c;
}
// reaproveita o MESMO elemento para outro vídeo/canal (o YouTube faz isso ao rolar e navegar)
window.__reciclar = (i, novo) => {
  const e = document.querySelectorAll('[data-i]')[i]; if (!e) return false;
  e.__c = novo; e.dataset.i = novo.vid;
  if (e.tagName === 'YT-LOCKUP-VIEW-MODEL') {
    for (const a of e.querySelectorAll('a[href*="/watch?v="]')) a.setAttribute('href', '/watch?v=' + novo.vid);
    e.querySelector('h3 span').textContent = novo.titulo;
    const nm = e.querySelector('yt-content-metadata-view-model [role=group] span[role=text]');
    const comLink = !!nm.querySelector('a');
    nm.innerHTML = novo.nome ? (comLink && (novo.h || novo.uc) ? '<a href="' + (novo.h ? '/' + novo.h : '/channel/' + novo.uc) + '">' + novo.nome + '</a>' : novo.nome) : '';
  } else {
    for (const a of e.querySelectorAll('a[href*="/watch?v="]')) a.setAttribute('href', '/watch?v=' + novo.vid);
    e.querySelector('#video-title').textContent = novo.titulo;
    e.querySelector('ytd-channel-name#channel-name #text-container').innerHTML = novo.nome ? '<a href="' + (novo.h ? '/' + novo.h : '/channel/' + novo.uc) + '">' + novo.nome + '</a>' : '';
    e.data = dados(novo);
  }
  return true;
};
})();
</script>`;

const CAB = (titulo, login, extra = '') => `<!doctype html><html lang="pt-BR" dark><head><meta charset="utf-8"><title>${titulo}</title>
<style>html{background:#0f0f0f;color:#f1f1f1;font-family:Roboto,Arial,sans-serif}body{margin:0}#masthead{height:56px;padding:0 16px;display:flex;align-items:center}
ytd-rich-item-renderer,ytd-video-renderer{display:block;margin:8px;padding:8px;border:1px solid #333;width:360px}
yt-lockup-view-model{display:block} img{width:320px;height:180px;background:#333;display:block} a{color:inherit}</style>
<script>(() => { const LOG = ${login ? 'true' : 'false'}; window.ytcfg = { get: (k) => ({ LOGGED_IN: LOG, INNERTUBE_CONTEXT: { client: { clientName: 'WEB', clientVersion: '2.20261116.00.00' } }, INNERTUBE_CONTEXT_CLIENT_VERSION: '2.20261116.00.00' }[k]) }; })();</script>
${extra}</head><body>`;

export function homeHtml(cards, q) {
  const login = q.get('login') === '1';
  return `${CAB('YouTube (simulado)', login)}<ytd-app><div id="masthead">YouTube simulado</div><ytd-page-manager><ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="contents">
${cards.map((c) => `<ytd-rich-item-renderer><div id="content">${lockup(c, true)}</div></ytd-rich-item-renderer>`).join('\n')}
</div></ytd-rich-grid-renderer></ytd-browse></ytd-page-manager></ytd-app>${SCRIPT(cards)}<script>setTimeout(() => document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true })), 50);</script></body></html>`;
}
export function buscaHtml(cards, q) {
  const login = q.get('login') === '1';
  return `${CAB('Busca - YouTube (simulado)', login)}<ytd-app><div id="masthead">YouTube simulado</div><ytd-page-manager><ytd-search><ytd-two-column-search-results-renderer><div id="primary"><ytd-section-list-renderer><div id="contents">
${cards.map((c) => videoRenderer(c)).join('\n')}
</div></ytd-section-list-renderer></div></ytd-two-column-search-results-renderer></ytd-search></ytd-page-manager></ytd-app>${SCRIPT(cards)}<script>setTimeout(() => document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true })), 50);</script></body></html>`;
}
// bloco da coluna de relacionados da página de vídeo (sem link do canal, como no site real) + script dos dados
export const relacionadosHtml = (cards) => `<ytd-watch-next-secondary-results-renderer><div id="items">${cards.map((c) => lockup(c, false)).join('\n')}</div></ytd-watch-next-secondary-results-renderer>${SCRIPT(cards)}`;

// POST /youtubei/v1/browse (FEchannels e continuações). Sem a autorização do site (SAPISIDHASH), devolve vazio, como o YouTube de verdade.
// st.insc = { n: total de canais, porPagina, off: Set de índices que saíram, extra: [{uc,h}] }
export function browse(st, req, corpo) {
  const aut = req.headers().authorization || '';
  st.inscPedidos.push({ aut: /^SAPISIDHASH \d+_[0-9a-f]{40}$/.test(aut), cont: !!corpo.continuation, browseId: corpo.browseId || null });
  if (!/^SAPISIDHASH /.test(aut)) return { responseContext: {}, trackedParams: 'x' };
  if (st.insc.modo === 'vazio') return { responseContext: {}, contents: [] };
  const todos = [];
  for (let i = 0; i < st.insc.n; i++) if (!st.insc.off.has(i)) todos.push({ uc: ucDe(i), h: handleDe(i) });
  for (const x of st.insc.extra) todos.push(x);
  const pp = st.insc.porPagina || 100;
  const pag = corpo.continuation ? +String(corpo.continuation).replace('tok', '') : 0;
  if (corpo.browseId && corpo.browseId !== 'FEchannels') return { responseContext: {} };
  const fatia = todos.slice(pag * pp, pag * pp + pp);
  const itens = fatia.map((c) => ({ channelRenderer: { channelId: c.uc, navigationEndpoint: { browseEndpoint: { browseId: c.uc, canonicalBaseUrl: c.h ? '/' + c.h : undefined } } } }));
  if ((pag + 1) * pp < todos.length) itens.push({ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'tok' + (pag + 1), request: 'CONTINUATION_REQUEST_TYPE_BROWSE' } } } });
  return { responseContext: {}, contents: itens };
}
