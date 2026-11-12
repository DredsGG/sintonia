// Sintonia — página de Ajustes: todas as chaves por seção (desenhadas a partir de src/defaults.js), rodapé padrão e quadros.
(() => {
  'use strict';
  const ext = globalThis.chrome, I = globalThis.SINT_I18N, C = globalThis.SINT_COMUM, DEF = globalThis.SINT_DEF;
  const SYNC = ext.storage.sync || ext.storage.local;
  const VERSION = ext.runtime.getManifest().version;
  const { esc, ICO } = C;
  const S = Object.assign({}, DEF.SYNC);
  let lang = I.detect(), upd = {}, msg = null, cards = null;
  const L = () => I.T[lang] || I.T.en;
  const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const app = document.getElementById('app');
  const st = document.createElement('style'); st.textContent = C.CSS; document.head.appendChild(st);
  // Seções extras desenhadas por recursos (ex.: lista de perfis): SINT_OPTS.extra[id] = { html(T, S), wire(el, S, salvar) }
  const EXTRA = (globalThis.SINT_OPTS && globalThis.SINT_OPTS.extra) || {};

  const updCmd = (cmd, data) => new Promise((ok) => { try { ext.runtime.sendMessage({ type: 'sintonia:update', cmd, data }).then(ok, () => ok(null)); } catch (_) { ok(null); } });
  let tSaved = 0;
  function salvo() { const s = app.querySelector('.saved'); if (!s) return; s.classList.add('on'); clearTimeout(tSaved); tSaved = setTimeout(() => s.classList.remove('on'), 1200); }
  async function salvar(k, v) { S[k] = v; try { await SYNC.set({ [k]: v }); } catch (_) {} salvo(); }

  function item(it, T) {
    const t = T['set.' + it.k] || it.k, sub = T['set.' + it.k + '_'] || '';
    const lb = `<span class="lb"><span>${esc(t)}${it.canal ? `<i class="tag">${esc(T.tagCanal)}</i>` : ''}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
    if (it.type === 'switch') return `<button type="button" class="it" role="switch" aria-checked="${!!S[it.k]}" data-k="${it.k}" data-t="switch">${lb}<span class="sw"></span></button>`;
    if (it.type === 'lang') return `<div class="it">${lb}<select data-k="lang" data-t="lang" aria-label="${esc(t)}"><option value="">${esc(T.langAuto)}</option>${I.LANGS.map((l) => `<option value="${l}"${S.lang === l ? ' selected' : ''}>${({ pt: 'Português', en: 'English', es: 'Español' })[l]}</option>`).join('')}</select></div>`;
    if (it.type === 'select') return `<div class="it">${lb}<select data-k="${it.k}" data-t="select" aria-label="${esc(t)}">${it.opts.map((o) => `<option value="${esc(o)}"${String(S[it.k]) === String(o) ? ' selected' : ''}>${esc((T['opt.' + it.k] && T['opt.' + it.k][o]) || o)}</option>`).join('')}</select></div>`;
    if (it.type === 'number') return `<div class="it">${lb}<input type="number" data-k="${it.k}" data-t="number" min="${it.min}" max="${it.max}" step="${it.step || 1}" value="${esc(S[it.k])}" aria-label="${esc(t)}"></div>`;
    if (it.type === 'text') return `<div class="it">${lb}<input type="text" data-k="${it.k}" data-t="text" value="${esc(S[it.k])}" aria-label="${esc(t)}"></div>`;
    if (it.type === 'extra' && EXTRA[it.k]) return `<div class="it" data-x="${it.k}">${EXTRA[it.k].html(T, S)}</div>`;
    return '';
  }
  function render() {
    const T = L(), dark = (localTema || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    document.body.classList.toggle('light', !dark);
    app.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
    document.title = T.optTitle;
    const ativa = (location.hash || '#geral').slice(1);
    app.innerHTML = `<header class="hdr"><span class="ic">${ICO.app}</span><b>Sintonia</b><span class="tg">${esc(T.tagline)}</span><span class="sp"></span></header>
      <div class="wrap"><nav class="sec"><span class="pill" aria-hidden="true"></span>${DEF.SECTIONS.map((s) => `<a href="#${s.id}" data-sec="${s.id}" class="${s.id === ativa ? 'on' : ''}"${s.id === ativa ? ' aria-current="true"' : ''}>${esc(T['sec.' + s.id] || s.id)}</a>`).join('')}</nav>
      <main><label class="busca"><input type="search" data-busca placeholder="${esc(T.optSearch)}" aria-label="${esc(T.optSearch)}"></label><p class="hint">${esc(T.allOff)}</p><p class="hint nada" hidden>${esc(T.buscaVazia)}</p>
      ${DEF.SECTIONS.map((s) => `<section id="${s.id}"><h2>${esc(T['sec.' + s.id] || s.id)}</h2><div class="box">${s.items.map((it) => `<div class="itw" data-q="${esc(norm([T['sec.' + s.id], T['set.' + it.k], T['set.' + it.k + '_'], ...Object.values(T['opt.' + it.k] || {})].join(' ')))}">${item(it, T)}</div>`).join('')}</div></section>`).join('')}
      </main></div>${C.footerHtml(T, lang, I.LANGS, VERSION, msg)}
      <div class="card" role="dialog" hidden></div><div class="saved" role="status">${esc(T.optSaved)}</div>`;
    wire();
  }
  function filtrar(q) {
    q = norm(q.trim()); let algum = false;
    app.querySelectorAll('main section').forEach((sec) => {
      let n = 0; sec.querySelectorAll('.itw').forEach((w) => { const ok = !q || w.dataset.q.includes(q); w.hidden = !ok; if (ok) n++; });
      sec.hidden = !n; if (n) algum = true;
    });
    const nada = app.querySelector('.nada'); if (nada) nada.hidden = algum;
    marcarPelaRolagem();
  }
  // ── menu lateral acompanha a rolagem (pedido do André): marca a seção que está no alto da tela, com um destaque que desliza
  // de item em item. No fim da página marca a última seção (ela pode ser curta demais para chegar ao alto).
  const ALTO = 56 + 32; // cabeçalho fixo + folga
  let travaAte = 0, quadro = 0, escolhido = null; // escolhido: item clicado, vale enquanto a seção dele estiver na tela
  function marcar(id, suave) {
    const nav = app.querySelector('nav.sec'); if (!nav) return;
    let alvo = null;
    nav.querySelectorAll('a[data-sec]').forEach((a) => { const on = a.dataset.sec === id; a.classList.toggle('on', on); if (on) { a.setAttribute('aria-current', 'true'); alvo = a; } else a.removeAttribute('aria-current'); });
    const pill = nav.querySelector('.pill');
    if (pill && alvo) {
      if (!suave) pill.classList.add('sem-anim');
      pill.style.transform = `translate(${alvo.offsetLeft}px, ${alvo.offsetTop}px)`; pill.style.width = alvo.offsetWidth + 'px'; pill.style.height = alvo.offsetHeight + 'px';
      pill.classList.add('vis');
      if (!suave) { void pill.offsetWidth; pill.classList.remove('sem-anim'); }
    }
    if (id && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  }
  function secaoNoAlto() {
    const secs = [...app.querySelectorAll('main section')].filter((s) => !s.hidden);
    if (!secs.length) return null;
    if (escolhido) { const e = secs.find((s) => s.id === escolhido); if (e) { const r = e.getBoundingClientRect(); if (r.top < innerHeight - 40 && r.bottom > ALTO) return escolhido; } escolhido = null; }
    const fim = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    if (fim && scrollY > 0) {
      // no fim: a última seção que aparece na tela (as curtas do fim não chegam ao alto)
      const vis = secs.filter((s) => s.getBoundingClientRect().top < innerHeight - 40);
      return (vis[vis.length - 1] || secs[secs.length - 1]).id;
    }
    let atual = secs[0];
    for (const s of secs) if (s.getBoundingClientRect().top - ALTO <= 0) atual = s;
    return atual.id;
  }
  function marcarPelaRolagem(suave = true) { const id = secaoNoAlto(); if (id) marcar(id, suave); }
  addEventListener('scroll', () => { if (Date.now() < travaAte || quadro) return; quadro = requestAnimationFrame(() => { quadro = 0; marcarPelaRolagem(); }); }, { passive: true });
  addEventListener('resize', () => marcarPelaRolagem(false));
  // a pessoa voltou a rolar por conta própria: o item clicado deixa de mandar
  const soltar = () => { escolhido = null; travaAte = 0; };
  addEventListener('wheel', soltar, { passive: true }); addEventListener('touchmove', soltar, { passive: true });
  addEventListener('keydown', (e) => { if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key)) soltar(); });
  // terminou a rolagem suave de um clique: confere de novo
  addEventListener('scrollend', () => { if (travaAte) { travaAte = 0; marcarPelaRolagem(); } });
  function wire() {
    const bq = app.querySelector('[data-busca]'); if (bq) bq.addEventListener('input', () => filtrar(bq.value));
    app.querySelectorAll('[data-t=switch]').forEach((b) => b.addEventListener('click', async () => { const v = !S[b.dataset.k]; b.setAttribute('aria-checked', String(v)); await salvar(b.dataset.k, v); }));
    app.querySelectorAll('[data-t=lang]').forEach((s) => s.addEventListener('change', async () => { await salvar('lang', s.value); lang = I.LANGS.includes(s.value) ? s.value : I.detect(); render(); }));
    app.querySelectorAll('[data-t=select]').forEach((s) => s.addEventListener('change', () => salvar(s.dataset.k, isNaN(+s.value) || s.value === '' ? s.value : +s.value)));
    app.querySelectorAll('[data-t=number]').forEach((s) => s.addEventListener('change', () => {
      const it = DEF.SECTIONS.flatMap((x) => x.items).find((x) => x.k === s.dataset.k);
      let v = parseFloat(String(s.value).replace(',', '.')); if (isNaN(v)) v = DEF.SYNC[s.dataset.k];
      v = Math.min(it.max, Math.max(it.min, v)); s.value = v; salvar(s.dataset.k, v);
    }));
    app.querySelectorAll('[data-t=text]').forEach((s) => s.addEventListener('change', () => salvar(s.dataset.k, s.value.trim())));
    app.querySelectorAll('[data-x]').forEach((el) => { const x = EXTRA[el.dataset.x]; if (x && x.wire) x.wire(el, S, salvar, L); });
    // clicar: o destaque vai direto para o item e a página rola suave até a seção (sem passar pelos itens do meio)
    app.querySelectorAll('nav.sec a[data-sec]').forEach((a) => a.addEventListener('click', (e) => {
      const sec = document.getElementById(a.dataset.sec); if (!sec) return;
      e.preventDefault();
      marcar(a.dataset.sec, true);
      escolhido = a.dataset.sec; travaAte = Date.now() + 1200;
      sec.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
    marcarPelaRolagem(false);
    app.querySelectorAll('.foot .langs button').forEach((b) => b.addEventListener('click', async () => { await salvar('lang', b.dataset.l); lang = b.dataset.l; render(); }));
    app.querySelectorAll('.foot [data-act]').forEach((b) => b.addEventListener('click', () => acao(b.dataset.act)));
    cards = C.makeCards({
      card: app.querySelector('.card'), root: document, T: L, lang: () => lang, setLang: async (l) => { await salvar('lang', l); lang = l; }, LANGS: I.LANGS, version: VERSION,
      NOV: globalThis.SINT_NOVIDADES || {}, upd: () => upd, updCmd, onClosed: () => {},
      loadApoio: async () => (await ext.storage.local.get(DEF.LOCAL.apoio))[DEF.LOCAL.apoio],
      saveApoio: (v) => ext.storage.local.set({ [DEF.LOCAL.apoio]: v }),
    });
  }
  async function acao(act) {
    const T = L();
    if (act === 'help') cards.tutorial();
    else if (act === 'apoio') cards.apoio();
    else if (act === 'bug') {
      const d = (await updCmd('diag')) || {};
      const diag = [`Sintonia v${VERSION}`, `Browser: ${C.navegador()}`, `Install: ${d.instalacao || '?'}`, `UI: ${lang} / ${navigator.language}`, 'Page: options',
        `Settings: ${Object.keys(DEF.SYNC).filter((k) => typeof DEF.SYNC[k] === 'boolean').map((k) => `${k}=${S[k] ? 1 : 0}`).join(' ')}`].join('\n');
      await C.copiar(diag);
      window.open(C.relatoUrl(T, diag), '_blank', 'noopener');
      msg = { t: T.bugCopied }; render();
    } else if (act === 'check') {
      msg = { t: T.checking }; render();
      const r = (await updCmd('check')) || {};
      upd = r;
      msg = r.erro ? { t: T.checkErr, bad: true } : r.disponivel ? { t: T.newVer(r.ultima) } : { t: T.upToDate };
      render();
      if (r.disponivel) cards.update();
    }
  }
  addEventListener('keydown', (e) => { if (cards) cards.onKey(e); });
  let localTema = '';
  ext.storage.onChanged.addListener((ch, area) => {
    if (area === 'sync') { let mud = false; for (const k of Object.keys(DEF.SYNC)) if (ch[k]) { const nv = ch[k].newValue === undefined ? DEF.SYNC[k] : ch[k].newValue; if (JSON.stringify(nv) !== JSON.stringify(S[k])) mud = true; S[k] = nv; } if (ch.lang) lang = I.LANGS.includes(S.lang) ? S.lang : I.detect(); if (mud && !cards.open) render(); }
  });
  Promise.all([
    SYNC.get(null).then((s) => { for (const k of Object.keys(DEF.SYNC)) if (k in s) S[k] = s[k]; if (I.LANGS.includes(s.lang)) lang = s.lang; }),
    ext.storage.local.get([DEF.LOCAL.update, DEF.LOCAL.tema]).then((l) => { upd = l[DEF.LOCAL.update] || {}; localTema = l[DEF.LOCAL.tema] || ''; }),
  ]).catch(() => {}).then(render);
})();
