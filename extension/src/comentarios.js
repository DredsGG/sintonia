// Sintonia — ordem dos comentários escolhida sozinha: "Mais recentes" ou "Principais" (desligado = como o YouTube mostrar).
// Medido ao vivo em 2026-11-11: o menu "Ordenar por" (ytd-comments-header-renderer #sort-menu) tem dois <a> na tp-yt-paper-listbox,
// "Principais" (iron-selected) e "Mais recentes"; clicar no <a> ordena, sem precisar abrir o menu na tela.
// Uma vez por vídeo: se a pessoa trocar na mão, a Sintonia respeita até o próximo vídeo.
(() => {
  'use strict';
  const SINT = globalThis.SINT;
  if (!SINT || SINT.dead) return;
  const S = SINT.S;
  const RX = { recentes: /recentes|newest|recientes|neueste|récents/i, principais: /principais|top|principales|beliebteste|meilleurs/i };
  let feitoPara = '', liberaEm = 0; // na troca de vídeo o cabeçalho velho fica uns instantes: espera 3 s
  function vigiar() {
    const modo = S.comentOrdem;
    if (!SINT.ativo() || !RX[modo] || SINT.page.kind !== 'watch') return;
    const id = SINT.page.videoId, chave = id + '|' + modo;
    if (!id || feitoPara === chave || Date.now() < liberaEm) return;
    const menu = document.querySelector('ytd-watch-flexy ytd-comments-header-renderer #sort-menu, ytd-comments ytd-comments-header-renderer #sort-menu');
    if (!menu) return; // os comentários ainda não carregaram (só carregam ao rolar até eles)
    const as = [...menu.querySelectorAll('tp-yt-paper-listbox a')];
    const alvo = as.find((a) => RX[modo].test(a.textContent)) || as[modo === 'recentes' ? 1 : 0]; // plano B: a posição
    if (!alvo) return;
    feitoPara = chave;
    if (alvo.classList.contains('iron-selected') || alvo.getAttribute('aria-selected') === 'true') return;
    alvo.click();
    SINT.log('comentarios-ordem');
  }
  const tk = setInterval(vigiar, 1000);
  const offs = [
    SINT.on('video', (d) => { if (d && d.trocou) liberaEm = Date.now() + 3000; }),
    SINT.on('settings', (m) => { if (m && 'comentOrdem' in m) feitoPara = ''; }),
  ];
  SINT.onStop(() => { clearInterval(tk); offs.forEach((f) => f()); });
})();
