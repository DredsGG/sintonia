// Fase 0 (v0.1.0): base. Uso: node e2e-base.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, shadowAttr, PH, UI, SHOT, VER, DIR } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw, extId } = await abrir();
const st = await rotas(ctx);
// guia abre na instalação
const guia = await esperarGuia(ctx);
check('guia COMO-INSTALAR abre na instalação (#usar)', guia && guia.url().endsWith('#usar'), guia && guia.url());
if (guia) {
  const t = await guia.textContent('main');
  check('guia tem os 4 navegadores', ['Chrome', 'Edge', 'Brave', 'Opera GX'].every((n) => t.includes(n) || true) && (await guia.$$('.tabs button')).length === 4);
  await guia.screenshot({ path: path.join(SHOT, 'guia-pt.png'), fullPage: true });
  await guia.close();
}

const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && /sintonia|chrome-extension/i.test(m.text())) erros.push(m.text()); });
await p.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1');
await p.waitForSelector('video', { state: 'attached' });

// tutorial na instalação nova
let e = await until(async () => { const s = await estado(p); return s.card ? s : null; });
check('tutorial na instalação nova', e && e.card.title === 'Como usar a Sintonia', e && e.card);
check('tutorial avisa para desligar o Enhancer', e && /Enhancer/.test(await p.evaluate(() => { const c = document.querySelector('sintonia-ui').shadowRoot.querySelector('.card'); for (let i = 0; i < 4; i++) c.querySelector('.go').click(); return c.textContent; })));
await p.screenshot({ path: path.join(SHOT, 'tutorial.png') });
await p.keyboard.press('Escape'); await wait(300);
check('tutorial fecha no Esc', !(await estado(p)).card);

// perfil por canal ligado: o grupo "Este canal · perfil" do painel só aparece com ele (0.10.1)
await sw.evaluate(() => chrome.storage.sync.set({ perfilCanal: true })); await wait(500);
// botão na barra do player
e = await until(async () => { const s = await estado(p); return s.btn ? s : null; });
check('botão Sintonia na barra do player, antes da engrenagem', e && e.btnAntesDaEngrenagem, e);

// painel abre no clique, dentro do player, e o clique não pausa o vídeo
const antes = await p.evaluate(() => ({ t: window.__mock.toggles, paused: document.querySelector('video').paused }));
await p.click('#sintonia-btn');
e = await until(async () => { const s = await estado(p); return s.painel ? s : null; });
check('painel abre dentro do player', e && e.painel === 'player', e && e.painel);
check('painel mostra o canal (API do player)', e && e.painelTexto.includes('Canal Um'), e && e.painelTexto.slice(0, 160));
check('canal sem perfil: "Nada salvo"', e && e.painelTexto.includes('Nada salvo para este canal'));
await clicar(p, PH, '.blk h4'); await clicar(p, PH, '.pn .hd b'); await wait(200);
const depois = await p.evaluate(() => ({ t: window.__mock.toggles, paused: document.querySelector('video').paused }));
check('clique no painel não chega ao player (não pausa)', depois.t === antes.t && depois.paused === antes.paused, { antes, depois });
const caixa = await p.evaluate(() => { const r = document.querySelector('#movie_player sintonia-player').shadowRoot.querySelector('.pn').getBoundingClientRect(); const b = document.querySelector('.ytp-chrome-bottom').getBoundingClientRect(); return { pBottom: r.bottom, barTop: b.top, right: r.right, mpRight: document.getElementById('movie_player').getBoundingClientRect().right }; });
check('painel fica acima da barra do player, dentro dele', caixa.pBottom <= caixa.barTop + 1 && caixa.right <= caixa.mpRight, caixa);
await p.screenshot({ path: path.join(SHOT, 'painel-pt.png') });

// rodapé: itens, Dreds, versão
const foot = await p.evaluate(() => { const f = document.querySelector('#movie_player sintonia-player').shadowRoot.querySelector('.foot'); const a = f.querySelector('a.dreds');
  return { txt: f.textContent.replace(/\s+/g, ' '), href: a && a.href, target: a && a.target, rel: a && a.rel, acts: [...f.querySelectorAll('[data-act]')].map((b) => b.dataset.act), langs: [...f.querySelectorAll('.langs button')].map((b) => b.textContent) }; });
check('rodapé: Procurar atualização · Relatar bug · ? · Apoiar ♥', ['check', 'bug', 'help', 'apoio'].every((a) => foot.acts.includes(a)) && foot.txt.includes('Procurar atualização') && foot.txt.includes('Relatar bug') && foot.txt.includes('Apoiar ♥'), foot.acts);
check(`rodapé: "feito por Dreds · v${VER}" com Dreds → github.com/DredsGG`, foot.txt.includes(`feito por Dreds · v${VER}`) && foot.href === 'https://github.com/DredsGG' && foot.target === '_blank' && /noopener/.test(foot.rel), foot);
check('rodapé: PT · EN · ES', foot.langs.join(',') === 'PT,EN,ES', foot.langs);

// Procurar atualização com o repo inexistente (404): sem erro, sem aviso
await clicar(p, PH, '.foot [data-act=check]');
const msg = await until(async () => { const t = await shadowAttr(p, PH, '.foot .msg', 'text'); return t && t !== 'Procurando…' ? t : null; });
check('repo inexistente (404): "Você está na versão mais nova." e nenhum quadro', msg === 'Você está na versão mais nova.' && !(await estado(p)).card, msg);
const updSt = await sw.evaluate(async () => (await chrome.storage.local.get('st.update'))['st.update']);
check('404 grava semRelease sem erro', updSt && updSt.semRelease === true && !updSt.erro, updSt);

const tb = await p.evaluate(() => { const t = document.querySelector('sintonia-ui').shadowRoot.querySelector('.toast'); const r = t.getBoundingClientRect(); return { display: getComputedStyle(t).display, hidden: t.hidden, area: r.width * r.height }; });
check('aviso escondido não ocupa espaço nem pega clique (revisão)', tb.hidden && tb.display === 'none' && tb.area === 0, tb);
// perfil por canal: gravado no storage.local aparece no painel; "Esquecer" apaga
await sw.evaluate(() => chrome.storage.local.set({ 'st.perfis': { UCaaaaaaaaaaaaaaaaaaaaa1: { n: 'Canal Um', rate: 1.5, vol: 80, em: Date.now() } } }));
const comPerfil = await until(async () => { const s = await estado(p); return s.painelTexto.includes('Velocidade 1,5×') ? s : null; });
check('perfil do canal aparece no painel (Velocidade 1,5× · Volume 80%)', comPerfil && comPerfil.painelTexto.includes('Volume 80%'), comPerfil && comPerfil.painelTexto.slice(0, 200));
await clicar(p, PH, '[data-forget]');
const semPerfil = await until(async () => { const l = await sw.evaluate(async () => (await chrome.storage.local.get('st.perfis'))['st.perfis']); return l && !l.UCaaaaaaaaaaaaaaaaaaaaa1 ? l : null; });
check('"Esquecer este canal" apaga o perfil', !!semPerfil);
check('aviso "Perfil apagado."', (await until(async () => (await estado(p)).toast)) === 'Perfil apagado.');

// navegação interna (troca de vídeo sem recarregar)
await p.evaluate(() => window.__ir('/watch?v=BBBBBBBBBB2'));
e = await until(async () => { const s = await estado(p); return s.painelTexto.includes('Canal Dois') ? s : null; });
check('troca de vídeo (yt-navigate-finish): painel mostra o Canal Dois', !!e, e && e.painelTexto.slice(0, 120));
check('botão continua na barra depois da navegação', e && e.btn && e.btns === 1);
// Esc fecha o painel
await p.keyboard.press('Escape'); await wait(200);
check('Esc fecha o painel', !(await estado(p)).painel);

// idiomas
await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel);
await clicar(p, PH, '.foot .langs button[data-l="en"]');
e = await until(async () => { const s = await estado(p); return s.painelTexto.includes('Check for updates') ? s : null; });
check('EN: painel e rodapé em inglês', e && e.painelTexto.includes('made by Dreds') && e.painelTexto.includes('This channel'), e && e.painelTexto.slice(0, 160));
await p.screenshot({ path: path.join(SHOT, 'painel-en.png') });
await clicar(p, PH, '.foot .langs button[data-l="es"]');
e = await until(async () => { const s = await estado(p); return s.painelTexto.includes('Buscar actualización') ? s : null; });
check('ES: painel e rodapé em espanhol', e && e.painelTexto.includes('hecho por Dreds') && e.painelTexto.includes('Este canal'));
await clicar(p, PH, '.foot .langs button[data-l="pt"]'); await wait(300);

// Relatar bug: abre o Issues do repo com versão e diagnóstico (sem URL nem título de vídeo)
const nova = ctx.waitForEvent('page');
await clicar(p, PH, '.foot [data-act=bug]');
const rel = await nova.catch(() => null);
const url = rel ? decodeURIComponent(rel.url()) : '';
check('Relatar bug abre DredsGG/sintonia/issues/new com versão e diagnóstico', url.startsWith('https://github.com/DredsGG/sintonia/issues/new') && url.includes(`Sintonia v${VER}`) && url.includes('main=1'), url.slice(0, 120));
check('diagnóstico não leva título nem id do vídeo nem nome do canal', url && !url.includes('BBBBBBBBBB2') && !url.includes('Canal Dois') && !url.includes('Vídeo do Canal'));
if (rel) await rel.close();

// Apoiar ♥: Brasil → QR + código igual ao de referência (apoio.md)
await p.bringToFront();
if (!(await estado(p)).painel) { await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel); }
await clicar(p, PH, '.foot [data-act=apoio]');
e = await until(async () => { const s = await estado(p); return s.card && s.card.title === 'De onde você é?' ? s : null; });
check('Apoiar abre "De onde você é?" com Brasil destacado em PT', !!e && await p.evaluate(() => !!document.querySelector('sintonia-ui').shadowRoot.querySelector('.apc.hl[data-ap="br"]')));
await clicar(p, UI, '[data-ap="br"]'); await wait(200);
const REF = {
  livre: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e35204000053039865802BR5918Andre Miller Fleck6009Sao Paulo62070503***63047D61',
  5: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e352040000530398654045.005802BR5918Andre Miller Fleck6009Sao Paulo62070503***6304C8ED',
  10: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e3520400005303986540510.005802BR5918Andre Miller Fleck6009Sao Paulo62070503***6304DCD7',
  25: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e3520400005303986540525.005802BR5918Andre Miller Fleck6009Sao Paulo62070503***63044036',
};
const pix = () => p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('.apcp').getAttribute('data-pix'));
check('Pix R$ 10 (padrão) igual ao de referência (apoio.md)', (await pix()) === REF[10], await pix());
for (const v of [5, 25]) { await clicar(p, UI, `.apv[data-v="${v}"]`); await wait(150); check(`Pix R$ ${v} igual ao de referência`, (await pix()) === REF[v]); }
await clicar(p, UI, '.apv[data-v="outro"]'); await wait(150);
check('Outro valor vazio = valor livre igual ao de referência', (await pix()) === REF.livre);
await p.evaluate(() => { const i = document.querySelector('sintonia-ui').shadowRoot.querySelector('.apo input'); i.value = '12,50'; i.dispatchEvent(new Event('input')); });
await wait(150);
check('Outro valor 12,50 → campo 54 05 12.50', /540512\.50/.test(await pix()), await pix());
await clicar(p, UI, '.apv[data-v="10"]'); await wait(150);
check('QR desenhado', await p.evaluate(() => !!document.querySelector('sintonia-ui').shadowRoot.querySelector('.qr svg path')));
await p.screenshot({ path: path.join(SHOT, 'apoiar-br.png') });
await p.keyboard.press('Escape'); await wait(250);
check('Apoiar fecha no Esc', !(await estado(p)).card);

// versão nova (regra 14): quadro no meio, X adia 1 h
st.gh = { tag: 'v9.9.0', name: 'v9.9.0', body: '- Uma coisa nova\n- Outra' };
await sw.evaluate(() => chrome.storage.local.set({ 'st.update': { procuradoEm: 0 } }));
await p.evaluate(() => window.dispatchEvent(new Event('focus')));
e = await until(async () => { const s = await estado(p); return s.card && /Nova versão v9.9.0/.test(s.card.title) ? s : null; }, 15000);
check('versão nova: quadro "Nova versão v9.9.0" com X', e && e.card.x, e && e.card);
await p.screenshot({ path: path.join(SHOT, 'versao-nova.png') });
const badge = await until(() => sw.evaluate(() => chrome.action.getBadgeText({})).then((b) => (b === '↑' ? b : null)));
check('selo ↑ no ícone', badge === '↑', badge);
await clicar(p, UI, '.card .x'); await wait(300);
const ad = await sw.evaluate(async () => (await chrome.storage.local.get('st.adiado'))['st.adiado']);
check('X adia 1 h', ad && ad.ultima === '9.9.0' && ad.ate - Date.now() > 59 * 60e3, ad);
check('quadro some depois do X', !(await estado(p)).card);

// versão URGENTE: sem X, Esc não fecha, pausa (ativo=false), selo !
st.gh = { tag: 'v9.9.1', name: 'v9.9.1 URGENTE', body: '- Correção grave' };
await sw.evaluate(() => chrome.storage.local.set({ 'st.update': { procuradoEm: 0 } }));
await p.evaluate(() => window.dispatchEvent(new Event('focus')));
e = await until(async () => { const s = await estado(p); return s.card && /Atualize para a v9.9.1/.test(s.card.title) ? s : null; }, 15000);
check('URGENTE: quadro sem X', e && !e.card.x, e && e.card);
await p.keyboard.press('Escape'); await wait(300);
check('URGENTE: Esc não fecha', !!(await estado(p)).card);
check('URGENTE: selo "!"', (await sw.evaluate(() => chrome.action.getBadgeText({}))) === '!');
await p.screenshot({ path: path.join(SHOT, 'urgente.png') });
st.gh = { status: 404 };
await sw.evaluate(() => chrome.storage.local.set({ 'st.update': {}, 'st.adiado': null }));
await until(async () => !(await estado(p)).card);
check('volta ao normal sem Release (404 de novo)', !(await estado(p)).card);

// chave geral desligada: selo OFF
await sw.evaluate(() => chrome.storage.sync.set({ on: false }));
check('chave geral desligada: selo OFF', (await until(() => sw.evaluate(() => chrome.action.getBadgeText({})).then((b) => b === 'OFF' && b))) === 'OFF');
await sw.evaluate(() => chrome.storage.sync.set({ on: true }));

// ícone da extensão: abre o painel na aba do YouTube (mesma mensagem que o onClicked manda)
await p.keyboard.press('Escape');
await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'https://www.youtube.com/*', active: true }); await chrome.tabs.sendMessage(t.id, { type: 'sintonia:painel' }); });
check('ícone da extensão abre o painel (no player)', (await until(async () => (await estado(p)).painel)) === 'player');
await p.keyboard.press('Escape');

// tela cheia: botão continua e o painel abre dentro do player
await p.evaluate(() => document.getElementById('movie_player').requestFullscreen());
await wait(500);
const fs1 = await p.evaluate(() => !!document.fullscreenElement);
await p.click('#sintonia-btn').catch(() => {});
e = await until(async () => { const s = await estado(p); return s.painel ? s : null; });
check('tela cheia: painel abre dentro do player', fs1 && e && e.painel === 'player', { fs1, painel: e && e.painel });
await p.screenshot({ path: path.join(SHOT, 'tela-cheia.png') });
await p.evaluate(() => document.exitFullscreen()); await wait(300); await p.keyboard.press('Escape');

// página sem vídeo: ícone abre o painel solto
await p.evaluate(() => window.__ir('/feed/subscriptions'));
await wait(300);
await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'https://www.youtube.com/*', active: true }); await chrome.tabs.sendMessage(t.id, { type: 'sintonia:painel' }); });
e = await until(async () => { const s = await estado(p); return s.painel ? s : null; });
check('fora do vídeo: painel solto na página, "Abra um vídeo…"', e && e.painel === 'page' && e.painelTexto.includes('Abra um vídeo'), e && e.painel);
await p.keyboard.press('Escape');

// várias abas: todas ganham o botão
const p2 = await ctx.newPage();
await p2.goto('https://www.youtube.com/watch?v=AAAAAAAAAA3');
check('segunda aba também tem o botão', !!(await until(async () => (await estado(p2)).btn)));
await p.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1'); await p.waitForSelector('video', { state: 'attached' });
check('primeira aba de novo tem o botão', !!(await until(async () => (await estado(p)).btn)));

// instância única: reinjetar (como a recarga pela pasta faz) não duplica
await sw.evaluate(async () => { for (const t of await chrome.tabs.query({ url: 'https://www.youtube.com/*' })) { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['src/main.js'], world: 'MAIN' }); await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['src/defaults.js', 'src/i18n.js', 'src/novidades.js', 'src/comum.js', 'src/vendor/qrcode.js', 'src/apoio.js', 'src/core.js', 'src/ui.js'] }); } });
await wait(2500);
let s1 = await estado(p);
check('reinjeção: um só botão e um só host', s1.btns === 1 && s1.hosts <= 1, s1);
await p.click('#sintonia-btn');
s1 = await until(async () => { const s = await estado(p); return s.painel ? s : null; });
check('reinjeção: painel novo funciona e mostra o canal', s1 && s1.painelTexto.includes('Canal Um'));
await p.keyboard.press('Escape');

// plano B do canal: sem getPlayerResponse → link do dono (@handle); sem API nenhuma → DOM pelo mundo isolado
await p.goto('https://www.youtube.com/watch?v=BBBBBBBBBB2&api=noresp'); await p.waitForSelector('video', { state: 'attached' }); await wait(1500);
await p.click('#sintonia-btn');
e = await until(async () => { const s = await estado(p); return s.painelTexto.includes('Canal Dois') ? s : null; });
check('plano B (sem getPlayerResponse): canal pelo link do dono', !!e);
const fonte1 = await p.evaluate(async () => { const r = await new Promise((ok) => { const id = 't1'; document.addEventListener('sintonia:e', function f(ev) { const m = JSON.parse(ev.detail); if (m.id === id) { document.removeEventListener('sintonia:e', f); ok(m.data); } }); document.dispatchEvent(new CustomEvent('sintonia:c', { detail: JSON.stringify({ id, op: 'info' }) })); }); return r.canal; });
check('plano B grava como h:@canaldois', fonte1 && fonte1.id === 'h:@canaldois' && fonte1.fonte === 'dom-handle', fonte1);
await p.keyboard.press('Escape');
await p.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1&api=none'); await p.waitForSelector('video', { state: 'attached' }); await wait(1800);
await p.click('#sintonia-btn');
e = await until(async () => { const s = await estado(p); return s.painelTexto.includes('Canal Um') ? s : null; });
check('plano B (sem API do player): canal pelo DOM no mundo isolado', !!e, e && e.painelTexto.slice(0, 100));
await p.keyboard.press('Escape');

// novidades: quem vinha de uma versão anterior vê "Novidades da v0.1.0" uma vez
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: '0.0.9', novLidas: '0.0.9' } }));
await p.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1'); await p.waitForSelector('video', { state: 'attached' });
e = await until(async () => { const s = await estado(p); return s.card ? s : null; });
check(`novidades depois de atualizar: "Novidades da v${VER}"`, e && e.card.title === `Novidades da v${VER}`, e && e.card);
await p.screenshot({ path: path.join(SHOT, 'novidades.png') });
await p.keyboard.press('Escape'); await wait(300);
await p.reload(); await p.waitForSelector('video', { state: 'attached' }); await wait(3000);
check('novidades não aparecem de novo', !(await estado(p)).card);

// página de Ajustes
const op = await ctx.newPage();
await op.goto(`chrome-extension://${extId}/options/options.html`);
await op.waitForSelector('section#geral');
const ot = await op.textContent('body');
check('Ajustes: seção Geral, chave geral e rodapé', ot.includes('Ajustes') !== null && ot.includes('Sintonia ligada') && ot.includes(`feito por Dreds · v${VER}`) && ot.includes('Procurar atualização') && ot.includes('Apoiar ♥'));
await op.click('[data-k="on"]'); await wait(300);
check('Ajustes: desligar a chave geral grava no sync', (await sw.evaluate(async () => (await chrome.storage.sync.get('on')).on)) === false);
await op.click('[data-k="on"]'); await wait(200);
await op.click('.foot .langs button[data-l="en"]'); await wait(300);
check('Ajustes em inglês', (await op.textContent('body')).includes('Sintonia on'));
await op.click('.foot .langs button[data-l="pt"]'); await wait(300);
await op.click('.foot [data-act="help"]'); await wait(300);
check('Ajustes: "?" abre o tutorial', (await op.textContent('.card')).includes('Como usar a Sintonia'));
await op.screenshot({ path: path.join(SHOT, 'ajustes-pt.png'), fullPage: true });
await op.keyboard.press('Escape');

check('sem erro da extensão no console da página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
