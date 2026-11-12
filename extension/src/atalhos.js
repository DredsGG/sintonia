// Sintonia — atalhos de teclado configuráveis (fase 2). Usado pelo content script e pela página de Ajustes.
// Regra: todo atalho usa Alt (com ou sem Ctrl/Shift), e nunca um que o YouTube ou o navegador já usam.
(() => {
  // ação → atalho de fábrica (e.code com modificadores na ordem Ctrl+Alt+Shift)
  const PADRAO = {
    painel: 'Alt+KeyS',
    velMais: 'Alt+Period', velMenos: 'Alt+Comma', vel1: 'Alt+Digit1',
    volMais: 'Alt+ArrowUp', volMenos: 'Alt+ArrowDown',
    cinema: 'Alt+KeyC', teatro: 'Alt+KeyT',
    loop: 'Alt+KeyL', pontoA: 'Alt+KeyA', pontoB: 'Alt+KeyB', popup: 'Alt+KeyO', foto: 'Alt+KeyP',
  };
  const ACOES = Object.keys(PADRAO);
  // atalhos do navegador (Chrome/Edge/Brave/Opera no Windows) que não podem ser tomados
  const NAVEGADOR = new Set(['Alt+KeyF', 'Alt+KeyE', 'Alt+KeyD', 'Alt+ArrowLeft', 'Alt+ArrowRight', 'Alt+Home', 'Alt+F4', 'Alt+Enter', 'Alt+Space', 'Alt+Tab',
    'Alt+Shift+KeyI', 'Ctrl+Alt+Delete', 'Alt+Shift+KeyB']);
  const NOME_TECLA = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Period', '.').replace('Comma', ',').replace('Slash', '/').replace('ArrowUp', '↑').replace('ArrowDown', '↓')
    .replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('Semicolon', ';').replace('Quote', "'").replace('BracketLeft', '[').replace('BracketRight', ']').replace('Minus', '-').replace('Equal', '=').replace('Backquote', '`');
  function doEvento(e) {
    if (/^(Control|Alt|Shift|Meta)/.test(e.key) || !e.code) return null;
    return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.code].filter(Boolean).join('+');
  }
  const legivel = (a) => (a ? a.split('+').map((p) => (/^(Ctrl|Alt|Shift)$/.test(p) ? p : NOME_TECLA(p))).join(' + ') : '—');
  // erro: 'alt' (precisa de Alt) | 'navegador' | 'repetido' | null
  function validar(atalho, mapa, acao) {
    if (!atalho || !/(^|\+)Alt\+/.test(atalho)) return 'alt';
    if (NAVEGADOR.has(atalho)) return 'navegador';
    for (const k of ACOES) if (k !== acao && mapa[k] === atalho) return 'repetido';
    return null;
  }
  const mapa = (sobre) => Object.assign({}, PADRAO, sobre && typeof sobre === 'object' ? sobre : {});
  const api = { PADRAO, ACOES, doEvento, legivel, validar, mapa };
  globalThis.SINT_ATALHOS = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
