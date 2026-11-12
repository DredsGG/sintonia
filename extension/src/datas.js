// Sintonia — lê a data relativa do YouTube ("há 2 dias", "2 days ago", "hace 2 días") em PT, EN e ES e diz a idade em horas.
// O YouTube arredonda para baixo: "há 2 dias" = de 48 h a 72 h (inferido do formato; ver margem de erro abaixo).
// Devolve { min, max } em horas, ou null se o texto não for uma data relativa. Também classifica o tipo do item.
//
// Margem de erro (documentada em Jarvis/02-projetos/extensoes/telao/sintonia-engenharia-reversa.md):
//  - a idade real fica entre min e max; o erro é de até 1 unidade do texto (1 h para "há N horas", 1 dia para "há N dias",
//    1 semana para "há N semanas"). A janela inclui o item quando min < limite: "há 1 dia" (24–48 h) não entra em "Hoje (24 h)",
//    "há 2 dias" (48–72 h) entra em "3 dias", "há 6 dias" entra em "7 dias" e "há 1 semana" (168 h+) não entra.
(() => {
  const H = { s: 1 / 3600, min: 1 / 60, h: 1, d: 24, w: 168, mo: 730, y: 8760 };
  // unidade → chave; ordem importa (min antes de m de mês)
  const UNI = [
    [/^(segundos?|seconds?|secs?|s)$/, 's'],
    [/^(minutos?|minutes?|mins?|min|m)$/, 'min'],
    [/^(horas?|hours?|hrs?|h)$/, 'h'],
    [/^(dias?|días?|days?|d)$/, 'd'],
    [/^(semanas?|weeks?|wks?|sem\.?)$/, 'w'],
    [/^(m[eê]s|meses|months?|mo)$/, 'mo'],
    [/^(anos?|años?|years?|yrs?|a)$/, 'y'],
  ];
  const norm = (t) => String(t || '').toLowerCase().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  // "há 2 dias", "transmitido há 3 horas", "estreou há 1 dia", "2 days ago", "streamed 5 hours ago", "premiered 1 day ago",
  // "hace 2 días", "transmitido hace 3 horas", "se estrenó hace 1 día"
  const RE = [
    /(?:^|\s)h[áa]\s+(\d+|um|uma)\s+([a-zà-ú.]+)/, // pt
    /(\d+|an?|one)\s+([a-z.]+)\s+ago\b/, // en
    /(?:^|\s)hace\s+(\d+|un|una)\s+([a-zà-ú.]+)/, // es
  ];
  const num = (x) => (/^\d+$/.test(x) ? parseInt(x, 10) : 1);
  function idade(texto) {
    const t = norm(texto);
    if (!t) return null;
    for (const re of RE) {
      const m = t.match(re);
      if (!m) continue;
      const u = UNI.find(([r]) => r.test(m[2].replace(/[.,]$/, '')));
      if (!u) continue;
      const n = num(m[1]), h = H[u[1]];
      return { min: n * h, max: (n + 1) * h, n, u: u[1] };
    }
    return null;
  }
  // tipo pelo texto dos metadados e dos selos
  const RX = {
    aoVivo: /\b(ao vivo|live|en vivo|en directo)\b|assistindo agora|watching now|espectadores|viendo ahora|watching$|^[\d.,]+\s*(mil|k|mi|m)?\s*(assistindo|watching|viendo)$/, // '148 assistindo' (feed real, 2026-11-11)
    transmitido: /^(transmitido|streamed)\b/,
    estreia: /\b(estreia|estreando|premieres?|premiering|estreno|se estrena)\b/,
    agendado: /\b(programad[oa]|agendad[oa]|scheduled|em breve|upcoming|próximamente|proximamente)\b/,
    estreou: /\b(estreou|premiered|se estrenó|estrenado)\b/,
  };
  // textos: lista de strings do card (metadados + selos). Devolve 'aoVivo' | 'live' (transmissão encerrada) | 'estreia' | 'agendado' | 'video'
  function tipo(textos) {
    const ts = textos.map(norm);
    if (ts.some((x) => RX.estreia.test(x) && !RX.estreou.test(x))) return 'estreia';
    if (ts.some((x) => RX.agendado.test(x))) return 'agendado';
    if (ts.some((x) => RX.aoVivo.test(x) && !RX.transmitido.test(x) && !/\bh[áa]\b|\bago\b|\bhace\b/.test(x))) return 'aoVivo';
    if (ts.some((x) => RX.transmitido.test(x))) return 'live';
    return 'video';
  }
  const api = { idade, tipo };
  globalThis.SINT_DATAS = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
