// Fase 2 (v0.3.0): velocidade, qualidade e volume por canal, roda do mouse, atalhos, teatro e cinema. Uso: node e2e-player.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, PH, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw, extId } = await abrir();
const st = await rotas(ctx);
await esperarGuia(ctx);
await sw.evaluate(() => chrome.storage.local.set({ 'st.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } }));
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
const setSync = (o) => sw.evaluate((o) => chrome.storage.sync.set(o), o);
const perfis = () => sw.evaluate(async () => (await chrome.storage.local.get('st.perfis'))['st.perfis'] || {});
const pl = () => p.evaluate(() => { const mp = document.getElementById('movie_player'), v = mp.querySelector('video');
  return { r: +v.playbackRate.toFixed(2), api: mp.getPlaybackRate(), vol: mp.getVolume(), muted: mp.isMuted(), q: mp.getPlaybackQuality(), theater: document.querySelector('ytd-watch-flexy').hasAttribute('theater'),
    m: window.__mock, sy: scrollY, velBtn: (document.getElementById('sintonia-vel') || {}).textContent || null }; });
const abrirVideo = async (v, extra = '') => { await p.goto(`https://www.youtube.com/watch?v=${v}${extra}`); await p.waitForSelector('video', { state: 'attached' }); await until(() => p.evaluate(() => { const x = document.querySelector('video'); return x.readyState >= 2; })); await wait(1200); };
const ir = async (v) => { await p.evaluate((v) => window.__ir('/watch?v=' + v), v); await until(() => p.evaluate((v) => document.getElementById('movie_player').getVideoData().video_id === v && document.querySelector('video').readyState >= 2, v)); await wait(1500); };
const roda = async (dy, shift, sel = '#movie_player') => { const b = await p.locator(sel).boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 3); if (shift) await p.keyboard.down('Shift'); await p.mouse.wheel(0, dy); if (shift) await p.keyboard.up('Shift'); await wait(400); };

// ── A) desligado de fábrica: nada muda
await abrirVideo('AAAAAAAAAA1', '&vol=60&muted=1');
await p.evaluate(() => { document.body.style.minHeight = '3000px'; });
let s = await pl();
check('desligado: velocidade 1×, volume 60 e mudo intactos, sem chamar a API', s.r === 1 && s.vol === 60 && s.muted && !s.m.setRate.length && !s.m.setVol.length && !s.m.setQ.length, { r: s.r, vol: s.vol, setRate: s.m.setRate, setVol: s.m.setVol });
check('desligado: sem teatro automático e sem botão de velocidade', !s.theater && !s.velBtn);
await roda(300, false);
s = await pl();
check('desligado: roda do mouse sobre o vídeo rola a página (não mexe no volume)', s.sy > 0 && s.vol === 60, { sy: s.sy, vol: s.vol });
await p.evaluate(() => scrollTo(0, 0));
await p.keyboard.press('Alt+Period'); await wait(300);
check('desligado: Alt+. não muda a velocidade', (await pl()).r === 1);

// ── B) velocidade padrão
await setSync({ velocidade: true, velPadrao: 1.5 });
await abrirVideo('AAAAAAAAAA1');
s = await until(async () => { const x = await pl(); return x.r === 1.5 ? x : null; });
check('velocidade padrão 1,5×: vídeo abre a 1,5× (no <video> e na API)', s && s.api === 1.5, s && { r: s.r, api: s.api });
check('botão de velocidade "1,5×" na barra, antes do botão da Sintonia', await p.evaluate(() => { const b = document.getElementById('sintonia-vel'); return !!b && b.textContent === '1,5×' && b.nextElementSibling && b.nextElementSibling.id === 'sintonia-btn'; }));
// ── C) 3× (fora da API) e troca de vídeo: o player devolve para a API (2×) e a Sintonia volta para 3×
await setSync({ velPadrao: 3 });
s = await until(async () => { const x = await pl(); return x.r === 3 ? x : null; });
check('3×: fora do limite da API, vai direto no <video> (API fica no limite, 2×)', s && s.api === 2, s && { r: s.r, api: s.api });
await ir('BBBBBBBBBB2');
s = await until(async () => { const x = await pl(); return x.r === 3 && x.m.resets >= 1 ? x : null; });
check('troca de vídeo: o player reseta (como o real) e a Sintonia volta para 3×', !!s, s && { r: (await pl()).r, resets: (await pl()).m.resets });
await wait(1500);
check('troca de vídeo: continua em 3× depois de 1,5 s', (await pl()).r === 3);

// ── D) nunca volta para 1× na playlist/fila (reclamação nº 1 do Enhancer)
await setSync({ velPadrao: 1 });
await p.goto('https://www.youtube.com/watch_videos?video_ids=AAAAAAAAAA1,BBBBBBBBBB2,AAAAAAAAAA3'); await p.waitForURL(/list=TLGG/);
await until(() => p.evaluate(() => document.querySelector('video').readyState >= 2)); await wait(1000);
await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel);
await clicar(p, PH, '[data-pv-set="2.5"]'); await wait(400); await p.keyboard.press('Escape');
check('escolha no painel: 2,5×', (await pl()).r === 2.5);
for (const prox of ['BBBBBBBBBB2', 'AAAAAAAAAA3']) {
  await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = v.duration - 1.2; v.play(); });
  await until(() => p.evaluate((x) => document.getElementById('movie_player').getVideoData().video_id === x && document.querySelector('video').readyState >= 2, prox), 20000);
  await wait(1500);
  s = await pl();
  check(`playlist: o próximo (${prox}) continua a 2,5×, nunca 1×`, s.r === 2.5, { r: s.r, api: s.api });
}
// ── E) mudança pelo menu do próprio YouTube vira a escolha
await p.click('.ytp-settings-button'); await p.click('.ytp-settings-menu [data-rate="1.25"]'); await wait(500);
check('menu do YouTube 1,25×: aceito como escolha (não volta para 2,5×)', (await pl()).r === 1.25);
await ir('BBBBBBBBBB2');
check('troca de vídeo depois do menu: 1,25×', (await until(async () => { const x = await pl(); return x.r === 1.25 ? x : null; })) !== null);
// teclas do YouTube (Shift + .)
await p.keyboard.press('Shift+Period'); await wait(600);
check('tecla > do YouTube (1,5×) também é escolha da pessoa', (await pl()).r === 1.5);
// ── F) anúncio: não briga durante, volta depois
await p.evaluate(() => window.__anuncio(1500)); await wait(500);
check('durante o anúncio: a Sintonia não mexe (1×)', (await pl()).r === 1);
check('depois do anúncio: volta para 1,5×', !!(await until(async () => { const x = await pl(); return x.r === 1.5 ? x : null; })));

// ── G) lembrar por canal
await setSync({ perfilCanal: true, velPadrao: 1.5 });
await abrirVideo('AAAAAAAAAA1', '&vol=60');
await p.click('#sintonia-btn'); await until(async () => (await estado(p)).painel);
await clicar(p, PH, '[data-pv-set="1.75"]'); await wait(500); await p.keyboard.press('Escape');
let pf = await until(async () => { const x = await perfis(); return x.UCaaaaaaaaaaaaaaaaaaaaa1 && x.UCaaaaaaaaaaaaaaaaaaaaa1.rate === 1.75 ? x : null; });
check('por canal: 1,75× no Canal Um fica salvo no perfil dele', !!pf);
await p.locator('#movie_player').click({ position: { x: 5, y: 5 } }).catch(() => {}); await p.evaluate(() => { const v = document.querySelector('video'); if (v.paused) v.play(); });
await p.evaluate(() => document.activeElement && document.activeElement.blur());
await p.keyboard.press('ArrowUp'); await wait(600);
pf = await until(async () => { const x = await perfis(); return x.UCaaaaaaaaaaaaaaaaaaaaa1 && x.UCaaaaaaaaaaaaaaaaaaaaa1.vol === 65 ? x : null; });
check('por canal: volume mudado pela tecla ↑ do YouTube (65) fica salvo', !!pf);
await p.click('.ytp-settings-button'); await p.click('.ytp-settings-menu [data-q="large"]'); await wait(600);
pf = await until(async () => { const x = await perfis(); return x.UCaaaaaaaaaaaaaaaaaaaaa1 && x.UCaaaaaaaaaaaaaaaaaaaaa1.q === 'large' ? x : null; });
check('por canal: qualidade escolhida no menu (480p) fica salva', !!pf);
await ir('BBBBBBBBBB2');
s = await until(async () => { const x = await pl(); return x.r === 1.5 ? x : null; });
check('Canal Dois (sem perfil): usa o padrão 1,5×, não o 1,75× do Canal Um', !!s);
await ir('AAAAAAAAAA3');
s = await until(async () => { const x = await pl(); return x.r === 1.75 && x.vol === 65 ? x : null; });
check('volta ao Canal Um: 1,75× e volume 65 do perfil', !!s, await pl().then((x) => ({ r: x.r, vol: x.vol })));
check('volta ao Canal Um: qualidade 480p do perfil aplicada', (await pl()).m.setQ.slice(-1)[0] === 'large', (await pl()).m.setQ);
await p.click('#sintonia-btn');
check('painel mostra o perfil do canal (Velocidade 1,75× · Volume 65% · Qualidade 480p)', !!(await until(async () => { const e = await estado(p); return /Velocidade 1,75×/.test(e.painelTexto) && /Volume 65%/.test(e.painelTexto) && /Qualidade 480p/.test(e.painelTexto) ? e : null; })));
await p.screenshot({ path: path.join(SHOT, 'painel-velocidade.png') });
await p.keyboard.press('Escape');

// ── H) volume no máximo ao abrir (perfil ganha)
await sw.evaluate(() => chrome.storage.local.set({ 'st.perfis': {} }));
await setSync({ perfilCanal: false, volMax: true });
await abrirVideo('BBBBBBBBBB2', '&vol=60&muted=1');
s = await until(async () => { const x = await pl(); return x.vol === 100 && !x.muted ? x : null; });
check('volume no máximo: abre com 100% e sem mudo', !!s);
await setSync({ perfilCanal: true });
await sw.evaluate(() => chrome.storage.local.set({ 'st.perfis': { UCaaaaaaaaaaaaaaaaaaaaa1: { n: 'Canal Um', vol: 40, em: Date.now() } } }));
await abrirVideo('AAAAAAAAAA1', '&vol=60&muted=1');
s = await until(async () => { const x = await pl(); return x.vol === 40 && !x.muted ? x : null; });
check('volume no máximo + perfil do canal com 40%: o perfil ganha (40%)', !!s);
await ir('BBBBBBBBBB2');
check('troca para canal sem perfil: 100%', !!(await until(async () => { const x = await pl(); return x.vol === 100 ? x : null; })));

// ── I) qualidade padrão
await setSync({ volMax: false, qualidade: true, qualPadrao: 'hd720' });
await abrirVideo('BBBBBBBBBB2');
check('qualidade padrão 720p: setPlaybackQualityRange("hd720")', (await until(async () => { const x = await pl(); return x.m.setQ.includes('hd720') ? x : null; })) !== null);
await setSync({ qualPadrao: 'highres' });
await ir('AAAAAAAAAA3');
check('limite 8K num vídeo que vai até 1080p: escolhe 1080p', (await until(async () => { const x = await pl(); return x.m.setQ.slice(-1)[0] === 'hd1080' ? x : null; })) !== null, (await pl()).m.setQ);
await setSync({ qualidade: false });

// ── J) roda do mouse
await sw.evaluate(() => chrome.storage.local.set({ 'st.perfis': {} }));
await setSync({ perfilCanal: false, rodaVolume: true, rodaVelocidade: true, velPasso: 0.1, volPasso: 5, velPadrao: 1 });
await abrirVideo('BBBBBBBBBB2', '&vol=60');
await p.evaluate(() => { document.body.style.minHeight = '3000px'; scrollTo(0, 0); });
await roda(100, false);
s = await pl();
check('roda para baixo sobre o vídeo: volume 60 → 55 e a página não rola', s.vol === 55 && s.sy === 0, { vol: s.vol, sy: s.sy });
await roda(-100, false); await roda(-100, false);
check('roda para cima 2×: 65', (await pl()).vol === 65);
const r0 = (await pl()).r; // (a aba lembra a última escolha: parte dela)
await roda(-100, true);
check(`Shift + roda para cima: velocidade ${r0} → ${+(r0 + 0.1).toFixed(2)}×`, (await pl()).r === +(r0 + 0.1).toFixed(2), (await pl()).r);
await roda(-100, false, '#sintonia-vel');
const r2 = +(r0 + 0.2).toFixed(2);
check(`roda sobre o botão de velocidade: ${r2}×`, (await pl()).r === r2, (await pl()).r);
check('aviso rápido no player mostra a velocidade', await p.evaluate((t) => { const o = document.querySelector('#movie_player sintonia-osd'); return !!o && o.shadowRoot.querySelector('div').textContent === t; }, String(r2).replace('.', ',') + '×'));
await p.evaluate(() => document.querySelector('video').playbackRate = 15.95); await wait(100);
await p.evaluate(() => { const b = document.getElementById('sintonia-btn'); b.click(); });
await until(async () => (await estado(p)).painel);
await clicar(p, PH, '[data-pv="vel+"]'); await wait(300); await clicar(p, PH, '[data-pv="vel+"]'); await wait(300);
check('limite de cima: 16×', (await pl()).r === 16);
for (let i = 0; i < 3; i++) { await p.evaluate(() => { document.querySelector('video').playbackRate = 0.1; }); }
await clicar(p, PH, '[data-pv="vel-"]'); await wait(300); await clicar(p, PH, '[data-pv="vel-"]'); await wait(300);
check('limite de baixo: 0,07×', (await pl()).r === 0.07);
await clicar(p, PH, '[data-pv-set="1"]'); await wait(300); await p.keyboard.press('Escape');
await ir('AAAAAAAAAA3');
await roda(100, false);
check('troca de vídeo: a roda continua mexendo no volume', (await pl()).vol === 60, (await pl()).vol);
await setSync({ rodaVolume: false, rodaVelocidade: false });

// ── K) teatro automático
await setSync({ teatroAuto: true });
await abrirVideo('AAAAAAAAAA1');
s = await until(async () => { const x = await pl(); return x.theater ? x : null; });
check('teatro automático: abre em modo teatro', !!s);
await ir('BBBBBBBBBB2');
s = await pl();
check('troca de vídeo: continua em teatro, sem clicar de novo', s.theater && s.m.teatro === 1, { teatro: s.m.teatro });
await setSync({ teatroAuto: false });
await abrirVideo('AAAAAAAAAA1');
check('teatro desligado: não clica', !(await pl()).m.teatro);

// ── L) modo cinema
await setSync({ cinema: true });
await abrirVideo('AAAAAAAAAA1');
await p.evaluate(() => document.querySelector('video').play());
const cine = () => p.evaluate(() => { const c = document.querySelector('sintonia-cinema'); if (!c) return null; const r = document.getElementById('movie_player').getBoundingClientRect();
  const fs = [...c.children].map((f) => f.getBoundingClientRect()); const cobre = fs.some((f) => f.width && f.height && f.left < r.right - 1 && f.right > r.left + 1 && f.top < r.bottom - 1 && f.bottom > r.top + 1);
  return { op: getComputedStyle(c).opacity, n: c.children.length, cobre }; });
let c = await until(async () => { const x = await cine(); return x && x.op === '1' ? x : null; });
check('cinema: escurece em volta enquanto toca (4 faixas)', c && c.n === 4, c);
check('cinema: nenhuma faixa cobre o vídeo', c && !c.cobre);
await p.screenshot({ path: path.join(SHOT, 'cinema.png') });
await p.evaluate(() => document.querySelector('video').pause());
check('cinema: pausado, clareia', !!(await until(async () => { const x = await cine(); return x && x.op === '0' ? x : null; })));
const pega = await p.evaluate(() => { const c = document.querySelector('sintonia-cinema'); const e = document.elementFromPoint(innerWidth - 20, innerHeight - 20); return { display: getComputedStyle(c).display, alvoEhCinema: !!(e && e.closest && e.closest('sintonia-cinema')) }; });
check('cinema clareado não pega clique da página (display none; revisão)', pega.display === 'none' && !pega.alvoEhCinema, pega);
await p.evaluate(() => document.querySelector('video').play());
await until(async () => { const x = await cine(); return x && x.op === '1'; });
await ir('BBBBBBBBBB2');
await p.evaluate(() => document.querySelector('video').play());
check('cinema: troca de vídeo continua escurecendo', !!(await until(async () => { const x = await cine(); return x && x.op === '1' ? x : null; })));
await setSync({ cinema: false });
check('cinema desligado: clareia', !!(await until(async () => { const x = await cine(); return !x || x.op === '0' ? true : null; })));

// ── M) atalhos
await setSync({ atalhos: true, velocidade: true, velPadrao: 1 });
await abrirVideo('AAAAAAAAAA1');
await p.evaluate(() => document.activeElement && document.activeElement.blur());
await p.keyboard.press('Alt+Period'); await wait(300);
check('Alt+. : velocidade 1 → 1,1×', (await pl()).r === 1.1);
await p.keyboard.press('Alt+Digit1'); await wait(300);
check('Alt+1 : volta para 1×', (await pl()).r === 1);
await p.keyboard.press('Alt+KeyS');
check('Alt+S : abre o painel', !!(await until(async () => (await estado(p)).painel)));
await p.keyboard.press('Escape');
const k0 = (await pl()).m.k || 0; await p.keyboard.press('KeyK'); await wait(200);
check('tecla K do YouTube continua indo para o YouTube', ((await pl()).m.k || 0) === k0 + 1);
await ir('BBBBBBBBBB2'); await p.keyboard.press('Alt+Period'); await wait(300);
check('troca de vídeo: atalhos continuam', (await pl()).r === 1.1);
// Ajustes: conflito
const op = await ctx.newPage();
await op.goto(`chrome-extension://${extId}/options/options.html#controles`); await op.waitForSelector('[data-mudar="velMais"]');
await op.click('[data-mudar="velMais"]'); await op.keyboard.press('KeyK'); await wait(200);
check('Ajustes: atalho sem Alt é recusado', /use Alt/.test(await op.textContent('.atmsg')), await op.textContent('.atmsg'));
await op.keyboard.press('Alt+KeyF'); await wait(200);
check('Ajustes: atalho do navegador (Alt+F) é recusado', /navegador/.test(await op.textContent('.atmsg')));
await op.keyboard.press('Alt+KeyC'); await wait(200);
check('Ajustes: atalho repetido (Alt+C do cinema) é recusado', /outra ação/.test(await op.textContent('.atmsg')));
await op.keyboard.press('Alt+KeyJ'); await wait(500);
const mapa = await sw.evaluate(async () => (await chrome.storage.sync.get('atalhoMap')).atalhoMap);
check('Ajustes: Alt+J salvo para Velocidade +', mapa && mapa.velMais === 'Alt+KeyJ', mapa);
await op.screenshot({ path: path.join(SHOT, 'ajustes-atalhos.png'), fullPage: true });
await op.close();
await p.bringToFront(); await p.evaluate(() => document.activeElement && document.activeElement.blur());
await p.keyboard.press('Alt+KeyJ'); await wait(300);
check('o atalho novo (Alt+J) funciona no vídeo', (await pl()).r === 1.2);
await setSync({ atalhos: false, velocidade: false, atalhoMap: {} });
check('sem erro da extensão na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
