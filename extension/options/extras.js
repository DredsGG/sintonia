// Sintonia — itens especiais da página de Ajustes (desenhados à mão): atalhos de teclado e perfis por canal.
(() => {
  const ext = globalThis.chrome, A = globalThis.SINT_ATALHOS, C = globalThis.SINT_COMUM;
  const { esc } = C;
  const extra = {};

  // ───────────── atalhos: lista de ações, "Mudar" grava a próxima combinação, com conferência de conflito ─────────────
  let gravando = null, teclaAtiva = null; // um só ouvinte de tecla na janela (a página redesenha e não pode acumular)
  extra.atalhoMap = {
    html(T, S) {
      const m = A.mapa(S.atalhoMap);
      return `<div class="atl" style="width:100%"><span class="lb" style="margin-bottom:8px"><span>${esc(T['set.atalhoMap'])}</span><small>${esc(T['set.atalhoMap_'])}</small></span>
        ${A.ACOES.map((k) => `<div class="atr" style="display:flex;align-items:center;gap:12px;min-height:44px">
          <span style="flex:1">${esc(T.acao[k])}</span>
          <kbd style="font:500 13px/28px Roboto,Arial,sans-serif;padding:0 10px;border-radius:8px;background:var(--add);min-width:96px;text-align:center" data-kbd="${k}">${esc(gravando === k ? T.atlAperte : A.legivel(m[k]))}</kbd>
          <button type="button" class="btn sec" data-mudar="${k}">${esc(gravando === k ? T.edCancelar : T.atlMudar)}</button></div>`).join('')}
        <div class="atmsg" role="status" style="min-height:20px;color:var(--err);font-size:13px;margin-top:4px"></div>
        <button type="button" class="lk" data-restaurar="1">${esc(T.atlRestaurar)}</button></div>`;
    },
    wire(el, S, salvar, L) {
      const redesenhar = () => { el.innerHTML = extra.atalhoMap.html(L(), S); extra.atalhoMap.wire(el, S, salvar, L); };
      el.querySelectorAll('[data-mudar]').forEach((b) => b.addEventListener('click', () => { gravando = gravando === b.dataset.mudar ? null : b.dataset.mudar; redesenhar(); }));
      const r = el.querySelector('[data-restaurar]');
      if (r) r.addEventListener('click', async () => { gravando = null; await salvar('atalhoMap', {}); redesenhar(); });
      if (teclaAtiva) removeEventListener('keydown', teclaAtiva, true);
      teclaAtiva = async (e) => {
        if (!gravando) return;
        const combo = A.doEvento(e);
        if (!combo) return;
        e.preventDefault(); e.stopPropagation();
        if (e.code === 'Escape' && !e.altKey) { gravando = null; return redesenhar(); }
        const atual = Object.assign({}, S.atalhoMap || {});
        const erro = A.validar(combo, A.mapa(atual), gravando);
        if (erro) { const m = el.querySelector('.atmsg'); if (m) m.textContent = L().atlErro[erro](A.legivel(combo)); return; }
        atual[gravando] = combo; gravando = null;
        await salvar('atalhoMap', atual);
        redesenhar();
      };
      addEventListener('keydown', teclaAtiva, true);
    },
  };

  // ───────────── perfis por canal: lista com o que está salvo e "Esquecer" ─────────────
  let perfis = null;
  const QLAB = { highres: '4320p', hd2880: '2880p', hd2160: '2160p', hd1440: '1440p', hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p' };
  const fmt = (k, v, lang, T) => (Array.isArray(v) ? (v.map((c) => (T.sbCat && T.sbCat[c]) || c).join(', ') || '—') : k === 'rate' ? `${String(v).replace('.', lang === 'en' ? '.' : ',')}×` : k === 'vol' || k === 'boost' ? `${v}%` : k === 'q' ? (QLAB[v] || v) : String(v));
  extra.perfis = {
    html(T) {
      const ps = perfis || {}, ids = Object.keys(ps).sort((a, b) => (ps[b].em || 0) - (ps[a].em || 0));
      return `<div style="width:100%"><span class="lb"><span>${esc(T['set.perfis'])}</span><small>${esc(T['set.perfis_'])}</small></span>
        ${perfis === null ? '' : !ids.length ? `<p style="color:var(--tx2);margin:8px 0 0">${esc(T.perfisVazio)}</p>` : ids.map((id) => {
          const p = ps[id], aj = Object.keys(p).filter((k) => !['n', 'em'].includes(k) && p[k] != null);
          return `<div style="display:flex;align-items:center;gap:12px;min-height:44px;border-top:1px solid var(--line);margin-top:6px;padding-top:6px">
            <span style="flex:1;min-width:0"><b>${esc(p.n || id)}</b><br><small style="color:var(--tx2)">${aj.map((k) => `${esc((T.profKeys && T.profKeys[k]) || k)} ${esc(fmt(k, p[k], T === globalThis.SINT_I18N.T.en ? 'en' : 'pt', T))}`).join(' · ') || '—'}</small></span>
            <button type="button" class="btn sec" data-esquecer="${esc(id)}">${esc(T.profForget)}</button></div>`;
        }).join('')}</div>`;
    },
    wire(el, S, salvar, L) {
      const desenhar = () => { el.innerHTML = extra.perfis.html(L()); ligar(); };
      const ligar = () => el.querySelectorAll('[data-esquecer]').forEach((b) => b.addEventListener('click', async () => {
        const cur = (await ext.storage.local.get('st.perfis'))['st.perfis'] || {};
        delete cur[b.dataset.esquecer]; await ext.storage.local.set({ 'st.perfis': cur }); perfis = cur; desenhar();
      }));
      if (perfis === null) ext.storage.local.get('st.perfis').then((l) => { perfis = l['st.perfis'] || {}; desenhar(); });
      else ligar();
    },
  };
  // ───────────── like automático: canais marcados e "nunca curtir" ─────────────
  let likeD = null;
  extra.likeListas = {
    html(T) {
      const d = likeD || { canais: {}, nunca: {} };
      const lista = (o, k) => (Object.keys(o).length ? Object.keys(o).map((id) => `<div style="display:flex;align-items:center;gap:12px;min-height:40px"><span style="flex:1">${esc(o[id] || id)}</span><button type="button" class="btn sec" data-lktira="${k}|${esc(id)}">${esc(T.likeTirar)}</button></div>`).join('') : `<p style="color:var(--tx2);margin:4px 0">${esc(T.likeListaVazia)}</p>`);
      return `<div style="width:100%"><span class="lb"><span>${esc(T['set.likeListas'])}</span><small>${esc(T['set.likeListas_'])}</small></span>
        <h3 style="font-size:14px;margin:12px 0 4px">${esc(T.likeCanais)}</h3>${lista(d.canais, 'canais')}
        <h3 style="font-size:14px;margin:12px 0 4px">${esc(T.likeNuncaLista)}</h3>${lista(d.nunca, 'nunca')}</div>`;
    },
    wire(el, S, salvar, L) {
      const desenhar = () => { el.innerHTML = extra.likeListas.html(L()); ligar(); };
      const ligar = () => el.querySelectorAll('[data-lktira]').forEach((b) => b.addEventListener('click', async () => {
        const [k, id] = b.dataset.lktira.split('|');
        const cur = (await ext.storage.local.get('st.like'))['st.like'] || {};
        if (cur[k]) delete cur[k][id];
        await ext.storage.local.set({ 'st.like': cur }); likeD = cur; desenhar();
      }));
      if (likeD === null) ext.storage.local.get('st.like').then((l) => { likeD = Object.assign({ canais: {}, nunca: {} }, l['st.like'] || {}); desenhar(); });
      else ligar();
    },
  };
  // ───────────── SponsorBlock: categorias de todos os canais ─────────────
  const SBC = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'filler', 'music_offtopic'];
  extra.sbCats = {
    html(T, S) {
      const on = Array.isArray(S.sbCats) ? S.sbCats : [];
      return `<div style="width:100%"><span class="lb"><span>${esc(T['set.sbCats'])}</span><small>${esc(T['set.sbCats_'])}</small></span>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${SBC.map((c) => `<button type="button" class="btn ${on.includes(c) ? 'pri' : 'sec'}" data-sbc="${c}" aria-pressed="${on.includes(c)}">${esc(T.sbCat[c])}</button>`).join('')}</div></div>`;
    },
    wire(el, S, salvar, L) {
      el.querySelectorAll('[data-sbc]').forEach((b) => b.addEventListener('click', async () => {
        const on = Array.isArray(S.sbCats) ? S.sbCats.slice() : [], c = b.dataset.sbc;
        await salvar('sbCats', on.includes(c) ? on.filter((x) => x !== c) : on.concat(c));
        el.innerHTML = extra.sbCats.html(L(), S); extra.sbCats.wire(el, S, salvar, L);
      }));
    },
  };
  globalThis.SINT_OPTS = { extra };
})();
