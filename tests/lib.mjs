// Base dos testes E2E da Sintonia: Chromium do Playwright com a extensão carregada, perfil novo e temporário.
import './env.mjs';
import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';


export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const EXT = path.resolve(process.env.SINT_EXT || path.join(DIR, '..', 'extension'));
export const VER = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
// o guia abre sozinho na instalação; num PC carregado pode passar de 5 s
export const esperarGuia = (ctx) => until(() => ctx.pages().find((p) => p.url().includes('COMO-INSTALAR')) || null, 25000);
export const SHOT = path.join(DIR, 'shots'); fs.mkdirSync(SHOT, { recursive: true });
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let falhas = 0, total = 0;
export function check(name, cond, info) {
  total++; if (!cond) falhas++;
  console.log((cond ? '✔' : '✘') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
  return !!cond;
}
export function fim() {
  console.log(`\n${total - falhas}/${total} checagens · ${falhas ? 'FALHOU' : 'TUDO PASSOU'}`);
  process.exitCode = falhas ? 1 : 0;
}
export const until = async (fn, ms = 15000, step = 150) => { const end = Date.now() + ms; while (Date.now() < end) { let v; try { v = await fn(); } catch (_) { v = null; } if (v) return v; await wait(step); } return null; };

export async function abrir({ locale = 'pt-BR', ext = EXT, headless = true, autoplay = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sint-prof-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    channel: 'chromium', headless, viewport: { width: 1280, height: 860 }, locale, deviceScaleFactor: 1,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`].concat(autoplay ? ['--autoplay-policy=no-user-gesture-required'] : []),
  });
  ctx.setDefaultTimeout(60000);
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  return { ctx, sw, extId, dir };
}

// estado da interface dentro dos shadow roots
export const estado = (p) => p.evaluate(() => {
  const h = document.querySelector('sintonia-ui'), r = h && h.shadowRoot;
  const card = r && r.querySelector('.card'), toast = r && r.querySelector('.toast');
  const ph = document.querySelector('#movie_player sintonia-player'), pr = ph && ph.shadowRoot, pn = pr && pr.querySelector('.pn');
  const fp = r && r.querySelector('.fpanel .pn');
  const b = document.getElementById('sintonia-btn');
  return {
    hosts: document.querySelectorAll('sintonia-ui').length, btns: document.querySelectorAll('#sintonia-btn').length,
    btn: !!b, btnAntesDaEngrenagem: !!(b && b.nextElementSibling && b.nextElementSibling.classList.contains('ytp-settings-button')),
    card: card && !card.hidden ? { title: (card.querySelector('.ttl b') || {}).textContent, x: !!card.querySelector('.x'), text: card.textContent } : null,
    toast: toast && !toast.hidden ? toast.querySelector('.msg').textContent : null,
    painel: pn ? 'player' : fp ? 'page' : null, painelTexto: (pn || fp || {}).textContent || '',
  };
});
// clica num seletor dentro de um shadow root (host = 'sintonia-ui' | '#movie_player sintonia-player')
export const clicar = (p, host, sel) => p.evaluate(([h, s]) => { const e = document.querySelector(h).shadowRoot.querySelector(s); if (!e) return false; e.click(); return true; }, [host, sel]);
export const shadowAttr = (p, host, sel, attr) => p.evaluate(([h, s, a]) => { const e = document.querySelector(h) && document.querySelector(h).shadowRoot.querySelector(s); return e ? (a === 'text' ? e.textContent : e.getAttribute(a)) : null; }, [host, sel, attr]);
export const PH = '#movie_player sintonia-player', UI = 'sintonia-ui';
