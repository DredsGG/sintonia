// Fase 6 (v0.7.0): loop e A–B, mini player, pop-up, playlist ao contrário, aba de fundo. Uso: node e2e-player2.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, PH, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw } = await abrir();
await rotas(ctx); await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
const abrirV = async (v, extra = '') => { await p.goto(`https://www.youtube.com/watch?v=${v}${extra}`); await p.waitForSelector('video', { state: 'attached' }); await until(() => p.evaluate(() => document.querySelector('video').readyState >= 2)); await wait(900); };
const t = () => p.evaluate(() => document.querySelector('video').currentTime);
const ir = (s) => p.evaluate((s) => { const v = document.querySelector('video'); v.currentTime = s; v.play(); }, s);
const painel = async () => { if (!(await estado(p)).painel) { await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel); } };
const temBotao = (sel) => p.evaluate((s) => !!document.querySelector('#movie_player sintonia-player').shadowRoot.querySelector(s), sel);

// ── loop e A–B
await abrirV('AAAAAAAAAA1'); await painel();
check('loop/A–B desligado: sem botões no painel', !(await temBotao('[data-p2="loop"]')));
await setSync({ loopAB: true }); await wait(400);
check('ligado: botões Repetir, A e B no painel', await temBotao('[data-p2="loop"]') && await temBotao('[data-p2="a"]') && await temBotao('[data-p2="b"]'));
await clicar(p, PH, '[data-p2="loop"]'); await wait(300);
check('Repetir vídeo: API setLoopVideo(true) e <video loop>', await p.evaluate(() => document.getElementById('movie_player').getLoopVideo() && document.querySelector('video').loop));
await ir(10); await wait(300); await clicar(p, PH, '[data-p2="a"]'); await ir(15); await wait(300); await clicar(p, PH, '[data-p2="b"]'); await wait(500);
check('A–B: marcar B volta para A (10 s)', (await t()) < 11.5, await t());
await ir(14.5); await wait(1800);
const tab = await t();
check('A–B: passou de B (15 s) e voltou para A', tab >= 10 && tab < 15, tab);
await p.keyboard.press('Escape');
await p.evaluate(() => window.__ir('/watch?v=BBBBBBBBBB2')); await wait(1500);
await ir(20); await wait(1500);
check('troca de vídeo: A–B e Repetir zerados', (await t()) > 20 && !(await p.evaluate(() => document.querySelector('video').loop)));
await setSync({ atalhos: true }); await p.evaluate(() => document.activeElement && document.activeElement.blur());
await p.keyboard.press('Alt+KeyL'); await wait(300);
check('atalho Alt+L liga o Repetir', await p.evaluate(() => document.querySelector('video').loop));
await p.keyboard.press('Alt+KeyL'); await setSync({ atalhos: false, loopAB: false });

// ── mini player ao rolar
await abrirV('AAAAAAAAAA1');
await p.evaluate(() => { document.body.style.minHeight = '4000px'; document.querySelector('video').play(); });
await p.evaluate(() => scrollTo(0, 900)); await wait(1200);
check('mini player desligado: rolar não mexe no player', !(await p.evaluate(() => document.getElementById('movie_player').hasAttribute('data-sint-mini'))));
await setSync({ miniPlayer: true }); await wait(1200);
const geo = () => p.evaluate(() => { const m = document.getElementById('movie_player'); const r = m.getBoundingClientRect(); return { mini: m.hasAttribute('data-sint-mini'), pos: getComputedStyle(m).position, w: Math.round(r.width), h: Math.round(r.height), right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom), video: Math.round(document.querySelector('video').getBoundingClientRect().width) }; });
let g = await until(async () => { const x = await geo(); return x.mini ? x : null; });
check('mini player: ao rolar, o player flutua no canto (400×225)', g && g.pos === 'fixed' && g.w === 400 && g.h === 225 && g.right === 16 && g.bottom === 16, g);
check('o vídeo acompanha o tamanho do mini player', g && g.video === 400, g);
await p.screenshot({ path: path.join(SHOT, 'mini-player.png') });
// arrastar pela barra de cima
const box = await p.locator('#movie_player').boundingBox();
await p.mouse.move(box.x + 100, box.y + 10); await wait(200);
await p.mouse.down(); await p.mouse.move(box.x - 200, box.y - 150, { steps: 6 }); await p.mouse.up(); await wait(500);
g = await geo();
check('arrastar pela barra: o mini player muda de lugar', g.right > 200 && g.bottom > 150, g);
const salvo = await sw.evaluate(async () => (await chrome.storage.local.get('st.mini'))['st.mini']);
check('posição lembrada (st.mini)', salvo && Math.abs(salvo.right - g.right) <= 2 && Math.abs(salvo.bottom - g.bottom) <= 2, salvo);
// aumentar pelo canto
const b2 = await p.locator('#movie_player').boundingBox();
await p.mouse.move(b2.x + 6, b2.y + b2.height - 6); await p.mouse.down(); await p.mouse.move(b2.x - 154, b2.y + b2.height - 6, { steps: 5 }); await p.mouse.up(); await wait(500);
g = await geo();
check('tamanho pelo canto: 560×315 (16:9) e lembrado', g.w === 560 && g.h === 315 && (await sw.evaluate(async () => (await chrome.storage.local.get('st.mini'))['st.mini'].w)) === 560, g);
await p.evaluate(() => scrollTo(0, 0)); await wait(1000);
g = await geo();
check('rolar de volta: o player volta para o lugar', !g.mini && g.pos !== 'fixed' && g.w === 854, g);
await p.evaluate(() => scrollTo(0, 900)); await wait(1000);
g = await geo();
check('flutua de novo no mesmo lugar e tamanho', g.mini && g.w === 560, g);
await p.evaluate(() => document.querySelector('#movie_player sintonia-mini').shadowRoot.querySelector('.x').click()); await wait(800);
check('X fecha o mini player (fica no lugar até rolar de volta)', !(await geo()).mini);
await p.evaluate(() => scrollTo(0, 0)); await wait(800); await p.evaluate(() => scrollTo(0, 900)); await wait(1000);
check('depois de voltar ao topo, flutua de novo', (await geo()).mini);
await p.evaluate(() => window.__ir('/feed/subscriptions')); await wait(1200);
check('saindo da página do vídeo, o mini player da Sintonia pousa', !(await p.evaluate(() => (document.getElementById('movie_player') || {}).hasAttribute?.call(document.getElementById('movie_player'), 'data-sint-mini'))));
await setSync({ miniPlayer: false });

// ── pop-up
await setSync({ popup: true });
await abrirV('AAAAAAAAAA1'); await ir(42); await wait(400); await painel();
const novaP = ctx.waitForEvent('page');
await clicar(p, PH, '[data-p2="popup"]');
const pop = await novaP;
check('pop-up: abre o embed no ponto atual (start=42)', /\/embed\/AAAAAAAAAA1\?start=4[23]&autoplay=1/.test(pop.url()), pop.url());
check('pop-up: o vídeo da página pausa', await p.evaluate(() => document.querySelector('video').paused));
await pop.close();
await abrirV('BBBBBBBBBB2', '&embed=0'); await ir(30); await wait(400); await painel();
const novaP2 = ctx.waitForEvent('page');
await clicar(p, PH, '[data-p2="popup"]');
const pop2 = await novaP2;
check('pop-up, vídeo que bloqueia embed: plano B abre a página normal no ponto (t=30s)', /\/watch\?v=BBBBBBBBBB2&t=3[01]s/.test(pop2.url()), pop2.url());
await pop2.close(); await setSync({ popup: false });

// ── playlist ao contrário
await setSync({ playlistReversa: true });
await p.goto('https://www.youtube.com/watch_videos?video_ids=AAAAAAAAAA1,BBBBBBBBBB2,AAAAAAAAAA3'); await p.waitForURL(/list=TLGG/);
await until(() => p.evaluate(() => document.querySelector('video').readyState >= 2)); await wait(800);
await p.evaluate(() => document.getElementById('movie_player').playVideoAt(2));
await until(() => p.evaluate(() => document.getElementById('movie_player').getVideoData().video_id === 'AAAAAAAAAA3' && document.querySelector('video').readyState >= 2)); await wait(800);
await painel();
await clicar(p, PH, '[data-p2="rev"]'); await wait(400); await p.keyboard.press('Escape');
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = v.duration - 1.3; v.play(); });
const ant = await until(() => p.evaluate(() => { const id = document.getElementById('movie_player').getVideoData().video_id; return id !== 'AAAAAAAAAA3' ? id : null; }), 10000);
check('ao contrário: do 3º vai para o 2º (não para o próximo)', ant === 'BBBBBBBBBB2', ant);
await setSync({ playlistReversa: false });
await until(() => p.evaluate(() => document.querySelector('video').readyState >= 2)); await wait(800);
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = v.duration - 1.3; v.play(); });
const prox = await until(() => p.evaluate(() => { const id = document.getElementById('movie_player').getVideoData().video_id; return id !== 'BBBBBBBBBB2' ? id : null; }), 10000);
check('chave desligada: volta à ordem normal (2º → 3º)', prox === 'AAAAAAAAAA3', prox);

// ── aba de fundo (o headless deixa todas as abas visíveis: o atributo de teste simula a aba de fundo)
await setSync({ fundoSemAutoplay: true, fundoNaoBaixar: true });
const q = await ctx.newPage();
await q.addInitScript(() => document.addEventListener('readystatechange', () => document.documentElement.setAttribute('data-sint-teste-oculta', '')));
await q.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1'); await q.waitForSelector('video', { state: 'attached' });
await until(() => q.evaluate(() => document.querySelector('video').readyState >= 2)); await wait(2500);
check('aba de fundo: o vídeo não toca sozinho', await q.evaluate(() => document.querySelector('video').paused), await q.evaluate(() => document.querySelector('video').currentTime));
check('aba de fundo: para de baixar (pauseVideoDownload)', (await q.evaluate(() => window.__mock.pararDownload || 0)) >= 1);
await q.evaluate(() => { document.documentElement.removeAttribute('data-sint-teste-oculta'); document.dispatchEvent(new Event('visibilitychange')); });
check('ao ir para a aba: começa a tocar', !!(await until(() => q.evaluate(() => !document.querySelector('video').paused))));
await q.evaluate(() => { document.documentElement.setAttribute('data-sint-teste-oculta', ''); document.dispatchEvent(new Event('visibilitychange')); }); await wait(1500);
check('depois de vista, voltar para o fundo não pausa (escolha da pessoa)', await q.evaluate(() => !document.querySelector('video').paused));
await q.close();
await setSync({ fundoSemAutoplay: false });
const r2 = await ctx.newPage();
await r2.addInitScript(() => document.addEventListener('readystatechange', () => document.documentElement.setAttribute('data-sint-teste-oculta', '')));
await r2.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1'); await r2.waitForSelector('video', { state: 'attached' }); await wait(2500);
check('chave desligada: aba de fundo toca normal', await r2.evaluate(() => !document.querySelector('video').paused));
await r2.close();
check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
