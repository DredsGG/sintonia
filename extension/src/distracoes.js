// Sintonia — fase 3: esconder distrações, uma chave para cada. Feito com CSS (uma <style> nossa), que não briga com o
// YouTube e some na hora quando a chave desliga. Seletores medidos ao vivo em 2026-11-11 (ver engenharia reversa).
(() => {
  'use strict';
  const SINT = globalThis.SINT;
  if (!SINT || SINT.dead) return;
  const S = SINT.S;
  const SH = 'a[href^="/shorts/"]';
  const REGRAS = {
    escComentarios: ['ytd-watch-flexy ytd-comments#comments', 'ytd-watch-flexy #comments'],
    escChat: ['ytd-watch-flexy ytd-live-chat-frame', 'ytd-watch-flexy #chat-container', 'ytd-watch-flexy #chat'],
    escRelacionados: ['ytd-watch-flexy #related', 'ytd-watch-next-secondary-results-renderer'],
    escShorts: ['ytd-reel-shelf-renderer', 'ytd-rich-shelf-renderer[is-shorts]', 'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
      'ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model)', 'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
      `ytd-rich-item-renderer:has(${SH})`, `ytd-video-renderer:has(${SH})`, `ytd-grid-video-renderer:has(${SH})`, `ytd-compact-video-renderer:has(${SH})`,
      `yt-lockup-view-model:has(${SH})`, 'ytd-guide-entry-renderer:has(a[title="Shorts"])', 'ytd-guide-entry-renderer:has(a[href^="/shorts"])', 'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])', 'ytd-mini-guide-entry-renderer[aria-label="Shorts"]', 'yt-tab-shape[tab-title="Shorts"]',
      '[data-sint-shorts]'],
    escTelaFinal: ['#movie_player .ytp-ce-element', '#movie_player .ytp-ce-covering-overlay', '#movie_player .ytp-endscreen-content', '#movie_player .ytp-cards-teaser',
      '#movie_player .ytp-cards-button', '#movie_player .iv-branding'],
  };
  SINT.esconder = { REGRAS };
  let el = null;
  function aplicar() {
    const on = SINT.ativo();
    const css = Object.keys(REGRAS).filter((k) => on && S[k]).map((k) => `${REGRAS[k].join(',\n')} { display: none !important; }`).join('\n');
    if (!css) { if (el) el.remove(); el = null; return; }
    if (!el) { el = document.createElement('style'); el.id = 'sintonia-esconder'; }
    if (el.textContent !== css) el.textContent = css;
    if (!el.isConnected) (document.head || document.documentElement).appendChild(el);
    if (S.escShorts) marcarChips();
  }
  // filtro "Shorts" da busca/início (chip): o texto não dá para pegar só com CSS
  function marcarChips() {
    for (const c of document.querySelectorAll('yt-chip-cloud-chip-renderer, chip-shape')) {
      const host = c.closest('yt-chip-cloud-chip-renderer') || c;
      if (!host.hasAttribute('data-sint-shorts') && /^shorts$/i.test((c.textContent || '').trim())) host.setAttribute('data-sint-shorts', '');
    }
  }
  // início → Inscrições
  function inicio() {
    if (SINT.ativo() && S.homeInscricoes && location.pathname === '/') { SINT.log('home-inscricoes'); location.replace('/feed/subscriptions'); }
  }
  const offs = [
    SINT.on('settings', (m) => { aplicar(); if ('homeInscricoes' in m || 'on' in m) inicio(); }),
    SINT.on('ativo', aplicar), SINT.on('nav', () => { aplicar(); inicio(); }),
  ];
  const tk = setInterval(() => { if (S.escShorts && SINT.ativo()) marcarChips(); }, 1500);
  SINT.onStop(() => { offs.forEach((f) => f()); clearInterval(tk); if (el) el.remove(); });
  SINT.ready.then(() => { aplicar(); inicio(); });

  // (2026-11-11) as chaves de esconder ficam só na aba Ajustes: a aba Agora mostra controles do que está ligado, não liga/desliga.
  function C_esc(s) { return SINT.C.esc(s); }
})();
