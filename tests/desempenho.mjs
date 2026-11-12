// Fase 8: CPU e memória da aba do YouTube REAL, 10 min de vídeo, com a Sintonia ligada (quase tudo) e sem a extensão.
// Perfil novo, sem login. Uso: node desempenho.mjs [com|sem] [minutos]   → imprime JSON
import './env.mjs';
import { chromium } from 'playwright';
import path from 'path'; import os from 'os'; import fs from 'fs';
import { EXT } from './lib.mjs';
const modo = process.argv[2] || 'com', MIN = +(process.argv[3] || 10);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sint-prof-perf-'));
const args = ['--autoplay-policy=no-user-gesture-required'].concat(modo === 'com' ? [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] : []);
const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1280, height: 860 }, locale: 'pt-BR', args });
ctx.setDefaultTimeout(60000);
if (modo === 'com') {
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  await wait(4000);
  await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
  const cfgExtra = process.env.SINT_CFG ? JSON.parse(process.env.SINT_CFG) : null; // bisseção: só estas chaves
  if (cfgExtra) await sw.evaluate((c) => chrome.storage.sync.set(c), cfgExtra); else await sw.evaluate(() => chrome.storage.sync.set({ velocidade: true, velPadrao: 1.25, perfilCanal: true, volMax: true, qualidade: true, qualPadrao: 'hd720', rodaVolume: true, rodaVelocidade: true, atalhos: true,
    teatroAuto: true, cinema: true, escComentarios: true, escShorts: true, escTelaFinal: true, reforco: true, reforcoPadrao: 150, igualar: true, sb: true, loopAB: true, miniPlayer: true, filtros: true, tema: 'grafite', screenshot: true }));
}
const p = ctx.pages()[0] || await ctx.newPage();
for (const x of ctx.pages()) if (x !== p) await x.close().catch(() => {});
await p.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 90; i++) { const ok = await p.evaluate(() => { const mp = document.getElementById('movie_player'); return !!(mp && mp.getVideoData && !mp.classList.contains('ad-showing') && mp.querySelector('video').readyState >= 2); }).catch(() => false); if (ok) break; await wait(1000); }
await p.mouse.click(1200, 700); // gesto (liga o Web Audio na Sintonia)
await p.evaluate(() => { const mp = document.getElementById('movie_player'); mp.mute(); mp.setLoopVideo(true); mp.playVideo(); });
if (process.env.SINT_TEATRO) { await p.evaluate(() => document.querySelector('.ytp-size-button').click()); await wait(1500); } // bisseção: teatro à mão, sem a extensão
const ambiente = await p.evaluate(() => ({ teatro: document.querySelector('ytd-watch-flexy').hasAttribute('theater'), ambiente: !!document.querySelector('#cinematics canvas, #cinematics-container canvas') }));
const cdp = await ctx.newCDPSession(p);
await cdp.send('Performance.enable');
const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
await wait(20000); // assenta
const m0 = await met(), t0 = Date.now();
const amostras = [];
for (let i = 0; i < MIN * 6; i++) {
  await wait(10000);
  const m = await met();
  amostras.push({ heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nos: m.Nodes, ouvintes: m.JSEventListeners });
  await p.evaluate(() => { const v = document.querySelector('#movie_player video'); if (v && v.paused) v.play(); }).catch(() => {});
}
const m1 = await met(), seg = (Date.now() - t0) / 1000;
const out = { modo, ...ambiente, cfg: process.env.SINT_CFG || 'tudo', minutos: +(seg / 60).toFixed(1),
  cpuPrincipalPct: +(((m1.TaskDuration - m0.TaskDuration) / seg) * 100).toFixed(2), scriptPct: +(((m1.ScriptDuration - m0.ScriptDuration) / seg) * 100).toFixed(2),
  layoutPct: +(((m1.LayoutDuration - m0.LayoutDuration) / seg) * 100).toFixed(2), heapInicioMB: amostras[0] && amostras[0].heapMB, heapFimMB: amostras[amostras.length - 1].heapMB,
  heapMaxMB: Math.max(...amostras.map((a) => a.heapMB)), nosInicio: amostras[0].nos, nosFim: amostras[amostras.length - 1].nos, ouvintesInicio: amostras[0].ouvintes, ouvintesFim: amostras[amostras.length - 1].ouvintes,
  tocando: await p.evaluate(() => !document.querySelector('#movie_player video').paused).catch(() => null) };
console.log(JSON.stringify(out));
await ctx.close();
