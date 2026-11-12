// v1.1.0: fila da Em Dia — avanço garantido e fim da fila (aviso + volta para a Em Dia). Uso: node e2e-fila.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';
import { esperado } from './mock-inscricoes.mjs';

const { ctx, sw } = await abrir();
const st = await rotas(ctx);
await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const fila = () => sw.evaluate(async () => (await chrome.storage.local.get('st.fila'))['st.fila'] || null);
const marcas = () => sw.evaluate(async () => (await chrome.storage.local.get('st.emdia'))['st.emdia'] || {});
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
const ordemEst = (lst) => { const o = lst.map((x, i) => ({ ...x, i })); o.sort((a, b) => (b.min - a.min) || (a.i - b.i)); return o.map((x) => x.id); };
const ed = () => p.evaluate(() => {
  const h = document.querySelector('sintonia-emdia'), r = h && h.shadowRoot;
  if (!r || !h.isConnected) return { aberta: false };
  return { aberta: true, tab: (r.querySelector('.chip[role=tab][aria-selected=true]') || {}).textContent, vazio: (r.querySelector('.vazio') || {}).textContent || null, cont: (r.querySelector('.cnt') || {}).textContent };
});
const aviso = () => p.evaluate(() => { const h = document.querySelector('sintonia-fila-fim'); const r = h && h.shadowRoot; const f = r && r.querySelector('.fim'); return f ? { txt: f.textContent.replace(/\s+/g, ' ').trim(), pai: h.parentElement && h.parentElement.tagName, box: (() => { const b = f.getBoundingClientRect(); return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, vw: innerWidth, vh: innerHeight }; })() } : null; });
const clicarAviso = (f) => p.evaluate((f) => document.querySelector('sintonia-fila-fim').shadowRoot.querySelector(`[data-f="${f}"]`).click(), f);
const barra = () => p.evaluate(() => { const b = document.getElementById('sintonia-fila'); const f = b && b.shadowRoot && b.shadowRoot.querySelector('.fb'); return f ? f.textContent.replace(/\s+/g, ' ').trim() : null; });
const idAtual = () => p.evaluate(() => new URLSearchParams(location.search).get('v'));
const pronto = () => until(() => p.evaluate(() => { const v = document.querySelector('video'); return v && isFinite(v.duration) && v.duration > 5 && v.readyState >= 2; }));
const quaseFim = async (s) => { await pronto(); await p.evaluate((s) => { const v = document.querySelector('video'); v.currentTime = v.duration - s; v.play(); }, s); };
const noSubs = () => p.evaluate(() => location.pathname === '/feed/subscriptions');
const irSubs = async () => { await p.goto('https://www.youtube.com/feed/subscriptions'); await p.waitForSelector('ytd-rich-item-renderer', { state: 'attached' }); await until(() => p.evaluate(() => !!document.getElementById('sintonia-emdia-btn'))); };

// começa uma fila de N vídeos pela Em Dia (o resto do período fica marcado como pulado), do jeito que a pessoa faz
async function comecar(per, n) {
  const rest = ordemEst(esperado(per).filter((x) => x.prog < 90));
  const m = {}; for (const id of rest.slice(n)) m[id] = { s: 'p', em: Date.now() };
  await sw.evaluate(async ([m, per]) => { await chrome.storage.local.set({ 'st.emdia': m, 'st.fila': null, 'st.emdia.periodo': per }); }, [m, per]);
  await irSubs();
  await p.evaluate(() => document.getElementById('sintonia-emdia-btn').shadowRoot.querySelector('.edbtn').click());
  await until(async () => { const x = await p.evaluate(() => { const h = document.querySelector('sintonia-emdia'); return h && h.shadowRoot && h.shadowRoot.querySelectorAll('.cd').length; }); return x ? true : null; }, 30000);
  await until(async () => /para ver/.test((await ed()).cont || ''), 20000);
  await p.evaluate(() => document.querySelector('sintonia-emdia').shadowRoot.querySelector('[data-act="comecar"]').click());
  await p.waitForURL(/\/watch\?v=/, { timeout: 30000 });
  await p.evaluate(() => { window.__semRecarga = 1; });
  await until(barra, 20000);
  return rest.slice(0, n);
}
const ESCOPO = async () => { await sw.evaluate(() => chrome.storage.local.set({ 'st.fila': null, 'st.emdia': {} })); };

await setSync({ emdia: true, atalhos: true });

// ───────────────────────── 1) plano A, 2 vídeos: acaba → próximo; último acaba → aviso → volta para a Em Dia ─────────────────────────
let q = await comecar(72, 2);
check('fila de 2 vídeos começou com a playlist nativa', (await fila()).modo === 'lista' && (await fila()).ids.length === 2);
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 20000 });
check('1º acaba sozinho e passa para o 2º (barra 2/2)', !!(await until(async () => { const b = await barra(); return b && b.includes('2/2'); })));
check('o que acabou conta como concluído', ((await marcas())[q[0]] || {}).s === 'v');
await quaseFim(1.2);
const av = await until(aviso, 8000);
check('último acabou: aviso "Fila concluída ✓" com resumo "2 vistos · 0 pulados"', av && av.txt.includes('Fila concluída ✓') && av.txt.includes('2 vistos · 0 pulados') && /Voltando para a Em Dia em \d s/.test(av.txt) && av.txt.includes('Ficar aqui'), av);
check('aviso no meio da tela', av && Math.abs(av.box.cx - av.box.vw / 2) < 40 && Math.abs(av.box.cy - av.box.vh / 2) < 60, av && av.box);
await p.screenshot({ path: path.join(SHOT, 'fila-fim.png') });
check('a fila é encerrada e limpa na hora', (await fila()) === null);
check('a barra da fila sumiu', !(await barra()));
const t0 = Date.now();
const chegou = await until(noSubs, 12000, 200);
check('depois de ~5 s volta para as Inscrições', !!chegou && Date.now() - t0 > 3500, Date.now() - t0);
check('navegação interna (sem recarregar a página)', await p.evaluate(() => window.__semRecarga === 1));
const e1 = await until(async () => { const x = await ed(); return x.aberta && x.vazio ? x : null; }, 15000);
check('Em Dia já aberta, no período que estava (3 dias), com "Tudo em dia ✓"', e1 && e1.tab === '3 dias' && e1.vazio.includes('Tudo em dia ✓'), e1);
await p.screenshot({ path: path.join(SHOT, 'fila-volta-emdia.png') });
check('sem aviso nem fila depois da volta', !(await aviso()) && (await fila()) === null);
// uma vez só: recarregar e outra aba não disparam de novo
await p.goto(`https://www.youtube.com/watch?v=${q[1]}`); await pronto(); await quaseFim(1.2); await wait(3500);
check('recarregar e tocar até o fim do mesmo vídeo não dispara o aviso de novo', !(await aviso()) && (await fila()) === null);
const p2 = await ctx.newPage();
await p2.goto(`https://www.youtube.com/watch?v=${q[0]}`); await wait(3000);
check('outra aba no mesmo vídeo não dispara o aviso', !(await p2.evaluate(() => !!document.querySelector('sintonia-fila-fim'))));
await p2.close();

// ───────────────────────── 2) "Pular" no último: mesmo aviso, resumo com pulados; Ir agora ─────────────────────────
await ESCOPO(); q = await comecar(24, 2);
await p.evaluate(() => document.getElementById('sintonia-fila').shadowRoot.querySelector('[data-f="pular"]').click());
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 20000 });
await until(async () => { const b = await barra(); return b && b.includes('2/2'); });
await p.evaluate(() => document.getElementById('sintonia-fila').shadowRoot.querySelector('[data-f="pular"]').click());
const av2 = await until(aviso, 8000);
check('"Pular" no último: aviso com "0 vistos · 2 pulados"', av2 && av2.txt.includes('Fila concluída ✓') && av2.txt.includes('0 vistos · 2 pulados'), av2);
check('"Pular" no último: fila limpa', (await fila()) === null);
await clicarAviso('ir');
const e2 = await until(async () => { const x = await ed(); return (await noSubs()) && x.aberta && x.vazio ? x : null; }, 12000);
check('"Ir agora": vai na hora para a Em Dia (Hoje) com "Tudo em dia ✓"', e2 && e2.tab === 'Hoje (24 h)' && e2.vazio.includes('Tudo em dia ✓'), e2);

// ───────────────────────── 3) "Ficar aqui" e Esc cancelam e deixam no vídeo ─────────────────────────
for (const [como, agir] of [['Ficar aqui', () => clicarAviso('ficar')], ['Esc', () => p.keyboard.press('Escape')]]) {
  await ESCOPO(); q = await comecar(24, 1);
  await quaseFim(1.2);
  await until(aviso, 8000);
  await agir();
  await wait(300);
  check(`${como}: o aviso some`, !(await aviso()));
  await wait(6500);
  check(`${como}: fica no vídeo (não navega) e a fila continua limpa`, !(await noSubs()) && /\/watch/.test(p.url()) && (await fila()) === null, p.url());
}

// ───────────────────────── 4) plano B (fila própria): navegação interna entre vídeos, autoplay de fora nunca entra ─────────────────────────
await ESCOPO(); q = await comecar(24, 2);
const ids2 = (await fila()).ids;
await sw.evaluate(async () => { const f = (await chrome.storage.local.get('st.fila'))['st.fila']; f.modo = 'propria'; f.autonavAntes = true; await chrome.storage.local.set({ 'st.fila': f }); });
await p.goto(`https://www.youtube.com/watch?v=${ids2[0]}`); await pronto(); await p.evaluate(() => { window.__semRecarga = 1; });
await until(barra, 20000);
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${ids2[1]}`), { timeout: 20000 });
check('plano B: 1º acaba → 2º por navegação interna do YouTube (sem recarregar)', await p.evaluate(() => window.__semRecarga === 1 && (window.__mock.ytNavigate || 0) >= 1));
await until(async () => { const b = await barra(); return b && b.includes('2/2'); });
await quaseFim(1.2);
await until(aviso, 8000);
await wait(2500);
const fora = await p.evaluate(() => ({ fora: window.__mock.autoplayFora, cancel: window.__mock.cancelou }));
check('plano B, fim da fila: a tela final é cancelada e nenhum vídeo de fora entra', fora.fora === 0 && fora.cancel >= 1, fora);
await clicarAviso('ficar');

// ───────────────────────── 5) bloco de 50 → 51 (plano A) ─────────────────────────
await ESCOPO();
const IDS = Array.from({ length: 52 }, (_, i) => 'Q' + String(i).padStart(10, '0'));
await sw.evaluate(async (ids) => { await chrome.storage.local.set({ 'st.fila': { ids, i: 0, origem: 'emdia', modo: 'lista', ativa: true, bloco: [0, 50], inicioBloco: Date.now(), autonavAntes: true, em: Date.now() } }); }, IDS);
await p.goto(`https://www.youtube.com/watch_videos?video_ids=${IDS.slice(0, 50).join(',')}`); await p.waitForURL(/list=TLGGmock/);
await until(barra, 20000);
await p.evaluate(() => document.getElementById('movie_player').playVideoAt(48));
await p.waitForURL(new RegExp(`v=${IDS[48]}`));
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${IDS[49]}`), { timeout: 20000 });
check('bloco: 49 → 50 dentro da mesma playlist nativa', true);
await until(async () => { const b = await barra(); return b && b.includes('50/52'); });
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${IDS[50]}`), { timeout: 30000 });
const fb = await until(async () => { const f = await fila(); return f && f.bloco && f.bloco[0] === 50 ? f : null; });
check('bloco: o 50º acaba → abre o próximo bloco com o 51º (51/52)', !!fb && st.watchVideos[st.watchVideos.length - 1].join() === IDS.slice(50).join(), fb && fb.bloco);
await until(async () => { const b = await barra(); return b && b.includes('51/52'); });
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${IDS[51]}`), { timeout: 20000 });
await quaseFim(1.2);
check('bloco: o 52º (último) acaba → aviso', !!(await until(aviso, 8000)));
await clicarAviso('ficar');

// ───────────────────────── 6) o YouTube não avança sozinho (reprodução automática desligada na conta) ─────────────────────────
await ESCOPO(); q = await comecar(24, 3);
await p.evaluate(() => { window.__mock.semAvanco = true; localStorage.setItem('mockAutonav', '0'); document.querySelector('.ytp-autonav-toggle-button').setAttribute('aria-checked', 'false'); });
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 20000 });
check('reprodução automática desligada e o YouTube parado: a Sintonia empurra para o próximo', true);

// ───────────────────────── 7) loop do vídeo inteiro: a fila ganha; fora da fila ele volta a valer ─────────────────────────
await p.evaluate(() => { window.__mock.semAvanco = false; document.querySelector('video').loop = true; });
await until(async () => { const b = await barra(); return b && b.includes('2/3'); });
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${q[2]}`), { timeout: 20000 });
check('loop ligado: o vídeo da fila acaba e vai para o próximo (a fila ganha)', true);
await p.evaluate(() => document.getElementById('sintonia-fila').shadowRoot.querySelector('[data-f="sair"]').click());
await wait(500);
check('fora da fila o loop continua valendo (não foi desligado)', await p.evaluate(() => document.querySelector('video').loop === true));
await quaseFim(1.2); await wait(3000);
check('fora da fila: vídeo em loop volta ao começo, sem aviso e sem sair', await p.evaluate(() => document.querySelector('video').currentTime < 30) && !(await aviso()) && /\/watch/.test(p.url()));
await p.evaluate(() => { document.querySelector('video').loop = false; });

// ───────────────────────── 8) A–B ligado pela pessoa: a fila espera ─────────────────────────
await ESCOPO(); q = await comecar(24, 2);
await setSync({ loopAB: true }); await wait(500);
await pronto();
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 2; v.play(); });
await p.keyboard.press('Alt+KeyA'); await wait(300);
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = v.duration - 0.35; v.play(); });
await p.keyboard.press('Alt+KeyB'); await wait(300);
const abOk = await p.evaluate(() => document.querySelector('video').currentTime < 10);
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = v.duration - 3; v.play(); });
await wait(6000);
check('A–B ligado com B perto do fim: a fila espera (continua no 1º vídeo, 1/2)', abOk && (await idAtual()) === q[0] && !!(await barra())?.includes('1/2'), { abOk, id: await idAtual() });
await setSync({ loopAB: false }); await wait(500); await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 20000 });
check('A–B desligado pela pessoa: a fila volta a andar', true);
await p.evaluate(() => document.getElementById('sintonia-fila').shadowRoot.querySelector('[data-f="sair"]').click());

// ───────────────────────── 9) velocidade acima de 2× ─────────────────────────
await ESCOPO(); q = await comecar(24, 2);
await pronto(); await p.evaluate(() => { const v = document.querySelector('video'); v.playbackRate = 8; v.currentTime = v.duration - 6; v.play(); });
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 20000 });
check('velocidade 8×: o vídeo acaba e a fila passa para o próximo', ((await marcas())[q[0]] || {}).s === 'v');
await p.evaluate(() => document.getElementById('sintonia-fila').shadowRoot.querySelector('[data-f="sair"]').click());

// ───────────────────────── 10) anúncio no fim do vídeo ─────────────────────────
await ESCOPO(); q = await comecar(24, 2);
await p.evaluate(() => { window.__mock.posroll = 3000; });
await quaseFim(1.5);
await wait(1800);
check('anúncio no fim: não pula enquanto o anúncio toca', (await idAtual()) === q[0]);
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 20000 });
check('anúncio no fim: acabou o anúncio, vai para o próximo', true);
await p.evaluate(() => document.getElementById('sintonia-fila').shadowRoot.querySelector('[data-f="sair"]').click());

// ───────────────────────── 11) SponsorBlock pulando o "outro" até o fim ─────────────────────────
await ESCOPO(); await setSync({ sb: true, sbCats: ['sponsor', 'outro'] });
q = await comecar(24, 2);
st.sb[q[0]] = [{ category: 'outro', actionType: 'skip', segment: [88, 100], UUID: 'u-ou-1', videoDuration: 100, locked: 0, votes: 1 }];
await p.goto(`https://www.youtube.com/watch?v=${q[0]}`); await pronto(); await until(barra, 20000);
await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 86; v.play(); });
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 25000 }).catch(() => {});
check('SponsorBlock pulou o "outro" até o fim: a fila passa para o próximo', (await idAtual()) === q[1] && st.sbPedidos.length > 0, { id: await idAtual() });
await setSync({ sb: false });
await p.evaluate(() => document.getElementById('sintonia-fila')?.shadowRoot.querySelector('[data-f="sair"]').click());

// ───────────────────────── 12) tela cheia e modo teatro ─────────────────────────
await ESCOPO(); q = await comecar(24, 2);
await pronto();
await p.click('.ytp-size-button'); await p.click('.ytp-fullscreen-button'); await wait(500);
check('tela cheia e teatro ligados', await p.evaluate(() => !!document.fullscreenElement && document.querySelector('ytd-watch-flexy').hasAttribute('theater')));
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 20000 });
check('tela cheia + teatro: acaba e passa para o próximo sem sair da tela cheia', await p.evaluate(() => !!document.fullscreenElement));
await quaseFim(1.2);
const av3 = await until(aviso, 8000);
check('fim da fila em tela cheia: o aviso aparece dentro da tela cheia', av3 && av3.pai && /^(DIV|YTD-)/i.test(av3.pai) || (av3 && av3.pai === 'DIV'), av3 && av3.pai);
await clicarAviso('ir');
check('a volta para a Em Dia sai da tela cheia', !!(await until(async () => (await noSubs()) && (await p.evaluate(() => !document.fullscreenElement)), 12000)));

// ───────────────────────── 13) mini player da Sintonia (rolando a página) ─────────────────────────
await ESCOPO(); await setSync({ miniPlayer: true }); q = await comecar(24, 2);
await pronto();
await p.evaluate(() => { document.body.style.paddingBottom = '3000px'; scrollTo(0, 900); }); await wait(1500);
check('mini player da Sintonia flutuando', await p.evaluate(() => document.getElementById('movie_player').hasAttribute('data-sint-mini')));
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 20000 });
check('mini player da Sintonia: o vídeo acaba e a fila passa para o próximo', true);
await p.evaluate(() => scrollTo(0, 0)); await setSync({ miniPlayer: false });
await p.evaluate(() => document.getElementById('sintonia-fila')?.shadowRoot.querySelector('[data-f="sair"]').click());

// ───────────────────────── 14) miniplayer do YouTube (a página não é /watch) ─────────────────────────
await ESCOPO(); q = await comecar(24, 3);
await p.evaluate(() => { window.__mock.semAvanco = true; window.__ir('/'); const m = document.createElement('ytd-miniplayer'); m.setAttribute('active', ''); document.body.appendChild(m); });
await wait(600);
check('miniplayer do YouTube: página fora do /watch', await p.evaluate(() => location.pathname === '/'));
await quaseFim(1.5);
await p.waitForURL(new RegExp(`v=${q[1]}`), { timeout: 20000 });
check('miniplayer do YouTube: o vídeo acaba e a fila passa para o próximo', true);
await p.evaluate(() => { window.__mock.semAvanco = false; document.querySelector('ytd-miniplayer')?.remove(); });
await p.evaluate(() => document.getElementById('sintonia-fila')?.shadowRoot.querySelector('[data-f="sair"]').click());

// ───────────────────────── 15) Em Dia ou Sintonia desligadas: nada dispara ─────────────────────────
for (const [nome, off, on] of [['Em Dia desligada', { emdia: false }, { emdia: true }], ['Sintonia desligada', { on: false }, { on: true }]]) {
  await ESCOPO(); q = await comecar(24, 1);
  await setSync(off); await wait(800);
  await quaseFim(1.2); await wait(3500);
  check(`${nome}: nenhum aviso e a fila fica como estava`, !(await aviso()) && (await fila()) !== null && /\/watch/.test(p.url()));
  await setSync(on);
}
// desligar durante a contagem
await ESCOPO(); q = await comecar(24, 1);
await quaseFim(1.2); await until(aviso, 8000);
await setSync({ emdia: false });
check('Em Dia desligada durante a contagem: o aviso some e não navega', !!(await until(async () => !(await aviso()), 3000)) && (await wait(6000), !(await noSubs())));
await setSync({ emdia: true });

check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
