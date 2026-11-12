// Página de Inscrições simulada (fase 1), com o DOM do card medido ao vivo em 2026-11-11 (grade de vídeos de canal público,
// mesmos componentes: ytd-rich-item-renderer > yt-lockup-view-model; metadados em [class*=MetadataRow] span[role=text];
// duração em badge-shape .ytBadgeShapeText; 30 itens por continuação, ytd-continuation-item-renderer no fim).
// O que precisa de login e não deu para medir (progresso assistido, linha do canal no feed de Inscrições) segue o mesmo
// padrão de nomes e fica marcado como inferido na engenharia reversa.

const TXT = {
  pt: { min: (n) => `há ${n} minutos`, h: (n) => `há ${n} ${n === 1 ? 'hora' : 'horas'}`, d: (n) => `há ${n} ${n === 1 ? 'dia' : 'dias'}`, w: (n) => `há ${n} ${n === 1 ? 'semana' : 'semanas'}`,
    views: '12 mil visualizações', live: 'AO VIVO', watching: '1,2 mil assistindo agora', sched: 'Programado para 12/11/26, 20:00', soon: 'EM BREVE', prem: 'Estreia em 12/11/2026, 20:00', streamed: (t) => `Transmitido ${t}` },
  en: { min: (n) => `${n} minutes ago`, h: (n) => `${n} ${n === 1 ? 'hour' : 'hours'} ago`, d: (n) => `${n} ${n === 1 ? 'day' : 'days'} ago`, w: (n) => `${n} ${n === 1 ? 'week' : 'weeks'} ago`,
    views: '12K views', live: 'LIVE', watching: '1.2K watching', sched: 'Scheduled for 11/12/26, 8:00 PM', soon: 'UPCOMING', prem: 'Premieres 11/12/26, 8:00 PM', streamed: (t) => `Streamed ${t}` },
  es: { min: (n) => `hace ${n} minutos`, h: (n) => `hace ${n} ${n === 1 ? 'hora' : 'horas'}`, d: (n) => `hace ${n} ${n === 1 ? 'día' : 'días'}`, w: (n) => `hace ${n} ${n === 1 ? 'semana' : 'semanas'}`,
    views: '12 mil visualizaciones', live: 'EN VIVO', watching: '1,2 k espectadores', sched: 'Programado para el 12/11/26, 20:00', soon: 'PRÓXIMAMENTE', prem: 'Se estrena el 12/11/26, 20:00', streamed: (t) => `Transmitido ${t}` },
};
const rel = (T, h) => (h < 1 ? T.min(Math.max(1, Math.floor(h * 60))) : h < 24 ? T.h(Math.floor(h)) : h < 168 ? T.d(Math.floor(h / 24)) : T.w(Math.floor(h / 168)));
const minAge = (h) => (h < 1 ? Math.floor(h * 60) / 60 : h < 24 ? Math.floor(h) : h < 168 ? Math.floor(h / 24) * 24 : Math.floor(h / 168) * 168);

// 150 itens, do mais novo para o mais antigo (~3,3 h entre eles: o último tem ~20 dias)
export const FEED = Array.from({ length: 150 }, (_, k) => {
  const id = 'SUB' + String(k).padStart(8, '0');
  const h = 0.4 + k * 3.3;
  const tipo = k === 2 ? 'aoVivo' : k === 5 ? 'agendado' : k === 7 ? 'estreia' : k === 9 ? 'live' : k === 12 ? 'shorts' : 'video';
  // canais com nome que parece tipo (revisão): "Live Science" e "Estreia Games" são vídeos normais e não podem sumir
  const canal = k === 1 ? 'Live Science' : k === 3 ? 'Estreia Games' : 'Canal ' + (k % 7 + 1);
  return { id, k, h, min: minAge(h), tipo, prog: k === 4 ? 95 : k === 6 ? 40 : 0, canal, titulo: `Vídeo ${k} das Inscrições` };
});
export const SHELF = ['SHORTS00001', 'SHORTS00002', 'SHORTS00003'];

function itemHtml(it, T) {
  const href = it.tipo === 'shorts' ? `/shorts/${it.id}` : `/watch?v=${it.id}`;
  let row2, badge;
  if (it.tipo === 'aoVivo') { row2 = `<span role="text">${T.watching}</span>`; badge = T.live; }
  else if (it.tipo === 'agendado') { row2 = `<span role="text">${T.sched}</span>`; badge = T.soon; }
  else if (it.tipo === 'estreia') { row2 = `<span role="text">${T.prem}</span>`; badge = T.soon; }
  else if (it.tipo === 'live') { row2 = `<span role="text">${T.views}</span><span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"></span><span role="text">${T.streamed(rel(T, it.h))}</span>`; badge = '1:02:03'; }
  else { row2 = `<span role="text">${T.views}</span><span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"></span><span role="text">${rel(T, it.h)}</span>`; badge = it.tipo === 'shorts' ? '0:45' : '8:59'; }
  const prog = it.prog ? `<yt-thumbnail-overlay-progress-bar-view-model class="ytThumbnailOverlayProgressBarHost"><div class="ytThumbnailOverlayProgressBarHostWatchedProgressBar"><div class="ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment" style="width: ${it.prog}%;"></div></div></yt-thumbnail-overlay-progress-bar-view-model>` : '';
  return `<ytd-rich-item-renderer class="style-scope ytd-rich-grid-renderer"><div id="content"><yt-lockup-view-model class="ytd-rich-item-renderer lockup ytLockupViewModelWrapper"><div>
<a href="${href}" class="ytLockupViewModelContentImage" tabindex="-1" aria-hidden="true"><yt-thumbnail-view-model><div class="ytThumbnailViewModelImage"><img alt="" src="data:,"></div>
<yt-thumbnail-bottom-overlay-view-model class="ytThumbnailBottomOverlayViewModelHost"><div>${prog}<yt-thumbnail-badge-view-model><badge-shape role="img"><div class="ytBadgeShapeText" aria-hidden="true">${badge}</div></badge-shape></yt-thumbnail-badge-view-model></div></yt-thumbnail-bottom-overlay-view-model></yt-thumbnail-view-model></a>
<div class="ytLockupViewModelMetadata"><div class="ytSpecAvatarShapeAvatarSizeMedium"><img class="ytSpecAvatarShapeImage" alt="" src="https://yt3.ggpht.com/av-teste=s68-c-k"></div><yt-lockup-metadata-view-model><div class="ytLockupMetadataViewModelTextContainer"><h3 class="ytLockupMetadataViewModelHeadingReset" title="${it.titulo}"><a href="${href}" class="ytLockupMetadataViewModelTitle"><span class="ytAttributedStringHost">${it.titulo}</span></a></h3>
<div class="ytLockupMetadataViewModelMetadata"><yt-content-metadata-view-model><div class="ytContentMetadataViewModelMetadataRow" role="group"><span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" dir="auto"><span dir="auto"><a class="ytAttributedStringLink" href="/@${it.canal.replace(/\W/g, "").toLowerCase()}">${it.canal}</a></span></span></div>
<div class="ytContentMetadataViewModelMetadataRow" role="group">${row2}</div></yt-content-metadata-view-model></div></div>
<div class="ytLockupMetadataViewModelMenuButton"><button-view-model><button class="menu" aria-label="Mais ações">⋮</button></button-view-model></div></yt-lockup-metadata-view-model></div></div></yt-lockup-view-model></div></ytd-rich-item-renderer>`;
}
const shelfHtml = () => `<ytd-rich-section-renderer><div id="content"><ytd-rich-shelf-renderer is-shorts><h2>Shorts</h2>${SHELF.map((id) => `<ytd-rich-item-renderer><div id="content"><ytm-shorts-lockup-view-model><a href="/shorts/${id}"><img src="data:,"></a><h3><a href="/shorts/${id}"><span>Short ${id}</span></a></h3><div><span>1 mi de visualizações</span></div></ytm-shorts-lockup-view-model></div></ytd-rich-item-renderer>`).join('')}</ytd-rich-shelf-renderer></div></ytd-rich-section-renderer>`;

export function inscricoesHtml(q) {
  const lang = q.get('hl') || 'pt', T = TXT[lang] || TXT.pt;
  const pagina = (n) => FEED.slice(n * 30, n * 30 + 30).map((it) => itemHtml(it, T)).join('') + (n === 0 ? shelfHtml() : '');
  const paginas = [0, 1, 2, 3, 4].map(pagina);
  return `<!doctype html><html lang="${lang}" dark><head><meta charset="utf-8"><title>Inscrições - YouTube (simulado)</title>
<style>html{background:#0f0f0f;color:#f1f1f1;font-family:Roboto,Arial,sans-serif}body{margin:0}
#masthead-container{position:fixed;top:0;left:0;right:0;height:56px;background:#0f0f0f;z-index:2020;display:flex;align-items:center;padding:0 16px}
#guide{position:fixed;top:56px;left:0;width:240px;bottom:0}ytd-page-manager{display:block;margin-left:240px;padding-top:56px}
#contents{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:16px}ytd-rich-section-renderer{grid-column:1/-1}
ytd-rich-item-renderer img{width:100%;aspect-ratio:16/9;background:#333;display:block}ytd-continuation-item-renderer{grid-column:1/-1;height:40px;display:block}</style></head><body>
<ytd-app><div id="masthead-container"><ytd-masthead>YouTube simulado</ytd-masthead></div><div id="guide"><ytd-guide-entry-renderer><a title="Início" href="/">Início</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer><a title="Shorts" href="/shorts/SHORTS00001">Shorts</a></ytd-guide-entry-renderer><yt-chip-cloud-chip-renderer><chip-shape><button>Shorts</button></chip-shape></yt-chip-cloud-chip-renderer></div>
<ytd-page-manager id="page-manager"><ytd-browse page-subtype="subscriptions" role="main"><ytd-two-column-browse-results-renderer><div id="primary">
<ytd-rich-grid-renderer><div id="contents"><ytd-rich-section-renderer id="cab"><ytd-shelf-renderer><div id="title-container" style="display:flex;align-items:center;padding:0 16px"><h2 id="title" style="flex:1;margin:0">Mais recentes</h2><div id="subscribe-button"><a href="/feed/channels">Todas as inscrições</a></div></div></ytd-shelf-renderer></ytd-rich-section-renderer>${paginas[0]}<ytd-continuation-item-renderer><div id="ghost-cards">carregando…</div></ytd-continuation-item-renderer></div></ytd-rich-grid-renderer>
</div></ytd-two-column-browse-results-renderer></ytd-browse></ytd-page-manager></ytd-app>
<script>
(() => {
const P = ${JSON.stringify(paginas)};
let pg = 1;
window.__mock = { continuacoes: 0, menu: 0, feedback: 0 };
document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button.menu')) window.__mock.menu++; });
const contents = document.getElementById('contents');
const io = new IntersectionObserver((es) => {
  if (!es.some((e) => e.isIntersecting)) return;
  const c = document.querySelector('ytd-continuation-item-renderer'); if (!c || c.dataset.busy) return;
  c.dataset.busy = '1';
  setTimeout(() => { // como o YouTube: busca a continuação (30 itens) e põe no lugar do carregador
    window.__mock.continuacoes++;
    c.insertAdjacentHTML('beforebegin', P[pg]); pg++;
    if (pg >= P.length) c.remove(); else { delete c.dataset.busy; contents.appendChild(c); io.unobserve(c); io.observe(c); }
  }, 350);
});
io.observe(document.querySelector('ytd-continuation-item-renderer'));
setTimeout(() => document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true })), 50);
})();
</script></body></html>`;
}

// itens que a Em Dia deve mostrar num período, com as chaves de fábrica (sem shorts, lives, estreias e agendados)
export function esperado(periodoH, chaves = {}) {
  return FEED.filter((it) => {
    if (it.tipo === 'shorts') return !!chaves.emdiaShorts && it.min < periodoH;
    if (it.tipo === 'aoVivo') return !!chaves.emdiaLives;
    if (it.tipo === 'live') return !!chaves.emdiaLives && it.min < periodoH;
    if (it.tipo === 'estreia') return !!chaves.emdiaEstreias;
    if (it.tipo === 'agendado') return !!chaves.emdiaAgendados;
    return it.min < periodoH;
  });
}
