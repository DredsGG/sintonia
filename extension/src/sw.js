// Sintonia — fundo da extensão (service worker): procura versão nova (regras 7 e 14), se recarrega quando a pasta muda,
// põe a versão nova nas abas abertas do YouTube (todas) e, com o botão flutuante desligado, abre o painel pelo ícone. Nada de DOM aqui.
const ext = globalThis.chrome;
const SYNC = ext.storage.sync || ext.storage.local;
const REPO = 'DredsGG/sintonia';
const UPD_KEY = 'st.update';
const YT_TABS = ['https://www.youtube.com/*'];
const MAIN_JS = ['src/main.js'];
const CONTENT = ['src/defaults.js', 'src/i18n.js', 'src/novidades.js', 'src/comum.js', 'src/vendor/qrcode.js', 'src/apoio.js', 'src/datas.js', 'src/core.js', 'src/ui.js', 'src/emdia.js', 'src/fila.js', 'src/atalhos.js', 'src/player.js', 'src/player2.js', 'src/like.js', 'src/distracoes.js', 'src/audio.js', 'src/sb.js', 'src/imagem.js', 'src/comentarios.js'];

const cmpVer = (a, b) => {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0), pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
};
const versaoAtual = () => ext.runtime.getManifest().version;
const tipoInstalacao = async () => { try { return (await ext.management.getSelf()).installType; } catch (_) { return 'development'; } };
let filaUpd = Promise.resolve(); // ler-mudar-gravar em fila (várias abas pedindo ao mesmo tempo não perdem campo)
function salvarUpd(patch) {
  const r = filaUpd.then(async () => {
    const cur = (await ext.storage.local.get(UPD_KEY))[UPD_KEY] || {};
    const novo = Object.assign({}, cur, patch);
    await ext.storage.local.set({ [UPD_KEY]: novo });
    return novo;
  });
  filaUpd = r.catch(() => {});
  return r;
}

// ───────────────────────── atualização (regras 7 e 14 do hub) ─────────────────────────
// Releases do GitHub: ao abrir o navegador, na instalação, a cada 30 min, quando a página do YouTube abre ou volta a ficar
// visível (no máximo 1 vez a cada 10 min) e no botão do rodapé. Release com "URGENTE" no título = urgente: quadro sem X
// e a Sintonia pausa até atualizar. O repo DredsGG/sintonia ainda não existe: 404 = "sem Release", sem erro e sem aviso.
async function procurar() {
  const base = { procuradoEm: Date.now(), atual: versaoAtual(), instalacao: await tipoInstalacao() };
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', credentials: 'omit' });
    if (r.status === 404) return salvarUpd(Object.assign(base, { ultima: null, disponivel: false, urgente: false, erro: null, semRelease: true }));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const ultima = ((String(j.tag_name || '') + ' ' + String(j.name || '')).match(/(\d+\.\d+\.\d+)/) || [])[1] || ''; // aceita "v0.9.0", "sintonia-v0.9.0" etc.
    const asset = (re) => ((j.assets || []).find((a) => re.test(a.name)) || {}).browser_download_url || null;
    const urgente = /urgent/i.test(String(j.name || '') + ' ' + String(j.tag_name || ''));
    return salvarUpd(Object.assign(base, { ultima, urgente, titulo: String(j.name || '').slice(0, 120), notas: String(j.body || '').slice(0, 4000), pagina: j.html_url || null,
      zip: asset(/\.zip$/i), disponivel: !!ultima && cmpVer(ultima, versaoAtual()) > 0, erro: null, semRelease: false }));
  } catch (e) {
    return salvarUpd(Object.assign(base, { erro: String((e && e.message) || e) }));
  }
}

async function aplicar() {
  const st = (await ext.storage.local.get(UPD_KEY))[UPD_KEY] || {};
  const pagina = st.pagina && st.pagina.startsWith(`https://github.com/${REPO}/`) ? st.pagina : `https://github.com/${REPO}/releases/latest`;
  if (await tipoInstalacao() === 'normal' && ext.runtime.requestUpdateCheck) {
    const res = await ext.runtime.requestUpdateCheck().then((r) => (r && r.status) || r).catch(() => 'no_update');
    if (res === 'update_available') { setTimeout(() => ext.runtime.reload(), 1500); return { modo: 'loja' }; }
  }
  // por pasta (modo desenvolvedor): baixa o zip do Release; o guia ensina a extrair por cima da pasta
  if (st.zip && /^https:\/\/github\.com\//.test(st.zip)) {
    try { await ext.downloads.download({ url: st.zip, conflictAction: 'uniquify', saveAs: false }); } catch (_) { await ext.tabs.create({ url: pagina }); }
  } else await ext.tabs.create({ url: pagina });
  await salvarUpd({ baixadoEm: Date.now() });
  return { modo: 'download' };
}

const INTERVALO_MIN_MS = 10 * 60 * 1000;
async function procurarSeVelho() {
  const st = (await ext.storage.local.get(UPD_KEY))[UPD_KEY] || {};
  if (st.procuradoEm && Date.now() - st.procuradoEm < INTERVALO_MIN_MS && st.atual === versaoAtual()) return st;
  return procurar();
}
function abrirGuia(ancora) {
  const a = /^#[a-z]+$/.test(ancora || '') ? ancora : '';
  return ext.tabs.create({ url: ext.runtime.getURL('COMO-INSTALAR.html') + a }).then(() => ({ ok: true }));
}

// ───────────────────────── SponsorBlock (fase 5): cliente próprio, só leitura, só o prefixo do hash ─────────────────────────
// GET https://sponsor.ajay.app/api/skipSegments/<4 primeiros hex do sha256 do videoId>?categories=[todas]. O servidor devolve os
// segmentos de todos os vídeos com esse prefixo (~100, medido em 2026-11-11); o filtro pelo videoId é feito aqui. O ID nunca sai.
// Cache local por vídeo (st.sb.cache): 6 h com segmentos, 10 min sem (vídeo novo costuma ganhar marcação nas primeiras horas);
// quem está assistindo pede de novo com maxIdade (a cada 5 min de vídeo tocando). No máximo 200 vídeos.
const SB_CATS = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'filler', 'music_offtopic'];
const SB_KEY = 'st.sb.cache';
async function sbSegmentos(videoId, maxIdade) {
  if (!/^[\w-]{11}$/.test(videoId || '')) return { segs: [], erro: 'id' };
  const cache = (await ext.storage.local.get(SB_KEY))[SB_KEY] || {};
  const c = cache[videoId];
  const lim = maxIdade > 0 ? maxIdade : c && c.segs.length ? 6 * 3600e3 : 10 * 60e3;
  if (c && Date.now() - c.em < lim) return { segs: c.segs, cache: true, em: c.em };
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(videoId));
  const prefixo = [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 4);
  let segs = [];
  try {
    const r = await fetch(`https://sponsor.ajay.app/api/skipSegments/${prefixo}?categories=${encodeURIComponent(JSON.stringify(SB_CATS))}`, { credentials: 'omit', cache: 'no-store' });
    if (r.status !== 404) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const lista = await r.json();
      const meu = Array.isArray(lista) ? lista.find((x) => x && x.videoID === videoId) : null;
      segs = ((meu && meu.segments) || []).filter((x) => x && Array.isArray(x.segment) && SB_CATS.includes(x.category))
        .map((x) => ({ c: x.category, a: x.actionType || 'skip', s: +x.segment[0], e: +x.segment[1], u: String(x.UUID || '').slice(0, 16), d: +x.videoDuration || 0 }));
    }
  } catch (e) { return { segs: [], erro: String(e.message || e) }; }
  cache[videoId] = { em: Date.now(), segs };
  const ids = Object.keys(cache).sort((a, b) => cache[b].em - cache[a].em);
  for (const id of ids.slice(200)) delete cache[id];
  await ext.storage.local.set({ [SB_KEY]: cache });
  return { segs, em: cache[videoId].em };
}

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === 'sintonia:foto') { // screenshot do quadro (fase 7): PNG com o nome do vídeo e o tempo
    const ok = typeof msg.url === 'string' && msg.url.startsWith('data:image/png;base64,');
    if (!ok) { sendResponse({ ok: false }); return; }
    let nome = String(msg.nome || 'sintonia').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 116) || 'sintonia'; if (!/\.png$/i.test(nome)) nome += '.png';
    ext.downloads.download({ url: msg.url, filename: nome, saveAs: false, conflictAction: 'uniquify' }).then((id) => sendResponse({ ok: true, id }), (e) => sendResponse({ ok: false, erro: String(e) }));
    return true;
  }
  if (msg.type === 'sintonia:sb') { sbSegmentos(msg.videoId, +msg.maxIdade || 0).then(sendResponse, (e) => sendResponse({ segs: [], erro: String(e) })); return true; }
  if (msg.type === 'sintonia:opts') { ext.runtime.openOptionsPage().then(() => sendResponse({ ok: true }), () => sendResponse({})); return true; }
  if (msg.type !== 'sintonia:update') return;
  const run = msg.cmd === 'check' ? procurar() : msg.cmd === 'check-soft' ? procurarSeVelho() : msg.cmd === 'apply' ? aplicar() : msg.cmd === 'guide' ? abrirGuia(msg.data)
    : msg.cmd === 'diag' ? tipoInstalacao().then((instalacao) => ({ instalacao }))
    : msg.cmd === 'dismiss' ? salvarUpd({ dispensada: typeof msg.data === 'string' ? msg.data.slice(0, 20) : null }) : Promise.resolve({});
  run.then((r) => sendResponse(r || {}), (e) => sendResponse({ erro: String((e && e.message) || e) }));
  return true;
});

// ───────────────────────── ícone da extensão: só abre o painel com o botão flutuante desligado ─────────────────────────
// Na aba do YouTube abre/fecha o painel (no player, se tiver vídeo; senão, solto no canto). Em outra aba, abre os Ajustes.
async function injetar(tabId) {
  await ext.scripting.executeScript({ target: { tabId }, files: MAIN_JS, world: 'MAIN' });
  await ext.scripting.executeScript({ target: { tabId }, files: CONTENT });
}
// (2026-11-11, pedido do André) o menu agora é o botão flutuante dentro do YouTube: no YouTube o clique no ícone só abre o
// menu quando o botão flutuante não está à vista (desligado, escondido em cima do vídeo, tela cheia); quem decide é a página.
// Fora do YouTube abre os Ajustes.
ext.action.onClicked.addListener(async (tab) => {
  const noYT = tab && /^https:\/\/www\.youtube\.com\//.test(tab.url || '');
  if (noYT) {
    try { await ext.tabs.sendMessage(tab.id, { type: 'sintonia:painel', icone: true }); return; } catch (_) {}
    try { await injetar(tab.id); await new Promise((r) => setTimeout(r, 400)); await ext.tabs.sendMessage(tab.id, { type: 'sintonia:painel', icone: true }); return; } catch (_) {}
  }
  ext.runtime.openOptionsPage();
});

// ───────────────────────── selo no ícone: "!" urgente, "OFF" desligada, "↑" versão nova ─────────────────────────
async function selo() {
  try {
    const s = await SYNC.get({ on: true });
    const u = (await ext.storage.local.get(UPD_KEY))[UPD_KEY] || {};
    const nova = u.disponivel && u.ultima && cmpVer(u.ultima, versaoAtual()) > 0;
    const txt = nova && u.urgente ? '!' : !s.on ? 'OFF' : nova ? '↑' : '';
    await ext.action.setBadgeText({ text: txt });
    await ext.action.setBadgeBackgroundColor({ color: nova && u.urgente ? '#ff0033' : nova ? '#3ea6ff' : '#3f3f3f' });
    if (ext.action.setBadgeTextColor) await ext.action.setBadgeTextColor({ color: nova && !u.urgente ? '#0f0f0f' : '#ffffff' }).catch(() => {});
  } catch (_) {}
}
ext.storage.onChanged.addListener((ch, area) => { if ((area !== 'local' && ch.on) || (area === 'local' && ch[UPD_KEY])) selo(); });

// ───────────────────────── versão nova na pasta (modo desenvolvedor) ─────────────────────────
// O navegador não deixa a extensão trocar os próprios arquivos. Quando a versão nova chega na pasta (zip extraído por cima,
// ou gravada pela IA com o manifest por último), a extensão percebe em até 1 min e se recarrega; depois se injeta em todas as
// abas abertas do YouTube, sem recarregar a página (não interrompe o vídeo).
let recargaPendente = null;
const anotarDisco = (o) => ext.storage.local.set({ 'st.disco': Object.assign({ em: Date.now(), rodando: versaoAtual() }, o) }).catch(() => {});
async function conferirDisco() {
  if (await tipoInstalacao() !== 'development') return;
  try {
    const r = await fetch(ext.runtime.getURL('manifest.json') + '?t=' + Date.now(), { cache: 'no-store' });
    const noDisco = (await r.json()).version;
    if (!noDisco || noDisco === versaoAtual() || recargaPendente === noDisco) { anotarDisco({ noDisco, estado: recargaPendente === noDisco ? 'recarregando' : 'igual' }); return; }
    anotarDisco({ noDisco, estado: 'recarregando' });
    recargaPendente = noDisco;
    setTimeout(() => ext.runtime.reload(), 15000); // dá tempo de o resto dos arquivos terminar de chegar
  } catch (_) { /* manifest no meio da gravação: tenta no próximo minuto */ }
}
async function injetarNasAbas() {
  try {
    for (const t of await ext.tabs.query({ url: YT_TABS })) {
      if (t.discarded) continue;
      injetar(t.id).catch(() => {});
    }
  } catch (_) {}
}

const agendar = () => {
  ext.alarms.create('st-procura', { delayInMinutes: 1, periodInMinutes: 30 });
  ext.alarms.create('st-disco', { delayInMinutes: 1, periodInMinutes: 1 });
};
ext.alarms.onAlarm.addListener((a) => {
  if (a.name === 'st-procura') procurar();
  if (a.name === 'st-disco') conferirDisco();
});
ext.runtime.onStartup.addListener(() => { agendar(); procurar(); selo(); });
ext.runtime.onInstalled.addListener(async (d) => {
  agendar();
  selo();
  // regra 12: instalação nova → tutorial na primeira abertura do YouTube; atualização → quadro de novidades
  try {
    const ob = (await ext.storage.local.get('st.onboard'))['st.onboard'];
    if (d.reason === 'install' && !ob) await ext.storage.local.set({ 'st.onboard': { tutorial: 'pendente', visto: versaoAtual() } });
    if (d.reason === 'update' && !ob) await ext.storage.local.set({ 'st.onboard': { tutorial: 'pulado', visto: d.previousVersion || '' } });
  } catch (_) {}
  // 0.10.1: a chave "Comentários mais recentes" virou a seleção "Ordem dos comentários"
  try { const o = await SYNC.get(['comentRecentes', 'comentOrdem']); if ('comentRecentes' in o) { if (o.comentRecentes && !o.comentOrdem) await SYNC.set({ comentOrdem: 'recentes' }); await SYNC.remove('comentRecentes'); } } catch (_) {}
  if (d.reason === 'install') ext.tabs.create({ url: ext.runtime.getURL('COMO-INSTALAR.html#usar') });
  if (d.reason === 'update') await salvarUpd({ acabouDeAtualizar: { de: d.previousVersion || null, para: versaoAtual(), em: Date.now() }, disponivel: false, atual: versaoAtual() });
  injetarNasAbas();
  procurar();
});
// o service worker pode dormir: garante os alarmes sempre que acordar
ext.alarms.get('st-disco').then((a) => { if (!a) agendar(); }, () => agendar());
