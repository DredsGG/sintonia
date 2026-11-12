// Fase 7 (v0.8.0): filtros, temas escuros, screenshot e codec (evitar 60 fps, forçar H.264). Uso: node e2e-imagem.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, PH, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw } = await abrir();
await rotas(ctx); await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
const abrirV = async (v) => { await p.goto(`https://www.youtube.com/watch?v=${v}`); await p.waitForSelector('video', { state: 'attached' }); await until(() => p.evaluate(() => document.querySelector('video').readyState >= 2)); await wait(900); };
const vst = () => p.evaluate(() => { const c = getComputedStyle(document.querySelector('video')); return { filter: c.filter, transform: c.transform }; });
const painel = async () => { if (!(await estado(p)).painel) { await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel); } };
const range = (k, v) => p.evaluate(([k, v]) => { const i = document.querySelector('#movie_player sintonia-player').shadowRoot.querySelector(`[data-fi="${k}"]`); i.value = v; i.dispatchEvent(new Event('input')); }, [k, v]);

// ── filtros
await abrirV('AAAAAAAAAA1'); await painel();
check('filtros desligados: sem controles e vídeo sem filtro', !(await p.evaluate(() => !!document.querySelector('#movie_player sintonia-player').shadowRoot.querySelector('[data-fi]'))) && (await vst()).filter === 'none');
await setSync({ filtros: true }); await wait(400);
await range('brilho', 150); await range('contraste', 120); await range('saturacao', 0); await range('cinza', 30);
let v = await vst();
check('brilho 150%, contraste 120%, saturação 0%, cinza 30% no <video>', /brightness\(1\.5\)/.test(v.filter) && /contrast\(1\.2\)/.test(v.filter) && /saturate\(0\)/.test(v.filter) && /grayscale\(0\.3\)/.test(v.filter), v.filter);
await clicar(p, PH, '[data-fa="inverter"]'); await wait(200);
check('inverter', /invert\(1\)/.test((await vst()).filter));
await clicar(p, PH, '[data-fa="girar"]'); await wait(300);
v = await vst();
check('girar 90°: rotação com escala para caber no player', v.transform !== 'none' && /matrix\(0/.test(v.transform.replace(/\s/g, '')) , v.transform);
await p.screenshot({ path: path.join(SHOT, 'filtros.png') });
await p.evaluate(() => { const s = document.querySelector('video').style; s.cssText = 'width: 854px; height: 480px; left: 0px; top: 0px;'; }); await wait(200);
check('o YouTube reescrevendo o style do <video> não apaga o filtro', /brightness\(1\.5\)/.test((await vst()).filter));
await clicar(p, PH, '[data-fa="zerar"]'); await wait(300);
v = await vst();
check('Zerar: sem filtro e sem rotação', v.filter === 'none' && v.transform === 'none', v);
await range('brilho', 80); await p.keyboard.press('Escape');
await p.evaluate(() => window.__ir('/watch?v=BBBBBBBBBB2')); await wait(1500);
check('troca de vídeo: filtros zeram (são por vídeo)', (await vst()).filter === 'none');
await setSync({ filtros: false });

// ── temas escuros
const tema = () => p.evaluate(() => ({ app: getComputedStyle(document.querySelector('ytd-app')).backgroundColor, base: getComputedStyle(document.documentElement).getPropertyValue('--yt-sys-color-baseline--base-background').trim() }));
const antes = await tema();
check('tema do YouTube (fábrica): nada trocado', !(await p.evaluate(() => !!document.getElementById('sintonia-tema'))), antes);
for (const [k, cor, rgb] of [['grafite', '#161616', 'rgb(22, 22, 22)'], ['noite', '#0e131b', 'rgb(14, 19, 27)'], ['preto', '#000', 'rgb(0, 0, 0)']]) {
  await setSync({ tema: k }); await wait(400);
  const t = await tema();
  check(`tema ${k}: fundo ${cor} e variável do YouTube trocada`, t.app === rgb && t.base === cor, t);
}
await p.screenshot({ path: path.join(SHOT, 'tema-preto.png') });
await p.evaluate(() => document.documentElement.removeAttribute('dark')); await wait(300);
check('com o YouTube no tema claro, o tema escuro não se aplica', (await tema()).app !== 'rgb(0, 0, 0)');
await p.evaluate(() => document.documentElement.setAttribute('dark', ''));
await setSync({ tema: '' }); await wait(400);
check('voltar para "O do YouTube" tira o tema', !(await p.evaluate(() => !!document.getElementById('sintonia-tema'))));

// ── screenshot
await setSync({ screenshot: true });
await abrirV('AAAAAAAAAA1');
await p.evaluate(() => { const v = document.querySelector('video'); v.pause(); v.currentTime = 12.3; }); await wait(800);
await painel();
// (o Playwright renomeia todo download com um GUID: o nome pedido é conferido no chrome.downloads.download do fundo)
await sw.evaluate(() => { const o = chrome.downloads.download.bind(chrome.downloads); globalThis.__dl = []; chrome.downloads.download = (a) => { globalThis.__dl.push({ filename: a.filename, url: String(a.url).slice(0, 22) }); return o(a); }; });
await clicar(p, PH, '[data-fa="foto"]');
const dl = await until(() => sw.evaluate(async () => (await chrome.downloads.search({ orderBy: ['-startTime'] })).find((d) => d.state === 'complete')), 15000, 300);
const pedido = await sw.evaluate(() => globalThis.__dl[0]);
check('foto do quadro: pede o PNG com o nome do vídeo e o tempo', pedido && pedido.filename === 'Vídeo um do Canal Um - 12s.png' && pedido.url === 'data:image/png;base64,', pedido);
check('foto do quadro: arquivo PNG gravado', dl && dl.mime === 'image/png' && dl.fileSize > 500, dl && { mime: dl.mime, tamanho: dl.fileSize });
check('aviso "Foto salva em Downloads."', (await until(async () => (await estado(p)).toast)) === 'Foto salva em Downloads.');
await p.keyboard.press('Escape');
await setSync({ atalhos: true }); await p.evaluate(() => document.activeElement && document.activeElement.blur());
const n0 = (await sw.evaluate(() => chrome.downloads.search({}))).length;
await p.keyboard.press('Alt+KeyP');
check('atalho Alt+P tira a foto', !!(await until(async () => (await sw.evaluate(() => chrome.downloads.search({}))).length > n0)));
await setSync({ atalhos: false, screenshot: false });

// ── codec: evitar 60 fps e forçar H.264 (MediaSource.isTypeSupported no mundo MAIN)
const codec = () => p.evaluate(() => { const t = (x) => MediaSource.isTypeSupported(x);
  return { vp9: t('video/webm; codecs="vp9"'), av1: t('video/mp4; codecs="av01.0.05M.08"'), avc: t('video/mp4; codecs="avc1.4d401f"'),
    vp9_60: t('video/webm; codecs="vp9"; width=1920; height=1080; framerate=60'), avc_60: t('video/mp4; codecs="avc1.4d401f"; framerate=60'), avc_30: t('video/mp4; codecs="avc1.4d401f"; framerate=30'), audio: t('audio/webm; codecs="opus"') }; });
await abrirV('AAAAAAAAAA1');
const c0 = await codec();
check('codec desligado: o navegador responde normal (VP9 sim)', c0.vp9 && c0.avc && c0.vp9_60, c0);
await setSync({ semHfr: true }); await wait(500);
check('aviso de que vale a partir do próximo vídeo', /próximo vídeo/.test((await until(async () => (await estado(p)).toast)) || ''));
await abrirV('AAAAAAAAAA1');
let c1 = await codec();
check('evitar 60 fps: framerate=60 recusado, 30 aceito, áudio intacto', !c1.vp9_60 && !c1.avc_60 && c1.avc_30 && c1.vp9 && c1.audio, c1);
await setSync({ h264: true }); await abrirV('BBBBBBBBBB2');
c1 = await codec();
check('forçar H.264: VP9 e AV1 recusados, H.264 aceito', !c1.vp9 && !c1.av1 && c1.avc && c1.audio, c1);
await setSync({ semHfr: false, h264: false }); await abrirV('AAAAAAAAAA1');
c1 = await codec();
check('desligar: volta ao normal', c1.vp9 && c1.vp9_60 && c1.av1 === c0.av1, c1);
check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
