// Sintonia — Em Dia (fase 1): fila das Inscrições em /feed/subscriptions.
// Um botão "Em Dia" muda a visão para os vídeos de Hoje (24 h), 3 dias ou 7 dias, em grade no visual do YouTube.
// Fonte dos dados: o próprio DOM do feed (o YouTube já desenhou os cards); para ir além da 1ª página, a Sintonia rola a página
// de baixo (coberta pela visão da Em Dia) e deixa o próprio YouTube buscar a continuação, até passar do período (teto de 300).
// "Não quero ver" é só uma marcação visual local (st.emdia): nunca usa o "Não tenho interesse" do YouTube, nada vai para a conta.
(() => {
  'use strict';
  const SINT = globalThis.SINT, D = globalThis.SINT_DATAS;
  if (!SINT || SINT.dead || !D) return;
  const { ext, C } = SINT;
  const { esc } = C;
  const L = () => SINT.L();
  const K_MARCAS = 'st.emdia', K_PER = 'st.emdia.periodo';
  const TETO = 300, DIAS_MARCA = 30;
  const PERIODOS = [24, 72, 168];

  // ───────────────────────── marcações locais (pulado / visto), apagadas depois de 30 dias ─────────────────────────
  let marcas = {};
  let marcQ = Promise.resolve();
  function marcar(ids, s) { // s = 'p' (pulado) | 'v' (visto/concluído) | null (desfazer)
    const lista = [].concat(ids);
    marcQ = marcQ.then(async () => {
      const cur = (await ext.storage.local.get(K_MARCAS))[K_MARCAS] || {};
      const agora = Date.now(), velho = agora - DIAS_MARCA * 864e5;
      for (const k of Object.keys(cur)) if (!cur[k] || cur[k].em < velho) delete cur[k];
      for (const id of lista) { if (s) cur[id] = { s, em: agora }; else delete cur[id]; }
      marcas = cur;
      await ext.storage.local.set({ [K_MARCAS]: cur });
    }).catch(() => {});
    return marcQ;
  }
  // fim da fila: a Sintonia navega para as Inscrições e a Em Dia abre sozinha ao chegar (uma vez; vale 60 s; sobrevive a uma recarga)
  const K_ABRIR = 'sintonia.abrirEmDia';
  let abrirPendente = 0;
  const abrirAoChegar = () => { abrirPendente = Date.now(); try { sessionStorage.setItem(K_ABRIR, String(abrirPendente)); } catch (_) {} };
  SINT.emdia = { marcar, abrirAoChegar, get marcas() { return marcas; } };
  try { const t = +sessionStorage.getItem(K_ABRIR); if (t && Date.now() - t < 60000) abrirPendente = t; } catch (_) {}

  // ───────────────────────── leitura do feed (DOM medido em 2026-11-11) ─────────────────────────
  const naInscricoes = () => location.pathname === '/feed/subscriptions';
  const raizFeed = () => document.querySelector('ytd-browse[page-subtype="subscriptions"]') || (naInscricoes() ? document.querySelector('ytd-browse:not([hidden])') : null);
  const SEL_ITEM = 'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer';
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
  function lerItem(el) {
    const a = el.querySelector('a[href*="/watch?v="], a[href^="/shorts/"]');
    if (!a) return null;
    const href = a.getAttribute('href') || '';
    let id = null, shorts = false;
    const mw = href.match(/[?&]v=([\w-]{11})/), ms = href.match(/^\/shorts\/([\w-]{11})/);
    if (mw) id = mw[1]; else if (ms) { id = ms[1]; shorts = true; }
    if (!id) return null;
    const h3 = el.querySelector('h3[title]');
    const titulo = (h3 && h3.getAttribute('title')) || txt(el.querySelector('#video-title, .ytLockupMetadataViewModelTitle, [class*="MetadataViewModelTitle"], h3')) || '';
    const linhas = [...el.querySelectorAll('[class*="MetadataRow"], #metadata-line, #byline-container, ytd-channel-name')];
    const textos = [];
    for (const s of el.querySelectorAll('[class*="MetadataRow"] span[role="text"], #metadata-line span, .inline-metadata-item, ytd-channel-name #text')) { const t = txt(s); if (t) textos.push(t); }
    const selos = [];
    for (const b of el.querySelectorAll('badge-shape, .ytBadgeShapeText, [class*="badge-shape"] [class*="text"], ytd-badge-supported-renderer, ytd-thumbnail-overlay-time-status-renderer')) { const t = txt(b); if (t) selos.push(t); }
    let idade = null;
    for (const t of textos) { idade = D.idade(t); if (idade) break; }
    const dur = selos.find((t) => /^\d{1,2}(:\d{2}){1,2}$/.test(t)) || '';
    // canal: 1ª linha de metadados (layout novo) ou ytd-channel-name (antigo)
    // canal: link do canal nos metadados (medido no feed real de Inscrições em 2026-11-11: a[href^="/@"] dentro da 1ª linha);
    // reserva: a 1ª linha de metadados (layout da grade de canal) ou ytd-channel-name (antigo)
    const linkCanal = [...el.querySelectorAll('yt-lockup-metadata-view-model a[href^="/@"], yt-lockup-metadata-view-model a[href^="/channel/"], #metadata a[href^="/@"], ytd-channel-name a')].find((x) => txt(x));
    const linha1 = linhas[0] ? txt(linhas[0].querySelector('span[role="text"]') || linhas[0].querySelector('a') || linhas[0]) : '';
    const canal = linkCanal ? txt(linkCanal) : linha1 && !D.idade(linha1) && !/^\d/.test(linha1) ? linha1 : '';
    // progresso assistido (barra vermelha). Inferido: só aparece logado; nomes do layout novo e do antigo.
    let prog = 0;
    for (const p of el.querySelectorAll('[class*="ProgressBar"][class*="Segment"], [class*="ProgressBar"] [style*="width"], #progress')) {
      const m = (p.getAttribute('style') || '').match(/width:\s*([\d.]+)%/);
      if (m) { prog = Math.max(prog, parseFloat(m[1])); }
    }
    const naPrateleira = !!el.closest('ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-rich-section-renderer');
    // o nome do canal não entra na classificação (canal "Live Science" não vira live: achado da revisão)
    const tipo = shorts ? 'shorts' : D.tipo(textos.filter((t) => t !== canal).concat(selos));
    const avImg = el.querySelector('img.ytSpecAvatarShapeImage, yt-avatar-shape img, yt-decorated-avatar-view-model img, #avatar img');
    const avatar = avImg && /^https:\/\/yt\d\.(ggpht|googleusercontent)\.com\//.test(avImg.src || '') ? avImg.src : '';
    return { id, shorts, titulo: titulo.trim(), canal, textos, selos, idade, tipo, prog, dur, naPrateleira, avatar };
  }
  function lerFeed() {
    const r = raizFeed();
    if (!r) return null;
    const vistos = new Set(), itens = [];
    for (const el of r.querySelectorAll(SEL_ITEM)) {
      const it = lerItem(el);
      if (!it || vistos.has(it.id)) continue;
      vistos.add(it.id); itens.push(it);
      if (itens.length >= TETO) break;
    }
    return itens;
  }
  const ultimaIdade = (itens) => { let m = 0; for (const it of itens) if (!it.naPrateleira && it.idade && it.tipo !== 'agendado' && it.tipo !== 'estreia') m = Math.max(m, it.idade.min); return m; };

  // carrega mais itens rolando a página de baixo até passar do período (ou do teto, ou do fim do feed)
  let carregando = false, lidos = 0, fimFeed = false;
  async function carregar(limiteH) {
    if (carregando) return;
    carregando = true; fimFeed = false;
    try {
      for (let volta = 0; volta < 40 && ativa; volta++) {
        const itens = lerFeed() || [];
        lidos = itens.length; desenhar();
        if (itens.length >= TETO || ultimaIdade(itens) >= limiteH) break;
        const antes = itens.length;
        const cont = raizFeed() && raizFeed().querySelector('ytd-continuation-item-renderer');
        if (!cont) { fimFeed = true; break; }
        const se = document.scrollingElement || document.documentElement;
        se.scrollTop = se.scrollHeight;
        try { cont.scrollIntoView({ block: 'end' }); } catch (_) {}
        const ok = await esperar(() => ((lerFeed() || []).length > antes), 8000);
        if (!ok) { fimFeed = true; break; }
      }
    } finally { carregando = false; }
    desenhar();
  }
  const esperar = (f, ms) => new Promise((ok) => { const t0 = Date.now(); const tk = () => { if (!ativa) return ok(false); if (f()) return ok(true); if (Date.now() - t0 > ms) return ok(false); setTimeout(tk, 250); }; tk(); });

  // ───────────────────────── visão da Em Dia ─────────────────────────
  let ativa = false, host = null, root = null, periodo = 24, confirmarTodos = false, scrollAntes = 0;
  const filtroOk = (it) => {
    const S = SINT.S;
    if (it.shorts) return !!S.emdiaShorts && !!it.idade; // Shorts da prateleira não têm data: ficam fora
    if (it.tipo === 'aoVivo' || it.tipo === 'live') return !!S.emdiaLives;
    if (it.tipo === 'estreia') return !!S.emdiaEstreias;
    if (it.tipo === 'agendado') return !!S.emdiaAgendados;
    return true;
  };
  // agendados e estreias não têm "há N": entram em qualquer período quando a chave deles está ligada
  const noPeriodo = (it) => (it.tipo === 'agendado' || it.tipo === 'estreia' ? true : it.tipo === 'aoVivo' ? true : !!it.idade && it.idade.min < periodo);
  const concluido = (it) => (marcas[it.id] && marcas[it.id].s === 'v') || it.prog >= 90;
  const pulado = (it) => marcas[it.id] && marcas[it.id].s === 'p';
  function lista() {
    const itens = (lerFeed() || []).filter((it) => filtroOk(it) && noPeriodo(it));
    // ordem: mais antigo primeiro (o feed vem do mais novo para o mais antigo)
    itens.sort((a, b) => ((b.idade ? b.idade.min : -1) - (a.idade ? a.idade.min : -1)));
    if (SINT.S.emdiaInverter) itens.reverse();
    return itens;
  }
  let recemPulados = new Set(); // continuam na tela (apagados, com Desfazer) até redesenhar o período
  function contagem(itens) {
    let ver = 0, ok = 0;
    for (const it of itens) { if (pulado(it) || concluido(it)) ok++; else ver++; }
    return { ver, ok };
  }
  SINT.emdia.restantes = () => lista().filter((it) => !pulado(it) && !concluido(it)).map((it) => it.id);

  // Visual da grade do próprio YouTube (medido em 2026-11-11): miniatura raio 12, título 16/22 peso 500 em 2 linhas,
  // avatar do canal 36 px, canal e "visualizações · data" 14/20 em cinza, chips de filtro 32 px raio 8, botões pílula 36 px.
  // Ações do card ficam em cima da miniatura no hover (como "Assistir mais tarde" do YouTube), nunca tapando o título.
  const CSS_EMDIA = `
.ed { position: fixed; z-index: 2019; overflow-y: auto; overscroll-behavior: contain; background: var(--bg); color: var(--tx); }
.ed .in { max-width: 2256px; margin: 0 auto; padding: 0 24px 64px; }
.ed .topo { position: sticky; top: 0; z-index: 3; background: var(--bg); padding: 16px 0 12px; }
.ed .hd { display: flex; align-items: center; gap: 12px; min-height: 40px; }
.ed .hd h1 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.ed .hd h1 svg { color: var(--acc); width: 24px; height: 24px; }
.ed .hd .sub { color: var(--tx2); font-size: 14px; line-height: 20px; }
.ed .hd .sp { flex: 1; }
.ed .x { width: 40px; height: 40px; border-radius: 20px; display: flex; align-items: center; justify-content: center; }
.ed .x:hover { background: var(--add); }
.ed .linha { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
.ed .chips { display: flex; gap: 12px; flex-wrap: wrap; }
.ed .chip { height: 32px; padding: 0 12px !important; border-radius: 8px; background: var(--add); font-size: 14px !important; font-weight: 500 !important; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.ed .chip:hover { background: var(--hov); }
.ed .chip[aria-selected=true], .ed .chip[aria-pressed=true] { background: var(--tx); color: var(--bg); }
.ed .chip svg { width: 18px; height: 18px; }
.ed .div { width: 1px; height: 24px; background: var(--line); }
.ed .cnt { font-size: 14px; line-height: 20px; color: var(--tx2); margin-right: auto; }
.ed .cnt b { color: var(--tx); font-weight: 500; }
.ed .acoes { display: flex; gap: 8px; flex-wrap: wrap; }
.ed .btn svg { width: 20px; height: 20px; }
.ed .conf, .ed .sel { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 16px; border-radius: 12px; background: var(--accbg); margin-top: 12px; flex-wrap: wrap; }
.ed .conf span, .ed .sel span { flex: 1; min-width: 200px; }
.ed .st { color: var(--tx2); font-size: 14px; margin: 4px 0 0; min-height: 20px; }
.ed .vazio { padding: 64px 16px; text-align: center; color: var(--tx2); } .ed .vazio b { display: block; color: var(--tx); font-size: 18px; line-height: 24px; margin-bottom: 4px; }
.ed .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 40px 16px; margin-top: 8px; }
.ed .cd { display: flex; flex-direction: column; gap: 12px; min-width: 0; transition: opacity .15s; position: relative; }
.ed .cd.off { opacity: .45; }
.ed .th { position: relative; display: block; aspect-ratio: 16/9; border-radius: 12px; overflow: hidden; background: var(--add); }
.ed .th img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ed .du { position: absolute; right: 8px; bottom: 8px; padding: 1px 4px; border-radius: 4px; background: rgba(0,0,0,.8); color: #fff; font-size: 12px; line-height: 18px; font-weight: 500; }
.ed .pg { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(255,255,255,.4); } .ed .pg i { display: block; height: 100%; background: #f03; }
.ed .selo { position: absolute; left: 8px; bottom: 8px; padding: 1px 6px; border-radius: 4px; background: rgba(0,0,0,.8); color: #fff; font-size: 12px; line-height: 18px; font-weight: 500; }
.ed .hov { position: absolute; right: 8px; top: 8px; display: flex; flex-direction: column; gap: 4px; opacity: 0; transition: opacity .1s; }
.ed .cd:hover .hov, .ed .hov:focus-within { opacity: 1; }
.ed .hov button { width: 36px; height: 36px; border-radius: 6px; background: rgba(0,0,0,.8) !important; color: #fff; display: flex; align-items: center; justify-content: center; position: relative; }
.ed .hov button svg { width: 20px; height: 20px; }
.ed .hov button::after { content: attr(data-dica); position: absolute; right: 42px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,.8); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .1s; }
.ed .hov button:hover::after { opacity: 1; }
.ed .ck { position: absolute; left: 8px; top: 8px; width: 28px; height: 28px; border-radius: 14px; border: 2px solid #fff; background: rgba(0,0,0,.4); display: none; align-items: center; justify-content: center; color: #fff; }
.ed.selecao .ck { display: flex; }
.ed.selecao .hov { display: none; }
.ed .cd.marcado .ck { background: var(--acc); border-color: var(--acc); color: var(--onacc); }
.ed .cd.marcado .th { outline: 3px solid var(--acc); outline-offset: 2px; }
.ed.selecao .cd { cursor: pointer; }
.ed .info { display: flex; gap: 12px; min-width: 0; }
.ed .av { width: 36px; height: 36px; border-radius: 18px; flex: none; background: var(--add); object-fit: cover; }
.ed .tx { min-width: 0; display: flex; flex-direction: column; }
.ed .tt { color: var(--tx); text-decoration: none; font-size: 16px; line-height: 22px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ed .mt { font-size: 14px; line-height: 20px; color: var(--tx2); margin-top: 4px; }
.ed .mt span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed .undo { color: var(--acc); font-size: 14px !important; font-weight: 500 !important; padding: 4px 0 !important; align-self: flex-start; }
.edbtn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px 0 12px !important; border-radius: 18px; background: var(--add) !important; color: var(--tx); font: 500 14px/36px Roboto, Arial, sans-serif; white-space: nowrap; }
.edbtn:hover { background: var(--hov) !important; } .edbtn svg { width: 20px; height: 20px; color: var(--acc); }
.edbtn[aria-pressed=true] { background: var(--tx) !important; color: var(--bg); } .edbtn[aria-pressed=true] svg { color: inherit; }
`;
  const ICO_ED = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M4 12h10M4 18h7"/><path d="M15 17l2.5 2.5L22 15"/></svg>';
  const ICO_EYE = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/></svg>';
  const ICO_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>';
  const ICO_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICO_SEL = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12.5l3 3 5-6"/></svg>';
  const tema = () => (document.documentElement.hasAttribute('dark') ? 'dark' : 'light');

  let selecionando = false, selecionados = new Set();
  function abrir() {
    if (ativa) return;
    ativa = true; confirmarTodos = false; recemPulados = new Set(); selecionando = false; selecionados = new Set();
    scrollAntes = (document.scrollingElement || document.documentElement).scrollTop;
    if (!host) {
      host = document.createElement('sintonia-emdia');
      root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${C.CSS}${CSS_EMDIA}</style><div class="sint" data-theme="${tema()}"><div class="ed" role="region" aria-label="Em Dia"></div></div>`;
      for (const ev of ['keydown', 'keyup', 'keypress']) host.addEventListener(ev, (e) => e.stopPropagation());
    }
    root.querySelector('.sint').dataset.theme = tema();
    document.documentElement.appendChild(host);
    posicionar();
    desenhar();
    carregar(periodo);
    SINT.log('emdia-abrir');
    pintarBotao();
  }
  function fechar() {
    if (!ativa) return;
    ativa = false; selecionando = false; selecionados = new Set();
    if (host) host.remove();
    const se = document.scrollingElement || document.documentElement; se.scrollTop = scrollAntes;
    pintarBotao();
  }
  SINT.emdia.abrir = abrir; SINT.emdia.fechar = fechar; SINT.emdia.aberta = () => ativa;
  // cobre só a área do conteúdo (abaixo do topo do YouTube e à direita do menu lateral)
  function posicionar() {
    if (!host) return;
    const mh = document.querySelector('#masthead-container, ytd-masthead');
    const top = mh ? Math.max(0, Math.round(mh.getBoundingClientRect().bottom)) : 56;
    const pm = document.querySelector('ytd-page-manager');
    const left = pm ? Math.max(0, Math.round(pm.getBoundingClientRect().left)) : 0;
    const ed = root.querySelector('.ed');
    ed.style.top = top + 'px'; ed.style.left = left + 'px'; ed.style.right = '0px'; ed.style.bottom = '0px';
  }

  const fmtIdade = (it) => it.textos.find((t) => D.idade(t)) || it.textos.find((t) => /estreia|premiere|estreno|programad|scheduled|agendad/i.test(t)) || '';
  const fmtViews = (it) => it.textos.find((t) => !D.idade(t) && /\d/.test(t) && t !== it.canal) || '';
  function cardHtml(it) {
    const T = L(), p = pulado(it), c = concluido(it), mostra = p || c, marc = selecionados.has(it.id);
    const url = it.shorts ? `/shorts/${it.id}` : `/watch?v=${it.id}`;
    const linha2 = [fmtViews(it), fmtIdade(it)].filter(Boolean).join(' • ');
    return `<div class="cd${mostra ? ' off' : ''}${marc ? ' marcado' : ''}" data-id="${esc(it.id)}">
      <a class="th" href="${url}" tabindex="-1"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${esc(it.id)}/mqdefault.jpg">
        ${it.dur ? `<span class="du">${esc(it.dur)}</span>` : ''}${it.prog ? `<span class="pg"><i style="width:${Math.min(100, it.prog)}%"></i></span>` : ''}
        ${p ? `<span class="selo">${esc(T.edPulado)}</span>` : c ? `<span class="selo">${esc(T.edVisto)}</span>` : ''}
        <span class="ck" aria-hidden="true">${marc ? ICO_CHECK : ''}</span></a>
      ${!p && !c ? `<div class="hov"><button type="button" data-skip="${esc(it.id)}" data-dica="${esc(T.edNaoQuero)}" aria-label="${esc(T.edNaoQuero)}">${ICO_EYE}</button></div>` : ''}
      <div class="info">${it.avatar ? `<img class="av" alt="" loading="lazy" src="${esc(it.avatar)}">` : '<span class="av"></span>'}
        <div class="tx"><a class="tt" href="${url}" title="${esc(it.titulo)}">${esc(it.titulo)}</a>
          <div class="mt">${it.canal ? `<span>${esc(it.canal)}</span>` : ''}<span>${esc(linha2)}</span></div>
          ${p ? `<button type="button" class="undo" data-undo="${esc(it.id)}">${esc(T.edDesfazer)}</button>` : ''}</div></div></div>`;
  }
  function desenhar() {
    if (!ativa || !root) return;
    const T = L(), feed = lerFeed();
    const ed = root.querySelector('.ed');
    const sc = ed.scrollTop;
    root.querySelector('.sint').dataset.theme = tema();
    ed.classList.toggle('selecao', selecionando);
    let corpo;
    const todos = feed ? lista() : [];
    const vis = todos.filter((it) => SINT.S.emdiaMostrarPulados || !pulado(it) || recemPulados.has(it.id));
    const { ver, ok } = contagem(todos);
    const fila = SINT.fila && SINT.fila.estado();
    const retomar = fila && fila.origem === 'emdia' && fila.i < fila.ids.length;
    if (!feed) corpo = `<div class="vazio"><b>${esc(T.edSemFeed)}</b>${esc(T.edSemFeedSub)}</div>`;
    else if (!todos.length && !carregando) corpo = `<div class="vazio"><b>${esc(T.edVazio)}</b>${esc(T.edVazioSub)}</div>`;
    else if (!ver && !carregando && !SINT.S.emdiaMostrarPulados && !recemPulados.size) corpo = `<div class="vazio"><b>${esc(T.edVazio)}</b>${esc(T.edVazioSub)}</div>`; // nada para ver: tudo visto ou pulado
    else corpo = `<div class="grid">${vis.map(cardHtml).join('')}</div>`;
    const nSel = selecionados.size;
    ed.innerHTML = `<div class="in"><div class="topo">
      <div class="hd"><h1>${ICO_ED}Em Dia</h1><span class="sub">${esc(SINT.S.emdiaInverter ? T.edSubNovo : T.edSubAntigo)}</span><span class="sp"></span>
        <button class="x" type="button" data-act="fechar" title="${esc(T.edFechar)}" aria-label="${esc(T.edFechar)}">${C.ICO.x}</button></div>
      <div class="linha"><div class="chips" role="tablist">${PERIODOS.map((h) => `<button class="chip" type="button" role="tab" data-per="${h}" aria-selected="${periodo === h}">${esc(T.edPer[h])}</button>`).join('')}</div>
        <span class="div"></span>
        <button class="chip" type="button" aria-pressed="${!!SINT.S.emdiaMostrarPulados}" data-act="mostrar">${esc(T.edMostrar)}</button>
        <button class="chip" type="button" aria-pressed="${!!SINT.S.emdiaInverter}" data-act="ordem">${esc(T.edNovoPrimeiro)}</button></div>
      <div class="linha"><span class="cnt" role="status">${esc(T.edConta(ver, ok))}</span>
        <div class="acoes">
        ${retomar && !selecionando ? `<button class="btn pri" type="button" data-act="continuar">${ICO_PLAY}${esc(T.edContinuar(fila.i + 1, fila.ids.length))}</button>` : ''}
        ${!selecionando ? `<button class="btn ${retomar ? 'sec' : 'pri'}" type="button" data-act="comecar"${ver ? '' : ' disabled'}>${ICO_PLAY}${esc(T.edComecar)}</button>
          <button class="btn sec" type="button" data-act="selecionar"${ver ? '' : ' disabled'}>${ICO_SEL}${esc(T.edSelecionar)}</button>
          <button class="btn sec" type="button" data-act="todos"${ver ? '' : ' disabled'}>${esc(T.edTodos)}</button>` : ''}</div></div>
      ${selecionando ? `<div class="sel" role="toolbar" aria-label="${esc(T.edSelecionar)}"><span><b>${esc(T.edSelN(nSel))}</b> · ${esc(T.edSelDica)}</span>
          <button class="btn sec" type="button" data-act="selTodos">${esc(T.edSelTodos)}</button>
          <button class="btn sec" type="button" data-act="selPular"${nSel ? '' : ' disabled'}>${ICO_EYE}${esc(T.edNaoQuero)}</button>
          <button class="btn pri" type="button" data-act="selPularComecar"${nSel ? '' : ' disabled'}>${ICO_PLAY}${esc(T.edPularEComecar)}</button>
          <button class="btn sec" type="button" data-act="selSair">${esc(T.edCancelar)}</button></div>` : ''}
      ${confirmarTodos ? `<div class="conf" role="alertdialog"><span>${esc(T.edConfTodos(ver))}</span><button class="btn sec" type="button" data-act="nao">${esc(T.edCancelar)}</button><button class="btn pri" type="button" data-act="sim">${esc(T.edMarcar)}</button></div>` : ''}
      <div class="st" role="status">${carregando ? esc(T.edCarregando(lidos)) : feed && fimFeed && lidos >= TETO ? esc(T.edTeto(TETO)) : ''}</div></div>
      ${corpo}</div>`;
    ed.scrollTop = sc;
    ligar(ed);
  }
  function ligar(ed) {
    ed.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => { periodo = +b.dataset.per; recemPulados = new Set(); confirmarTodos = false; selecionados = new Set(); try { ext.storage.local.set({ [K_PER]: periodo }); } catch (_) {} desenhar(); carregar(periodo); }));
    ed.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); recemPulados.add(b.dataset.skip); await marcar(b.dataset.skip, 'p'); desenhar(); }));
    ed.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', async (e) => { e.stopPropagation(); await marcar(b.dataset.undo, null); desenhar(); }));
    ed.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => acao(b.dataset.act)));
    // modo Selecionar: clique no card marca/desmarca (em vez de abrir o vídeo)
    ed.querySelectorAll('.cd').forEach((c) => c.addEventListener('click', (e) => {
      if (!selecionando) return;
      e.preventDefault(); e.stopPropagation();
      const id = c.dataset.id, it = lista().find((x) => x.id === id);
      if (!it || pulado(it) || concluido(it)) return;
      if (selecionados.has(id)) selecionados.delete(id); else selecionados.add(id);
      desenhar();
    }, true));
  }
  async function acao(a) {
    if (a === 'fechar') return fechar();
    if (a === 'todos') { confirmarTodos = true; return desenhar(); }
    if (a === 'nao') { confirmarTodos = false; return desenhar(); }
    if (a === 'sim') { confirmarTodos = false; const ids = SINT.emdia.restantes(); ids.forEach((id) => recemPulados.add(id)); await marcar(ids, 'p'); SINT.log('emdia-todos'); return desenhar(); }
    if (a === 'mostrar') { await SINT.setSetting('emdiaMostrarPulados', !SINT.S.emdiaMostrarPulados); return desenhar(); }
    if (a === 'ordem') { await SINT.setSetting('emdiaInverter', !SINT.S.emdiaInverter); return desenhar(); }
    if (a === 'selecionar') { selecionando = true; selecionados = new Set(); confirmarTodos = false; return desenhar(); }
    if (a === 'selSair') { selecionando = false; selecionados = new Set(); return desenhar(); }
    if (a === 'selTodos') { const r = SINT.emdia.restantes(); if (r.every((id) => selecionados.has(id))) selecionados = new Set(); else selecionados = new Set(r); return desenhar(); }
    if (a === 'selPular' || a === 'selPularComecar') {
      const ids = [...selecionados];
      if (!ids.length) return;
      ids.forEach((id) => recemPulados.add(id));
      await marcar(ids, 'p');
      SINT.log('emdia-selecao');
      selecionando = false; selecionados = new Set();
      if (a === 'selPularComecar') { const r = SINT.emdia.restantes(); if (r.length && SINT.fila) { SINT.log('emdia-comecar'); SINT.fila.comecar(r, 0, 'emdia'); return; } }
      return desenhar();
    }
    if (a === 'comecar') { const ids = SINT.emdia.restantes(); if (ids.length && SINT.fila) { SINT.log('emdia-comecar'); SINT.fila.comecar(ids, 0, 'emdia'); } return; }
    if (a === 'continuar') { if (SINT.fila) SINT.fila.continuar(); }
  }

  // ───────────────────────── botão "Em Dia" na página das Inscrições ─────────────────────────
  // Lugar (medido no feed real em 2026-11-11): no cabeçalho da prateleira "Mais recentes" (ytd-shelf-renderer #title-container),
  // ao lado do botão "Todas as inscrições" (#subscribe-button), no mesmo formato. Reserva: antes da grade; último caso: canto.
  const BTN_ID = 'sintonia-emdia-btn';
  function pintarBotao() {
    const b = document.getElementById(BTN_ID);
    if (b && b._root) { const x = b._root.querySelector('.edbtn'); if (x) { x.setAttribute('aria-pressed', String(ativa)); x.querySelector('span').textContent = ativa ? L().edVoltar : 'Em Dia'; } }
  }
  function garantirBotao() {
    const ligado = SINT.ativo() && SINT.S.emdia && naInscricoes();
    let b = document.getElementById(BTN_ID);
    if (!ligado) { if (b) b.remove(); if (ativa) fechar(); return; }
    const r = raizFeed();
    const sub = r && r.querySelector('ytd-shelf-renderer #title-container #subscribe-button');
    const grade = r && r.querySelector('ytd-rich-grid-renderer, ytd-section-list-renderer');
    if (!b) {
      b = document.createElement('div');
      b.id = BTN_ID;
      const sr = b.attachShadow({ mode: 'open' });
      sr.innerHTML = `<style>${C.CSS}${CSS_EMDIA}</style><div class="sint" data-theme="${tema()}"><button class="edbtn" type="button" aria-pressed="false" title="${esc(L().edDica)}">${ICO_ED}<span>Em Dia</span></button></div>`;
      sr.querySelector('.edbtn').addEventListener('click', () => (ativa ? fechar() : abrir()));
      b._root = sr;
    }
    b._root.querySelector('.sint').dataset.theme = tema();
    b._root.querySelector('.edbtn').title = L().edDica;
    if (sub) {
      if (b.nextElementSibling !== sub) { b.style.cssText = 'display:inline-flex;align-items:center;margin-right:8px'; sub.parentElement.insertBefore(b, sub); }
    } else if (grade) {
      if (b.nextElementSibling !== grade) { b.style.cssText = 'display:flex;justify-content:flex-end;padding:16px 24px 0;'; grade.parentElement.insertBefore(b, grade); }
    } else if (b.isConnected) b.remove(); // sem cabeçalho nem grade ainda: espera (nunca fixo por cima da página)
    pintarBotao();
  }

  // gancho de teste: lê a grade de qualquer página (ex.: vídeos de um canal público, mesmos componentes das Inscrições)
  // e devolve um resumo no atributo data-sint-feed. Só conta campos lidos; não guarda nem envia nada.
  const onTeste = () => {
    const its = [...document.querySelectorAll(SEL_ITEM)].map(lerItem).filter(Boolean);
    document.documentElement.dataset.sintFeed = JSON.stringify({ n: its.length, comData: its.filter((x) => x.idade).length, comTitulo: its.filter((x) => x.titulo).length,
      comDuracao: its.filter((x) => x.dur).length, tipos: its.reduce((a, x) => { a[x.tipo] = (a[x.tipo] || 0) + 1; return a; }, {}), exemplo: its[0] && { titulo: its[0].titulo.slice(0, 40), textos: its[0].textos, dur: its[0].dur, idade: its[0].idade } });
  };
  document.addEventListener('sintonia:teste-feed', onTeste);

  // ───────────────────────── ciclo de vida ─────────────────────────
  function abrirSePendente() {
    if (!abrirPendente) return;
    if (Date.now() - abrirPendente > 60000 || !SINT.ativo() || !SINT.S.emdia) { abrirPendente = 0; try { sessionStorage.removeItem(K_ABRIR); } catch (_) {} return; }
    if (!naInscricoes() || !raizFeed()) return;
    abrirPendente = 0; try { sessionStorage.removeItem(K_ABRIR); } catch (_) {}
    if (!ativa) abrir();
  }
  const tick = setInterval(() => { garantirBotao(); abrirSePendente(); if (ativa) { posicionar(); if (!naInscricoes()) fechar(); } }, 400);
  let redesenhoT = 0;
  const offs = [
    SINT.on('nav', () => { if (!naInscricoes() && ativa) fechar(); setTimeout(garantirBotao, 200); }),
    SINT.on('settings', (m) => { if (Object.keys(m).some((k) => k.startsWith('emdia') || k === 'on')) { garantirBotao(); if (ativa) desenhar(); } }),
    SINT.on('lang', () => { if (ativa) desenhar(); pintarBotao(); }),
    SINT.on('ativo', () => garantirBotao()),
  ];
  const onStore = (ch, area) => {
    if (area !== 'local' || !SINT.alive()) return;
    if (ch[K_MARCAS]) { marcas = ch[K_MARCAS].newValue || {}; if (ativa) { clearTimeout(redesenhoT); redesenhoT = setTimeout(desenhar, 50); } }
    if (ch['st.fila'] && ativa) desenhar();
  };
  ext.storage.onChanged.addListener(onStore);
  const onKey = (e) => { if (ativa && e.key === 'Escape' && !e.defaultPrevented) { const t = e.composedPath ? e.composedPath()[0] : e.target; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName || '')) return; fechar(); } };
  addEventListener('keydown', onKey, true);
  addEventListener('resize', posicionar);
  SINT.onStop(() => {
    clearInterval(tick); offs.forEach((f) => f());
    try { ext.storage.onChanged.removeListener(onStore); } catch (_) {}
    removeEventListener('keydown', onKey, true); removeEventListener('resize', posicionar);
    document.removeEventListener('sintonia:teste-feed', onTeste);
    const b = document.getElementById(BTN_ID); if (b) b.remove();
    if (host) host.remove();
  });
  ext.storage.local.get([K_MARCAS, K_PER]).then((l) => { marcas = l[K_MARCAS] || {}; if (PERIODOS.includes(l[K_PER])) periodo = l[K_PER]; }, () => {});
  SINT.ready.then(() => garantirBotao());

  // bloco do painel: chave da Em Dia (atalho para abrir quando estiver nas Inscrições)
  SINT.addBloco({
    id: 'emdia', ordem: 20,
    html(T) {
      if (!SINT.S.emdia || !naInscricoes()) return '';
      return `<h4>Em Dia</h4><button type="button" class="more" data-ed="abrir">${ICO_ED}<span>${esc(ativa ? T.edVoltar : T.edAbrir)}</span></button>`;
    },
    wire(el) {
      const t = el.querySelector('[data-ed="on"]'); if (t) t.addEventListener('click', async () => { await SINT.setSetting('emdia', !SINT.S.emdia); SINT.painel.redesenhar(); });
      const a = el.querySelector('[data-ed="abrir"]'); if (a) a.addEventListener('click', () => { SINT.painel.fechar(); ativa ? fechar() : abrir(); });
    },
  });
})();
