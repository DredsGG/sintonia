// Regra 7a: versão nova gravada na pasta (manifest por último) → a Sintonia percebe em até ~1 min e manda recarregar.
// Roda numa CÓPIA da pasta instalada (não mexe na de verdade).
// ⚠️ Limite do ambiente (observado em 2026-11-11): no Chromium do Playwright, chrome.runtime.reload() DESCARREGA a extensão
// carregada por --load-extension (as páginas dela passam a dar ERR_BLOCKED_BY_CLIENT). Por isso este teste confere a detecção
// e a ordem de recarga (st.disco) e, separado, a reinjeção nas abas abertas; a recarga em si se confere no Chrome do André.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { abrir, esperarGuia, check, fim, until, estado, EXT } from './lib.mjs';
import { rotas } from './mock.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sint-copia-'));
fs.cpSync(EXT, tmp, { recursive: true });
const { ctx, sw } = await abrir({ ext: tmp });
await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
await rotas(ctx);
const p = await ctx.newPage();
await p.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1'); await p.waitForSelector('video', { state: 'attached' });
check('antes: botão na barra', !!(await until(async () => (await estado(p)).btn)));

// 1) reinjeção nas abas abertas (o que o fundo faz logo depois de recarregar), sem recarregar a página
await p.evaluate(() => { window.__marca = 42; });
await sw.evaluate(async () => { for (const t of await chrome.tabs.query({ url: 'https://www.youtube.com/*' })) { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['src/main.js'], world: 'MAIN' }); await chrome.scripting.executeScript({ target: { tabId: t.id }, files: chrome.runtime.getManifest().content_scripts[1].js }); } });
const volta = await until(async () => { const s = await estado(p); return s.btn && s.btns === 1 && s.hosts <= 1 ? s : null; }, 30000);
check('reinjeção pela lista do manifest: um botão só, um host só', !!volta, volta);
check('a página não recarregou', (await p.evaluate(() => window.__marca)) === 42);
const lista = await sw.evaluate(() => chrome.runtime.getManifest().content_scripts[1].js.join(','));
const doSw = fs.readFileSync(path.join(EXT, 'src', 'sw.js'), 'utf8').match(/const CONTENT = \[([^\]]+)\]/)[1].replace(/['\s]/g, '');
check('a lista de reinjeção do sw.js é igual à do manifest', lista === doSw, { lista, doSw });

// 2) versão nova na pasta → detectada e recarga marcada
const mf = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
const nova = mf.version + '.1';
mf.version = nova; fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(mf, null, 2));
console.log('… versão na pasta trocada para', nova, '(espera até 100 s)');
const t0 = Date.now();
const d = await until(async () => { const x = await sw.evaluate(async () => (await chrome.storage.local.get('st.disco'))['st.disco']).catch(() => null); return x && x.noDisco === nova && x.estado === 'recarregando' ? x : null; }, 100000, 2000);
check(`versão ${nova} na pasta detectada e recarga marcada em até ~1 min`, !!d, { s: Math.round((Date.now() - t0) / 1000), d });
await ctx.close().catch(() => {});
fs.rmSync(tmp, { recursive: true, force: true });
fim();
