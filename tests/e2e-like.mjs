// Fase 3 (v0.4.0): like automático + esconder distrações. Uso: node e2e-like.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, PH, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw } = await abrir();
const st = await rotas(ctx);
await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const likeSt = () => sw.evaluate(async () => (await chrome.storage.local.get('st.like'))['st.like'] || {});
const m = () => p.evaluate(() => ({ ...window.__mock, pressed: (document.getElementById('b-like') || {}).getAttribute?.call(document.getElementById('b-like'), 'aria-pressed') }));
const abrirV = async (v, extra = '&login=1') => { await p.goto(`https://www.youtube.com/watch?v=${v}${extra}`); await p.waitForSelector('video', { state: 'attached' }); await until(() => p.evaluate(() => document.querySelector('video').readyState >= 2)); await wait(800); };
const rapido = (r) => p.evaluate((r) => { const v = document.querySelector('video'); v.playbackRate = r; v.play(); }, r);
const ate = (seg, ms = 20000) => until(() => p.evaluate((s) => document.querySelector('video').currentTime >= s, seg), ms, 100);

// ── like desligado (fábrica)
await abrirV('AAAAAAAAAA1'); await rapido(8); await ate(60);
check('like desligado: não clica nada', (await m()).likeCliques === 0);

// ── modo "depois de 50% assistido"
await setSync({ likeAuto: true, likeModo: 'pct', likePct: 50 });
await abrirV('AAAAAAAAAA1'); await rapido(8);
await ate(35);
check('50%: em ~35% ainda não curtiu', (await m()).likeCliques === 0);
const ok50 = await until(async () => { const x = await m(); return x.pressed === 'true' ? x : null; }, 25000);
check('50%: curtiu depois de metade assistida (aria-pressed=true, 1 clique)', ok50 && ok50.likeCliques === 1, ok50 && { cliques: ok50.likeCliques, t: await p.evaluate(() => Math.round(document.querySelector('video').currentTime)) });
check('like registrado (um por vídeo, no st.like.feitos)', !!(await until(async () => (await likeSt()).feitos?.AAAAAAAAAA1)));
check('log local tem o like', !!(await until(async () => (await sw.evaluate(async () => (await chrome.storage.local.get('st.log'))['st.log'] || [])).some((e) => e.type === 'like' && e.ok))));
// a pessoa tira o like: a Sintonia não curte de novo
await p.click('#b-like'); await wait(500); await rapido(8); await wait(3000);
check('um like por vídeo: depois de a pessoa tirar, não curte de novo', (await m()).likeCliques === 2 && (await m()).pressed === 'false');
// pular para o fim não conta como assistido
await abrirV('AAAAAAAAAA3'); await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 95; v.play(); }); await wait(3500);
check('pular para 95% não conta como assistido: não curte', (await m()).likeCliques === 0);

// ── já tem like / dislike: não mexe
await setSync({ likeModo: 'abrir' });
await abrirV('BBBBBBBBBB2', '&login=1&liked=1'); await wait(5000);
check('já tinha like: não clica (nunca tira like)', (await m()).likeCliques === 0 && (await m()).pressed === 'true');
await sw.evaluate(() => chrome.storage.local.set({ 'st.like': {} }));
await abrirV('BBBBBBBBBB2', '&login=1&disliked=1'); await wait(5000);
check('tem dislike: não clica', (await m()).likeCliques === 0 && (await m()).disCliques === 0);
// sem login: nada
await sw.evaluate(() => chrome.storage.local.set({ 'st.like': {} }));
await abrirV('BBBBBBBBBB2', ''); await wait(5000);
check('sem login: não clica (não abre o "Fazer login")', (await m()).likeCliques === 0 && (await m()).loginPopup === 0);
// live: nada
await abrirV('LIVEVIDEO04'); await wait(5000);
check('live: ignora', (await m()).likeCliques === 0);
// anúncio: nada durante
await sw.evaluate(() => chrome.storage.local.set({ 'st.like': {} }));
await abrirV('AAAAAAAAAA1'); await p.evaluate(() => { window.__anuncio(6000); }); await wait(4000);
check('anúncio: não curte durante', (await m()).likeCliques === 0);
check('depois do anúncio, modo "ao abrir" curte', !!(await until(async () => { const x = await m(); return x.pressed === 'true' ? x : null; }, 15000)));
// troca de vídeo: curte o novo
await p.evaluate(() => window.__ir('/watch?v=AAAAAAAAAA3'));
check('troca de vídeo (navegação interna): curte o novo também', !!(await until(async () => { const x = await m(); return x.pressed === 'true' && x.likes >= 2 ? x : null; }, 15000)));

// ── só nos canais marcados + nunca curtir
await sw.evaluate(() => chrome.storage.local.set({ 'st.like': {} }));
await setSync({ likeModo: 'canais' });
await abrirV('AAAAAAAAAA1'); await wait(5000);
check('canais marcados: Canal Um não marcado → não curte', (await m()).likeCliques === 0);
await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel);
await clicar(p, PH, '[data-lk="canal"]'); await wait(300); await p.keyboard.press('Escape');
check('marcar "Curtir sempre neste canal" no painel → curte', !!(await until(async () => { const x = await m(); return x.pressed === 'true' ? x : null; }, 15000)));
check('canal marcado salvo em st.like.canais', (await likeSt()).canais?.UCaaaaaaaaaaaaaaaaaaaaa1 === 'Canal Um');
await setSync({ likeModo: 'abrir' });
await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel);
await clicar(p, PH, '[data-lk="nunca"]'); await wait(300); await p.keyboard.press('Escape');
await abrirV('AAAAAAAAAA3'); await wait(5000);
check('"Nunca curtir neste canal": mesmo em "ao abrir", não curte', (await m()).likeCliques === 0);
await abrirV('BBBBBBBBBB2'); await wait(1000);
check('outro canal (sem "nunca") curte normalmente', !!(await until(async () => { const x = await m(); return x.pressed === 'true' ? x : null; }, 15000)));

// ── Shorts: fora de fábrica, chave própria
await p.goto('https://www.youtube.com/shorts/SHRT0000001?login=1'); await wait(5000);
check('Shorts: ignorados de fábrica', (await p.evaluate(() => window.__mock.likes)) === 0);
await setSync({ likeShorts: true });
await p.goto('https://www.youtube.com/shorts/SHRT0000002?login=1');
check('Shorts com a chave ligada: curte', !!(await until(() => p.evaluate(() => window.__mock.likes === 1), 15000)));
await setSync({ likeAuto: false, likeShorts: false });

// ── esconder distrações
const vis = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }, sel);
await abrirV('AAAAAAAAAA1');
const antes = { com: await vis('#comments'), rel: await vis('#related'), fim: await vis('.ytp-endscreen-content'), card: await vis('.ytp-ce-element') };
check('desligado: comentários, relacionados, tela final e cards aparecem', Object.values(antes).every(Boolean), antes);
await setSync({ escComentarios: true, escRelacionados: true, escTelaFinal: true });
await wait(500);
check('esconder comentários', !(await vis('#comments')));
check('esconder relacionados', !(await vis('#related')));
check('esconder tela final e cards', !(await vis('.ytp-endscreen-content')) && !(await vis('.ytp-ce-element')) && !(await vis('.ytp-cards-teaser')));
check('o player e o vídeo continuam visíveis', (await vis('#movie_player')) && (await vis('video')));
await p.evaluate(() => window.__ir('/watch?v=BBBBBBBBBB2')); await wait(800);
check('troca de vídeo: continuam escondidos', !(await vis('#comments')) && !(await vis('#related')));
await abrirV('LIVEVIDEO04');
check('live: chat aparece com a chave desligada', await vis('ytd-live-chat-frame'));
await setSync({ escChat: true }); await wait(400);
check('esconder chat', !(await vis('ytd-live-chat-frame')));
await setSync({ escComentarios: false });
await wait(400);
check('desligar a chave volta a mostrar (comentários)', await vis('#comments'));
await p.screenshot({ path: path.join(SHOT, 'esconder.png') });
// Shorts em toda parte (Inscrições simuladas: prateleira, item da grade, menu e filtro)
await p.goto('https://www.youtube.com/feed/subscriptions'); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
const shorts = () => p.evaluate(() => {
  const v = (e) => !!e && getComputedStyle(e).display !== 'none' && !e.closest('[style*="display: none"]') && e.getClientRects().length > 0;
  return { prateleira: v(document.querySelector('ytd-rich-shelf-renderer[is-shorts]')), itemGrade: v(document.querySelector('ytd-rich-item-renderer:has(a[href="/shorts/SUB00000012"])')),
    menu: v(document.querySelector('ytd-guide-entry-renderer:has(a[title="Shorts"])')), chip: v(document.querySelector('yt-chip-cloud-chip-renderer')), video: v(document.querySelector('ytd-rich-item-renderer:has(a[href="/watch?v=SUB00000000"])')) };
});
let sh = await shorts();
check('Shorts desligado: tudo aparece', sh.prateleira && sh.itemGrade && sh.menu && sh.chip, sh);
await setSync({ escShorts: true });
sh = await until(async () => { const x = await shorts(); return !x.chip ? x : null; }, 5000);
check('esconder Shorts: prateleira, item da grade, menu e filtro somem; vídeo normal fica', sh && !sh.prateleira && !sh.itemGrade && !sh.menu && !sh.chip && sh.video, sh || await shorts());
// início → Inscrições
await setSync({ homeInscricoes: true });
await p.goto('https://www.youtube.com/');
await p.waitForURL(/\/feed\/subscriptions/, { timeout: 15000 }).catch(() => {});
check('início vai para as Inscrições', p.url().endsWith('/feed/subscriptions'), p.url());
await setSync({ homeInscricoes: false, escShorts: false, escRelacionados: false, escTelaFinal: false, escChat: false });
await p.goto('https://www.youtube.com/'); await wait(2500);
check('desligado: o início fica no início', new URL(p.url()).pathname === '/');
check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
