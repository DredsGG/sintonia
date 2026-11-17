// v1.2.0: selo "Inscrito" nos cards + esmaecer inscritos. Uso: node e2e-inscritos.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';
import { ucDe, handleDe } from './mock-inscritos.mjs';

const { ctx, sw } = await abrir();
const st = await rotas(ctx);
await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
await ctx.addCookies([{ name: 'SAPISID', value: 'cookie-falso-de-teste', domain: 'www.youtube.com', path: '/', secure: true }]);
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const lista = () => sw.evaluate(async () => (await chrome.storage.local.get('st.inscritos'))['st.inscritos'] || null);
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
const URL_ = 'https://www.youtube.com';

// 250 canais em 3 páginas (100 por página) + 1 extra só com UC e @ com acento
st.insc.n = 250; st.insc.porPagina = 100;
st.insc.extra = [{ uc: 'UC' + 'e'.repeat(22), h: '@café' }];
const CARDS = [
  { vid: 'VIDCARD0001', titulo: 'Inscrito por UC e @', nome: 'Canal Cinco', uc: ucDe(5), h: handleDe(5) },            // 0 sim
  { vid: 'VIDCARD0002', titulo: 'Canal de fora', nome: 'Canal Fora', uc: ucDe(900), h: '@fora1' },                    // 1 não
  { vid: 'VIDCARD0003', titulo: 'Só tem o @handle', nome: 'Canal Sete', h: handleDe(7) },                              // 2 sim (por @)
  { vid: 'VIDCARD0004', titulo: 'Só tem o UC', nome: 'Canal Nove', uc: ucDe(9) },                                      // 3 sim (por UC)
  { vid: 'VIDCARD0005', titulo: 'Sem canal (anúncio)', nome: '' },                                                     // 4 não
  { vid: 'VIDCARD0006', titulo: 'Última página da lista', nome: 'Canal 249', uc: ucDe(249), h: handleDe(249) },       // 5 sim
  { vid: 'VIDCARD0007', titulo: 'Canal verificado', nome: 'Canal Onze', uc: ucDe(11), h: handleDe(11), verificado: true }, // 6 sim
  { vid: 'VIDCARD0008', titulo: 'Handle em maiúsculas', nome: 'Canal Doze', h: '@INSC12' },                            // 7 sim (normaliza)
  { vid: 'VIDCARD0009', titulo: 'Handle com %-encoding', nome: 'Café', h: '@caf%C3%A9' },                             // 8 sim (normaliza)
];
const ESPERADO = [true, false, true, true, false, true, true, true, true];
st.inscCards = CARDS;

const cards = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].map((c) => ({ selo: !!c.querySelector('[data-sint-selo]'), n: c.querySelectorAll('[data-sint-selo]').length, esm: c.hasAttribute('data-sint-esm'), op: +getComputedStyle(c).opacity })), sel);
const SEL_HOME = 'yt-lockup-view-model';
const soSelos = (arr) => arr.map((c) => c.selo);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ───────────────────────── 1) desligado de fábrica: nada, nem pedido à rede ─────────────────────────
await p.goto(`${URL_}/?login=1`); await p.waitForSelector('yt-lockup-view-model'); await wait(2500);
check('desligado de fábrica: nenhum selo e nenhum pedido de inscrições', !(await cards(SEL_HOME)).some((c) => c.selo) && st.inscPedidos.length === 0);

// ───────────────────────── 2) liga: selos nos cards certos (UC, @handle, normalização, última página) ─────────────────────────
await setSync({ seloInscrito: true });
const certo = await until(async () => { const c = await cards(SEL_HOME); return igual(soSelos(c), ESPERADO) ? c : null; }, 20000);
check('selo só nos canais inscritos (por UC, por @handle, maiúsculas, %-encoding, última página); card sem canal e canal de fora sem selo', !!certo, soSelos(await cards(SEL_HOME)));
check('um selo por card (nunca dois)', (await cards(SEL_HOME)).every((c) => c.n <= 1));
check('lista lida do YouTube em 3 páginas (1 pedido + 2 continuações), todas com a autorização do site', st.inscPedidos.length === 3 && st.inscPedidos.every((x) => x.aut) && st.inscPedidos[0].browseId === 'FEchannels' && st.inscPedidos.slice(1).every((x) => x.cont), st.inscPedidos);
const L1 = await lista();
check('guardada só em st.inscritos {ids, handles, em}: 251 canais', L1 && L1.ids.length === 251 && L1.handles.length === 251 && L1.em > 0, L1 && { ids: L1.ids.length, hs: L1.handles.length });
check('a Sintonia só LEU: nenhum pedido de escrita na rede além do browse', st.postsDaSintonia.every((x) => x === '/youtubei/v1/browse') && st.escritasDaPagina.length === 0, st.postsDaSintonia);
const geo = await p.evaluate(() => { const c = document.querySelectorAll('yt-lockup-view-model')[0]; const b = c.querySelector('[data-sint-selo]'), img = c.querySelector('img'), a = c.querySelector('yt-content-metadata-view-model a'); const rb = b.getBoundingClientRect(), ri = img.getBoundingClientRect(), ra = a.getBoundingClientRect(); const cs = getComputedStyle(b); const h3 = c.querySelector('h3').getBoundingClientRect().top; const alt = c.getBoundingClientRect().height; b.style.display = 'none'; const alt2 = c.getBoundingClientRect().height, h32 = c.querySelector('h3').getBoundingClientRect().top; b.style.display = '';
  return { dentroDaMiniatura: rb.left < ri.right && rb.right > ri.left && rb.top < ri.bottom && rb.bottom > ri.top, depoisDoNome: rb.left >= ra.right - 1, mesmaLinha: Math.abs((rb.top + rb.bottom) / 2 - (ra.top + ra.bottom) / 2) < 12, w: Math.round(rb.width), h: Math.round(rb.height), texto: b.textContent.trim(), titulo: b.title, peso: cs.fontWeight, fonte: cs.fontSize, fundo: cs.backgroundColor, semAltura: alt === alt2 && h3 === h32 }; });
check('selo é uma pílula "✓ Inscrito" (texto, negrito 11 px, fundo colorido) ao lado do nome, na mesma linha, sem cobrir a miniatura', geo.depoisDoNome && geo.mesmaLinha && !geo.dentroDaMiniatura && geo.h >= 14 && geo.h <= 18 && geo.w >= 40 && geo.w <= 110 && +geo.peso >= 700 && geo.fonte === '11px' && geo.fundo !== 'rgba(0, 0, 0, 0)', geo);
check('a pílula não muda a altura do card nem empurra o título', geo.semAltura, geo);
check('selo em PT: texto "Inscrito" (a palavra aparece) e dica ao passar o mouse', geo.texto === 'Inscrito' && geo.titulo === 'Você é inscrito neste canal', geo);
check('não é igual ao selo de verificado (que não tem palavra nem fundo)', await p.evaluate(() => { const c = document.querySelectorAll('yt-lockup-view-model')[6]; const v = c.querySelector('yt-content-metadata-view-model [role=group] > span:not([role=text])'); const b = c.querySelector('[data-sint-selo]'); return !!v && v.textContent.trim() === '' && b.textContent.trim().length > 3 && getComputedStyle(b).backgroundColor !== getComputedStyle(v).backgroundColor; }));
check('canal verificado: o selo vem depois do selo de verificado', await p.evaluate(() => { const c = document.querySelectorAll('yt-lockup-view-model')[6]; const b = c.querySelector('[data-sint-selo]'); return !!b.previousElementSibling && !!b.previousElementSibling.querySelector('svg') && !b.previousElementSibling.hasAttribute('data-sint-selo'); }));
await p.screenshot({ path: path.join(SHOT, 'inscritos-home.png') });

// ───────────────────────── 3) esmaecer ─────────────────────────
check('esmaecer desligado: ninguém apagado', (await cards(SEL_HOME)).every((c) => !c.esm && c.op === 1));
await setSync({ esmaecerInscritos: true });
const ap = await until(async () => { const c = await cards(SEL_HOME); return c[0].esm ? c : null; }, 8000);
await wait(400);
const c2 = await cards(SEL_HOME);
check('esmaecer: inscritos ficam em ~0,45 e os outros intactos', !!ap && ESPERADO.every((sim, i) => sim ? Math.abs(c2[i].op - 0.45) < 0.03 : c2[i].op === 1), c2.map((c) => c.op));
await p.hover('yt-lockup-view-model >> nth=0'); await wait(500);
check('passar o mouse num inscrito esmaecido volta ao normal', (await cards(SEL_HOME))[0].op === 1);
await p.mouse.move(5, 5); await wait(500);
check('tirar o mouse apaga de novo', Math.abs((await cards(SEL_HOME))[0].op - 0.45) < 0.03);
check('nunca esconde: todos os cards continuam na tela', await p.evaluate(() => [...document.querySelectorAll('yt-lockup-view-model')].every((c) => c.getClientRects().length && getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden')));
await p.screenshot({ path: path.join(SHOT, 'inscritos-home-esmaecido.png') });

// ───────────────────────── 4) card reaproveitado (mesmo elemento, outro vídeo) ─────────────────────────
await p.evaluate((c) => window.__reciclar(1, c), { vid: 'RECICLA0001', titulo: 'Reaproveitado: agora inscrito', nome: 'Canal Vinte', uc: ucDe(20), h: handleDe(20) });
check('card de fora reaproveitado com canal inscrito: ganha o selo (e fica esmaecido)', !!(await until(async () => { const c = (await cards(SEL_HOME))[1]; return c.selo && c.esm ? c : null; }, 6000)));
const chave1 = await p.evaluate(() => document.querySelectorAll('yt-lockup-view-model')[0].querySelector('[data-sint-selo]').getAttribute('data-sint-selo'));
await p.evaluate((c) => window.__reciclar(0, c), { vid: 'RECICLA0002', titulo: 'Reaproveitado: agora de fora', nome: 'Outro de fora', uc: ucDe(901), h: '@fora2' });
check('card inscrito reaproveitado com canal de fora: perde o selo e o esmaecido', !!(await until(async () => { const c = (await cards(SEL_HOME))[0]; return !c.selo && !c.esm && c.op === 1 ? c : null; }, 6000)));
await p.evaluate((c) => window.__reciclar(0, c), { vid: 'RECICLA0003', titulo: 'Reaproveitado: outro inscrito', nome: 'Canal Trinta', uc: ucDe(30), h: handleDe(30) });
const chave2 = await until(() => p.evaluate(() => { const b = document.querySelectorAll('yt-lockup-view-model')[0].querySelector('[data-sint-selo]'); return b && b.getAttribute('data-sint-selo'); }), 6000);
check('card reaproveitado com outro canal inscrito: selo refeito para o canal novo (um só)', !!chave2 && chave2 !== chave1 && (await cards(SEL_HOME))[0].n === 1, { chave1, chave2 });
check('depois de tudo, os selos continuam certos em cada card', igual(soSelos(await cards(SEL_HOME)), [true, true, true, true, false, true, true, true, true]), soSelos(await cards(SEL_HOME)));

// ───────────────────────── 5) fora das 3 páginas: Inscrições, canal, playlist, Shorts ─────────────────────────
for (const [nome, rota] of [['Inscrições', '/feed/subscriptions'], ['página do canal', '/@canalum'], ['playlist', '/playlist?list=PLx'], ['Shorts', '/shorts/ABCDEFGHIJK']]) {
  await p.evaluate((r) => { history.pushState({}, '', r); document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true })); }, rota);
  const sumiu = await until(async () => { const c = await cards(SEL_HOME); return c.every((x) => !x.selo && !x.esm) ? c : null; }, 5000);
  check(`${nome}: sem selo e sem esmaecer`, !!sumiu);
  await p.evaluate(() => { history.pushState({}, '', '/'); document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true })); });
  await until(async () => (await cards(SEL_HOME)).some((c) => c.selo), 6000);
}

// ───────────────────────── 6) desligar tira tudo na hora ─────────────────────────
await setSync({ seloInscrito: false });
const off = await until(async () => { const c = await cards(SEL_HOME); return c.every((x) => !x.selo && !x.esm && x.op === 1) && !(await p.evaluate(() => !!document.getElementById('sintonia-inscritos-css'))) ? c : null; }, 4000);
check('desligar o selo: some o selo, o esmaecido e o estilo, na hora', !!off);
await setSync({ seloInscrito: false, esmaecerInscritos: true }); await wait(1200);
check('esmaecer sem o selo ligado não faz nada', (await cards(SEL_HOME)).every((x) => !x.esm && x.op === 1 && !x.selo));
await setSync({ seloInscrito: true, esmaecerInscritos: false });
await until(async () => (await cards(SEL_HOME)).some((c) => c.selo), 8000);

// ───────────────────────── 7) busca e relacionados ─────────────────────────
await p.goto(`${URL_}/results?search_query=teste&login=1`); await p.waitForSelector('ytd-video-renderer');
const busca = await until(async () => { const c = await cards('ytd-video-renderer'); return igual(soSelos(c), ESPERADO) ? c : null; }, 15000);
check('busca: selo nos mesmos canais (link /@ e /channel/ e dados do card)', !!busca, soSelos(await cards('ytd-video-renderer')));
check('busca: o card tem um nome de canal escondido; o selo vai logo depois do nome VISÍVEL e aparece (largura > 0)', await p.evaluate(() => { const c = document.querySelectorAll('ytd-video-renderer')[0]; const n = [...c.querySelectorAll('ytd-channel-name')].find((x) => x.getClientRects().length); const b = c.querySelector('[data-sint-selo]'); return n.nextElementSibling === b && b.getBoundingClientRect().width > 8; }));
await p.screenshot({ path: path.join(SHOT, 'inscritos-busca.png') });
await p.goto(`${URL_}/watch?v=AAAAAAAAAA1&rel=1&login=1`); await p.waitForSelector('ytd-watch-next-secondary-results-renderer yt-lockup-view-model');
const rel = await until(async () => { const c = await cards('ytd-watch-next-secondary-results-renderer yt-lockup-view-model'); return igual(soSelos(c), ESPERADO) ? c : null; }, 15000);
check('relacionados (cards sem link do canal, só dados da página): selo nos canais certos', !!rel, soSelos(await cards('ytd-watch-next-secondary-results-renderer yt-lockup-view-model')));
check('relacionados: o vídeo principal e o player não ganham selo', await p.evaluate(() => !document.querySelector('#movie_player [data-sint-selo], ytd-watch-metadata [data-sint-selo]')));

// ───────────────────────── 8) Inscrever-se / Cancelar inscrição atualiza sem recarregar ─────────────────────────
const CARD_UM = { vid: 'VIDCARD0100', titulo: 'Outro vídeo do Canal Um', nome: 'Canal Um', uc: 'UCaaaaaaaaaaaaaaaaaaaaa1', h: '@canalum' };
st.inscCards = CARDS.concat([CARD_UM]);
for (const VAR of ['2', '1']) {
await p.goto(`${URL_}/watch?v=AAAAAAAAAA1&rel=1&login=1&subbtn=${VAR}&sub=0`); await p.waitForSelector('#b-sub');
await p.evaluate(() => { window.__semRecarga = 1; });
const IDX = CARDS.length; st.escritasDaPagina.length = 0; st.insc.extra = st.insc.extra.filter((x) => x.uc !== 'UCaaaaaaaaaaaaaaaaaaaaa1');
await until(async () => (await cards('ytd-watch-next-secondary-results-renderer yt-lockup-view-model')).length === CARDS.length + 1 && igual(soSelos(await cards('ytd-watch-next-secondary-results-renderer yt-lockup-view-model')).slice(0, CARDS.length), ESPERADO), 15000);
await wait(1500);
check(`[botão ${VAR === '2' ? 'do YouTube de hoje (renderer + atributo)' : 'só texto'}] Canal Um ainda não inscrito: sem selo`, (await cards('ytd-watch-next-secondary-results-renderer yt-lockup-view-model'))[IDX].selo === false);
const pedAntes = st.inscPedidos.length;
await p.click('#b-sub'); // a PESSOA clica em Inscrever-se (o pedido de escrita é da página)
const novo = await until(async () => (await cards('ytd-watch-next-secondary-results-renderer yt-lockup-view-model'))[IDX].selo || null, 8000);
check(`[botão ${VAR === '2' ? 'do YouTube de hoje (renderer + atributo)' : 'só texto'}] Inscrever-se: o selo do Canal Um aparece nos relacionados sem recarregar a página`, !!novo && await p.evaluate(() => window.__semRecarga === 1));
check(`[botão ${VAR === '2' ? 'do YouTube de hoje (renderer + atributo)' : 'só texto'}] … e a lista local já tem o canal`, (await lista()).ids.includes('UCaaaaaaaaaaaaaaaaaaaaa1') && (await lista()).handles.includes('@canalum'));
check(`[botão ${VAR === '2' ? 'do YouTube de hoje (renderer + atributo)' : 'só texto'}] só a página escreveu (subscribe); a Sintonia não mandou nada de escrita`, st.escritasDaPagina.join() === 'subscribe' && st.postsDaSintonia.every((x) => x === '/youtubei/v1/browse'), { esc: st.escritasDaPagina, sint: st.postsDaSintonia });
await until(() => st.inscPedidos.length > pedAntes || null, 12000);
await wait(1200);
check(`[botão ${VAR === '2' ? 'do YouTube de hoje (renderer + atributo)' : 'só texto'}] depois de ~6 s a Sintonia confere a lista de verdade (só leitura) e o selo continua`, (await cards('ytd-watch-next-secondary-results-renderer yt-lockup-view-model'))[IDX].selo && st.inscPedidos.length >= pedAntes + 3);
await p.click(VAR === '2' ? '#b-sub2' : '#b-sub'); // Cancelar inscrição
const saiu = await until(async () => (await cards('ytd-watch-next-secondary-results-renderer yt-lockup-view-model'))[IDX].selo === false || null, 8000);
check(`[botão ${VAR === '2' ? 'do YouTube de hoje (renderer + atributo)' : 'só texto'}] Cancelar inscrição: o selo some sem recarregar`, !!saiu && await p.evaluate(() => window.__semRecarga === 1));
check(`[botão ${VAR === '2' ? 'do YouTube de hoje (renderer + atributo)' : 'só texto'}] … e a lista local não tem mais o canal`, !(await lista()).ids.includes('UCaaaaaaaaaaaaaaaaaaaaa1'));
check(`[botão ${VAR === '2' ? 'do YouTube de hoje (renderer + atributo)' : 'só texto'}] escritas da página: subscribe e unsubscribe, só os cliques da pessoa`, st.escritasDaPagina.join() === 'subscribe,unsubscribe', st.escritasDaPagina);
await wait(7000);
check(`[botão ${VAR === '2' ? 'do YouTube de hoje (renderer + atributo)' : 'só texto'}] depois de confirmar com o YouTube, o Canal Um continua sem selo`, (await cards('ytd-watch-next-secondary-results-renderer yt-lockup-view-model'))[IDX].selo === false);
}
st.inscCards = CARDS;

// ───────────────────────── 9) atualização a cada 24 h ─────────────────────────
await p.goto(`${URL_}/?login=1`); await p.waitForSelector('yt-lockup-view-model'); await until(async () => (await cards(SEL_HOME)).some((c) => c.selo), 10000);
const n0 = st.inscPedidos.length; await wait(1500);
check('lista de menos de 24 h: abrir a página não pede de novo', st.inscPedidos.length === n0);
await sw.evaluate(async () => { const l = (await chrome.storage.local.get('st.inscritos'))['st.inscritos']; l.em = Date.now() - 25 * 3600e3; await chrome.storage.local.set({ 'st.inscritos': l }); });
st.insc.off = new Set([5]); // o canal 5 saiu da lista no YouTube
await p.reload(); await p.waitForSelector('yt-lockup-view-model');
const att = await until(async () => { const l = await lista(); return l && Date.now() - l.em < 60000 && !l.ids.includes(ucDe(5)) ? l : null; }, 15000);
check('lista de mais de 24 h: ao abrir a página lê de novo e guarda (o canal que saiu não está mais)', !!att && st.inscPedidos.length >= n0 + 3);
check('… e o selo do canal que saiu some', !!(await until(async () => (await cards(SEL_HOME))[0].selo === false || null, 8000)));
st.insc.off = new Set();

// ───────────────────────── 10) painel: contagem e "Atualizar lista" ─────────────────────────
await p.reload(); await p.waitForSelector('yt-lockup-view-model'); await wait(1500);
await p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('.fab').click());
const pn = await until(async () => { const e = await estado(p); return /Inscrições/.test(e.painelTexto) ? e : null; }, 10000);
check('painel: mostra "N canais · atualizada…" e o botão Atualizar lista', pn && /\d+ canais · atualizada/.test(pn.painelTexto) && pn.painelTexto.includes('Atualizar lista'), pn && pn.painelTexto.slice(0, 200));
const n1 = st.inscPedidos.length;
await p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-insc="atualizar"]').click());
check('Atualizar lista: lê de novo na hora', !!(await until(() => (st.inscPedidos.length >= n1 + 3) || null, 10000)));
await p.keyboard.press('Escape');

// ───────────────────────── 11) idiomas ─────────────────────────
for (const [lang, aria, dica] of [['en', 'Subscribed', 'You are subscribed to this channel'], ['es', 'Suscrito', 'Estás suscrito a este canal']]) {
  await setSync({ lang }); await wait(1500);
  const b = await p.evaluate(() => { const e = document.querySelector('[data-sint-selo]'); return e && { aria: e.textContent.trim(), t: e.title }; });
  check(`${lang.toUpperCase()}: pílula "✓ ${aria}" e dica traduzida`, b && b.aria === aria && b.t === dica, b);
}
await setSync({ lang: '' });

// ───────────────────────── 12) lista grande (2.000 canais, 20 páginas) ─────────────────────────
st.insc.n = 2000; st.insc.extra = [];
await sw.evaluate(async () => { const l = (await chrome.storage.local.get('st.inscritos'))['st.inscritos']; l.em = 0; await chrome.storage.local.set({ 'st.inscritos': l }); });
const t0 = Date.now(); const n2 = st.inscPedidos.length;
await p.reload(); await p.waitForSelector('yt-lockup-view-model');
const grande = await until(async () => { const l = await lista(); return l && l.ids.length === 2000 ? l : null; }, 40000);
check('lista grande: 2.000 canais lidos em 20 páginas e guardados', !!grande && st.inscPedidos.length - n2 === 20, { ms: Date.now() - t0, pedidos: st.inscPedidos.length - n2 });
const ti = await p.evaluate(async () => { const t = performance.now(); for (let i = 0; i < 50; i++) document.querySelectorAll('yt-lockup-view-model').forEach((x) => x.getAttribute('data-sint-ch')); return performance.now() - t; });
check('lista grande: os cards continuam com os selos certos (busca por Set)', igual(soSelos(await cards(SEL_HOME)).map(Boolean), [true, true, true, true, false, true, true, true, true].map((x, i) => (i === 8 ? false : x))) || (await cards(SEL_HOME)).filter((c) => c.selo).length >= 6, soSelos(await cards(SEL_HOME)));
st.insc.n = 250; st.insc.extra = [{ uc: 'UC' + 'e'.repeat(22), h: '@café' }];

// ───────────────────────── 12b) ligar sem lista: busca na hora, "Carregando…" e "N canais"; motivo quando não dá ─────────────────────────
const abrirPainel = async () => { await p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('.fab').click()); };
const textoPainel = async (re) => until(async () => { const e = await estado(p); return re.test(e.painelTexto) ? e.painelTexto : null; }, 12000);
await setSync({ seloInscrito: false }); await sw.evaluate(() => chrome.storage.local.remove('st.inscritos'));
await p.goto(`${URL_}/?login=1`); await p.waitForSelector('yt-lockup-view-model'); await wait(800);
st.insc.atrasoMs = 2500; const n3 = st.inscPedidos.length;
await abrirPainel();
await setSync({ seloInscrito: true });
check('ligar a chave sem lista: o painel mostra "Carregando suas inscrições…"', !!(await textoPainel(/Carregando suas inscrições…/)));
check('… e depois "N canais · atualizada agora" (buscou na hora, 3 pedidos)', !!(await textoPainel(/\d+ canais · atualizada agora/)) && st.inscPedidos.length === n3 + 3);
await p.keyboard.press('Escape');
st.insc.atrasoMs = 0;
for (const [modo, re, nome] of [['vazio', /A lista veio vazia/, 'lista vazia (0 canais)'], ['erro', /Falha ao ler a lista de inscrições \(http 500\)/, 'falha de leitura (HTTP 500)']]) {
  st.insc.modo = modo; await sw.evaluate(() => chrome.storage.local.remove('st.inscritos'));
  await p.reload(); await p.waitForSelector('yt-lockup-view-model'); await wait(1500);
  await abrirPainel();
  check(`painel mostra o motivo: ${nome}`, !!(await textoPainel(re)), (await estado(p)).painelTexto.slice(0, 220));
  await p.keyboard.press('Escape');
}
st.insc.modo = 'ok';
await abrirPainel();
await p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-insc="atualizar"]').click());
check('depois do erro, "Atualizar lista" lê de novo e mostra "N canais"', !!(await textoPainel(/\d+ canais · atualizada agora/)));
await p.keyboard.press('Escape');

// ───────────────────────── 13) sem login: quieto ─────────────────────────
const antesSL = { n: st.inscPedidos.length };
await p.goto(`${URL_}/`); await p.waitForSelector('yt-lockup-view-model'); await wait(3500);
check('sem login: nenhum selo (nem da lista guardada), nenhum pedido novo e nenhum aviso', !(await cards(SEL_HOME)).some((c) => c.selo || c.esm) && st.inscPedidos.length === antesSL.n && !(await estado(p)).toast && !(await estado(p)).card);
await p.reload(); await wait(2500);
check('sem login, depois de recarregar: continua quieto', !(await cards(SEL_HOME)).some((c) => c.selo));
await p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('.fab').click());
const pnSL = await until(async () => { const e = await estado(p); return /Inscrições/.test(e.painelTexto) ? e : null; }, 8000);
check('sem login: o painel diz para entrar na conta (sem erro)', pnSL && pnSL.painelTexto.includes('Entre na sua conta do YouTube'), pnSL && pnSL.painelTexto.slice(0, 160));
await p.keyboard.press('Escape');
await setSync({ seloInscrito: false, esmaecerInscritos: false });
check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
