// Sintonia — interface dentro do YouTube: botão na barra do player, painel rápido, quadros no meio da tela
// (tutorial, novidades, versão nova, apoiar), avisos curtos e o rodapé padrão. Nunca cobre o vídeo sozinho: o painel só
// abre no clique (como o menu da engrenagem) e os cliques dentro dele não chegam ao player.
(() => {
  'use strict';
  const SINT = globalThis.SINT;
  if (!SINT || SINT.dead) return;
  const { ext, I, C } = SINT;
  const { esc, ICO } = C;
  const NOV = globalThis.SINT_NOVIDADES || {};
  const L = () => SINT.L();
  const ADIA_MS = 60 * 60 * 1000;
  const PAGE_ID = Math.random().toString(36).slice(2);

  // Recursos acrescentam blocos ao painel: { id, ordem, html(T) → string, wire(el) }. Ordem menor = mais acima.
  SINT.painel = SINT.painel || { blocos: [] };
  const addBloco = (b) => { SINT.painel.blocos = SINT.painel.blocos.filter((x) => x.id !== b.id).concat(b).sort((a, c) => a.ordem - c.ordem); };
  SINT.addBloco = addBloco;

  const temaYT = () => (document.documentElement.hasAttribute('dark') ? 'dark' : 'light');
  let temaSalvo = '';
  function anotarTema() { const t = temaYT(); if (t !== temaSalvo) { temaSalvo = t; try { ext.storage.local.set({ [SINT.K.tema]: t }); } catch (_) {} } }

  // ───────────────────────── host da página (quadros, aviso, painel solto) ─────────────────────────
  let host = null, root = null, wrap = null, cards = null;
  function ui() {
    if (host && host.isConnected) { const alvo = document.fullscreenElement || document.documentElement; if (host.parentNode !== alvo) alvo.appendChild(host); return root; }
    host = document.createElement('sintonia-ui');
    host.style.cssText = 'position:fixed;inset:0;width:0;height:0;z-index:2147483646;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${C.CSS}${CSS_UI}</style><div class="sint" data-theme="${temaYT()}"><div class="card" role="dialog" aria-modal="false" hidden></div>
      <div class="toast" role="status" hidden><span class="msg"></span><button class="act" type="button" hidden></button></div>
      <div class="fpanel" hidden></div><button class="fab" type="button" hidden aria-haspopup="dialog">${ICO.app}</button></div>`;
    wrap = root.querySelector('.sint');
    (document.fullscreenElement || document.documentElement).appendChild(host);
    cards = C.makeCards({
      card: root.querySelector('.card'), root, T: L, lang: () => SINT.lang, setLang: (l) => SINT.setLang(l), LANGS: I.LANGS, version: SINT.VERSION, NOV,
      upd: () => SINT.upd, updCmd, onClosed,
      loadApoio: async () => (await ext.storage.local.get(SINT.K.apoio))[SINT.K.apoio],
      saveApoio: (v) => ext.storage.local.set({ [SINT.K.apoio]: v }),
    });
    for (const ev of ['click', 'dblclick', 'pointerdown', 'mousedown', 'keydown', 'keyup', 'keypress', 'wheel']) host.addEventListener(ev, (e) => e.stopPropagation());
    const fab = root.querySelector('.fab');
    fab.addEventListener('pointerdown', onFabDown); fab.addEventListener('pointermove', onFabMove); fab.addEventListener('pointerup', onFabUp);
    fab.addEventListener('click', (e) => { if (e.detail === 0) togglePanel('page'); }); // Enter/Espaço (o mouse usa o pointerup)
    return root;
  }
  const updCmd = (cmd, data) => new Promise((ok) => { try { ext.runtime.sendMessage({ type: 'sintonia:update', cmd, data }).then(ok, () => ok(null)); } catch (_) { ok(null); } });

  const CSS_UI = `
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483646; display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 6px 8px 6px 16px;
  border-radius: 8px; background: #f1f1f1; color: #0f0f0f; box-shadow: 0 4px 16px rgba(0,0,0,.3); opacity: 0; transition: opacity .15s cubic-bezier(0,0,.2,1); max-width: calc(100vw - 32px); }
.sint[data-theme=light] .toast { background: #212121; color: #f1f1f1; }
.toast[hidden] { display: none !important; }
.toast:not(.on) { pointer-events: none; }
.toast.on { opacity: 1; } .toast .act { color: #065fd4; font-weight: 500; padding: 8px 12px !important; border-radius: 18px; } .sint[data-theme=light] .toast .act { color: #3ea6ff; }
.toast .act:hover { background: rgba(0,0,0,.08); }
.fpanel { position: fixed; top: 64px; right: 16px; z-index: 2147483645; }
.fab { position: fixed; z-index: 2147483644; width: 48px; height: 48px; border-radius: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;
  background: #282828 !important; color: #3ea6ff; box-shadow: 0 2px 10px rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.12) !important; touch-action: none; transition: transform .1s cubic-bezier(0,0,.2,1); }
.sint[data-theme=light] .fab { background: #fff !important; color: #065fd4; border-color: rgba(0,0,0,.1) !important; box-shadow: 0 2px 10px rgba(0,0,0,.18); }
.fab[hidden] { display: none !important; }
.fab:hover { transform: scale(1.06); } .fab:active { cursor: grabbing; } .fab svg { width: 26px; height: 26px; }
.fab[aria-expanded=true], .sint[data-theme=light] .fab[aria-expanded=true] { background: #3ea6ff !important; color: #0f0f0f; }
`;
  // painel: mesmo desenho dentro do player e solto na página (fundo do menu da engrenagem do player)
  const CSS_PAINEL = `
.pn { width: 340px; max-width: calc(100vw - 24px); display: flex; flex-direction: column; border-radius: 12px; background: rgba(28,28,28,.94); color: #eee; overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,.4); --tx:#f1f1f1; --tx2:#aaa; --add:rgba(255,255,255,.1); --hov:rgba(255,255,255,.2); --line:rgba(255,255,255,.12); --acc:#3ea6ff; --bg:#0f0f0f; --err:#f57; --accbg:#263850; }
.pn .sc { overflow-y: auto; overscroll-behavior: contain; }
.pn .hd { display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 8px 0 14px; border-bottom: 1px solid var(--line); }
.pn .hd .ic { color: var(--acc); } .pn .hd .ic svg { width: 22px; height: 22px; }
.pn .hd b { flex: 1; font-size: 16px; font-weight: 500; }
.pn .ban { margin: 8px 12px 0; padding: 8px 12px; border-radius: 8px; background: var(--accbg); font-size: 13px; display: flex; gap: 8px; align-items: center; }
.pn .ban.urg { background: #f03; color: #fff; } .pn .ban button { margin-left: auto; font-weight: 500 !important; }
.pn .row { display: flex; align-items: center; gap: 12px; min-height: 48px; width: 100%; padding: 6px 14px !important; text-align: left; }
.pn button.row:hover { background: var(--add); }
.pn .row .lb { flex: 1; min-width: 0; display: flex; flex-direction: column; } .pn .row .lb span { font-size: 14px; } .pn .row .lb small { font-size: 12px; line-height: 16px; color: var(--tx2); }
.pn .row .val { color: var(--tx2); font-size: 13px; }
.pn .blk { padding: 6px 0; border-bottom: 1px solid var(--line); }
.pn .blk h4 { margin: 4px 14px 2px; font-size: 12px; line-height: 18px; font-weight: 500; color: var(--tx2); text-transform: none; }
.pn .ch { padding: 4px 14px 8px; } .pn .ch .nm { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pn .ch .kv { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 0; } .pn .ch .kv span { padding: 2px 10px; border-radius: 12px; background: var(--add); font-size: 12px; }
.pn .ch .none { color: var(--tx2); font-size: 13px; margin-top: 2px; } .pn .ch .lk { margin-top: 4px; padding: 6px 0 !important; }
.pn .more { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 14px !important; width: 100%; color: var(--tx); }
.pn .more:hover { background: var(--add); } .pn .more svg { width: 20px; height: 20px; color: var(--tx2); } .pn .more span { flex: 1; text-align: left; }
.pn .foot { border-top: 1px solid var(--line); }
.pn .abas { display: flex; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--line); }
.pn .abas button { height: 32px; padding: 0 12px !important; border-radius: 8px; background: var(--add); font-size: 14px !important; font-weight: 500 !important; }
.pn .abas button:hover { background: var(--hov); } .pn .abas button[aria-selected=true] { background: #f1f1f1; color: #0f0f0f; }
.pn .dica { margin: 10px 14px 4px; font-size: 12px; line-height: 16px; color: var(--tx2); }
.pn .secao { border-bottom: 1px solid var(--line); }
.pn .sech { display: flex; align-items: center; width: 100%; height: 44px; padding: 0 10px 0 14px !important; font-size: 14px !important; font-weight: 500 !important; text-align: left; }
.pn .sech:hover { background: var(--add); } .pn .sech span { flex: 1; } .pn .sech svg { width: 18px; height: 18px; color: var(--tx2); transition: transform .15s; }
.pn .sech[aria-expanded=true] svg { transform: rotate(90deg); }
.pn .secc { padding: 0 0 6px; }
.pn .num, .pn .sel { height: 32px; border-radius: 8px; border: 1px solid var(--line); background: #0f0f0f; color: #f1f1f1; font: 13px Roboto, Arial, sans-serif; padding: 0 8px; }
.pn .num { width: 72px; } .pn .sel { max-width: 150px; }
.pn label.row { cursor: default; }
.pn .grp > h3 { margin: 12px 14px 0; font-size: 15px; line-height: 22px; font-weight: 500; color: var(--tx); }
.pn .grp .gsub { margin: 0 14px 2px; font-size: 12px; line-height: 16px; color: var(--tx2); }
.pn .grp + .grp { border-top: 6px solid rgba(0,0,0,.28); }
.pn .grp .blk:last-child { border-bottom: 0; }
.pn .nota { margin: 0 14px 6px; font-size: 12px; line-height: 16px; color: var(--tx2); }
.pn .vazio { margin: 0; padding: 16px 14px; font-size: 13px; line-height: 18px; color: var(--tx2); }
.pn .busca { display: flex; align-items: center; gap: 8px; margin: 10px 14px 2px; height: 36px; padding: 0 12px; border-radius: 18px; background: #121212; border: 1px solid #303030; cursor: text; }
.pn .busca:focus-within { border-color: #1c62b9; } .pn .busca svg { width: 18px; height: 18px; color: var(--tx2); flex: none; }
.pn .busca input { flex: 1; min-width: 0; height: 34px; border: 0; outline: 0; background: transparent; color: var(--tx); font: 14px Roboto, Arial, sans-serif; }
.pn .tag { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 4px; background: var(--add); color: var(--tx2); font: 500 11px/16px Roboto, Arial, sans-serif; font-style: normal; vertical-align: 1px; }
.pn .pv { padding: 2px 14px 8px; }
.pn .pvr { display: flex; align-items: center; gap: 8px; height: 40px; }
.pn .pvl { flex: 1; font-size: 14px; }
.pn .pvb { width: 32px; height: 32px; border-radius: 16px; background: var(--add) !important; font-size: 18px !important; line-height: 32px; }
.pn .pvb:hover { background: var(--hov) !important; }
.pn .pvv { min-width: 64px; text-align: center; font-size: 15px; font-weight: 500; }
.pn .pvc { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 6px; }
.pn .pvc button { height: 28px; padding: 0 10px !important; border-radius: 8px; background: var(--add); font-size: 13px !important; }
.pn .pvc button:hover { background: var(--hov); }
.pn .pvc button[aria-pressed=true] { background: var(--tx); color: #0f0f0f; }
`;

  // ───────────────────────── avisos curtos ─────────────────────────
  let toastT = 0;
  function toast(msg, act, ms) {
    ui();
    const t = root.querySelector('.toast');
    t.querySelector('.msg').textContent = msg;
    const b = t.querySelector('.act');
    b.hidden = !act; if (act) { b.textContent = act.label; b.onclick = () => { act.fn(); hideToast(); }; }
    t.hidden = false; requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(toastT); toastT = setTimeout(hideToast, ms || 5000);
  }
  function hideToast() { if (!root) return; const t = root.querySelector('.toast'); t.classList.remove('on'); setTimeout(() => { if (!t.classList.contains('on')) t.hidden = true; }, 160); }
  SINT.toast = toast;

  // ───────────────────────── quadros (regras 12 e 14) ─────────────────────────
  let adiado = null, ready = false;
  const adiadoAqui = () => { const u = SINT.upd; return !!(adiado && adiado.ultima === u.ultima && adiado.ate > Date.now()); };
  function onClosed(tipo, porX) {
    if (tipo === 'news') marcarNovLidas();
    if (tipo === 'update' && porX) { // X ou Esc: adia 1 h
      adiado = { ultima: SINT.upd.ultima, ate: Date.now() + ADIA_MS, pagina: PAGE_ID };
      try { ext.storage.local.set({ [SINT.K.adiado]: adiado }); } catch (_) {}
    } else if (tipo !== 'update') setTimeout(maybeUpdate, 400); // o aviso de versão espera o tutorial/novidades
  }
  async function marcarNovLidas() {
    try { const ob = (await ext.storage.local.get(SINT.K.onboard))[SINT.K.onboard] || {}; await ext.storage.local.set({ [SINT.K.onboard]: Object.assign({}, ob, { novLidas: C.baseVer(SINT.VERSION) }) }); } catch (_) {}
  }
  function maybeUpdate() {
    if (!ready || SINT.dead) return;
    if (document.fullscreenElement && cards && cards.open !== 'update') return; // não cobre o vídeo em tela cheia: espera sair
    const u = SINT.upd, tem = u.disponivel && u.ultima && C.cmpVer(u.ultima, SINT.VERSION) > 0;
    ui();
    if (!tem) { if (cards.open === 'update') cards.hideNow(); return; }
    if (cards.urgente()) { if (cards.open !== 'update') cards.update(); return; } // urgente passa na frente de tudo
    if (cards.open || adiadoAqui()) return;
    cards.update();
  }
  const visivel = () => new Promise((ok) => {
    if (document.visibilityState === 'visible') return ok();
    const f = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', f); ok(); } };
    document.addEventListener('visibilitychange', f);
  });
  const semTelaCheia = () => new Promise((ok) => {
    if (!document.fullscreenElement) return ok();
    const f = () => { if (!document.fullscreenElement) { document.removeEventListener('fullscreenchange', f); ok(); } };
    document.addEventListener('fullscreenchange', f);
  });
  const versaoAnterior = (v) => Object.keys(NOV.en || NOV.pt || {}).filter((x) => C.cmpVer(x, v) < 0).sort((a, b) => C.cmpVer(b, a))[0] || '';
  async function startBoxes() {
    const K = SINT.K;
    let ob;
    try { ob = (await ext.storage.local.get(K.onboard))[K.onboard]; adiado = (await ext.storage.local.get(K.adiado))[K.adiado] || null; } catch (_) { return; }
    procurarAgora();
    await new Promise((r) => setTimeout(r, 1200)); // deixa o YouTube desenhar primeiro
    if (SINT.dead) return;
    ready = true;
    ui();
    if (cards.urgente()) return maybeUpdate();
    await visivel(); // aba em segundo plano não "gasta" o quadro
    await semTelaCheia(); // nem cobre o vídeo em tela cheia
    if (SINT.dead) return;
    try { ob = (await ext.storage.local.get(K.onboard))[K.onboard] || ob; } catch (_) {}
    const BASE = C.baseVer(SINT.VERSION);
    if (!ob || ob.tutorial === 'pendente') {
      await ext.storage.local.set({ [K.onboard]: Object.assign({}, ob || {}, { tutorial: 'visto', visto: SINT.VERSION, novLidas: BASE }) });
      return cards.tutorial();
    }
    if (ob.visto !== SINT.VERSION) await ext.storage.local.set({ [K.onboard]: Object.assign({}, ob, { visto: SINT.VERSION }) });
    if (ob.novLidas !== BASE) {
      let from = ob.novLidas || ob.visto || '';
      if (from && C.cmpVer(C.baseVer(from), BASE) >= 0) from = versaoAnterior(BASE);
      if (cards.news(from)) return;
      marcarNovLidas();
    }
    maybeUpdate();
  }
  const procurarAgora = () => { if (SINT.alive()) updCmd('check-soft'); };
  const onVis = () => { if (document.visibilityState === 'visible') procurarAgora(); };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('focus', procurarAgora);

  // ───────────────────────── botão na barra do player ─────────────────────────
  const BTN_ID = 'sintonia-btn';
  function ensureBtn() {
    if (SINT.dead) return;
    const mp = document.getElementById('movie_player');
    const set = mp && mp.querySelector('.ytp-right-controls .ytp-settings-button');
    let b = document.getElementById(BTN_ID);
    if (!SINT.S.on) { if (b) b.remove(); return; } // desligada: o player fica como o YouTube fez (o botão flutuante continua, para religar)
    if (!set) return;
    if (b && b.isConnected && b.nextElementSibling === set) return;
    if (!b) {
      b = document.createElement('button');
      b.id = BTN_ID; b.type = 'button'; b.className = 'ytp-button sintonia-btn';
      b.innerHTML = ICO.app.replace('stroke="currentColor"', 'stroke="#fff"');
      const svg = b.querySelector('svg'); svg.style.cssText = 'width:24px;height:24px;margin:auto;display:block';
      b.addEventListener('click', (e) => { e.stopPropagation(); togglePanel('player'); });
    }
    b.setAttribute('aria-label', 'Sintonia'); b.setAttribute('title', 'Sintonia'); b.setAttribute('aria-haspopup', 'true');
    b.setAttribute('aria-expanded', String(painelAberto === 'player'));
    set.parentElement.insertBefore(b, set);
  }

  // ───────────────────────── botões extras na barra do player (Repetir, A–B, foto, janela, playlist ao contrário) ─────────────────────────
  // Cada recurso registra o seu: { id, ordem, mostrar(), svg | texto(), titulo(T), ativo(), click(e), direito(e) }. Só aparecem com o recurso
  // ligado e com o player largo o bastante; ficam antes do 1× e do botão da Sintonia.
  const extras = [];
  function pintarBarra() {
    if (SINT.dead) return;
    const sint = document.getElementById(BTN_ID), mp = document.getElementById('movie_player');
    const cabe = !!(mp && mp.clientWidth >= 560);
    let ancora = sint ? document.getElementById('sintonia-vel') || sint : null;
    for (let i = extras.length - 1; i >= 0; i--) { // de trás para frente: cada um fica logo antes do seguinte
      const o = extras[i], id = 'sintonia-b-' + o.id;
      let b = document.getElementById(id), quer = false;
      try { quer = !!(ancora && cabe && SINT.ativo() && o.mostrar()); } catch (_) {}
      if (!quer) { if (b) b.remove(); continue; }
      if (!b) {
        b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'ytp-button sintonia-extra';
        b.addEventListener('click', (e) => { e.stopPropagation(); try { o.click(e); } catch (er) { console.warn('[Sintonia]', er); } setTimeout(pintarBarra, 60); });
        b.addEventListener('contextmenu', (e) => { if (!o.direito) return; e.preventDefault(); e.stopPropagation(); o.direito(e); setTimeout(pintarBarra, 60); });
      }
      const T = L(), conteudo = o.texto ? esc(o.texto()) : o.svg, tit = o.titulo(T), on = !!(o.ativo && o.ativo());
      if (b.dataset.c !== conteudo) {
        b.dataset.c = conteudo; b.innerHTML = conteudo;
        b.style.cssText = o.texto ? 'width:auto;min-width:48px;padding:0 6px;font:500 13px/40px Roboto,Arial,sans-serif;text-align:center;white-space:nowrap'
          : 'display:inline-flex;align-items:center;justify-content:center;padding:0';
        const s = b.querySelector('svg'); if (s) s.style.cssText = 'width:24px;height:24px;display:block';
      }
      b.style.color = on ? '#3ea6ff' : '#fff';
      b.title = tit; b.setAttribute('aria-label', tit);
      if (o.ativo) b.setAttribute('aria-pressed', String(on));
      if (b.nextElementSibling !== ancora) ancora.parentElement.insertBefore(b, ancora);
      ancora = b;
    }
  }
  SINT.barra = {
    add(o) { const i = extras.findIndex((x) => x.id === o.id); if (i >= 0) extras.splice(i, 1); extras.push(o); extras.sort((a, c) => a.ordem - c.ordem); pintarBarra(); },
    pintar: () => pintarBarra(),
  };

  // ───────────────────────── painel ─────────────────────────
  let painelAberto = null, pHost = null, pRoot = null, msgRodape = null;
  function playerHost() {
    const mp = document.getElementById('movie_player');
    if (!mp) return null;
    if (pHost && pHost.isConnected && pHost.parentNode === mp) return pRoot;
    if (!pHost) {
      pHost = document.createElement('sintonia-player');
      pRoot = pHost.attachShadow({ mode: 'open' });
      pRoot.innerHTML = `<style>${C.CSS}${CSS_PAINEL}</style><div class="sint" data-theme="dark"></div>`;
      // os cliques e teclas dentro do painel não chegam ao player (não pausa, não pula, não muda volume)
      for (const ev of ['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'keydown', 'keyup', 'keypress', 'wheel', 'contextmenu']) pHost.addEventListener(ev, (e) => e.stopPropagation());
    }
    pHost.style.cssText = 'position:absolute;right:12px;bottom:64px;z-index:70;display:block';
    mp.appendChild(pHost);
    return pRoot;
  }
  function togglePanel(onde) {
    if (painelAberto) { const era = painelAberto; closePanel(); if (onde === era || onde === 'auto') return; }
    openPanel(onde);
  }
  function openPanel(onde) {
    if (onde === 'auto') onde = (page().kind === 'watch' && document.getElementById(BTN_ID) && document.getElementById(BTN_ID).getClientRects().length) ? 'player' : 'page';
    if (onde === 'player' && !playerHost()) onde = 'page';
    painelAberto = onde; msgRodape = null;
    renderPanel();
    setTimeout(() => { const r = painelAberto === 'player' ? pRoot : root; const f = r && r.querySelector('.pn [data-act="on"]'); if (f) f.focus({ preventScroll: true }); }, 30);
    ensureBtn();
    SINT.bridge('info').then((d) => { if (d && painelAberto) { SINT.page.info = d; renderPanel(); } });
  }
  function closePanel() {
    if (pHost) { const s = pRoot.querySelector('.sint'); s.innerHTML = ''; }
    if (root) { const f = root.querySelector('.fpanel'); f.innerHTML = ''; f.hidden = true; const fb = root.querySelector('.fab'); if (fb) fb.setAttribute('aria-expanded', 'false'); }
    painelAberto = null; abaRender = null;
    const b = document.getElementById(BTN_ID); if (b) b.setAttribute('aria-expanded', 'false');
  }
  SINT.painel.abrir = openPanel; SINT.painel.fechar = closePanel; SINT.painel.redesenhar = () => {
    if (!painelAberto) return;
    const a = (pRoot && pRoot.activeElement) || (root && root.activeElement);
    if (a && a.tagName === 'INPUT' && a.type !== 'range') return; // digitando um número ou na busca: não apaga
    renderPanel();
  };
  const page = () => SINT.page;
  // Duas abas: "Agora" (o que vale para esta página: vídeo, canal, fila…) e "Ajustes" (todas as chaves, por seção, cada uma
  // com uma explicação curta). Pedido do André (2026-11-11): menu flutuante organizado, sem depender do clique no ícone.
  let aba = 'agora', abaRender = null, busca = '';
  const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const ICO_LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg>';
  const secAbertas = new Set(['geral']);
  function itemAjuste(it, T) {
    const t = T['set.' + it.k] || it.k, sub = T['set.' + it.k + '_'] || '';
    const lb = `<span class="lb"><span>${esc(t)}${it.canal ? `<i class="tag">${esc(T.tagCanal)}</i>` : ''}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
    const S = SINT.S;
    if (it.type === 'switch') return `<button type="button" class="row" role="switch" aria-checked="${!!S[it.k]}" data-aj="${it.k}">${lb}<span class="sw"></span></button>`;
    if (it.type === 'number') return `<label class="row">${lb}<input class="num" type="number" data-ajn="${it.k}" min="${it.min}" max="${it.max}" step="${it.step || 1}" value="${esc(S[it.k])}" aria-label="${esc(t)}"></label>`;
    if (it.type === 'select') return `<label class="row">${lb}<select class="sel" data-ajs="${it.k}" aria-label="${esc(t)}">${it.opts.map((o) => `<option value="${esc(o)}"${String(S[it.k]) === String(o) ? ' selected' : ''}>${esc((T['opt.' + it.k] && T['opt.' + it.k][o]) || o)}</option>`).join('')}</select></label>`;
    if (it.type === 'lang') return `<label class="row">${lb}<select class="sel" data-ajs="lang" aria-label="${esc(t)}"><option value="">${esc(T.langAuto)}</option>${I.LANGS.map((l) => `<option value="${l}"${S.lang === l ? ' selected' : ''}>${({ pt: 'Português', en: 'English', es: 'Español' })[l]}</option>`).join('')}</select></label>`;
    return `<button type="button" class="row" data-act="opts"><span class="lb"><span>${esc(t)}</span><small>${esc(T.abrirCompleto)}</small></span>${ICO.chev}</button>`;
  }
  function ajustesHtml(T) {
    const q = norm(busca.trim());
    const casa = (s, it) => !q || [T['sec.' + s.id], T['set.' + it.k], T['set.' + it.k + '_'], ...Object.values(T['opt.' + it.k] || {})].some((x) => norm(x).includes(q));
    const secs = SINT.DEF.SECTIONS.map((s) => {
      const itens = s.items.filter((it) => casa(s, it));
      if (!itens.length) return '';
      const aberta = !!q || secAbertas.has(s.id);
      return `<div class="secao"><button type="button" class="sech" data-sec="${s.id}" aria-expanded="${aberta}"><span>${esc(T['sec.' + s.id] || s.id)}</span>${ICO.chev}</button>
        ${aberta ? `<div class="secc">${itens.map((it) => itemAjuste(it, T)).join('')}</div>` : ''}</div>`;
    }).join('');
    return `<label class="busca">${ICO_LUPA}<input type="search" data-busca="1" placeholder="${esc(T.optSearch)}" value="${esc(busca)}" aria-label="${esc(T.optSearch)}"></label>`
      + (q ? '' : `<p class="dica">${esc(T.allOff)}</p>`) + (secs || `<p class="dica">${esc(T.buscaVazia)}</p>`)
      + `<button type="button" class="more" data-act="opts">${ICO.gear}<span>${esc(T.openSettings)}</span>${ICO.chev}</button>`;
  }
  // Aba Agora: só controles do que está ligado (as chaves ficam em Ajustes), separados em "Este vídeo" (vale agora / para todos)
  // e "Este canal · perfil" (fica salvo só para o canal). Pedido do André, 2026-11-11.
  function agoraHtml(T) {
    const g = { pagina: [], canal: [] };
    for (const b of SINT.painel.blocos) {
      try {
        const h = b.html(T); if (!h) continue;
        const gr = typeof b.grupo === 'function' ? b.grupo() : b.grupo;
        g[gr === 'canal' ? 'canal' : 'pagina'].push(`<div class="blk" data-b="${esc(b.id)}">${h}</div>`);
      } catch (e) { /* um bloco com erro não derruba o painel */ }
    }
    const naV = page().kind === 'watch' && !!page().videoId, c = page().canal;
    let h = '';
    if (g.pagina.length) h += `<div class="grp"><h3>${esc(naV ? T.grpVideo : T.grpPagina)}</h3>${g.pagina.join('')}</div>`;
    if (g.canal.length) h += `<div class="grp canal"><h3>${esc(T.grpCanal)}</h3><p class="gsub">${esc(T.grpCanalSub(c ? c.nome || c.id : ''))}</p>${g.canal.join('')}</div>`;
    if (!h) h = `<p class="vazio">${esc(naV ? T.agoraVazioVideo : T.agoraVazio)}</p>`;
    return h + `<button type="button" class="more" data-aba="ajustes">${ICO.gear}<span>${esc(T.abaAjustes)}</span>${ICO.chev}</button>`;
  }
  function panelHtml() {
    const T = L(), u = SINT.upd, nova = u.disponivel && u.ultima && C.cmpVer(u.ultima, SINT.VERSION) > 0;
    return `<div class="pn" role="dialog" aria-label="Sintonia">
      <div class="hd"><span class="ic">${ICO.app}</span><b>${esc(T.panel)}</b>
        <button type="button" class="row" style="width:auto;min-height:40px;padding:0 6px!important" role="switch" aria-checked="${!!SINT.S.on}" data-act="on" title="${esc(SINT.S.on ? T.on : T.off)}" aria-label="${esc(T['set.on'])}"><span class="sw"></span></button></div>
      <div class="abas" role="tablist"><button type="button" role="tab" data-aba="agora" aria-selected="${aba === 'agora'}">${esc(T.abaAgora)}</button><button type="button" role="tab" data-aba="ajustes" aria-selected="${aba === 'ajustes'}">${esc(T.abaAjustes)}</button></div>
      <div class="sc">${nova ? `<div class="ban${SINT.urgente() ? ' urg' : ''}"><span>${esc(SINT.urgente() ? T.bannerUrg(u.ultima) : T.banner(u.ultima))}</span><button type="button" class="lk" data-act="upd">${esc(T.updGo)}</button></div>` : ''}
        ${aba === 'agora' ? agoraHtml(T) : ajustesHtml(T)}</div>
      ${C.footerHtml(T, SINT.lang, I.LANGS, SINT.VERSION, msgRodape)}</div>`;
  }
  // a explicação curta (set.<chave>_) também nas chaves dos blocos da aba "Agora"
  function explicar(el) {
    const T = L();
    el.querySelectorAll('[role="switch"]').forEach((b) => {
      const d = b.dataset;
      const k = d.aj || d.pvSw || d.imSw || d.auSw || d.p2sw || d.esc || (d.ed === 'on' ? 'emdia' : '') || (d.lk === 'auto' ? 'likeAuto' : '') || (d.sb === 'on' ? 'sb' : '');
      const lb = b.querySelector('.lb');
      if (!k || !lb || lb.querySelector('small') || !T['set.' + k + '_']) return;
      const sm = document.createElement('small'); sm.textContent = T['set.' + k + '_']; lb.appendChild(sm);
    });
  }
  function renderPanel() {
    if (!painelAberto) return;
    let alvo;
    if (painelAberto === 'player') { const r = playerHost(); if (!r) { painelAberto = 'page'; return renderPanel(); } alvo = r.querySelector('.sint'); }
    else { ui(); alvo = root.querySelector('.fpanel'); alvo.hidden = false; if (!alvo.shadowRoot) { /* usa o mesmo shadow da página */ } }
    if (painelAberto === 'page' && !root.querySelector('style[data-p]')) { const st = document.createElement('style'); st.dataset.p = '1'; st.textContent = CSS_PAINEL; root.appendChild(st); }
    const ativo = (pRoot && pRoot.activeElement) || (root && root.activeElement);
    const chave = ativo && [...ativo.attributes].find((a) => a.name.startsWith('data-') && a.name !== 'data-theme');
    const seletor = chave ? `[${chave.name}="${String(chave.value).replace(/"/g, '\\"')}"]` : null;
    const scVelho = alvo.querySelector('.sc'), topo = scVelho ? scVelho.scrollTop : 0, manter = abaRender === aba; abaRender = aba;
    alvo.innerHTML = panelHtml();
    const pn = alvo.querySelector('.pn'); if (pn) { pn.setAttribute('aria-labelledby', 'sint-pn-t'); const t = pn.querySelector('.hd b'); if (t) t.id = 'sint-pn-t'; }
    if (seletor) { const e2 = alvo.querySelector(seletor); if (e2) e2.focus({ preventScroll: true }); }
    if (painelAberto === 'player') { // altura máxima = player menos a barra de baixo
      const mp = document.getElementById('movie_player'), pn = alvo.querySelector('.pn');
      if (mp && pn) pn.style.maxHeight = Math.max(200, mp.clientHeight - 80) + 'px';
      const sc = alvo.querySelector('.sc'); if (sc && pn) sc.style.maxHeight = Math.max(80, mp.clientHeight - 80 - 52 - 96) + 'px';
    } else {
      const f = root.querySelector('.fab'), fp = root.querySelector('.fpanel'), sc = alvo.querySelector('.sc');
      if (f && !f.hidden) { // abre em cima do botão (ou embaixo, se ele estiver no alto da tela)
        const r = f.getBoundingClientRect(), emCima = r.top > innerHeight / 2;
        fp.style.right = Math.max(8, Math.round(innerWidth - r.right)) + 'px'; fp.style.left = 'auto';
        if (emCima) { fp.style.top = 'auto'; fp.style.bottom = Math.round(innerHeight - r.top + 8) + 'px'; if (sc) sc.style.maxHeight = Math.max(160, r.top - 8 - 64 - 52 - 130) + 'px'; }
        else { fp.style.bottom = 'auto'; fp.style.top = Math.round(r.bottom + 8) + 'px'; if (sc) sc.style.maxHeight = Math.max(160, innerHeight - r.bottom - 8 - 52 - 150) + 'px'; }
      } else { fp.style.top = '64px'; fp.style.right = '16px'; fp.style.bottom = 'auto'; fp.style.left = 'auto'; if (sc) sc.style.maxHeight = (innerHeight - 64 - 52 - 150) + 'px'; }
      if (f) f.setAttribute('aria-expanded', 'true');
    }
    { const s2 = alvo.querySelector('.sc'); if (s2 && manter && topo) s2.scrollTop = topo; } // (relato do André: a cada clique o menu voltava para o topo)
    wirePanel(alvo);
  }
  function wirePanel(el) {
    for (const b of SINT.painel.blocos) { const d = el.querySelector(`[data-b="${b.id}"]`); if (d && b.wire) { try { b.wire(d); } catch (e) { console.warn('[Sintonia]', e); } } }
    explicar(el);
    el.querySelectorAll('[data-aba]').forEach((x) => x.addEventListener('click', () => { aba = x.dataset.aba; renderPanel(); }));
    el.querySelectorAll('[data-busca]').forEach((x) => x.addEventListener('input', () => {
      busca = x.value; renderPanel();
      const n = el.querySelector('[data-busca]'); if (n) { n.focus({ preventScroll: true }); const f = n.value.length; try { n.setSelectionRange(f, f); } catch (_) {} }
    }));
    el.querySelectorAll('[data-sec]').forEach((x) => x.addEventListener('click', () => { const id = x.dataset.sec; if (secAbertas.has(id)) secAbertas.delete(id); else secAbertas.add(id); renderPanel(); }));
    el.querySelectorAll('[data-aj]').forEach((x) => x.addEventListener('click', async () => { await SINT.setSetting(x.dataset.aj, !SINT.S[x.dataset.aj]); renderPanel(); }));
    el.querySelectorAll('[data-ajs]').forEach((x) => x.addEventListener('change', async () => { const k = x.dataset.ajs; if (k === 'lang') await SINT.setLang(x.value); else await SINT.setSetting(k, x.value === '' || isNaN(+x.value) ? x.value : +x.value); renderPanel(); }));
    el.querySelectorAll('[data-ajn]').forEach((x) => x.addEventListener('change', async () => {
      const k = x.dataset.ajn, it = SINT.DEF.SECTIONS.flatMap((s) => s.items).find((i) => i.k === k);
      let v = parseFloat(String(x.value).replace(',', '.')); if (isNaN(v)) v = SINT.DEF.SYNC[k];
      v = Math.min(it.max, Math.max(it.min, v)); await SINT.setSetting(k, v); renderPanel();
    }));
    el.querySelectorAll('[data-act]').forEach((x) => x.addEventListener('click', (e) => { e.preventDefault(); acao(x.dataset.act, x); }));
    el.querySelectorAll('.foot .langs button').forEach((x) => x.addEventListener('click', () => SINT.setLang(x.dataset.l)));
  }
  async function acao(act) {
    const T = L();
    if (act === 'on') { await SINT.setSetting('on', !SINT.S.on); renderPanel(); }
    else if (act === 'opts') { try { await ext.runtime.sendMessage({ type: 'sintonia:opts' }); } catch (_) {} }
    else if (act === 'upd') { closePanel(); ui(); cards.update(); }
    else if (act === 'help') { closePanel(); ui(); ready = true; cards.tutorial(); }
    else if (act === 'apoio') { closePanel(); ui(); cards.apoio(); }
    else if (act === 'bug') { await abrirRelato(); }
    else if (act === 'check') {
      msgRodape = { t: T.checking }; renderPanel();
      const r = (await updCmd('check')) || {};
      msgRodape = r.erro ? { t: T.checkErr, bad: true } : r.disponivel ? { t: T.newVer(r.ultima) } : { t: T.upToDate };
      renderPanel();
    }
  }

  // "Relatar bug" (regra 9): abre o relato nos Issues do repo com a versão e um diagnóstico sem dado pessoal. Também copia o texto
  // (o repo DredsGG/sintonia ainda não existe; o link volta a funcionar quando ele for criado).
  async function diagnostico() {
    const K = SINT.K;
    let loc = {};
    try { loc = await ext.storage.local.get([K.log, K.update, K.disco, K.perfis]); } catch (_) {}
    const d = (await updCmd('diag')) || {}, agora = Date.now(), u = loc[K.update] || {};
    const log = (loc[K.log] || []).map((e) => `- ${Math.round((agora - e.em) / 60000)} min: ${e.type} ${e.ok ? 'ok' : 'FAIL'}`).join('\n') || '- (empty)';
    const keys = Object.keys(SINT.DEF.SYNC).filter((k) => typeof SINT.DEF.SYNC[k] === 'boolean');
    return [`Sintonia v${SINT.VERSION}`, `Browser: ${C.navegador()}`, `Install: ${d.instalacao || '?'}`, `UI: ${SINT.lang} / ${navigator.language}`,
      `Settings: ${keys.map((k) => `${k}=${SINT.S[k] ? 1 : 0}`).join(' ')}`,
      `Page: ${page().kind} main=${SINT.mainOk ? 1 : 0} player=${document.getElementById('movie_player') ? 1 : 0} btn=${document.getElementById(BTN_ID) ? 1 : 0} fs=${document.fullscreenElement ? 1 : 0} channel=${page().canal ? page().canal.fonte : '-'}`,
      `Profiles: ${Object.keys(loc[K.perfis] || {}).length}`,
      `Update: latest=${u.ultima || '-'} noRelease=${u.semRelease ? 1 : 0} err=${u.erro || '-'}`,
      loc[K.disco] ? `Disk: ${loc[K.disco].estado || '-'} (${loc[K.disco].noDisco || '-'})` : null, '', 'Last events:', log].filter((x) => x !== null).join('\n');
  }
  async function abrirRelato() {
    const T = L(), diag = await diagnostico();
    await C.copiar(diag);
    window.open(C.relatoUrl(T, diag), '_blank', 'noopener');
    msgRodape = { t: T.bugCopied }; renderPanel();
  }
  SINT.diagnostico = diagnostico;

  // ───────────────────────── botão flutuante (menu da Sintonia em qualquer página do YouTube) ─────────────────────────
  // Redondo no canto de baixo à direita, arrastável, posição lembrada (st.fab). Some em tela cheia e quando ficaria em cima do
  // vídeo (aí vale o botão da barra do player). Clique abre/fecha o menu ancorado nele.
  let fabPos = null, arrasto = null;
  function onFabDown(e) { if (e.button !== 0) return; const f = e.currentTarget; arrasto = { x: e.clientX, y: e.clientY, r0: f.getBoundingClientRect(), moveu: false }; try { f.setPointerCapture(e.pointerId); } catch (_) {} }
  function onFabMove(e) {
    if (!arrasto) return;
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    if (!arrasto.moveu && Math.hypot(dx, dy) < 5) return;
    arrasto.moveu = true;
    fabPos = { r: Math.max(4, Math.min(innerWidth - 52, Math.round(innerWidth - arrasto.r0.right - dx))), b: Math.max(4, Math.min(innerHeight - 52, Math.round(innerHeight - arrasto.r0.bottom - dy))) };
    pintarFab(true);
    if (painelAberto === 'page') renderPanel();
  }
  function onFabUp() {
    if (!arrasto) return;
    const moveu = arrasto.moveu; arrasto = null;
    if (moveu) { try { ext.storage.local.set({ 'st.fab': fabPos }); } catch (_) {} return; }
    togglePanel('page');
  }
  function pintarFab(forcar) {
    if (SINT.dead) return;
    const quer = SINT.S.botaoFlutuante && !document.fullscreenElement && document.documentElement.isConnected;
    if (!quer && !root) return;
    ui();
    const f = root.querySelector('.fab');
    const p0 = fabPos || { r: 24, b: 24 }; // presa à janela: posição salva numa tela maior não some para fora
    const p = { r: Math.max(4, Math.min(innerWidth - 52, p0.r)), b: Math.max(4, Math.min(innerHeight - 52, p0.b)) };
    f.style.right = p.r + 'px'; f.style.bottom = p.b + 'px';
    f.title = L().fabDica; f.setAttribute('aria-label', L().fabDica);
    let mostrar = quer;
    if (mostrar && !forcar && !arrasto) { // não fica em cima do vídeo
      const mp = document.getElementById('movie_player');
      const a = mp && mp.getBoundingClientRect();
      if (a && a.width > 0 && a.height > 0) {
        const x = innerWidth - p.r - 24, y = innerHeight - p.b - 24;
        if (x > a.left - 24 && x < a.right + 24 && y > a.top - 24 && y < a.bottom + 24) mostrar = false;
      }
    }
    f.hidden = !mostrar;
  }
  try { ext.storage.local.get('st.fab').then((l) => { fabPos = l['st.fab'] || null; pintarFab(); }, () => {}); } catch (_) {}

  // ───────────────────────── bloco do painel: perfil deste canal (fase 0) ─────────────────────────
  const QLAB = { highres: '4320p', hd2880: '2880p', hd2160: '2160p', hd1440: '1440p', hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p' };
  const fmtAjuste = (k, v) => (Array.isArray(v) ? (v.length ? v.map((c) => (L().sbCat && L().sbCat[c]) || c).join(', ') : '—') : k === 'boost' ? `${v}%` : k === 'rate' ? `${String(v).replace('.', SINT.lang === 'en' ? '.' : ',')}×` : k === 'vol' ? `${v}%` : k === 'q' ? (QLAB[v] || String(v)) : String(v));
  addBloco({
    id: 'canal', ordem: 5, grupo: 'canal',
    html(T) {
      const c = page().canal;
      if (page().kind !== 'watch' || !page().videoId || !SINT.S.perfilCanal) return '';
      if (!c) return `<div class="ch"><div class="none">${esc(T.chUnknown)}</div></div>`;
      const aj = SINT.perfil.ajustes(c.id), ks = Object.keys(aj).filter((k) => aj[k] != null);
      return `<h4>${esc(T.perfilSalvo)}</h4><div class="ch">
        ${ks.length ? `<div class="kv">${ks.map((k) => `<span>${esc((T.profKeys && T.profKeys[k]) || k)} ${esc(fmtAjuste(k, aj[k]))}</span>`).join('')}</div>
          <button type="button" class="lk" data-forget="1">${esc(T.profForget)}</button>` : `<div class="none">${esc(T.profEmpty)}</div>`}</div>`;
    },
    wire(el) {
      const f = el.querySelector('[data-forget]');
      if (f) f.addEventListener('click', async () => { const c = page().canal; if (!c) return; await SINT.perfil.forget(c.id); toast(L().profForgot); renderPanel(); });
    },
  });

  // ───────────────────────── teclado, tela cheia, clique fora ─────────────────────────
  const onKey = (e) => {
    if (cards && cards.onKey(e)) return;
    if (e.key === 'Escape' && painelAberto) { closePanel(); e.stopPropagation(); }
  };
  addEventListener('keydown', onKey, true);
  const onDocDown = (e) => {
    if (!painelAberto || !e.isTrusted) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(pHost) || path.includes(host) || path.includes(document.getElementById(BTN_ID))) return; // (o botão flutuante mora no host)
    closePanel();
  };
  document.addEventListener('pointerdown', onDocDown, true);
  const onFs = () => { if (host) ui(); pintarFab(); if (painelAberto) renderPanel(); };
  document.addEventListener('fullscreenchange', onFs);

  // o botão some quando o YouTube redesenha a barra: confere a cada 1 s (barato) e na navegação
  const tBtn = setInterval(() => { ensureBtn(); pintarBarra(); anotarTema(); pintarFab(); if (wrap && wrap.dataset.theme !== temaYT()) wrap.dataset.theme = temaYT(); }, 1000);
  const offs = [
    SINT.on('nav', () => { ensureBtn(); pintarBarra(); if (painelAberto) renderPanel(); }),
    SINT.on('video', () => { ensureBtn(); pintarBarra(); if (painelAberto) renderPanel(); }),
    SINT.on('perfis', () => { if (painelAberto) renderPanel(); }),
    SINT.on('settings', () => { pintarBarra(); if (painelAberto) renderPanel(); }),
    SINT.on('lang', () => { if (painelAberto) renderPanel(); if (cards) cards.redraw(); }),
    SINT.on('update', () => { if (cards && cards.open === 'update' && SINT.upd.disponivel) cards.update(); else maybeUpdate(); if (painelAberto) renderPanel(); }),
    SINT.on('msg', (m) => {
      if (m.type === 'sintonia:painel') { const f = root && root.querySelector('.fab'); if (m.icone && f && !f.hidden) return; togglePanel('auto'); }
      if (m.type === 'sintonia:tutorial') { ready = true; ui(); cards.tutorial(); }
      if (m.type === 'sintonia:news') { ui(); cards.news(''); }
    }),
  ];
  const onAd = (ch, area) => { if (area === 'local' && ch[SINT.K.adiado] && SINT.alive()) { adiado = ch[SINT.K.adiado].newValue || null; maybeUpdate(); } };
  ext.storage.onChanged.addListener(onAd);
  const tUpd = setInterval(maybeUpdate, 30000); // o adiamento de 1 h vence → o aviso volta sozinho

  SINT.onStop(() => {
    offs.forEach((f) => f());
    try { ext.storage.onChanged.removeListener(onAd); } catch (_) {}
    clearInterval(tBtn); clearInterval(tUpd); clearTimeout(toastT);
    removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('fullscreenchange', onFs);
    document.removeEventListener('visibilitychange', onVis);
    removeEventListener('focus', procurarAgora);
    const b = document.getElementById(BTN_ID); if (b) b.remove();
    document.querySelectorAll('.sintonia-extra').forEach((x) => x.remove());
    if (pHost) pHost.remove();
    if (host) host.remove();
  });

  SINT.ready.then(() => { if (SINT.dead) return; ensureBtn(); anotarTema(); startBoxes(); });
})();
