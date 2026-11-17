// Sintonia — selo "Inscrito" (v1.2.0; v1.2.1: pílula "✓ Inscrito" com a palavra, legível de longe): marca nos cards de vídeo os canais em que a pessoa é inscrita e, se quiser, esmaece esses cards.
// Páginas: início, relacionados (coluna ao lado do vídeo) e busca. Nunca nas Inscrições, na página do canal, em playlists ou Shorts.
// Fonte da lista (medida ao vivo em 2026-11-16, ver sintonia-engenharia-reversa.md): leitura ao próprio youtube.com, no mundo MAIN
// (main.js · listarInscricoes), a mesma da página Canais. SÓ LEITURA: nada que escreva na conta. Guardada só em storage.local:
// st.inscritos = { ids: [UC…], handles: [@…], em: data }. Atualiza ao ligar a chave, 1 vez a cada 24 h e na hora de Inscrever-se / Cancelar
// inscrição (observando o botão do vídeo, sem clicar em nada). Sem login: fica quieto.
// O YouTube reaproveita os cards: o main.js relê o canal sempre que o vídeo do card muda e este arquivo refaz o selo a cada lote.
(() => {
  'use strict';
  const SINT = globalThis.SINT;
  if (!SINT || SINT.dead) return;
  const { ext, C } = SINT;
  const { esc } = C;
  const S = SINT.S, L = () => SINT.L();
  const K = 'st.inscritos', DIA = 864e5, CSS_ID = 'sintonia-inscritos-css';
  let lista = null; // { ids: Set, hs: Set, em }
  let estado = 'parado'; // 'parado' | 'carregando' | 'ok' | 'deslogado' | 'erro'
  let proxima = 0; // não tenta de novo antes disso (erro / deslogado)
  let logado = true, ultimoLogin = 0;
  let motivo = '', detalhe = ''; // por que a leitura da lista não deu certo (mostrado no painel)

  const pagina = () => { const p = location.pathname; return p === '/' ? 'home' : p === '/watch' ? 'watch' : p === '/results' ? 'search' : ''; };
  const ligado = () => SINT.ativo() && !!S.seloInscrito && !!pagina();
  const norm = (h) => { try { return decodeURIComponent(h).toLowerCase(); } catch (_) { return String(h).toLowerCase(); } };
  const doDados = (d) => ({ ids: new Set(d.ids || []), hs: new Set((d.handles || []).map(norm)), em: d.em || 0 });
  const paraDados = () => ({ ids: [...lista.ids], handles: [...lista.hs], em: lista.em });
  const inscrito = (ucs, hs) => !!lista && (ucs.some((x) => lista.ids.has(x)) || hs.some((x) => lista.hs.has(x)));
  const mudarLista = async (fn) => { // altera a cópia local (Inscrever-se / Cancelar) e guarda
    if (!lista) lista = { ids: new Set(), hs: new Set(), em: Date.now() };
    fn(lista);
    try { await ext.storage.local.set({ [K]: paraDados() }); } catch (_) {}
  };

  // ───────────────────────── atualizar a lista ─────────────────────────
  let espera = null;
  async function atualizar(forcar) {
    if (estado === 'carregando') return;
    if (!forcar && (Date.now() < proxima || (lista && Date.now() - lista.em < DIA))) return;
    estado = 'carregando'; redesenharPainel();
    const r = await SINT.bridge('listarInscricoes');
    if (!r || !r.ok) { estado = r && r.motivo === 'deslogado' ? 'deslogado' : 'erro'; motivo = (r && r.motivo) || 'sem-resposta'; detalhe = ''; proxima = Date.now() + (estado === 'deslogado' ? 5 * 60e3 : 30 * 60e3); redesenharPainel(); return; }
    const dados = await new Promise((ok) => { const off = SINT.on('inscritos', (d) => { off(); clearTimeout(t); ok(d); }); const t = setTimeout(() => { off(); ok(null); }, 40000); });
    if (!dados || !dados.ok) { estado = dados && dados.motivo === 'sem-sessao' ? 'deslogado' : 'erro'; motivo = dados ? dados.motivo || 'erro' : 'demora'; detalhe = (dados && dados.detalhe) || ''; proxima = Date.now() + 30 * 60e3; SINT.log('inscritos-erro', true); redesenharPainel(); return; }
    lista = doDados({ ids: dados.ids, handles: dados.handles, em: Date.now() });
    estado = 'ok'; motivo = ''; detalhe = '';
    try { await ext.storage.local.set({ [K]: paraDados() }); } catch (_) {}
    SINT.log('inscritos-ok');
    redesenharPainel(); agendar(0);
  }

  // ───────────────────────── selo e esmaecido nos cards ─────────────────────────
  const ICO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 12.8l5 5L19.5 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // onde o selo entra: logo depois do nome do canal (e do selo de verificado, se houver)
  const visivel = (e) => e.getClientRects().length > 0; // o card da busca tem um nome de canal escondido (layout compacto) além do que aparece
  const primeiroVisivel = (card, sel) => [...card.querySelectorAll(sel)].find(visivel) || null;
  function ponto(card) {
    const alvo = primeiroVisivel(card, 'yt-lockup-metadata-view-model a[href^="/@"], yt-lockup-metadata-view-model a[href^="/channel/"]')
      || primeiroVisivel(card, 'yt-content-metadata-view-model span[role="text"]')
      || primeiroVisivel(card, 'ytd-channel-name');
    if (!alvo) return null;
    let n = alvo.closest('a') || alvo;
    if (n.matches('ytd-channel-name')) return n;
    const linha = n.closest('span[role="text"]') || n; // o link fica dentro do span do nome; o selo de verificado é irmão desse span
    const nx = linha.nextElementSibling;
    if (nx && !nx.hasAttribute('data-sint-selo') && !nx.textContent.trim() && nx.querySelector('svg')) return nx; // depois do selo de verificado
    return linha; // fora do span do nome (ele corta nomes longos com reticências e cortaria o selo junto)
  }
  function pintarEstilo(on) {
    let st = document.getElementById(CSS_ID);
    if (!on) { if (st) st.remove(); return; }
    if (!st) { st = document.createElement('style'); st.id = CSS_ID; (document.head || document.documentElement).appendChild(st); }
    // pílula "✓ Inscrito": verde (não se confunde com o vermelho do YouTube nem com o cinza do selo de verificado), texto em negrito 11 px
    st.textContent = '[data-sint-esm] { opacity: .45; transition: opacity .15s; } [data-sint-esm]:hover, [data-sint-esm]:focus-within { opacity: 1; }'
      + ' .sint-selo { display: inline-flex; align-items: center; gap: 3px; vertical-align: middle; margin-left: 6px; padding: 0 7px 0 5px; height: 16px; box-sizing: border-box; border-radius: 8px; font: 700 11px/16px Roboto, Arial, sans-serif; letter-spacing: .1px; white-space: nowrap; flex: none; color: #0a6b38; background: rgba(0, 150, 70, .14); }'
      + ' html[dark] .sint-selo { color: #6ee7a0; background: rgba(46, 204, 113, .22); }'
      + ' .sint-selo svg { width: 10px; height: 10px; display: block; flex: none; }';
  }
  function limpar() {
    for (const b of document.querySelectorAll('[data-sint-selo]')) b.remove();
    for (const c of document.querySelectorAll('[data-sint-esm]')) c.removeAttribute('data-sint-esm');
    pintarEstilo(false);
  }
  function aplicar(card) {
    const ucs = (card.getAttribute('data-sint-ch') || '').split(' ').filter(Boolean), hs = (card.getAttribute('data-sint-h') || '').split(' ').filter(Boolean);
    const sim = inscrito(ucs, hs);
    const chave = ucs.join(' ') + '|' + hs.join(' ');
    const velho = card.querySelector('[data-sint-selo]');
    if (!sim) { if (velho) velho.remove(); card.removeAttribute('data-sint-esm'); return; }
    if (velho && velho.getAttribute('data-sint-selo') !== chave) { velho.remove(); }
    if (!card.querySelector('[data-sint-selo]')) {
      const alvo = ponto(card);
      if (!alvo) faltou = true; // ainda sem layout: tenta de novo daqui a pouco
      if (alvo) {
        const T = L(), b = document.createElement('span');
        b.className = 'sint-selo'; b.setAttribute('data-sint-selo', chave); b.title = T.seloDica;
        b.innerHTML = ICO + '<span>' + esc(T.selo) + '</span>';
        alvo.insertAdjacentElement('afterend', b);
      }
    }
    if (S.esmaecerInscritos) card.setAttribute('data-sint-esm', ''); else card.removeAttribute('data-sint-esm');
  }
  let ocupado = false, faltou = false, tentativas = 0;
  async function reconciliar() {
    if (ocupado) return; ocupado = true;
    try {
      if (!ligado()) { limpar(); return; }
      // sem login: quieto (nem o selo da lista guardada de outra conta); confere de vez em quando
      if (Date.now() - ultimoLogin > 30e3) { const lg = await SINT.bridge('logado'); ultimoLogin = Date.now(); logado = !(lg && lg.ok && !lg.logado); }
      if (!logado) { limpar(); estado = 'deslogado'; return; }
      if (estado === 'deslogado') { estado = lista ? 'ok' : 'parado'; proxima = 0; }
      pintarEstilo(true);
      if (!lista && estado === 'parado') { estado = 'carregando'; try { const l = await ext.storage.local.get(K); if (l[K]) { lista = doDados(l[K]); estado = 'ok'; } else estado = 'parado'; } catch (_) { estado = 'parado'; } }
      if (!lista || Date.now() - lista.em > DIA) atualizar(false);
      if (!lista) return;
      await SINT.bridge('canaisCards'); // o MAIN anota o canal de cada card
      faltou = false;
      for (const card of document.querySelectorAll('[data-sint-vid]')) aplicar(card);
      if (faltou && tentativas++ < 6) agendar(800); else if (!faltou) tentativas = 0;
    } finally { ocupado = false; }
  }
  // lote: muda muita coisa por segundo no YouTube; no máximo uma passada a cada 400 ms
  let tm = 0;
  function agendar(ms) { if (tm) return; tm = setTimeout(() => { tm = 0; reconciliar(); }, ms == null ? 400 : ms); }
  const mo = new MutationObserver(() => { if (ligado()) agendar(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // ───────────────────────── Inscrever-se / Cancelar inscrição (só observa o botão) ─────────────────────────
  const donoAtual = () => {
    const c = SINT.page.canal, id = c && c.id || '';
    const link = document.querySelector('ytd-watch-metadata ytd-video-owner-renderer a[href^="/@"], #owner a[href^="/@"]');
    const h = id.startsWith('h:') ? id.slice(2) : link ? norm(link.getAttribute('href').slice(1)) : '';
    const uc = id.startsWith('UC') ? id : '';
    return (uc || h) ? { uc, h: h.toLowerCase() } : null;
  };
  const lerBotao = () => { // true = inscrito, false = não, null = sem botão
    // YouTube de hoje (medido 2026-11-16): ytd-subscribe-button-renderer tem os DOIS botões ("Inscrever-se" e "Inscrito", um escondido)
    // e o atributo `subscribed` no renderer diz qual vale
    const r = document.querySelector('ytd-watch-metadata ytd-subscribe-button-renderer');
    if (r) return r.hasAttribute('subscribed');
    // outro layout: o botão visível diz o estado pelo texto
    const bs = [...document.querySelectorAll('ytd-watch-metadata #subscribe-button button, ytd-watch-metadata yt-subscribe-button-view-model button')].filter((b) => b.getClientRects().length);
    for (const b of bs) {
      const t = ((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')).trim().replace(/^\W+/, '');
      if (/^(inscrever|inscreva|subscribe|suscribirse|suscr[ií]bete)/i.test(t)) return false;
      if (/(inscrito|subscribed|suscrito)/i.test(t)) return true;
    }
    return null;
  };
  let base = { k: '', v: null };
  function vigiaBotao() {
    if (!ligado() || pagina() !== 'watch' || !lista) return;
    const d = donoAtual(), v = lerBotao();
    if (!d || v === null) return;
    const k = d.uc + '|' + d.h;
    if (base.k !== k) { base = { k, v }; return; } // vídeo/canal novo: só guarda como está
    if (base.v === v) return;
    base.v = v;
    SINT.log(v ? 'inscritos-novo' : 'inscritos-saiu');
    mudarLista((l) => { for (const [set, x] of [[l.ids, d.uc], [l.hs, d.h]]) if (x) { if (v) set.add(x); else set.delete(x); } }).then(() => { redesenharPainel(); agendar(0); });
    setTimeout(() => { atualizar(true); }, 6000); // confere com a lista de verdade
  }
  const tk = setInterval(vigiaBotao, 1000);

  // ───────────────────────── painel (Agora): contagem e "carregando" ─────────────────────────
  const redesenharPainel = () => { if (SINT.painel && SINT.painel.redesenhar) SINT.painel.redesenhar(); };
  SINT.addBloco({
    id: 'inscritos', ordem: 30,
    html(T) {
      if (!SINT.ativo() || !S.seloInscrito) return '';
      const msg = estado === 'carregando' ? T.inscCarregando : estado === 'deslogado' ? T.inscSemLogin : estado === 'erro' ? T.inscMotivo(motivo, detalhe) : lista ? T.inscN(lista.ids.size, lista.em) : T.inscCarregando;
      return `<h4>${esc(T.inscTit)}</h4><p class="hint" role="status">${esc(msg)}</p><button type="button" class="more" data-insc="atualizar"${estado === 'carregando' ? ' disabled' : ''}><span>${esc(T.inscAtualizar)}</span></button>`;
    },
    wire(el) { const b = el.querySelector('[data-insc="atualizar"]'); if (b) b.addEventListener('click', () => atualizar(true)); },
  });

  // ───────────────────────── ciclo de vida ─────────────────────────
  const offs = [
    SINT.on('settings', (m) => { if (m && ('seloInscrito' in m || 'esmaecerInscritos' in m || 'on' in m)) { if (m.seloInscrito) { proxima = 0; if (!lista || Date.now() - lista.em > DIA) atualizar(false); } agendar(0); redesenharPainel(); } }),
    SINT.on('lang', () => { for (const b of document.querySelectorAll('[data-sint-selo]')) b.remove(); agendar(0); }),
    SINT.on('nav', () => { base = { k: '', v: null }; agendar(300); }),
    SINT.on('video', () => agendar(300)),
    SINT.on('ativo', () => agendar(0)),
  ];
  const onStore = (ch, area) => { if (area === 'local' && ch[K] && SINT.alive()) { lista = ch[K].newValue ? doDados(ch[K].newValue) : null; if (lista) estado = 'ok'; agendar(0); } };
  ext.storage.onChanged.addListener(onStore);
  SINT.onStop(() => {
    offs.forEach((f) => f()); mo.disconnect(); clearInterval(tk); clearTimeout(tm);
    try { ext.storage.onChanged.removeListener(onStore); } catch (_) {}
    limpar();
  });
  SINT.ready.then(() => agendar(500));
})();
