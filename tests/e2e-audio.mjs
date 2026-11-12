// Fase 4 (v0.5.0): reforço até 400% e volume igualado (Web Audio no <video>), e o vídeo nunca fica mudo. Uso: node e2e-audio.mjs
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, PH } from './lib.mjs';
import { rotas } from './mock.mjs';

const ponte = (p, op, ...args) => p.evaluate(([op, args]) => new Promise((ok) => { const id = 'a' + Math.random(); document.addEventListener('sintonia:e', function f(ev) { const m = JSON.parse(ev.detail); if (m.id === id) { document.removeEventListener('sintonia:e', f); ok(m.data); } }); document.dispatchEvent(new CustomEvent('sintonia:c', { detail: JSON.stringify({ id, op, args }) })); setTimeout(() => ok(null), 3000); }), [op, args]);
const nivel = (p) => ponte(p, 'audioNivel');
const somando = (p) => until(async () => { const n = await nivel(p); return n && n.ligado && n.estado === 'running' && n.rms > 0.005 ? n : null; }, 15000, 300);
const gesto = (p) => p.mouse.click(1100, 700); // clique fora do player (na página)
const onboard = (sw) => sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));

const { ctx, sw } = await abrir();
await rotas(ctx); await esperarGuia(ctx); await onboard(sw);
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
const abrirV = async (v) => { await p.goto(`https://www.youtube.com/watch?v=${v}`); await p.waitForSelector('video', { state: 'attached' }); await until(() => p.evaluate(() => document.querySelector('video').readyState >= 2)); await p.evaluate(() => { document.getElementById('movie_player').unMute(); document.querySelector('video').play(); }); await wait(800); };

// desligado: o vídeo nunca entra no Web Audio
await abrirV('AAAAAAAAAA1'); await gesto(p); await wait(800);
let n = await nivel(p);
check('desligado: o vídeo fica fora do Web Audio, mesmo depois de clique', n && !n.ligado, n);

// reforço 200%: só liga depois do gesto, com o contexto rodando
await setSync({ reforco: true, reforcoPadrao: 200 });
await abrirV('AAAAAAAAAA1'); await wait(1200);
n = await nivel(p);
check('reforço ligado, antes de qualquer gesto: ainda fora do Web Audio (não arrisca deixar mudo)', n && !n.ligado, n);
await gesto(p);
n = await somando(p);
check('depois do clique: AudioContext rodando, ganho 2 (200%) e som saindo', n && n.ganho === 2, n);
await wait(1500); // o analisador ainda estabiliza logo após o 1º som: lê de novo antes de comparar
n = await nivel(p);
const rms200 = n && n.rms;
await setSync({ reforcoPadrao: 100 }); await wait(1500);
n = await somando(p);
check('100%: grafo neutro (ganho 1) e som saindo', n && n.ganho === 1, n);
check('200% soa mais alto que 100% (RMS)', rms200 > (n ? n.rms : 1) * 1.3, { rms200, rms100: n && n.rms });
await setSync({ reforcoPadrao: 400 }); await wait(1500);
n = await somando(p);
check('400%: ganho 4, limitador segura (RMS ≤ 1)', n && n.ganho === 4 && n.rms <= 1, n);
await setSync({ reforcoPadrao: 200 });

// volume igualado
await setSync({ igualar: true }); await wait(1500);
n = await somando(p);
check('volume igualado: compressor no caminho e som saindo', n && n.igualar, n);

// nunca mudo: troca de vídeo, aba de fundo, mini player, versão nova da extensão
await p.evaluate(() => window.__ir('/watch?v=BBBBBBBBBB2')); await wait(1500);
await p.evaluate(() => { document.getElementById('movie_player').unMute(); document.querySelector('video').play(); });
check('troca de vídeo: continua no grafo e com som', !!(await somando(p)));
const outra = await ctx.newPage(); await outra.goto('https://www.youtube.com/watch?v=AAAAAAAAAA3'); await outra.bringToFront(); await wait(2500);
check('aba de fundo: contexto rodando e som saindo', !!(await somando(p)), await nivel(p));
await outra.close(); await p.bringToFront();
await p.evaluate(() => { const mini = document.createElement('ytd-miniplayer'); mini.style.cssText = 'position:fixed;right:0;bottom:0;width:400px;height:225px'; document.body.appendChild(mini); mini.appendChild(document.getElementById('movie_player')); document.querySelector('video').play(); });
await wait(1200);
check('mini player (player movido de lugar): som saindo', !!(await somando(p)));
await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'https://www.youtube.com/*' }); await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['src/main.js'], world: 'MAIN' }); await chrome.scripting.executeScript({ target: { tabId: t.id }, files: chrome.runtime.getManifest().content_scripts[1].js }); });
await wait(2500);
n = await somando(p);
check('versão nova reinjetada: reaproveita o grafo e o som continua com o reforço (200%)', n && n.ganho === 2, n);
check('sem erro de "MediaElementSource já ligado" na página', !erros.some((e) => /already|MediaElementSource/i.test(e)), erros.slice(0, 2));

// desligar o reforço e o igualar: grafo neutro, nunca mudo
await setSync({ reforco: false, igualar: false }); await wait(1500);
n = await somando(p);
check('desligar: grafo neutro (ganho 1, sem compressor) e som saindo', n && n.ganho === 1 && !n.igualar, n);

// reforço por canal
await setSync({ reforco: true, reforcoPadrao: 150, perfilCanal: true });
await abrirV('AAAAAAAAAA1'); await gesto(p); await somando(p);
await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel);
await clicar(p, PH, '[data-au="+"]'); await wait(800);
const pf = await sw.evaluate(async () => (await chrome.storage.local.get('st.perfis'))['st.perfis'] || {});
check('por canal: + no painel salva 175% no perfil do Canal Um', pf.UCaaaaaaaaaaaaaaaaaaaaa1 && pf.UCaaaaaaaaaaaaaaaaaaaaa1.boost === 175, pf);
check('ganho 1,75 aplicado', (await until(async () => { const x = await nivel(p); return x && x.ganho === 1.75 ? x : null; })) !== null);
await p.keyboard.press('Escape');
await p.evaluate(() => window.__ir('/watch?v=BBBBBBBBBB2')); await wait(2000);
check('Canal Dois (sem perfil): volta ao padrão 150%', (await until(async () => { const x = await nivel(p); return x && x.ganho === 1.5 ? x : null; })) !== null, await nivel(p));
await ctx.close();

// sem a permissão de autoplay (como no navegador de verdade): só liga no gesto
const b = await abrir({ autoplay: false });
await rotas(b.ctx); await esperarGuia(b.ctx); await onboard(b.sw);
await b.sw.evaluate(() => chrome.storage.sync.set({ reforco: true, reforcoPadrao: 200 }));
const q = await b.ctx.newPage();
await q.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1'); await q.waitForSelector('video', { state: 'attached' }); await wait(2500);
n = await nivel(q);
check('navegador sem autoplay de som: antes do gesto o vídeo fica fora do Web Audio', n && !n.ligado, n);
await gesto(q); await q.evaluate(() => { document.getElementById('movie_player').unMute(); document.querySelector('video').play(); });
n = await somando(q);
check('depois do gesto: contexto retomado (running) e reforço ligado', n && n.ganho === 2, n);
await b.ctx.close();
check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
fim();
