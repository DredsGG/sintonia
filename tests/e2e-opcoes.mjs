// Página de Ajustes: o menu lateral acompanha a rolagem (pedido do André, 2026-11-12). Uso: node e2e-opcoes.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, SHOT } from './lib.mjs';

const { ctx, extId } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
const erros = [];
const op = await ctx.newPage(); op.on('pageerror', (e) => erros.push(String(e)));
await op.goto(`chrome-extension://${extId}/options/options.html`);
await op.waitForSelector('nav.sec a[data-sec]');
const marcado = () => op.evaluate(() => { const on = [...document.querySelectorAll('nav.sec a.on')]; return on.length === 1 ? on[0].dataset.sec : on.map((a) => a.dataset.sec).join(','); });
const pill = () => op.evaluate(() => { const p = document.querySelector('nav.sec .pill'), a = document.querySelector('nav.sec a.on'); if (!p || !a) return null; const r = p.getBoundingClientRect(), q = a.getBoundingClientRect(); return { junto: Math.abs(r.top - q.top) < 2 && Math.abs(r.left - q.left) < 2 && Math.abs(r.height - q.height) < 2, vis: getComputedStyle(p).opacity === '1' }; });
const ids = await op.evaluate(() => [...document.querySelectorAll('main section')].map((s) => s.id));
const rolarAte = (id) => op.evaluate((id) => { const s = document.getElementById(id); scrollTo(0, s.getBoundingClientRect().top + scrollY - 56 - 8); }, id);

check('ao abrir: só "Geral" marcado, com o destaque em cima dele', (await marcado()) === ids[0] && (await pill()).junto && (await pill()).vis, [await marcado(), await pill()]);

// rolando com a roda do mouse, o item acompanha a seção do alto
let ok = true; const vistos = [];
for (const id of ids.slice(1, 6)) {
  await rolarAte(id); await wait(250);
  const m = await marcado(); vistos.push([id, m]);
  if (m !== id) ok = false;
}
check('rolando a página, o menu marca a seção que está no alto (uma de cada vez)', ok, vistos);
await wait(400);
check('o destaque desliza junto (fica em cima do item marcado)', (await pill()).junto, await pill());
check('a URL acompanha (#seção) sem pular a página', (await op.evaluate(() => location.hash)) === '#' + (await marcado()));

// rolagem de verdade (roda do mouse) até o fim: marca a última seção, mesmo curta
await op.mouse.move(640, 500);
for (let i = 0; i < 60; i++) { await op.mouse.wheel(0, 600); await wait(30); }
await wait(600);
check('no fim da página (rolado tudo para baixo): marca a última seção', (await marcado()) === ids[ids.length - 1], [await marcado(), ids[ids.length - 1]]);
await op.screenshot({ path: path.join(SHOT, 'opcoes-fim.png') });

// voltando ao topo
for (let i = 0; i < 60; i++) { await op.mouse.wheel(0, -600); await wait(30); }
await wait(600);
check('de volta ao topo: "Geral" de novo', (await marcado()) === ids[0], await marcado());

// clicar num item: rola suave até a seção e o destaque vai direto para ele
const alvo = ids[Math.floor(ids.length / 2)];
const saltos = [];
const obs = op.evaluate(() => new Promise((ok) => { const vis = []; const mo = new MutationObserver(() => { const a = document.querySelector('nav.sec a.on'); if (a && vis[vis.length - 1] !== a.dataset.sec) vis.push(a.dataset.sec); }); mo.observe(document.querySelector('nav.sec'), { attributes: true, subtree: true, attributeFilter: ['class'] }); setTimeout(() => { mo.disconnect(); ok(vis); }, 2000); }));
await op.click(`nav.sec a[data-sec="${alvo}"]`);
saltos.push(...(await obs));
const topo = await op.evaluate((id) => Math.round(document.getElementById(id).getBoundingClientRect().top), alvo);
check('clicar num item: a página rola até a seção', topo >= 40 && topo <= 120, topo);
check('o destaque vai direto ao item clicado (sem passar pelos do meio)', saltos.length === 1 && saltos[0] === alvo && (await marcado()) === alvo, saltos);

// clicar numa seção curta do fim (não chega ao alto): continua marcada a que foi clicada
const penult = ids[ids.length - 2];
await op.click(`nav.sec a[data-sec="${penult}"]`);
await wait(1800);
check('clicar na penúltima (o fim da página não deixa ela chegar ao alto): continua ela', (await marcado()) === penult, [await marcado(), penult]);
await op.mouse.wheel(0, -300); await wait(500);
check('depois, rolando de novo, volta a acompanhar a rolagem', (await marcado()) !== '' && (await marcado()).split(',').length === 1);

// busca: seções escondidas não são marcadas
await op.evaluate(() => scrollTo(0, 0)); await wait(300);
await op.fill('[data-busca]', 'velocidade'); await wait(300);
const vis = await op.evaluate(() => [...document.querySelectorAll('main section')].filter((s) => !s.hidden).map((s) => s.id));
check('com a busca, marca uma seção que está aparecendo', vis.includes(await marcado()), [await marcado(), vis]);
await op.fill('[data-busca]', ''); await wait(300);

// celular (estreito): o menu vira linha no alto e o destaque continua em cima do item
await op.setViewportSize({ width: 420, height: 800 }); await wait(400);
await op.evaluate(() => scrollTo(0, 0)); await wait(400);
check('tela estreita: destaque em cima do item marcado', !!(await pill()) && (await pill()).junto, await pill());
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
