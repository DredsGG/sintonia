// Prints do README do repo (inglês): menu, barra do player e Em Dia, no YouTube SIMULADO dos testes (sem conta, sem vídeo de ninguém).
// Uso: SINT_EXT=<pasta da extensão> PRINTS_OUT=<pasta de saída> node prints-github.mjs
import path from 'path';
import fs from 'fs';
import { abrir, esperarGuia, check, fim, until, wait, VER } from './lib.mjs';
import { rotas, VIDEOS } from './mock.mjs';
import { FEED } from './mock-inscricoes.mjs';

const OUT = path.resolve(process.env.PRINTS_OUT || path.join(path.dirname(new URL(import.meta.url).pathname), 'shots', 'github'));
fs.mkdirSync(OUT, { recursive: true });

// nomes neutros em inglês para os prints (o mock tem nomes em português)
VIDEOS.AAAAAAAAAA1.title = 'A calm walk through the forest'; VIDEOS.AAAAAAAAAA1.author = 'Channel One';
FEED.forEach((it, k) => { it.titulo = ['Mountain sunrise timelapse', 'How to bake sourdough at home', 'Synthwave mix for focus', 'Weekend project: a small bookshelf', 'City walk at night, 4K', 'Learn guitar chords in 10 minutes', 'Ocean waves, relaxing sound', 'Understanding tides', 'Street food tour', 'Short film: The Lighthouse', 'Garden update, week 12', 'Retro console repair'][k % 12]; });
FEED.forEach((it) => { if (!/^Live Science|^Estreia Games/.test(it.canal)) it.canal = it.canal.replace('Canal', 'Channel'); });
FEED.forEach((it) => { if (it.canal === 'Live Science') it.canal = 'Channel 8'; if (it.canal === 'Estreia Games') it.canal = 'Channel 9'; });

const { ctx, sw } = await abrir({ locale: 'en-US' });
await rotas(ctx);
await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
await setSync({ lang: 'en' });
// avatares do canal: círculo neutro (o mock aponta para o CDN do YouTube, que os testes não acessam)
await ctx.route('https://yt3.ggpht.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="68" height="68"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5a6a"/><stop offset="1" stop-color="#2b3540"/></linearGradient></defs><rect width="68" height="68" fill="url(#g)"/></svg>' }));
const p = await ctx.newPage();
await p.setViewportSize({ width: 1280, height: 800 });
// prints nítidos (2x); o layout continua 1280x800
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
// o mock tem peças cruas que não são da Sintonia (barra "YouTube simulado", links, tela final); somem só nos prints
const foto = async (file, clip) => { const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 } }); fs.writeFileSync(path.join(OUT, file), Buffer.from(r.data, 'base64')); };
const LIMPAR = '#masthead,#masthead-container,#guide,#related,.ytp-ce-element,.ytp-cards-teaser,.ytp-endscreen-content{display:none!important}';
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));

// --- 1) Em Dia (Inscrições) --- (janela mais alta só para esta imagem, para a 2ª fileira de vídeos caber inteira)
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false });
await setSync({ emdia: true });
await p.goto('https://www.youtube.com/feed/subscriptions?hl=en');
await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
await until(() => p.evaluate(() => !!document.getElementById('sintonia-emdia-btn')), 20000);
await p.evaluate(() => document.getElementById('sintonia-emdia-btn').shadowRoot.querySelector('.edbtn').click());
const abriu = await until(() => p.evaluate(() => { const r = document.querySelector('sintonia-emdia') && document.querySelector('sintonia-emdia').shadowRoot; return r && r.querySelectorAll('.cd').length > 3 && !/Loading|Carregando/.test((r.querySelector('.st') || {}).textContent || ''); }), 25000);
check('Em Dia abriu com cards', !!abriu);
await p.addStyleTag({ content: LIMPAR });
// miniaturas de exemplo (o mock não tem imagem): degradês neutros
await p.evaluate(() => {
  const r = document.querySelector('sintonia-emdia').shadowRoot;
  [...r.querySelectorAll('.cd')].forEach((c, i) => {
    const h = (i * 47 + 200) % 360, svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},35%,38%)"/><stop offset="1" stop-color="hsl(${(h + 40) % 360},40%,22%)"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/></svg>`;
    const im = c.querySelector('img:not(.av)'); if (im) im.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  });
});
await wait(600);
await p.mouse.move(640, 20);
const edClip = await p.evaluate(() => {
  const r = document.querySelector('sintonia-emdia').shadowRoot;
  const t = [...r.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Em Dia');
  const top = t ? t.getBoundingClientRect().top : 40;
  const bot = Math.max(...[...r.querySelectorAll('.cd')].map((c) => c.getBoundingClientRect().bottom));
  const y = Math.max(0, top - 28);
  return { x: 240, y, width: 1040, height: Math.min(900, bot + 24) - y };
});
await foto('sintonia-em-dia.png', edClip);

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
// --- 2) vídeo: barra do player e menu ---
await setSync({ emdia: false, perfilCanal: true, velocidade: true, filtros: true, screenshot: true, loopAB: true, popup: true, sb: true, volMax: true });
await p.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1&hl=en');
await p.waitForSelector('video', { state: 'attached' });
await until(() => p.evaluate(() => !!document.getElementById('sintonia-b-foto')), 25000);
await wait(1500);
await p.addStyleTag({ content: LIMPAR });
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 38; v.play(); });
await wait(800);
const pl = await p.evaluate(() => { const r = document.getElementById('movie_player').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await p.mouse.move(pl.x + pl.w / 2, pl.y + pl.h - 60);
await wait(500);
// player inteiro, com a barra e os botões da Sintonia
await foto('sintonia-player.png', { x: pl.x, y: pl.y, width: pl.w, height: pl.h });
// menu aberto (aba Agora), com a página inteira
await p.mouse.move(640, 700);
const fab = await until(() => p.evaluate(() => { const f = document.querySelector('sintonia-ui').shadowRoot.querySelector('.fab'); if (!f || f.hidden) return null; const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }), 15000);
check('botão flutuante achado', !!fab, fab);
await p.mouse.click(fab.x, fab.y);
const aberto = await until(() => p.evaluate(() => !!document.querySelector('sintonia-ui').shadowRoot.querySelector('.fpanel .pn')), 10000);
check('menu abriu', !!aberto);
await wait(600);
const menuClip = () => p.evaluate(() => { const r = document.querySelector('sintonia-ui').shadowRoot; const a = r.querySelector('.fpanel .pn').getBoundingClientRect(), b = r.querySelector('.fab').getBoundingClientRect(); const x = Math.min(a.left, b.left) - 16, y = a.top - 16; return { x: Math.max(0, x), y: Math.max(0, y), width: Math.min(1280, Math.max(a.right, b.right) + 16) - Math.max(0, x), height: Math.min(800, b.bottom + 16) - Math.max(0, y) }; });
await foto('sintonia-menu.png', await menuClip());
// aba Ajustes
await p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('.abas [data-aba="ajustes"]').click());
await wait(600);
await p.evaluate(() => { const r = document.querySelector('sintonia-ui').shadowRoot; const s = r.querySelector('[data-sec="video"]'); if (s) s.click(); });
await wait(600);
await foto('sintonia-settings.png', await menuClip());

check('sem erro de página durante os prints', erros.length === 0, erros);
console.log('versão da extensão nos prints:', VER);
fim();
await ctx.close();
