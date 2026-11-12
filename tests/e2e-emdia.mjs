// Fase 1 (v0.2.0): Em Dia. Uso: node e2e-emdia.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';
import { esperado, FEED } from './mock-inscricoes.mjs';

const { ctx, sw } = await abrir();
const st = await rotas(ctx);
await esperarGuia(ctx); // o onInstalled (lento num PC carregado) grava o onboard; só depois o teste mexe nele
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push(String(e)));
const ED = 'sintonia-emdia';
const ed = () => p.evaluate(() => {
  const h = document.querySelector('sintonia-emdia'), r = h && h.shadowRoot;
  const b = document.getElementById('sintonia-emdia-btn');
  if (!r || !h.isConnected) return { aberta: false, botao: !!b };
  const cards = [...r.querySelectorAll('.cd')].map((c) => ({ id: c.dataset.id, off: c.classList.contains('off'), selo: (c.querySelector('.selo') || {}).textContent || '' }));
  return { aberta: true, botao: !!b, cont: (r.querySelector('.cnt') || {}).textContent, st: (r.querySelector('.st') || {}).textContent, cards, ids: cards.map((c) => c.id),
    tab: (r.querySelector('.chip[role=tab][aria-selected=true]') || {}).textContent, vazio: (r.querySelector('.vazio') || {}).textContent || null, conf: !!r.querySelector('.conf') };
});
const clicar = (sel) => p.evaluate((s) => { const e = document.querySelector('sintonia-emdia').shadowRoot.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const quaseFim = async (s) => { await until(() => p.evaluate(() => { const v = document.querySelector('video'); return v && isFinite(v.duration) && v.duration > 5 && v.readyState >= 2; })); await p.evaluate((s) => { const v = document.querySelector('video'); v.currentTime = v.duration - s; v.play(); }, s); };
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const marcas = () => sw.evaluate(async () => (await chrome.storage.local.get('st.emdia'))['st.emdia'] || {});
const fila = () => sw.evaluate(async () => (await chrome.storage.local.get('st.fila'))['st.fila'] || null);
const ordemEst = (lst) => { const o = lst.map((x, i) => ({ ...x, i })); o.sort((a, b) => (b.min - a.min) || (a.i - b.i)); return o.map((x) => x.id); };

// 1) desligada (fábrica): Inscrições igual, sem botão
await p.goto('https://www.youtube.com/feed/subscriptions');
await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
await wait(2500);
let e = await ed();
check('Em Dia desligada de fábrica: sem botão e sem visão nas Inscrições', !e.botao && !e.aberta, e);
check('desligada: grade do YouTube intacta (30 itens + prateleira de Shorts)', (await p.evaluate(() => document.querySelectorAll('ytd-rich-item-renderer').length)) === 33);

// 2) liga → botão aparece antes da grade
await setSync({ emdia: true });
e = await until(async () => { const x = await ed(); return x.botao ? x : null; });
check('ligada: botão "Em Dia" aparece nas Inscrições', !!e);
check('botão fica no cabeçalho, logo antes de "Todas as inscrições"', await p.evaluate(() => { const b = document.getElementById('sintonia-emdia-btn'); return !!(b && b.nextElementSibling && b.nextElementSibling.id === 'subscribe-button' && b.closest('#title-container')); }));
check('botão alinhado com o cabeçalho (mesma linha, sem posição fixa)', await p.evaluate(() => { const b = document.getElementById('sintonia-emdia-btn'), s = document.getElementById('subscribe-button'); const rb = b.getBoundingClientRect(), rs = s.getBoundingClientRect(); return getComputedStyle(b).position !== 'fixed' && Math.abs((rb.top + rb.bottom) / 2 - (rs.top + rs.bottom) / 2) < 12 && rb.right <= rs.left + 1; }));
await p.screenshot({ path: path.join(SHOT, 'emdia-botao.png') });

// 3) abre: Hoje (24 h) com a contagem certa
await p.evaluate(() => document.getElementById('sintonia-emdia-btn').shadowRoot.querySelector('.edbtn').click());
e = await until(async () => { const x = await ed(); return x.aberta && x.cards.length && !/Carregando/.test(x.st) ? x : null; }, 20000);
const esp24 = esperado(24);
check('abre na aba "Hoje (24 h)"', e && e.tab === 'Hoje (24 h)', e && e.tab);
check(`Hoje: ${esp24.length} vídeos, sem live/estreia/agendado/Shorts`, e && JSON.stringify(e.ids.slice().sort()) === JSON.stringify(esp24.map((x) => x.id).sort()), e && { tem: e.ids.length, esp: esp24.length });
check('ordem: do mais antigo para o mais novo', e && JSON.stringify(e.ids) === JSON.stringify(ordemEst(esp24)), e && e.ids.slice(0, 4));
const conc24 = esp24.filter((x) => x.prog >= 90).length;
check(`contagem "${esp24.length - conc24} para ver · ${conc24} concluído" (barra ≥ 90% conta como concluído)`, e && e.cont === `${esp24.length - conc24} para ver · ${conc24} concluído`, e && e.cont);
check('vídeo com barra 95% aparece como "Visto" e apagado', e && e.cards.find((c) => c.id === FEED[4].id && c.off && c.selo === 'Visto'));
check('vídeo com barra 40% não conta como concluído', e && e.cards.find((c) => c.id === FEED[6].id && !c.off));
check('card mostra o nome do canal (link do canal, como no feed real)', await p.evaluate(() => { const c = document.querySelector('sintonia-emdia').shadowRoot.querySelector('.cd .mt'); return !!c && /^(Canal \d|Live Science|Estreia Games)/.test(c.textContent.trim()); }));
check('card mostra a foto do canal (img.ytSpecAvatarShapeImage, como no feed real)', await p.evaluate(() => /yt3\.ggpht\.com\/av-teste/.test((document.querySelector('sintonia-emdia').shadowRoot.querySelector('.cd img.av') || {}).src || '')));
await p.screenshot({ path: path.join(SHOT, 'emdia-hoje.png') });

// 4) 7 dias: carrega sozinha mais itens do feed (continuação) até passar de 7 dias
await clicar('.chip[data-per="168"]');
e = await until(async () => { const x = await ed(); return x.tab === '7 dias' && !/Carregando/.test(x.st) && x.cards.length > 40 ? x : null; }, 40000);
const esp7 = esperado(168);
check(`7 dias: carregou mais do feed sozinha (${esp7.length} vídeos)`, e && e.ids.length === esp7.length, e && { tem: e.ids.length, esp: esp7.length, st: e.st });
const cont = await p.evaluate(() => window.__mock.continuacoes);
check('7 dias: parou logo depois de passar do período (não leu o feed inteiro)', cont >= 1 && cont <= 2, { continuacoes: cont });
e = await (async () => { await clicar('.chip[data-per="72"]'); return until(async () => { const x = await ed(); return x.tab === '3 dias' ? x : null; }); })();
check(`3 dias: ${esperado(72).length} vídeos`, e && e.ids.length === esperado(72).length, e && e.ids.length);

// 5) chaves: lives, estreias, agendados, Shorts
await setSync({ emdiaLives: true, emdiaEstreias: true, emdiaAgendados: true, emdiaShorts: true });
const ch = { emdiaLives: 1, emdiaEstreias: 1, emdiaAgendados: 1, emdiaShorts: 1 };
e = await until(async () => { const x = await ed(); return x.ids.length === esperado(72, ch).length ? x : null; });
check('com as 4 chaves: entram live, transmissão, estreia, agendado e o Short com data', e && ['aoVivo', 'live', 'estreia', 'agendado', 'shorts'].every((t) => e.ids.includes(FEED.find((x) => x.tipo === t).id)), e && e.ids.length);
check('Shorts da prateleira (sem data) continuam fora', e && !e.ids.some((id) => id.startsWith('SHORTS')));
await setSync({ emdiaLives: false, emdiaEstreias: false, emdiaAgendados: false, emdiaShorts: false });
await until(async () => (await ed()).ids.length === esperado(72).length);

// 6) Não quero ver: apaga, selo Pulado, Desfazer, sai da contagem; nada é enviado ao YouTube
const alvo = FEED[3].id;
await clicar(`[data-skip="${alvo}"]`);
e = await until(async () => { const x = await ed(); const c = x.cards.find((y) => y.id === alvo); return c && c.selo === 'Pulado' ? x : null; });
check('"Não quero ver": card apagado com selo "Pulado"', e && e.cards.find((c) => c.id === alvo).off);
check('"Não quero ver": botão Desfazer no card', await p.evaluate((a) => !!document.querySelector('sintonia-emdia').shadowRoot.querySelector(`[data-undo="${a}"]`), alvo));
const esp72 = esperado(72), c72 = esp72.filter((x) => x.prog >= 90).length + 1;
check('sai da contagem como concluído', e && e.cont === `${esp72.length - c72} para ver · ${c72} concluídos`, e && e.cont);
check('marcação salva só no navegador (st.emdia)', (await marcas())[alvo] && (await marcas())[alvo].s === 'p');
check('nada enviado ao YouTube (sem "Não tenho interesse", sem feedback)', st.feedback === 0 && (await p.evaluate(() => window.__mock.menu)) === 0, { feedback: st.feedback });
await clicar(`[data-undo="${alvo}"]`);
e = await until(async () => { const x = await ed(); const c = x.cards.find((y) => y.id === alvo); return c && !c.off ? x : null; });
check('Desfazer volta o card e a contagem', !!e && !(await marcas())[alvo]);
await clicar(`[data-skip="${alvo}"]`); await wait(300);
// troca de aba: pulado some (Mostrar pulados desligado) e volta com a chave
await clicar('.chip[data-per="24"]'); await wait(300); await clicar('.chip[data-per="72"]');
e = await until(async () => { const x = await ed(); return x.tab === '3 dias' && !x.ids.includes(alvo) ? x : null; });
check('"Mostrar pulados" desligado: o pulado some da grade', !!e);
await clicar('[data-act="mostrar"]');
e = await until(async () => { const x = await ed(); return x.ids.includes(alvo) ? x : null; });
check('"Mostrar pulados" ligado: o pulado volta apagado', e && e.cards.find((c) => c.id === alvo).off);
await clicar('[data-act="mostrar"]'); await wait(300);

// 7) ordem invertida
await clicar('[data-act="ordem"]');
e = await until(async () => { const x = await ed(); return x.ids[0] === ordemEst(esp72.filter((y) => y.id !== alvo)).slice(-1)[0] ? x : null; });
check('chave de ordem: mais novo primeiro', !!e, e && e.ids.slice(0, 3));
await clicar('[data-act="ordem"]'); await wait(300);

// 8) Marcar todos como pulados, com confirmação
await clicar('[data-act="todos"]'); await wait(200);
check('"Marcar todos como pulados" pede confirmação', (await ed()).conf);
await clicar('[data-act="nao"]'); await wait(200);
check('Cancelar não marca nada', Object.values(await marcas()).filter((m) => m.s === 'p').length === 1);
// (o "sim" é conferido no fim, depois da fila)

// 9) persistência: recarregar a página mantém a marcação
await p.reload(); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
await until(async () => (await ed()).botao);
await p.evaluate(() => document.getElementById('sintonia-emdia-btn').shadowRoot.querySelector('.edbtn').click());
e = await until(async () => { const x = await ed(); return x.aberta && x.tab === '3 dias' && x.ids.length && !/Carregando/.test(x.st) ? x : null; }, 30000);
check('depois de recarregar: lembra a aba e o pulado continua fora', e && !e.ids.includes(alvo), e && e.tab);

// 10) Começar a assistir: playlist nativa /watch_videos com os que sobraram, na ordem
const restam = ordemEst(esp72.filter((x) => x.id !== alvo && x.prog < 90));
await clicar('[data-act="comecar"]');
await p.waitForURL(/\/watch\?v=.*list=TLGGmock/, { timeout: 30000 });
check('Começar a assistir abre /watch_videos com os restantes, na ordem', JSON.stringify(st.watchVideos[0]) === JSON.stringify(restam.slice(0, 50)), { ids: st.watchVideos[0] && st.watchVideos[0].length });
const barra = () => p.evaluate(() => { const b = document.getElementById('sintonia-fila'); const f = b && b.shadowRoot && b.shadowRoot.querySelector('.fb'); return f ? f.textContent.replace(/\s+/g, ' ').trim() : null; });
let b = await until(barra, 20000);
check(`barra da fila abaixo do player: "Em Dia 1/${restam.length} · Pular · Sair da fila"`, b && b.includes('Em Dia') && b.includes(`1/${restam.length}`) && b.includes('Pular') && b.includes('Sair da fila'), b);
check('barra fica fora do player (não cobre o vídeo)', await p.evaluate(() => { const b = document.getElementById('sintonia-fila').getBoundingClientRect(), m = document.getElementById('movie_player').getBoundingClientRect(); return b.top >= m.bottom - 1; }));
check('barra no fluxo da página: 1º item do #below, nunca fixa na tela', await p.evaluate(() => { const b = document.getElementById('sintonia-fila'); return b.parentElement.id === 'below' && b.parentElement.firstElementChild === b && getComputedStyle(b).position !== 'fixed'; }));
// o bug do relato (2026-11-11): a barra nascia sem lugar, ficava fixa no rodapé e depois cobria o like. Sem #below: some; com: volta no lugar.
await p.evaluate(() => { const bl = document.querySelector('ytd-watch-flexy #below'); window.__belowPai = bl.parentElement; window.__below = bl; bl.remove(); document.getElementById('sintonia-fila')?.remove(); });
await wait(2500);
check('sem lugar abaixo do player: não cria barra fixa por cima da página', await p.evaluate(() => { const b = document.getElementById('sintonia-fila'); return !b || (b.isConnected && getComputedStyle(b).position !== 'fixed' && b.parentElement.id === 'below'); }));
await p.evaluate(() => window.__belowPai.appendChild(window.__below));
check('quando o lugar aparece, a barra volta abaixo do player (sem posição fixa)', !!(await until(() => p.evaluate(() => { const b = document.getElementById('sintonia-fila'); return !!b && b.parentElement.id === 'below' && getComputedStyle(b).position === 'static'; }), 8000)));
await p.screenshot({ path: path.join(SHOT, 'fila-barra.png') });
await setSync({ emdia: false });
check('desligar a Em Dia com a fila andando: a barra some', !!(await until(async () => !(await barra()), 8000)));
await setSync({ emdia: true });
check('religar: a barra volta', !!(await until(barra, 8000)));
// fim do vídeo → próximo da fila; o que acabou conta como concluído
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${restam[1]}`), { timeout: 20000 });
b = await until(async () => { const x = await barra(); return x && x.includes(`2/${restam.length}`) ? x : null; });
check('no fim do vídeo vai para o próximo da fila (2/N)', !!b, b);
check('o vídeo que terminou conta como concluído', ((await marcas())[restam[0]] || {}).s === 'v');
// Pular → próximo e marca como pulado
await p.evaluate(() => document.getElementById('sintonia-fila').shadowRoot.querySelector('[data-f="pular"]').click());
await p.waitForURL(new RegExp(`v=${restam[2]}`), { timeout: 20000 });
check('Pular vai para o 3º e marca o 2º como pulado', ((await marcas())[restam[1]] || {}).s === 'p' && !!(await until(async () => { const x = await barra(); return x && x.includes(`3/${restam.length}`); })));
// velocidade/troca de vídeo: o painel mostra o bloco da fila
await p.click('#sintonia-btn');
check('painel mostra "Em Dia 3/N" com Pular e Sair (vale em tela cheia)', !!(await until(async () => { const s = await estado(p); return s.painelTexto.includes(`Em Dia 3/${restam.length}`) ? s : null; })));
await p.keyboard.press('Escape');
// Sair da fila → barra some; nas Inscrições, "Continuar (3/N)"
await p.evaluate(() => document.getElementById('sintonia-fila').shadowRoot.querySelector('[data-f="sair"]').click());
check('Sair da fila: a barra some', !!(await until(async () => !(await barra()))));
const f1 = await fila();
check('Sair guarda a posição', f1 && f1.ativa === false && f1.i === 2, f1 && { ativa: f1.ativa, i: f1.i });
await p.goto('https://www.youtube.com/feed/subscriptions'); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
await until(async () => (await ed()).botao);
await p.evaluate(() => document.getElementById('sintonia-emdia-btn').shadowRoot.querySelector('.edbtn').click());
const cont3 = await until(async () => p.evaluate(() => { const r = document.querySelector('sintonia-emdia'); const x = r && r.shadowRoot.querySelector('[data-act="continuar"]'); return x ? x.textContent.trim() : null; }));
check(`Em Dia oferece "Continuar (3/${restam.length})"`, cont3 === `Continuar (3/${restam.length})`, cont3);
await clicar('[data-act="continuar"]');
await p.waitForURL(new RegExp(`v=${restam[2]}`), { timeout: 30000 });
check('Continuar retoma do 3º', !!(await until(async () => { const x = await barra(); return x && x.includes(`3/${restam.length}`); })));

// 11) fim da fila: autoplay do YouTube não puxa vídeo de fora
await sw.evaluate(async (r) => { const f = (await chrome.storage.local.get('st.fila'))['st.fila']; f.ids = r.slice(0, 4); f.bloco = [0, 50]; await chrome.storage.local.set({ 'st.fila': f }); }, restam);
await p.goto(`https://www.youtube.com/watch_videos?video_ids=${restam.slice(0, 4).join(',')}`);
await p.waitForURL(/list=TLGGmock/);
await sw.evaluate(async () => { const f = (await chrome.storage.local.get('st.fila'))['st.fila']; f.i = 3; await chrome.storage.local.set({ 'st.fila': f }); });
await p.evaluate(() => document.getElementById('movie_player').playVideoAt(3));
await p.waitForURL(new RegExp(`v=${restam[3]}`));
await until(barra);
await quaseFim(1.2);
const avisoFim = await until(() => p.evaluate(() => { const h = document.querySelector('sintonia-fila-fim'); return h && h.shadowRoot ? h.shadowRoot.querySelector('.fim').textContent.replace(/\s+/g, ' ').trim() : null; }), 8000);
await p.evaluate(() => document.querySelector('sintonia-fila-fim').shadowRoot.querySelector('[data-f="ficar"]').click()); // fica no vídeo (a volta para a Em Dia tem teste próprio em e2e-fila)
await wait(4500);
const m = await p.evaluate(() => ({ fora: window.__mock.autoplayFora, cancel: window.__mock.cancelou, url: location.search }));
check('fim da fila: a contagem do autoplay é cancelada e nenhum vídeo de fora entra', m.fora === 0 && m.cancel >= 1 && m.url.includes(restam[3]), m);
check('fim da fila: aviso "Fila concluída ✓" e a fila apagada', !(await fila()) && !!avisoFim && avisoFim.includes('Fila concluída ✓'), avisoFim);

// 12) plano B: a playlist não vem → fila própria, com a reprodução automática desligada durante a fila
st.wv = false;
await p.goto('https://www.youtube.com/feed/subscriptions'); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
await until(async () => (await ed()).botao);
await p.evaluate(() => document.getElementById('sintonia-emdia-btn').shadowRoot.querySelector('.edbtn').click());
await until(async () => { const x = await ed(); return x.aberta && x.ids.length && !/Carregando/.test(x.st); }, 30000);
const restamB = SINT_restantes(await ed());
await clicar('[data-act="comecar"]');
await p.waitForURL(/\/watch\?v=/, { timeout: 30000 });
const fb = await until(async () => { const f = await fila(); return f && f.modo === 'propria' ? f : null; }, 20000, 500);
check('plano B: sem a playlist em 10 s, passa para a fila própria', !!fb, fb && fb.modo);
check('plano B: reprodução automática do player desligada durante a fila', (await p.evaluate(() => document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked'))) === 'false');
const id1 = await p.evaluate(() => new URLSearchParams(location.search).get('v'));
await quaseFim(1.5);
await p.waitForURL((u) => !u.toString().includes(id1), { timeout: 20000 });
const id2 = await p.evaluate(() => new URLSearchParams(location.search).get('v'));
check('plano B: no fim, a Sintonia navega para o próximo da fila (não para sugestão)', id2 === restamB[1] && (await p.evaluate(() => window.__mock.autoplayFora)) === 0, { id2, esp: restamB[1] });
await until(barra);
await p.evaluate(() => document.getElementById('sintonia-fila').shadowRoot.querySelector('[data-f="sair"]').click());
check('plano B: Sair religa a reprodução automática como estava', !!(await until(() => p.evaluate(() => document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked') === 'true'))));
st.wv = true;

// 13) Marcar todos como pulados (sim)
await p.goto('https://www.youtube.com/feed/subscriptions'); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
await until(async () => (await ed()).botao);
await p.evaluate(() => document.getElementById('sintonia-emdia-btn').shadowRoot.querySelector('.edbtn').click());
await until(async () => { const x = await ed(); return x.aberta && x.ids.length && !/Carregando/.test(x.st); }, 30000);
await clicar('[data-act="todos"]'); await wait(200); await clicar('[data-act="sim"]');
e = await until(async () => { const x = await ed(); return /^0 para ver/.test(x.cont) ? x : null; });
check('"Marcar todos" + confirmar: 0 para ver', !!e, e && e.cont);
await p.screenshot({ path: path.join(SHOT, 'emdia-todos.png') });

// 14) idioma: datas em inglês e espanhol
for (const [hl, aba] of [['en', 'Today (24 h)'], ['es', 'Hoy (24 h)']]) {
  await sw.evaluate(async () => { await chrome.storage.local.set({ 'st.emdia': {}, 'st.emdia.periodo': 24 }); });
  await setSync({ lang: hl });
  await p.goto('https://www.youtube.com/feed/subscriptions?hl=' + hl); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' });
  await until(async () => (await ed()).botao);
  await p.evaluate(() => document.getElementById('sintonia-emdia-btn').shadowRoot.querySelector('.edbtn').click());
  e = await until(async () => { const x = await ed(); return x.aberta && x.ids.length && !/Load|Carg/.test(x.st) ? x : null; }, 30000);
  check(`${hl.toUpperCase()}: datas lidas e mesma contagem (${esp24.length})`, e && e.tab === aba && e.ids.length === esp24.length, e && { tab: e.tab, n: e.ids.length });
}
await setSync({ lang: '' });

// 14b) Selecionar: marca vários, "Não quero ver" e "Não quero ver e começar"
await p.goto('https://www.youtube.com/feed/subscriptions');
await until(async () => (await ed()).botao);
await p.evaluate(() => document.getElementById('sintonia-emdia-btn').shadowRoot.querySelector('.edbtn').click());
e = await until(async () => { const x = await ed(); return x.aberta && x.ids.length && !/Carregando/.test(x.st) ? x : null; }, 30000);
await sw.evaluate(() => chrome.storage.local.set({ 'st.emdia': {}, 'st.fila': null })); await wait(600);
e = await until(async () => { const x = await ed(); return x.aberta && x.cards.filter((c) => !c.off).length >= 4 ? x : null; }, 10000);
const livres = e.cards.filter((c) => !c.off).map((c) => c.id);
check('Selecionar: botão existe', await clicar('[data-act="selecionar"]'));
const selInfo = () => p.evaluate(() => { const r = document.querySelector('sintonia-emdia').shadowRoot; return { barra: !!r.querySelector('.sel'), n: (r.querySelector('.sel b') || {}).textContent || '', marcados: [...r.querySelectorAll('.cd.marcado')].map((c) => c.dataset.id), comecarSome: !r.querySelector('[data-act="comecar"]') }; });
let si = await until(async () => { const x = await selInfo(); return x.barra ? x : null; });
check('modo seleção: barra com contagem e "Começar" some', si && si.n === '0 selecionados' && si.comecarSome, si);
const urlAntes = p.url();
await clicar(`.cd[data-id="${livres[0]}"] .th`); await clicar(`.cd[data-id="${livres[1]}"] .th`);
si = await until(async () => { const x = await selInfo(); return x.marcados.length === 2 ? x : null; });
check('clicar em 2 cards marca os dois (e não abre o vídeo)', si && si.n === '2 selecionados' && p.url() === urlAntes, si);
await clicar(`.cd[data-id="${livres[1]}"] .th`);
si = await until(async () => { const x = await selInfo(); return x.marcados.length === 1 ? x : null; });
check('clicar de novo desmarca', si && si.n === '1 selecionado', si);
await clicar(`.cd[data-id="${livres[1]}"] .th`);
await clicar('[data-act="selPular"]');
let mk = await until(async () => { const m = await marcas(); return m[livres[0]] && m[livres[1]] ? m : null; });
check('"Não quero ver": os 2 selecionados viram pulados', mk && mk[livres[0]].s === 'p' && mk[livres[1]].s === 'p');
si = await selInfo();
check('depois de marcar, sai do modo seleção', !si.barra);
await clicar('[data-act="selecionar"]'); await until(async () => (await selInfo()).barra);
await clicar(`.cd[data-id="${livres[2]}"] .th`);
await until(async () => (await selInfo()).marcados.length === 1);
await clicar('[data-act="selPularComecar"]');
const fl = await until(async () => { const f = await fila(); return f && f.ids && f.ids.length ? f : null; }, 15000);
check('"Não quero ver e começar": marca e começa a fila sem os pulados', fl && !fl.ids.includes(livres[0]) && !fl.ids.includes(livres[1]) && !fl.ids.includes(livres[2]) && fl.ids.includes(livres[3]), fl && { n: fl.ids.length, livres: livres.slice(0, 4), ids: fl.ids });
check('… e foi para o primeiro vídeo da fila', !!(await until(() => /\/watch/.test(p.url()) || null, 15000)), p.url());
await sw.evaluate(() => chrome.storage.local.set({ 'st.fila': null, 'st.emdia': {} }));

// 15) desligar a Em Dia some com o botão e com a visão
await setSync({ emdia: false });
check('desligar: botão e visão somem', !!(await until(async () => { const x = await ed(); return !x.botao && !x.aberta; })));
check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();

function SINT_restantes(x) { return x.cards.filter((c) => !c.off).map((c) => c.id); }
