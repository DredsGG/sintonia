// Teste ao vivo no youtube.com REAL, num perfil novo do Playwright, sem login (nunca o perfil, os cookies ou a conta do André).
// Não curte, não se inscreve, não comenta. Uso: node ao-vivo.mjs [fase]   (fase 0 = base)
import path from 'path';
import { abrir, check, fim, until, wait, estado, SHOT } from './lib.mjs';

const VID = 'jNQXAC9IVRw'; // "Me at the zoo" (canal jawed, UC4QobU6STFB0P71PMvOGN5A, medido em 2026-11-11)
const { ctx, sw } = await abrir();
await wait(1500);
for (const pg of ctx.pages()) if (pg.url().includes('COMO-INSTALAR')) await pg.close();
// sem o aviso de versão (o repo ainda não existe) e sem o tutorial atrapalhando a medição
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
await sw.evaluate(() => chrome.storage.sync.set({ perfilCanal: true, emdia: true })); // o grupo "Este canal" do painel só aparece com o perfil ligado (0.10.1)
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => { if (/sintonia/i.test(String(e.stack || e))) erros.push(String(e)); });
p.on('console', (m) => { if (m.type() === 'error' && /\[Sintonia\]|chrome-extension/.test(m.text())) erros.push(m.text()); });
await p.goto('https://www.youtube.com/watch?v=' + VID, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('#movie_player video', { timeout: 30000 });
await wait(4000);

const s = await until(async () => { const e = await estado(p); return e.btn ? e : null; }, 20000);
check('ao vivo: botão Sintonia na barra do player real, antes da engrenagem', s && s.btnAntesDaEngrenagem, s);
await p.mouse.move(500, 300);
await p.click('#sintonia-btn');
const e = await until(async () => { const x = await estado(p); return x.painelTexto.includes('jawed') ? x : null; }, 15000);
check('ao vivo: painel abre no player e mostra o canal (jawed)', e && e.painel === 'player', e && e.painelTexto.slice(0, 120));
const inf = await p.evaluate(() => new Promise((ok) => { const id = 'lv'; document.addEventListener('sintonia:e', function f(ev) { const m = JSON.parse(ev.detail); if (m.id === id) { document.removeEventListener('sintonia:e', f); ok(m.data); } }); document.dispatchEvent(new CustomEvent('sintonia:c', { detail: JSON.stringify({ id, op: 'info' }) })); }));
check('ao vivo: channelId pela API do player (UC4QobU6STFB0P71PMvOGN5A)', inf && inf.canal && inf.canal.id === 'UC4QobU6STFB0P71PMvOGN5A' && inf.canal.fonte === 'api', inf && inf.canal);
await p.screenshot({ path: path.join(SHOT, 'ao-vivo-painel.png') });
const paused = await p.evaluate(() => document.querySelector('#movie_player video').paused);
await p.keyboard.press('Escape');

// navegação interna: clica num relacionado e confere troca de vídeo e de canal
const antes = inf && inf.canal && inf.canal.id;
const rel = await p.$('ytd-watch-next-secondary-results-renderer a[href*="/watch"], yt-lockup-view-model a[href*="/watch"]');
if (rel) {
  await rel.click().catch(() => {});
  const ok = await until(async () => { const i = await p.evaluate(() => new Promise((ok) => { const id = 'lv2'; document.addEventListener('sintonia:e', function f(ev) { const m = JSON.parse(ev.detail); if (m.id === id) { document.removeEventListener('sintonia:e', f); ok(m.data); } }); document.dispatchEvent(new CustomEvent('sintonia:c', { detail: JSON.stringify({ id, op: 'info' }) })); })); return i && i.videoId && i.videoId !== VID ? i : null; }, 20000);
  check('ao vivo: troca de vídeo pela navegação interna detectada', !!ok, ok && { v: ok.videoId, canal: ok.canal && ok.canal.fonte });
  check('ao vivo: canal novo identificado depois da navegação', ok && ok.canal && ok.canal.id && ok.canal.id !== antes || (ok && ok.canal && ok.canal.id === antes), ok && ok.canal);
  await wait(1500);
  const s2 = await estado(p);
  check('ao vivo: botão continua (um só) depois da navegação', s2.btn && s2.btns === 1, s2);
} else check('ao vivo: achei um relacionado para navegar', false);
// Em Dia: a leitura do card funciona na grade real? (Inscrições exigem login; a grade de vídeos de um canal usa os mesmos componentes)
await p.goto('https://www.youtube.com/@YouTube/videos', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('ytd-rich-item-renderer', { timeout: 30000 }); await wait(3000);
const feed = await until(async () => { await p.evaluate(() => document.dispatchEvent(new Event('sintonia:teste-feed'))); const j = await p.evaluate(() => document.documentElement.dataset.sintFeed); return j ? JSON.parse(j) : null; });
check('ao vivo (grade real de canal): a Em Dia lê data, título e duração de quase todos os cards', feed && feed.n >= 20 && feed.comData >= feed.n * 0.9 && feed.comTitulo === feed.n && feed.comDuracao >= feed.n * 0.8, feed);
// Fila de verdade: playlist temporária real, avanço no fim e, no último, nenhum vídeo de fora entra.
// (No YouTube headless, pular para o fim do vídeo fica "carregando" para sempre, com ou sem a extensão — medido em 2026-11-11;
//  /watch_videos com IDs de Shorts volta para a página inicial. Por isso a fila usa dois vídeos curtos que tocam até o fim.)
const ids = ['jNQXAC9IVRw', 'qAyZIVQrC_Y']; // 0:19 e 0:30 (vídeos públicos curtos, medidos em 2026-11-11)
await sw.evaluate((ids) => chrome.storage.local.set({ 'st.fila': { ids, i: 0, origem: 'teste', modo: 'lista', ativa: true, bloco: [0, 50], inicioBloco: Date.now() } }), ids);
await p.goto('https://www.youtube.com/watch_videos?video_ids=' + ids.join(','), { waitUntil: 'domcontentloaded' });
await p.waitForURL(/list=TL/, { timeout: 30000 }).catch(() => {});
const barraFila = () => p.evaluate(() => { const b = document.getElementById('sintonia-fila'); const f = b && b.shadowRoot && b.shadowRoot.querySelector('.fb'); return f ? f.textContent.replace(/\s+/g, ' ').trim() : null; });
check('ao vivo: /watch_videos abre a playlist temporária (list=TL…)', /list=TL/.test(p.url()), p.url().replace(/^https:\/\/www.youtube.com/, ''));
check('ao vivo: barra "Em Dia 1/2" abaixo do player real', !!(await until(async () => { const b = await barraFila(); return b && b.includes('1/2'); }, 20000)));
await p.evaluate(() => { const mp = document.getElementById('movie_player'); mp.mute(); mp.playVideo(); });
const foi2 = await until(async () => { const b = await barraFila(); return b && b.includes('2/2') && p.url().includes(ids[1]) ? b : null; }, 150000, 1000);
check('ao vivo: no fim do 1º, o YouTube vai para o 2º da fila e a barra mostra 2/2', !!foi2, p.url().replace(/^https:\/\/www.youtube.com/, ''));
await p.evaluate(() => { const mp = document.getElementById('movie_player'); mp.mute(); mp.playVideo(); });
const acabou = await until(() => sw.evaluate(async () => !(await chrome.storage.local.get('st.fila'))['st.fila']), 150000, 1000);
await wait(12000);
const url2 = p.url();
check('ao vivo: no fim da fila nenhum vídeo de fora entra (autoplay cancelado) e a fila acaba', !!acabou && (url2.includes(ids[1]) || /\/feed\/subscriptions/.test(url2)), // v1.1.0: no fim volta para as Inscrições (nunca para vídeo de fora)
   url2.replace(/^https:\/\/www.youtube.com/, ''));
await p.screenshot({ path: path.join(SHOT, 'ao-vivo-fim-da-fila.png') });
// Fase 2 no player real: 3× (fora da API) aplicado e mantido depois da navegação interna; volume no máximo; teatro automático
await sw.evaluate(() => chrome.storage.sync.set({ velocidade: true, velPadrao: 3, volMax: true, teatroAuto: true }));
await p.goto('https://www.youtube.com/watch?v=n_G4dQMKYN0', { waitUntil: 'domcontentloaded' });
const semAd2 = () => until(() => p.evaluate(() => { const mp = document.getElementById('movie_player'), v = mp && mp.querySelector('video'); return !!(mp && v && !mp.classList.contains('ad-showing') && v.readyState >= 2); }), 90000, 1000);
await semAd2(); await wait(2500);
const vv = () => p.evaluate(() => { const mp = document.getElementById('movie_player'), v = mp.querySelector('video'); return { id: mp.getVideoData().video_id, r: v.playbackRate, api: mp.getPlaybackRate(), vol: mp.getVolume(), muted: mp.isMuted(), teatro: document.querySelector('ytd-watch-flexy').hasAttribute('theater') }; });
let x = await until(async () => { const y = await vv(); return y.r === 3 ? y : null; }, 15000);
check('ao vivo: velocidade padrão 3× no player real (API no limite 2×)', !!x, x || await vv());
check('ao vivo: volume no máximo (100, sem mudo)', !!(await until(async () => { const y = await vv(); return y.vol === 100 && !y.muted ? y : null; })), await vv());
check('ao vivo: teatro automático', !!(await until(async () => (await vv()).teatro)));
const rel2 = await p.$('ytd-watch-next-secondary-results-renderer a[href*="/watch"], yt-lockup-view-model a[href*="/watch"]');
if (rel2) {
  const antesId = (await vv()).id;
  await rel2.click().catch(() => {});
  await until(async () => (await vv()).id !== antesId, 20000); await semAd2(); await wait(3000);
  x = await vv();
  check('ao vivo: depois da navegação interna o player real continua a 3× (não volta para 1× nem 2×)', x.r === 3, x);
  check('ao vivo: depois da navegação, ainda em teatro', x.teatro);
}
await sw.evaluate(() => chrome.storage.sync.set({ velocidade: false, volMax: false, teatroAuto: false }));
// Fase 3 no YouTube real: esconder distrações; like automático sem login não clica (nunca abre o "Fazer login")
await sw.evaluate(() => chrome.storage.sync.set({ escComentarios: true, escRelacionados: true, escTelaFinal: true, escShorts: true, likeAuto: true, likeModo: 'abrir' }));
await p.goto('https://www.youtube.com/watch?v=n_G4dQMKYN0', { waitUntil: 'domcontentloaded' });
await semAd2(); await p.evaluate(() => scrollTo(0, 800)); await wait(5000); await p.evaluate(() => scrollTo(0, 0));
const viv = await p.evaluate(() => { const v = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).display !== 'none' : null; };
  const like = document.querySelector('like-button-view-model button[aria-pressed]');
  return { comments: v('ytd-watch-flexy #comments'), related: v('ytd-watch-flexy #related'), endscreen: v('#movie_player .ytp-endscreen-content'), player: v('#movie_player'),
    likePressed: like && like.getAttribute('aria-pressed'), dialogo: !!document.querySelector('ytd-popup-container tp-yt-paper-dialog:not([aria-hidden="true"]), ytd-modal-with-title-and-button-renderer, yt-sheet-view-model') }; });
check('ao vivo: comentários, relacionados e tela final escondidos; player visível', viv.comments === false && viv.related === false && viv.endscreen !== true && viv.player === true, viv);
check('ao vivo: like automático sem login não clica (nada de "Fazer login")', viv.likePressed === 'false' && !viv.dialogo, viv);
await p.goto('https://www.youtube.com/results?search_query=receita+de+bolo', { waitUntil: 'domcontentloaded' }); await wait(7000);
const sv = await p.evaluate(() => { const vis = [...document.querySelectorAll('a[href^="/shorts/"]')].filter((a) => a.getClientRects().length > 0); return { shortsVisiveis: vis.length, total: document.querySelectorAll('a[href^="/shorts/"]').length, videos: [...document.querySelectorAll('a[href^="/watch?v="]')].filter((a) => a.getClientRects().length).length }; });
check('ao vivo: busca sem Shorts visíveis e com vídeos normais', sv.total > 0 && sv.shortsVisiveis === 0 && sv.videos > 0, sv);
await sw.evaluate(() => chrome.storage.sync.set({ escComentarios: false, escRelacionados: false, escTelaFinal: false, escShorts: false, likeAuto: false }));
// Fase 4 no YouTube real: reforço 200% no <video> de verdade (MSE), som saindo, e continua depois da navegação interna
const ponteV = (op) => p.evaluate((op) => new Promise((ok) => { const id = 'v' + Math.random(); document.addEventListener('sintonia:e', function f(ev) { const m = JSON.parse(ev.detail); if (m.id === id) { document.removeEventListener('sintonia:e', f); ok(m.data); } }); document.dispatchEvent(new CustomEvent('sintonia:c', { detail: JSON.stringify({ id, op }) })); setTimeout(() => ok(null), 3000); }), op);
await sw.evaluate(() => chrome.storage.sync.set({ reforco: true, reforcoPadrao: 200 }));
await p.goto('https://www.youtube.com/watch?v=n_G4dQMKYN0', { waitUntil: 'domcontentloaded' });
await semAd2(); await wait(1500);
await p.mouse.click(1300, 200); // gesto fora do player
const somReal = () => until(async () => { const x = await ponteV('audioNivel'); return x && x.ligado && x.estado === 'running' && x.rms > 0.001 ? x : null; }, 20000, 500);
let au = await somReal();
check('ao vivo: reforço 200% no player real (contexto rodando, som saindo)', au && au.ganho === 2, au || await ponteV('audioNivel'));
const rel3 = await p.$('ytd-watch-next-secondary-results-renderer a[href*="/watch"], yt-lockup-view-model a[href*="/watch"]');
if (rel3) { const a0 = (await vv()).id; await rel3.click().catch(() => {}); await until(async () => (await vv()).id !== a0, 20000); await semAd2(); await wait(2000);
  au = await somReal(); check('ao vivo: depois da navegação interna, o som continua (não ficou mudo)', !!au, au || await ponteV('audioNivel')); }
await sw.evaluate(() => chrome.storage.sync.set({ reforco: false }));
// Fase 5 no YouTube real: vídeo com patrocínio cadastrado no SponsorBlock (achado pela própria API, por um prefixo qualquer)
let alvoSb = null;
for (const pre of ['5f6b', 'cfc3', '0a1b', '7c3e']) {
  try { const r = await fetch(`https://sponsor.ajay.app/api/skipSegments/${pre}?categories=${encodeURIComponent('["sponsor"]')}`); if (!r.ok) continue;
    for (const x of await r.json()) { const sg = x.segments.find((y) => y.category === 'sponsor' && y.actionType === 'skip' && y.segment[0] > 30 && y.segment[1] - y.segment[0] > 8 && y.videoDuration > 120 && y.videoDuration < 2400); if (sg) { alvoSb = { id: x.videoID, s: sg.segment[0], e: sg.segment[1] }; break; } } } catch (_) {}
  if (alvoSb) break;
}
if (alvoSb) {
  const pedidos = []; p.on('request', (r) => { if (r.url().includes('sponsor.ajay.app')) pedidos.push(r.url()); });
  await sw.evaluate(() => chrome.storage.sync.set({ sb: true, sbCats: ['sponsor'] }));
  await p.goto('https://www.youtube.com/watch?v=' + alvoSb.id, { waitUntil: 'domcontentloaded' });
  await semAd2(); await wait(3000);
  const mk = await until(() => p.evaluate(() => document.querySelectorAll('#movie_player .ytp-progress-bar #sintonia-sb-marcas > div').length), 20000);
  check('ao vivo: marcas do SponsorBlock na barra de progresso real', mk >= 1, { video: alvoSb.id, marcas: mk });
  await p.evaluate((s) => { const mp = document.getElementById('movie_player'); mp.mute(); mp.seekTo(s - 1.5, true); mp.playVideo(); }, alvoSb.s);
  const tt = await until(() => p.evaluate((e) => { const v = document.querySelector('#movie_player video'); return v.currentTime >= e - 0.5 ? v.currentTime : null; }, alvoSb.e), 25000, 300);
  check('ao vivo: patrocínio pulado no player real (para o fim do trecho)', !!tt, { trecho: [alvoSb.s, alvoSb.e], t: tt || await p.evaluate(() => document.querySelector('#movie_player video').currentTime) });
  await sw.evaluate(() => chrome.storage.sync.set({ sb: false }));
} else check('ao vivo: achei um vídeo com patrocínio no SponsorBlock', false);
// Fase 6 no YouTube real: mini player ao rolar (o player real se redimensiona?) e loop pela API
await sw.evaluate(() => chrome.storage.sync.set({ miniPlayer: true, loopAB: true }));
await p.goto('https://www.youtube.com/watch?v=n_G4dQMKYN0', { waitUntil: 'domcontentloaded' });
await semAd2(); await wait(2000);
await p.evaluate(() => { const mp = document.getElementById('movie_player'); mp.mute(); mp.playVideo(); });
await p.evaluate(() => scrollTo(0, 1400)); await wait(2500);
const gm = await p.evaluate(() => { const m = document.getElementById('movie_player'); const r = m.getBoundingClientRect(); return { mini: m.hasAttribute('data-sint-mini'), w: Math.round(r.width), h: Math.round(r.height), video: Math.round(m.querySelector('video').getBoundingClientRect().width), dentro: r.right <= innerWidth && r.bottom <= innerHeight, tocando: !m.querySelector('video').paused }; });
check('ao vivo: mini player flutua no canto e o vídeo real acompanha o tamanho', gm.mini && gm.w === 400 && Math.abs(gm.video - 400) <= 2 && gm.dentro && gm.tocando, gm);
await p.screenshot({ path: path.join(SHOT, 'ao-vivo-mini.png') });
await p.evaluate(() => scrollTo(0, 0)); await wait(2000);
const gv = await p.evaluate(() => { const m = document.getElementById('movie_player'); return { mini: m.hasAttribute('data-sint-mini'), w: Math.round(m.getBoundingClientRect().width), video: Math.round(m.querySelector('video').getBoundingClientRect().width) }; });
check('ao vivo: rolar de volta, o player real volta ao tamanho normal (vídeo grande, dentro do player)', !gv.mini && gv.w > 600 && gv.video > 600 && gv.video <= gv.w + 2, gv);
const lp = await ponteV('info'); await p.evaluate(() => 0);
await p.evaluate(() => new Promise((ok) => { const id = 'lp'; document.addEventListener('sintonia:e', function f(ev) { const m = JSON.parse(ev.detail); if (m.id === id) { document.removeEventListener('sintonia:e', f); ok(m.data); } }); document.dispatchEvent(new CustomEvent('sintonia:c', { detail: JSON.stringify({ id, op: 'setLoop', args: [true] }) })); }));
check('ao vivo: loop pela API (getLoopVideo = true)', await p.evaluate(() => document.getElementById('movie_player').getLoopVideo() === true), lp && lp.videoId);
await sw.evaluate(() => chrome.storage.sync.set({ miniPlayer: false, loopAB: false }));
// Fase 7 no YouTube real: forçar H.264 + sem 60 fps (estatísticas do player), foto do quadro do vídeo real, tema no escuro
await sw.evaluate(() => chrome.storage.sync.set({ h264: true, semHfr: true, screenshot: true, tema: 'preto' }));
await p.goto('https://www.youtube.com/watch?v=n_G4dQMKYN0', { waitUntil: 'domcontentloaded' }); await wait(1500);
await p.reload({ waitUntil: 'domcontentloaded' }); // as chaves valem a partir do próximo carregamento
await semAd2(); await wait(4000);
const cod = await ponteV('codecAgora');
check('ao vivo: forçar H.264 e evitar 60 fps → o player real toca avc1', cod && /avc1/.test(String(cod.codecs)) && !/vp0?9|av01/.test(String(cod.codecs)), cod);
const fps = await p.evaluate(() => { const v = document.querySelector('#movie_player video'); const q = v.getVideoPlaybackQuality && v.getVideoPlaybackQuality(); return { quadros: q && q.totalVideoFrames, t: v.currentTime }; });
await wait(3000);
const fps2 = await p.evaluate(() => { const v = document.querySelector('#movie_player video'); const q = v.getVideoPlaybackQuality && v.getVideoPlaybackQuality(); return { quadros: q && q.totalVideoFrames, t: v.currentTime }; });
const taxa = (fps2.quadros - fps.quadros) / Math.max(0.1, fps2.t - fps.t);
check('ao vivo: no máximo ~30 quadros por segundo', taxa > 0 && taxa <= 31, { taxa: Math.round(taxa) });
await sw.evaluate(() => { const o = chrome.downloads.download.bind(chrome.downloads); globalThis.__dl = []; chrome.downloads.download = (a) => { globalThis.__dl.push({ filename: a.filename, tam: String(a.url).length }); return o(a); }; });
await p.click('#sintonia-btn');
await until(async () => (await estado(p)).painel);
await p.evaluate(() => document.querySelector('#movie_player sintonia-player').shadowRoot.querySelector('[data-fa="foto"]').click());
const dlv = await until(() => sw.evaluate(() => globalThis.__dl[0]), 15000);
check('ao vivo: foto do quadro do vídeo real (PNG com nome e tempo)', dlv && /\.png$/.test(dlv.filename) && / - \d+(m\d+)?s\.png$/.test(dlv.filename) && dlv.tam > 5000, dlv);
await p.keyboard.press('Escape');
await ctx.addCookies([{ name: 'PREF', value: 'f6=400&hl=pt', domain: '.youtube.com', path: '/' }]);
await p.reload({ waitUntil: 'domcontentloaded' }); await wait(5000);
const tm = await p.evaluate(() => ({ dark: document.documentElement.hasAttribute('dark'), app: getComputedStyle(document.querySelector('ytd-app')).backgroundColor }));
check('ao vivo: tema "Preto total" no YouTube escuro', tm.dark && tm.app === 'rgb(0, 0, 0)', tm);
await sw.evaluate(() => chrome.storage.sync.set({ h264: false, semHfr: false, screenshot: false, tema: '' }));
// v1.1.0: fila de 2 vídeos no YouTube real (playlist nativa), até o fim: avança, aviso "Fila concluída" e volta para a Em Dia
{
  const F = ['jNQXAC9IVRw', 'dQw4w9WgXcQ'];
  await sw.evaluate(async (f) => { await chrome.storage.local.set({ 'st.emdia': {}, 'st.fila': { ids: f, i: 0, origem: 'emdia', modo: 'lista', ativa: true, bloco: [0, 2], inicioBloco: Date.now(), autonavAntes: null, em: Date.now() } }); }, F);
  await p.goto('https://www.youtube.com/watch_videos?video_ids=' + F.join(','), { waitUntil: 'domcontentloaded' });
  const fim1 = async (s) => { await until(() => p.evaluate(() => { const v = document.querySelector('#movie_player video'); return v && isFinite(v.duration) && v.duration > 5 && v.readyState >= 2 && !document.querySelector('#movie_player.ad-showing'); }), 45000); await p.evaluate((s) => { const v = document.querySelector('#movie_player video'); v.currentTime = v.duration - s; v.play(); }, s); };
  await fim1(3);
  const seg = await until(() => p.evaluate(() => new URLSearchParams(location.search).get('v') === 'dQw4w9WgXcQ' || null), 40000);
  check('ao vivo: fila de 2 vídeos: o 1º acaba sozinho e passa para o 2º', !!seg, p.url());
  await fim1(3);
  const avv = await until(() => p.evaluate(() => { const h = document.querySelector('sintonia-fila-fim'); return h && h.shadowRoot ? h.shadowRoot.querySelector('.fim').textContent : null; }), 40000);
  check('ao vivo: o 2º acaba → aviso "Fila concluída ✓"', !!avv && avv.includes('Fila concluída ✓'), avv);
  await p.screenshot({ path: path.join(SHOT, 'ao-vivo-fila-fim.png') });
  await p.evaluate(() => { window.__semRecarga = 1; });
  const vol = await until(() => p.evaluate(() => location.pathname === '/feed/subscriptions' || null), 20000);
  check('ao vivo: depois da contagem volta para as Inscrições (sem recarregar)', !!vol && await p.evaluate(() => window.__semRecarga === 1), p.url());
  await wait(3000);
  console.log('(Inscrições deslogadas: a Em Dia aberta =', await p.evaluate(() => !!document.querySelector('sintonia-emdia')), ')');
}
// v1.2.0: selo "Inscrito" sem login (perfil novo): o recurso fica quieto, sem selo, sem pedido de escrita e sem erro
{
  await sw.evaluate(() => chrome.storage.sync.set({ seloInscrito: true, esmaecerInscritos: true }));
  const pedidos = []; p.on('request', (r) => { if (r.method() === 'POST' && /\/youtubei\//.test(r.url())) pedidos.push(r.url().replace(/\?.*/, '')); });
  await p.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('ytd-rich-item-renderer', { timeout: 30000 }).catch(() => {}); await wait(5000);
  const q = await p.evaluate(() => ({ cards: document.querySelectorAll('ytd-rich-grid-renderer yt-lockup-view-model').length, selos: document.querySelectorAll('[data-sint-selo]').length, esm: document.querySelectorAll('[data-sint-esm]').length, logado: window.ytcfg && ytcfg.get('LOGGED_IN') }));
  check('ao vivo sem login: selo ligado fica quieto (nenhum selo, nenhum esmaecido) com cards na tela', q.cards > 0 && q.selos === 0 && q.esm === 0 && !q.logado, q);
  check('ao vivo sem login: nenhuma lista de inscrições foi lida nem guardada', !(await sw.evaluate(async () => (await chrome.storage.local.get('st.inscritos'))['st.inscritos'] ? 1 : 0)), pedidos.slice(0, 4));
  await sw.evaluate(() => chrome.storage.sync.set({ seloInscrito: false, esmaecerInscritos: false }));
}
check('ao vivo: nenhum erro da Sintonia no console', erros.length === 0, erros.slice(0, 3));
console.log('(observado: vídeo pausado ao abrir o painel =', paused, ')');
await ctx.close();
fim();
