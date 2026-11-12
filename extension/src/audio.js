// Sintonia — fase 4: áudio. Reforço acima de 100% (até 400%) e volume igualado entre vídeos, com Web Audio no próprio <video>
// (sem tabCapture). O grafo mora no mundo MAIN (src/main.js); aqui só se decide a configuração e o painel.
// Por canal: com "Lembrar por canal", o reforço mudado no painel fica salvo no perfil do canal (boost).
(() => {
  'use strict';
  const SINT = globalThis.SINT;
  if (!SINT || SINT.dead) return;
  const { C } = SINT;
  const { esc } = C;
  const S = SINT.S;
  const canalId = () => (SINT.page.canal && SINT.page.canal.id) || null;
  function reforcoAtual() {
    if (!SINT.ativo() || !S.reforco) return 100;
    const pf = S.perfilCanal && canalId() ? SINT.perfil.ajustes(canalId()) : {};
    return Math.max(100, Math.min(400, Math.round(pf.boost || +S.reforcoPadrao || 100)));
  }
  let ultimo = '';
  async function enviar(forcar) {
    const cfg = { ganho: reforcoAtual() / 100, igualar: !!(SINT.ativo() && S.igualar) };
    const k = JSON.stringify(cfg);
    if (k === ultimo && !forcar) return;
    ultimo = k;
    await SINT.bridge('audioConfig', cfg);
  }
  async function mudarReforco(n) {
    n = Math.max(100, Math.min(400, Math.round(n / 5) * 5));
    if (S.perfilCanal && canalId()) await SINT.perfil.set(canalId(), { boost: n === 100 ? null : n });
    else await SINT.setSetting('reforcoPadrao', n);
    if (!S.reforco) await SINT.setSetting('reforco', true);
    await enviar(true);
    if (SINT.player) SINT.player.osd(`${SINT.L().reforcoCurto} ${n}%`);
    SINT.painel.redesenhar();
  }
  const offs = [
    SINT.on('video', () => enviar(true)), SINT.on('ready', () => enviar(true)), SINT.on('perfis', () => enviar()), SINT.on('ativo', () => enviar()),
    SINT.on('settings', (m) => { if (['reforco', 'reforcoPadrao', 'igualar', 'perfilCanal', 'on'].some((k) => k in m)) enviar(); }),
  ];
  // a ponte MAIN pode ter sido reinjetada (versão nova): manda a configuração de novo de vez em quando (é barato)
  const tk = setInterval(() => enviar(true), 5000);
  SINT.onStop(() => { offs.forEach((f) => f()); clearInterval(tk); });
  SINT.ready.then(() => enviar(true));
  SINT.audio = { mudarReforco, reforcoAtual };

  SINT.addBloco({
    id: 'audio', ordem: 35,
    html(T) {
      if (!S.reforco || SINT.page.kind !== 'watch') return '';
      const r = reforcoAtual();
      return `<h4>${esc(T['sec.audio'])}</h4>
        ${`<div class="pv"><div class="pvr"><span class="pvl">${esc(T.reforcoCurto)}</span><button type="button" class="pvb" data-au="-" aria-label="${esc(T.menos)}">−</button><b class="pvv">${r}%</b><button type="button" class="pvb" data-au="+" aria-label="${esc(T.mais)}">+</button></div></div>`}
        <p class="nota">${esc(S.perfilCanal && canalId() ? T.velNotaCanal : T.reforcoNotaGlobal)}</p>`;
    },
    wire(el) {
      el.querySelectorAll('[data-au]').forEach((b) => b.addEventListener('click', () => mudarReforco(reforcoAtual() + (b.dataset.au === '+' ? 25 : -25))));
      el.querySelectorAll('[data-au-sw]').forEach((b) => b.addEventListener('click', async () => { await SINT.setSetting(b.dataset.auSw, !S[b.dataset.auSw]); SINT.painel.redesenhar(); }));
    },
  });
})();
