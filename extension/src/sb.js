// Sintonia — fase 5: pular partes com os dados do SponsorBlock (cliente próprio, só leitura; o código do SponsorBlock não é usado).
// O fundo (sw.js) busca só pelo prefixo do hash do videoId e filtra; aqui a Sintonia pula, avisa ("Patrocínio pulado · Desfazer")
// e desenha marcas coloridas na barra de progresso. Categorias no global e por canal (perfil sbCats).
// Se o SponsorBlock oficial estiver ativo na página (ul#previewbar.sbNotInvidious / .sponsorBlockChapterBar, nomes lidos no
// código-fonte público dele em 2026-11-11), a Sintonia desliga esta parte e avisa uma vez.
(() => {
  'use strict';
  const SINT = globalThis.SINT;
  if (!SINT || SINT.dead) return;
  const { ext, C } = SINT;
  const { esc } = C;
  const S = SINT.S, L = () => SINT.L();
  const CATS = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'filler', 'music_offtopic'];
  const COR = { sponsor: '#00b37a', selfpromo: '#e8b100', interaction: '#c44dff', intro: '#00b0ff', outro: '#2f6fff', preview: '#3fa9a9', filler: '#7b5cff', music_offtopic: '#ff8a00' };
  const canalId = () => (SINT.page.canal && SINT.page.canal.id) || null;
  const video = () => document.querySelector('#movie_player video');
  const emAnuncio = () => { const p = document.getElementById('movie_player'); return !!(p && p.classList.contains('ad-showing')); };
  const oficial = () => !!document.querySelector('ul#previewbar, #previewbar.sbNotInvidious, .sponsorBlockChapterBar');
  function categorias() {
    const pf = S.perfilCanal && canalId() ? SINT.perfil.ajustes(canalId()) : {};
    const l = Array.isArray(pf.sbCats) ? pf.sbCats : Array.isArray(S.sbCats) ? S.sbCats : [];
    return l.filter((c) => CATS.includes(c));
  }
  const ligado = () => SINT.ativo() && S.sb && SINT.page.kind === 'watch' && !(SINT.page.info && SINT.page.info.live);

  let vid = '', todos = [], segs = [], desfeitos = new Set(), pulados = new Set(), avisouOficial = false;
  // estado da consulta deste vídeo (aparece no painel) e nova consulta enquanto ele toca: marcação nova entra sem recarregar
  // (relato do André, 2026-11-11: vídeo lançado no mesmo dia, ainda sem marcação, e nada dizia que a Sintonia tinha consultado)
  let consultaEm = 0, consultaErro = false, tentativaEm = 0;
  const intervalo = () => Math.max(3000, +document.documentElement.dataset.sintTesteSb || 5 * 60e3); // gancho de teste: intervalo menor (nunca abaixo de 3 s)
  async function consultar(id, maxIdade) {
    tentativaEm = Date.now();
    let r = null;
    try { r = await ext.runtime.sendMessage({ type: 'sintonia:sb', videoId: id, maxIdade: maxIdade || 0 }); } catch (_) {}
    if (id !== vid || id !== SINT.page.videoId) return;
    consultaErro = !r || !!r.erro;
    if (consultaErro) { SINT.log('sb-erro', false); if (SINT.painel) SINT.painel.redesenhar(); return; }
    consultaEm = r.em || Date.now();
    const antes = JSON.stringify(todos);
    todos = r.segs || [];
    filtrar();
    if (antes !== JSON.stringify(todos) && SINT.painel) SINT.painel.redesenhar();
  }
  function filtrar() { const cs = categorias(); segs = todos.filter((x) => x.a === 'skip' && cs.includes(x.c) && x.e - x.s >= 0.5); desenharMarcas(); }
  async function carregar() {
    const id = SINT.page.videoId;
    if (!id || id === vid) return;
    vid = id; todos = []; segs = []; desfeitos = new Set(); pulados = new Set(); consultaEm = 0; consultaErro = false; desenharMarcas();
    if (!ligado()) return;
    if (oficial()) return avisarOficial();
    await consultar(id);
  }
  const tkRe = setInterval(() => {
    if (!vid || vid !== SINT.page.videoId || !ligado() || oficial()) return;
    const v = video(), agora = Date.now();
    if (consultaErro) { if (agora - tentativaEm > 30e3) consultar(vid); return; } // falhou: tenta de novo em 30 s
    if (v && !v.paused && agora - tentativaEm >= intervalo()) consultar(vid, intervalo());
  }, 2000);
  function avisarOficial() {
    segs = []; desenharMarcas();
    if (avisouOficial) return;
    avisouOficial = true;
    ext.storage.local.get('st.sb.oficial').then((l) => { if (!l['st.sb.oficial']) { SINT.toast(L().sbOficial, null, 8000); ext.storage.local.set({ 'st.sb.oficial': Date.now() }); } }, () => {});
    SINT.log('sb-oficial');
  }
  // ───────────── pular ─────────────
  function vigiar() {
    const v = video();
    if (!v || !segs.length || !ligado() || emAnuncio() || v.paused && v.currentTime === 0) return;
    if (oficial()) return avisarOficial();
    const t = v.currentTime;
    for (const x of segs) {
      if (desfeitos.has(x.u) || pulados.has(x.u)) continue;
      if (t >= x.s && t < x.e - 0.3) {
        pulados.add(x.u);
        SINT.bridge('seek', x.e);
        SINT.log('sb-pulou');
        if (S.sbAviso) SINT.toast(L().sbPulado(L().sbCat[x.c]), { label: L().undo, fn: () => { desfeitos.add(x.u); SINT.bridge('seek', x.s); } }, 6000);
        break;
      }
    }
  }
  const tk = setInterval(vigiar, 200);
  const onTime = () => vigiar();
  let vEl = null;
  const prender = () => { const v = video(); if (v === vEl) return; if (vEl) vEl.removeEventListener('timeupdate', onTime); vEl = v; if (vEl) vEl.addEventListener('timeupdate', onTime); };
  // ───────────── marcas na barra de progresso ─────────────
  function desenharMarcas() {
    let m = document.getElementById('sintonia-sb-marcas');
    const bar = document.querySelector('#movie_player .ytp-progress-bar');
    const v = video(), dur = (v && isFinite(v.duration) && v.duration) || (segs[0] && segs[0].d) || 0;
    if (!S.sbMarcas || !segs.length || !bar || !dur || !ligado()) { if (m) m.remove(); return; }
    if (!m) { m = document.createElement('div'); m.id = 'sintonia-sb-marcas'; m.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:40'; }
    if (m.parentElement !== bar) bar.appendChild(m);
    m.innerHTML = segs.map((x) => `<div title="${esc(L().sbCat[x.c])}" data-c="${x.c}" style="position:absolute;top:0;bottom:0;left:${(x.s / dur) * 100}%;width:${Math.max(0.3, ((x.e - x.s) / dur) * 100)}%;background:${COR[x.c]};opacity:.9"></div>`).join('');
  }
  const offs = [
    SINT.on('video', () => { prender(); carregar(); }), SINT.on('nav', () => setTimeout(carregar, 300)),
    SINT.on('perfis', filtrar),
    SINT.on('settings', (m) => { if (['sb', 'on'].some((k) => k in m)) { vid = ''; carregar(); } if (['sbCats', 'sbMarcas', 'perfilCanal'].some((k) => k in m)) filtrar(); }),
  ];
  const tkM = setInterval(() => { prender(); if (segs.length && !document.getElementById('sintonia-sb-marcas') && S.sbMarcas) desenharMarcas(); }, 1500);
  SINT.onStop(() => { offs.forEach((f) => f()); clearInterval(tk); clearInterval(tkM); clearInterval(tkRe); if (vEl) vEl.removeEventListener('timeupdate', onTime); const m = document.getElementById('sintonia-sb-marcas'); if (m) m.remove(); });
  SINT.ready.then(() => { prender(); carregar(); });
  SINT.sb = { CATS, COR, get segs() { return segs; } };

  // ───────────── painel: chave + categorias (deste canal, com "Lembrar por canal") ─────────────
  SINT.addBloco({
    id: 'sb', ordem: 45, grupo: () => (S.perfilCanal && canalId() && SINT.page.kind === 'watch' ? 'canal' : 'pagina'),
    html(T) {
      if (!S.sb) return '';
      const cs = categorias(), porCanal = S.perfilCanal && canalId() && SINT.page.kind === 'watch';
      const temProprio = porCanal && Array.isArray(SINT.perfil.ajustes(canalId()).sbCats);
      const naV = SINT.page.kind === 'watch' && vid && vid === SINT.page.videoId;
      const status = !naV || oficial() || !ligado() ? '' : consultaErro ? T.sbStatusErro : !consultaEm ? T.sbStatusConsultando
        : !todos.filter((x) => x.a === 'skip').length ? T.sbStatusVazio : T.sbStatusN(segs.length, todos.filter((x) => x.a === 'skip').length);
      return `<h4>${esc(T['sec.sb'])}</h4>${status ? `<p class="nota sbst" style="color:var(--tx)">${esc(status)}</p>` : ''}<p class="nota">${esc(porCanal ? T.sbCatsCanal : T.sbCatsGlobal)}</p>
        ${S.sb ? `<div class="pv"><div class="pvc">${CATS.map((c) => `<button type="button" data-sbc="${c}" aria-pressed="${cs.includes(c)}"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${COR[c]};margin-right:6px"></span>${esc(T.sbCat[c])}</button>`).join('')}</div>
          ${temProprio ? `<button type="button" class="lk" data-sb="padrao">${esc(T.sbUsarPadrao)}</button>` : ''}</div>` : ''}`;
    },
    wire(el) {
      el.querySelectorAll('[data-sb]').forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.sb === 'on') await SINT.setSetting('sb', !S.sb);
        if (b.dataset.sb === 'padrao' && canalId()) await SINT.perfil.set(canalId(), { sbCats: null });
        SINT.painel.redesenhar();
      }));
      el.querySelectorAll('[data-sbc]').forEach((b) => b.addEventListener('click', async () => {
        const c = b.dataset.sbc, cs = categorias(), novo = cs.includes(c) ? cs.filter((x) => x !== c) : cs.concat(c);
        if (S.perfilCanal && canalId() && SINT.page.kind === 'watch') await SINT.perfil.set(canalId(), { sbCats: novo });
        else await SINT.setSetting('sbCats', novo);
        filtrar(); SINT.painel.redesenhar();
      }));
    },
  });
})();
