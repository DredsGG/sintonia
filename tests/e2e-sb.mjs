// Fase 5 (v0.6.0): pular partes com dados do SponsorBlock (cliente próprio, só prefixo do hash, só leitura). Uso: node e2e-sb.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, PH, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const seg = (c, s, e, u) => ({ category: c, actionType: 'skip', segment: [s, e], UUID: u, videoDuration: 100, locked: 0, votes: 1 });
const SB = {
  AAAAAAAAAA1: [seg('sponsor', 20, 30, 'u-sp-1'), seg('intro', 2, 8, 'u-in-1')],
  BBBBBBBBBB2: [seg('sponsor', 40, 50, 'u-sp-2')],
  AAAAAAAAAA3: [seg('selfpromo', 60, 70, 'u-se-3')],
};
const { ctx, sw } = await abrir();
const st = await rotas(ctx, { sb: SB });
await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
const abrirV = async (v) => { await p.goto(`https://www.youtube.com/watch?v=${v}`); await p.waitForSelector('video', { state: 'attached' }); await until(() => p.evaluate(() => document.querySelector('video').readyState >= 2)); await wait(1000); };
const t = () => p.evaluate(() => document.querySelector('video').currentTime);
const ir = (s) => p.evaluate((s) => { const v = document.querySelector('video'); v.currentTime = s; v.play(); }, s);
const marcas = () => p.evaluate(() => [...document.querySelectorAll('#sintonia-sb-marcas > div')].map((d) => ({ c: d.dataset.c, left: d.style.left, w: d.style.width })));
const sbStatus = () => p.evaluate(() => { const h = document.querySelector('#movie_player sintonia-player'); const e = h && h.shadowRoot.querySelector('.sbst'); return e ? e.textContent : null; });

// desligado: nenhum pedido, nada pulado
await abrirV('AAAAAAAAAA1'); await ir(19); await wait(2500);
check('desligado: nenhum pedido ao sponsor.ajay.app', st.sbPedidos.length === 0);
check('desligado: o patrocínio (20–30 s) toca normal', (await t()) > 20 && (await t()) < 25, await t());

// ligado: pedido só com prefixo
await setSync({ sb: true });
await abrirV('AAAAAAAAAA1');
await until(() => st.sbPedidos.length > 0);
const ped = st.sbPedidos[0] || '';
check('pedido só com o prefixo de 4 hex do sha256 (o ID do vídeo não sai)', /^\/api\/skipSegments\/[0-9a-f]{4}\?categories=/.test(ped) && !ped.includes('AAAAAAAAAA1'), ped.slice(0, 60));
check('pedido sem cookie nem nada além do prefixo e das categorias', !/[&?](videoID|v)=/.test(ped));
// pula patrocínio, não pula intro (fora das categorias de fábrica)
await ir(1); await wait(2500);
check('intro fora das categorias de fábrica: não pula (2–8 s toca)', (await t()) > 2.5 && (await t()) < 8, await t());
await ir(19.5);
const pulou = await until(async () => { const x = await t(); return x >= 30 ? x : null; }, 8000);
check('patrocínio pulado: do 20 s para o fim do trecho (30 s)', !!pulou, pulou || await t());
const av = await until(async () => (await estado(p)).toast);
check('aviso "Patrocínio pulado" com Desfazer', av === 'Patrocínio pulado' && await p.evaluate(() => !document.querySelector('sintonia-ui').shadowRoot.querySelector('.toast .act').hidden), av);
await p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('.toast .act').click());
await wait(400);
const volta = await t();
check('Desfazer volta para o começo do trecho', volta >= 19.5 && volta < 22, volta);
await wait(2000);
check('depois do Desfazer, não pula de novo esse trecho', (await t()) < 30, await t());
let mk = await marcas();
const pct = (x) => parseFloat(x);
check('marca colorida na barra: só o patrocínio, em ~20% com ~10% de largura', mk.length === 1 && mk[0].c === 'sponsor' && Math.abs(pct(mk[0].left) - 20) < 0.1 && Math.abs(pct(mk[0].w) - 10) < 0.1, mk);
check('vizinho de isca (outro videoID com o mesmo prefixo) ignorado', !mk.some((m) => m.left === '1%'));
await p.screenshot({ path: path.join(SHOT, 'sb-marcas.png'), clip: { x: 0, y: 380, width: 900, height: 180 } });

// categoria nova pelo painel (global): intro entra
await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel);
await clicar(p, PH, '[data-sbc="intro"]'); await wait(500); await p.keyboard.press('Escape');
mk = await until(async () => { const m = await marcas(); return m.length === 2 ? m : null; });
check('painel: marcar "Intro" acrescenta a marca e o pulo', !!mk && (await sw.evaluate(async () => (await chrome.storage.sync.get('sbCats')).sbCats)).includes('intro'));
await ir(2.2);
check('intro agora é pulada (para 8 s)', !!(await until(async () => { const x = await t(); return x >= 8 ? x : null; }, 6000)));

// cache: abrir de novo não pede de novo
const n0 = st.sbPedidos.length;
await abrirV('AAAAAAAAAA1'); await wait(1500);
check('cache local: segundo acesso ao vídeo não pede de novo', st.sbPedidos.length === n0, { antes: n0, depois: st.sbPedidos.length });

// troca de vídeo (navegação interna)
await p.evaluate(() => window.__ir('/watch?v=BBBBBBBBBB2'));
await until(() => p.evaluate(() => document.getElementById('movie_player').getVideoData().video_id === 'BBBBBBBBBB2' && document.querySelector('video').readyState >= 2)); await wait(1500);
mk = await until(async () => { const m = await marcas(); return m.length === 1 && Math.abs(parseFloat(m[0].left) - 40) < 0.1 ? m : null; });
check('troca de vídeo: marcas do vídeo novo (40%)', !!mk, await marcas());
await ir(39.5);
check('troca de vídeo: pula o patrocínio do vídeo novo', !!(await until(async () => { const x = await t(); return x >= 50 ? x : null; }, 8000)));

// por canal (global sem autopromoção)
await setSync({ perfilCanal: true, sbCats: ['sponsor', 'intro'] });
await abrirV('AAAAAAAAAA3');
check('Canal Um: autopromoção fora das categorias globais → sem marca', (await marcas()).length === 0);
await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel);
await clicar(p, PH, '[data-sbc="selfpromo"]'); await wait(600); await p.keyboard.press('Escape');
const pf = await sw.evaluate(async () => (await chrome.storage.local.get('st.perfis'))['st.perfis'] || {});
check('por canal: categorias do Canal Um salvas no perfil (com autopromoção)', pf.UCaaaaaaaaaaaaaaaaaaaaa1 && pf.UCaaaaaaaaaaaaaaaaaaaaa1.sbCats.includes('selfpromo'), pf.UCaaaaaaaaaaaaaaaaaaaaa1);
check('Canal Um: marca da autopromoção aparece', !!(await until(async () => { const m = await marcas(); return m.length === 1 && m[0].c === 'selfpromo' ? m : null; })));
check('global continua sem autopromoção', !(await sw.evaluate(async () => (await chrome.storage.sync.get('sbCats')).sbCats)).includes('selfpromo'));
await setSync({ perfilCanal: false });

// SponsorBlock oficial ativo: a Sintonia sai e avisa uma vez
await abrirV('BBBBBBBBBB2');
await until(async () => (await marcas()).length === 1);
await p.evaluate(() => { const ul = document.createElement('ul'); ul.id = 'previewbar'; ul.className = 'sbNotInvidious'; document.querySelector('.ytp-progress-bar').appendChild(ul); });
await ir(39.5);
const avOf = await until(async () => { const s = await estado(p); return s.toast && /oficial/.test(s.toast) ? s.toast : null; }, 6000);
await wait(1500);
check('SponsorBlock oficial na página: a Sintonia não pula', (await t()) > 40 && (await t()) < 45, await t());
check('SponsorBlock oficial: as marcas da Sintonia somem', (await marcas()).length === 0);
check('SponsorBlock oficial: avisa (uma vez)', !!avOf, avOf);
await abrirV('BBBBBBBBBB2');
await p.evaluate(() => { const ul = document.createElement('ul'); ul.id = 'previewbar'; document.querySelector('.ytp-progress-bar').appendChild(ul); });
await ir(39.5); await wait(2500);
check('SponsorBlock oficial: o aviso não repete', !/oficial/.test((await estado(p)).toast || ''));
// vídeo sem segmentos
await abrirV('AAAAAAAAAA1'.replace('1', '9')); await wait(1500);
check('vídeo sem trechos (404): nada acontece, sem erro', (await marcas()).length === 0 && erros.length === 0);
await setSync({ sb: false });
// vídeo lançado agora, ainda sem marcação (relato do André, 2026-11-11): o painel diz e a Sintonia consulta de novo enquanto toca
await setSync({ sb: true, sbCats: ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'filler', 'music_offtopic'] });
await p.goto('https://www.youtube.com/watch?v=NOVOVIDEO01'); await p.evaluate(() => { document.documentElement.dataset.sintTesteSb = '4000'; });
await p.waitForSelector('video', { state: 'attached' }); await until(() => p.evaluate(() => document.querySelector('video').readyState >= 2));
await p.evaluate(() => document.querySelector('video').play());
const nPed0 = st.sbPedidos.length;
await p.click('#sintonia-btn');
check('sem marcação: o painel diz "Ninguém marcou trechos deste vídeo ainda"', !!(await until(async () => /Ninguém marcou/.test((await sbStatus()) || ''), 10000)), await sbStatus());
await p.keyboard.press('Escape');
st.sb.NOVOVIDEO01 = [seg('sponsor', 40, 50, 'u-novo')]; // alguém marca o patrocínio enquanto a pessoa assiste
const pegou = await until(async () => (await marcas()).length === 1, 25000, 300);
check('vídeo tocando: consulta de novo e a marcação nova aparece na barra', !!pegou, { pedidos: st.sbPedidos.length - nPed0 });
check('a nova consulta também só manda o prefixo', st.sbPedidos.slice(nPed0).every((u) => /^\/api\/skipSegments\/[0-9a-f]{4}\?/.test(u) && !u.includes('NOVOVIDEO01')), st.sbPedidos.slice(nPed0));
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 39; v.play(); });
check('… e pula o patrocínio marcado depois', !!(await until(async () => (await t()) >= 50, 15000)), await t());
await p.click('#sintonia-btn');
check('painel passa a dizer "1 trecho marcado neste vídeo"', !!(await until(async () => /1 trecho marcado/.test((await sbStatus()) || ''), 8000)), await sbStatus());
await p.keyboard.press('Escape');
await p.evaluate(() => { const v = document.querySelector('video'); v.pause(); delete document.documentElement.dataset.sintTesteSb; });

check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
