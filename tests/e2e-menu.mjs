// v0.10.0: menu flutuante (botão redondo + abas Agora/Ajustes com explicação) e comentários em "Mais recentes". Uso: node e2e-menu.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, SHOT, UI } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw } = await abrir();
await rotas(ctx);
await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const getSync = (k) => sw.evaluate((k) => chrome.storage.sync.get(k).then((r) => r[k]), k);
const fab = () => p.evaluate(() => {
  const h = document.querySelector('sintonia-ui'), f = h && h.shadowRoot.querySelector('.fab');
  if (!f || f.hidden) return null;
  const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, left: r.left, right: innerWidth - r.right, bottom: innerHeight - r.bottom, exp: f.getAttribute('aria-expanded'), title: f.title };
});
const pn = () => p.evaluate(() => {
  const r = document.querySelector('sintonia-ui').shadowRoot, el = r.querySelector('.fpanel .pn');
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { top: b.top, bottom: b.bottom, right: innerWidth - b.right, aba: (el.querySelector('.abas [aria-selected=true]') || {}).textContent,
    secoes: [...el.querySelectorAll('.sech')].map((s) => ({ id: s.dataset.sec, aberta: s.getAttribute('aria-expanded') === 'true' })),
    explic: [...el.querySelectorAll('.row .lb small')].map((s) => s.textContent), texto: el.textContent };
});
const naUI = (sel) => p.evaluate((s) => { const e = document.querySelector('sintonia-ui').shadowRoot.querySelector(s); if (!e) return false; e.click(); return true; }, sel);

// 1) botão flutuante aparece em qualquer página do YouTube, no canto de baixo à direita
await p.goto('https://www.youtube.com/feed/subscriptions');
await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
let f = await until(fab, 20000);
check('botão flutuante aparece (ligado de fábrica, é o menu da Sintonia)', !!f, f);
check('fica no canto de baixo à direita (24 px)', f && Math.abs(f.right - 24) <= 1 && Math.abs(f.bottom - 24) <= 1, f);
check('tem dica dizendo o que é', f && /Sintonia/.test(f.title), f && f.title);

// 2) clique abre o menu ancorado nele (em cima do botão), aba "Agora"
await p.mouse.click(f.x, f.y);
let m = await until(pn);
check('clique abre o menu', !!m);
check('menu abre em cima do botão, alinhado à direita', m && m.bottom <= f.top && m.bottom >= f.top - 16 && Math.abs(m.right - f.right) <= 2, m && { bottom: m.bottom, fabTop: f.top, right: m.right });
check('abre na aba "Agora"', m && m.aba === 'Agora', m && m.aba);
check('botão mostra que o menu está aberto (aria-expanded)', (await fab()).exp === 'true');
await p.screenshot({ path: path.join(SHOT, 'menu-agora.png') });

// 3) aba Ajustes: todas as seções, Geral aberta, cada chave com explicação
await naUI('.abas [data-aba="ajustes"]');
m = await until(async () => { const x = await pn(); return x && x.aba === 'Ajustes' ? x : null; });
check('aba "Ajustes" mostra as 13 seções (com Perfil por canal e Comentários separados)', m && m.secoes.length === 13 && m.secoes.some((s) => s.id === 'canal') && m.secoes.some((s) => s.id === 'comentarios'), m && m.secoes.map((s) => s.id));
check('seção Geral vem aberta, com explicação em cada linha', m && m.secoes[0].aberta && m.explic.length >= 3 && m.explic.some((t) => /parar tudo/.test(t)), m && m.explic);
check('aviso "Tudo vem desligado de fábrica" no topo', m && /desligado de fábrica/.test(m.texto));
await naUI('[data-sec="comentarios"]');
m = await until(async () => { const x = await pn(); return x && x.secoes.find((s) => s.id === 'comentarios' && s.aberta) ? x : null; });
check('clicar numa seção abre (acordeão)', !!m);
check('seção Comentários: "Ordem dos comentários" com Mais recentes / Principais e explicação', m && /Ordem dos comentários/.test(m.texto) && /Mais recentes/.test(m.texto) && /Principais/.test(m.texto) && m.explic.some((t) => /ordem/i.test(t)));
// a rolagem não volta para o topo quando muda um ajuste (relato do André)
const rolar = (y) => p.evaluate((y) => { const sc = document.querySelector('sintonia-ui').shadowRoot.querySelector('.fpanel .sc'); sc.scrollTop = y; return sc.scrollTop; }, y);
const rolado = await rolar(120);
await p.evaluate(() => { const s = document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-ajs="comentOrdem"]'); s.value = 'recentes'; s.dispatchEvent(new Event('change')); });
check('seleção grava (comentOrdem = recentes)', !!(await until(async () => (await getSync('comentOrdem')) === 'recentes')));
await wait(400);
const depoisRolar = await p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('.fpanel .sc').scrollTop);
check('mudar um ajuste não joga o menu para o topo', rolado > 0 && Math.abs(depoisRolar - rolado) <= 2, { rolado, depoisRolar });
// busca
await p.evaluate(() => { const i = document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-busca]'); i.value = 'comentarios'; i.dispatchEvent(new Event('input')); });
m = await until(async () => { const x = await pn(); return x && x.secoes.length && x.secoes.length < 13 ? x : null; });
check('busca "comentarios" (sem acento) acha a seção Comentários e o "Esconder comentários"', m && m.secoes.some((s) => s.id === 'comentarios') && /Esconder comentários/.test(m.texto), m && m.secoes.map((s) => s.id));
check('busca mantém o foco no campo', await p.evaluate(() => { const r = document.querySelector('sintonia-ui').shadowRoot; return r.activeElement && r.activeElement.hasAttribute('data-busca'); }));
await p.evaluate(() => { const i = document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-busca]'); i.value = 'xyzxyz'; i.dispatchEvent(new Event('input')); });
check('busca sem resultado avisa', !!(await until(async () => /Nenhum ajuste/.test((await pn()).texto))));
await p.evaluate(() => { const i = document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-busca]'); i.value = ''; i.dispatchEvent(new Event('input')); });
await naUI('[data-sec="video"]'); await until(async () => (await pn()).secoes.find((s) => s.id === 'video' && s.aberta));
check('padrões que o perfil do canal substitui têm a marca "por canal"', await p.evaluate(() => /por canal/.test(document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-ajn="velPadrao"]').closest('.row').textContent)));
await p.evaluate(() => { const i = document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-ajn="velPadrao"]'); i.value = '1.5'; i.dispatchEvent(new Event('change')); });
check('número no menu grava (velocidade padrão 1,5)', !!(await until(async () => (await getSync('velPadrao')) === 1.5)));
await p.evaluate(() => { const i = document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-ajn="velPadrao"]'); i.value = '99'; i.dispatchEvent(new Event('change')); });
check('número fora do limite é cortado no máximo (16)', !!(await until(async () => (await getSync('velPadrao')) === 16)));
await p.evaluate(() => { const s = document.querySelector('sintonia-ui').shadowRoot.querySelector('[data-ajs="qualPadrao"]'); s.value = 'hd720'; s.dispatchEvent(new Event('change')); });
check('seleção no menu grava (qualidade 720p)', !!(await until(async () => (await getSync('qualPadrao')) === 'hd720')));
await naUI('[data-sec="canal"]'); await until(async () => (await pn()).secoes.find((s) => s.id === 'canal' && s.aberta));
check('item extra leva à página completa de Ajustes', await p.evaluate(() => !!document.querySelector('sintonia-ui').shadowRoot.querySelector('.secc [data-act="opts"]')));
await p.screenshot({ path: path.join(SHOT, 'menu-ajustes.png') });

// 4) clique fora fecha; Esc também
await p.mouse.click(400, 300);
check('clique fora fecha o menu', !!(await until(async () => !(await pn()))));
f = await fab(); await p.mouse.click(f.x, f.y); await until(pn);
await p.keyboard.press('Escape');
check('Esc fecha o menu', !!(await until(async () => !(await pn()))));

// 5) arrastar muda de lugar, lembra depois de recarregar e não abre o menu
f = await fab();
await p.mouse.move(f.x, f.y); await p.mouse.down(); await p.mouse.move(f.x - 150, f.y - 120, { steps: 6 }); await p.mouse.move(f.x - 300, f.y - 240, { steps: 6 }); await p.mouse.up();
const f2 = await fab();
check('arrastar move o botão', f2 && Math.abs(f2.right - (f.right + 300)) <= 3 && Math.abs(f2.bottom - (f.bottom + 240)) <= 3, f2);
check('arrastar não abre o menu', !(await pn()));
const salvo = await until(() => sw.evaluate(async () => (await chrome.storage.local.get('st.fab'))['st.fab']));
check('posição guardada (st.fab)', salvo && Math.abs(salvo.r - f2.right) <= 2, salvo);
await p.goto('https://www.youtube.com/feed/subscriptions'); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
const f3 = await until(fab, 20000);
check('depois de recarregar, volta no mesmo lugar', f3 && Math.abs(f3.right - f2.right) <= 2 && Math.abs(f3.bottom - f2.bottom) <= 2, f3);
await p.mouse.click(f3.x, f3.y); m = await until(pn);
check('com o botão no meio da tela, o menu continua inteiro na tela', m && m.top >= 0 && m.right >= 0, m && { top: m.top, bottom: m.bottom });
await p.keyboard.press('Escape');
await sw.evaluate(() => chrome.storage.local.remove('st.fab'));

// 6) página de vídeo: não fica em cima do player; aba Agora só com o que está ligado, em "Este vídeo" e "Este canal · perfil"
await setSync({ comentOrdem: '' });
await p.goto('https://www.youtube.com/watch?v=AAAAAAAAAA1'); await p.waitForSelector('video', { state: 'attached' }); await wait(2500);
f = await fab();
const sobre = await p.evaluate((f) => { if (!f) return false; const a = document.getElementById('movie_player').getBoundingClientRect(); return f.x > a.left && f.x < a.right && f.y > a.top && f.y < a.bottom; }, f);
check('no vídeo: botão nunca fica em cima do player', !sobre, f);
check('comentários: desligado de fábrica não mexe na ordem', (await p.evaluate(() => window.__mock.ordemCliques)) === 0);
const agora = () => p.evaluate(() => { const r = document.querySelector('#movie_player sintonia-player'); const pn = r && r.shadowRoot.querySelector('.pn'); if (!pn) return null; return { grupos: [...pn.querySelectorAll('.grp > h3')].map((h) => h.textContent), blocos: [...pn.querySelectorAll('.blk')].map((b) => b.dataset.b), chaves: pn.querySelectorAll('.sc [role=switch]').length, texto: pn.textContent }; });
await p.click('#sintonia-btn'); let ag = await until(agora);
check('tudo desligado: aba Agora sem chaves de recursos desligados (nem Filtros, nem Esconder)', ag && ag.chaves === 0 && !ag.blocos.includes('imagem') && !ag.blocos.includes('esconder'), ag);
check('tudo desligado: diz para ligar na aba Ajustes', ag && /aba Ajustes/.test(ag.texto));
await p.keyboard.press('Escape');
await setSync({ perfilCanal: true, velocidade: true, filtros: true, screenshot: true, loopAB: true, popup: true, velPadrao: 1 }); // velPadrao volta a 1: o teste do limite (seção 3) deixou 16× e a extensão reaplica esse padrão, o que disputava com o 1× do 6b
await wait(800); await p.click('#sintonia-btn'); ag = await until(async () => { const x = await agora(); return x && x.grupos.length === 2 ? x : null; });
check('com recursos ligados: grupos "Este vídeo" e "Este canal · perfil"', ag && ag.grupos[0] === 'Este vídeo' && ag.grupos[1] === 'Este canal · perfil', ag && ag.grupos);
check('Este vídeo: velocidade, filtros e foto; Este canal: o perfil salvo', ag && ag.blocos.includes('vel') && ag.blocos.includes('imagem') && ag.blocos.includes('player2') && ag.blocos.includes('canal'), ag && ag.blocos);
check('velocidade avisa que fica salva para o canal', ag && /fica salvo para este canal/.test(ag.texto));
await p.screenshot({ path: path.join(SHOT, 'menu-agora-video.png') });
await p.keyboard.press('Escape');

// 6b) barra do player: 1× muda a velocidade no clique; Repetir, A–B, foto e janela só com o recurso ligado
const barraP = () => p.evaluate(() => [...(document.getElementById('sintonia-btn') || { parentElement: { children: [] } }).parentElement.children].map((b) => b.id || b.className.split(' ')[0]).filter((x) => /sintonia|settings/.test(x)));
const bp = await until(async () => { const x = await barraP(); return x.includes('sintonia-b-foto') ? x : null; });
check('botões na barra: Repetir, A–B, foto, janela, depois 1× e Sintonia', bp && bp.join() === 'sintonia-b-loop,sintonia-b-ab,sintonia-b-foto,sintonia-b-popup,sintonia-vel,sintonia-btn', bp);
const rate = () => p.evaluate(() => document.querySelector('video').playbackRate);
await p.evaluate(() => { document.querySelector('video').playbackRate = 1; });
await p.click('#sintonia-vel');
check('clique no 1× sobe a velocidade (1 → 1,25) e não abre o painel', !!(await until(async () => (await rate()) === 1.25)) && !(await agora()));
await p.click('#sintonia-vel'); await until(async () => (await rate()) === 1.5);
await p.click('#sintonia-vel', { button: 'right' });
check('botão direito no 1× desce (1,5 → 1,25)', !!(await until(async () => (await rate()) === 1.25)));
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 5; });
await p.click('#sintonia-b-ab'); await wait(300);
check('A–B: 1º clique marca o início (mostra "A 0:05")', /^A 0:0[45]$/.test(await p.evaluate(() => document.getElementById('sintonia-b-ab').textContent)), await p.evaluate(() => document.getElementById('sintonia-b-ab').textContent));
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 12; });
await p.click('#sintonia-b-ab'); await wait(300);
check('A–B: 2º clique marca o fim e repete o trecho', /^0:0[45]–0:1[12]$/.test(await p.evaluate(() => document.getElementById('sintonia-b-ab').textContent)), await p.evaluate(() => [document.getElementById('sintonia-b-ab').textContent, document.getElementById('sintonia-b-ab').title]));
await p.click('#sintonia-b-ab'); await wait(300);
check('A–B: 3º clique desliga', (await p.evaluate(() => document.getElementById('sintonia-b-ab').textContent)) === 'A–B');
await p.click('#sintonia-b-loop'); await wait(300);
check('Repetir: liga e fica azul (aria-pressed)', await p.evaluate(() => document.getElementById('sintonia-b-loop').getAttribute('aria-pressed') === 'true' && document.querySelector('video').loop));
await p.click('#sintonia-b-loop'); await wait(200);
await setSync({ loopAB: false, screenshot: false, popup: false, filtros: false, perfilCanal: false, velocidade: false });
check('desligar os recursos tira os botões da barra', !!(await until(async () => { const x = await barraP(); return !x.some((y) => /sintonia-b-/.test(y)) ? x : null; })));

// 7) comentários em "Mais recentes"
await setSync({ comentOrdem: 'recentes' });
await p.goto('https://www.youtube.com/watch?v=AAAAAAAAAA3'); await p.waitForSelector('video', { state: 'attached' });
const ord = await until(() => p.evaluate(() => (document.getElementById('o-rec').getAttribute('aria-selected') === 'true' ? window.__mock.ordemCliques : 0)), 15000);
check('ligado: comentários passam para "Mais recentes" (1 clique)', ord === 1, ord);
await p.click('#o-top'); await wait(3000);
check('se a pessoa volta para "Principais", a Sintonia respeita (não clica de novo no mesmo vídeo)', (await p.evaluate(() => [window.__mock.ordemCliques, document.getElementById('o-top').getAttribute('aria-selected')])).join() === '2,true');
await p.evaluate(() => window.__ir('/watch?v=AAAAAAAAAA1'));
check('troca de vídeo: ordena de novo no vídeo novo', !!(await until(() => p.evaluate(() => window.__mock.ordemCliques >= 1 && document.getElementById('o-rec').getAttribute('aria-selected') === 'true'), 15000)));
await setSync({ comentOrdem: 'principais' });
check('"Principais": volta para Principais na hora', !!(await until(() => p.evaluate(() => document.getElementById('o-top').getAttribute('aria-selected') === 'true'), 8000)));
await setSync({ comentOrdem: '' });

// 7b) revisão da 1.0: teclado, posição presa à janela, página de Ajustes mantém a busca
await p.goto('https://www.youtube.com/feed/subscriptions'); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
await until(fab, 20000);
await p.evaluate(() => document.querySelector('sintonia-ui').shadowRoot.querySelector('.fab').focus()); await p.keyboard.press('Enter');
check('Enter no botão flutuante abre o menu (teclado)', !!(await until(pn, 5000)));
await p.keyboard.press('Escape');
await sw.evaluate(() => chrome.storage.local.set({ 'st.fab': { r: 5000, b: 5000 } }));
await p.goto('https://www.youtube.com/feed/subscriptions'); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
const fp = await until(fab, 20000);
check('posição salva fora da janela: o botão fica preso dentro dela', fp && fp.left >= 0 && fp.top >= 0 && fp.right >= 0 && fp.bottom >= 0, fp);
await sw.evaluate(() => chrome.storage.local.remove('st.fab'));
const op = await ctx.newPage(); await op.goto('chrome-extension://' + sw.url().split('/')[2] + '/options/options.html');
await op.waitForSelector('[data-busca]');
await op.fill('[data-busca]', 'velocidade');
const visiveis = () => op.evaluate(() => [...document.querySelectorAll('main section')].filter((s) => !s.hidden).map((s) => s.id));
const v1 = await visiveis();
await op.click('.itw:not([hidden]) [data-k="velocidade"]'); await wait(800);
const v2 = await visiveis();
check('página de Ajustes: mudar um ajuste não apaga a busca', (await op.inputValue('[data-busca]')) === 'velocidade' && JSON.stringify(v1) === JSON.stringify(v2) && v2.length < 13, { v1, v2 });
check('… e grava (velocidade ligada)', (await getSync('velocidade')) === true);
await setSync({ velocidade: false }); await op.close();

// 8) inglês e chave desligada
await setSync({ lang: 'en' }); await p.goto('https://www.youtube.com/feed/subscriptions'); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
f = await until(fab, 20000); await p.mouse.click(f.x, f.y); m = await until(pn);
check('EN: abas "Now" e "Settings"', m && /Now/.test(m.texto) && /Settings/.test(m.texto), m && m.aba);
await p.keyboard.press('Escape'); await setSync({ lang: '' });
await setSync({ botaoFlutuante: false });
check('desligar "Botão flutuante" some com ele', !!(await until(async () => !(await fab()))));
await setSync({ botaoFlutuante: true });
check('ligar de novo: volta', !!(await until(fab)));

check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
