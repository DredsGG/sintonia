// Sintonia — ajustes de fábrica e seções da página de Ajustes. Usado pelo content script, pela página de Ajustes e pelo fundo.
// Regra do projeto: tudo desligado de fábrica, uma chave para cada recurso. Só a chave geral "on" vem ligada (sem recurso ligado,
// ela não faz nada). storage.sync guarda só estes ajustes pequenos; perfis por canal, marcações da Em Dia, log e cache ficam no local.
(() => {
  // Chaves do storage.sync e o valor de fábrica. Recurso novo entra aqui e numa seção abaixo.
  const SYNC = {
    on: true, // chave geral
    lang: '', // '' = idioma do navegador
    // fase 1 · Em Dia
    emdia: false, emdiaShorts: false, emdiaLives: false, emdiaEstreias: false, emdiaAgendados: false, emdiaInverter: false, emdiaMostrarPulados: false,
    // fase 2 · todo vídeo do seu jeito
    velocidade: false, velPadrao: 1, velPasso: 0.1, perfilCanal: false, qualidade: false, qualPadrao: 'hd1080', volMax: false,
    rodaVolume: false, volPasso: 5, rodaVelocidade: false, atalhos: false, atalhoMap: {}, teatroAuto: false, cinema: false,
    // fase 3 · like automático e esconder distrações
    likeAuto: false, likeModo: 'pct', likePct: 50, likeShorts: false,
    escComentarios: false, escChat: false, escRelacionados: false, escShorts: false, escTelaFinal: false, homeInscricoes: false,
    // fase 4 · áudio
    reforco: false, reforcoPadrao: 150, igualar: false,
    // fase 5 · pular partes (dados do SponsorBlock)
    sb: false, sbCats: ['sponsor', 'selfpromo', 'interaction'], sbAviso: true, sbMarcas: true,
    // fase 6 · player
    loopAB: false, miniPlayer: false, popup: false, playlistReversa: false, fundoSemAutoplay: false, fundoNaoBaixar: false,
    // fase 7 · imagem e vídeo
    filtros: false, tema: '', screenshot: false, semHfr: false, h264: false,
    // extras pedidos pelo André (2026-11-11)
    comentOrdem: '', botaoFlutuante: true,
  };
  // Seções da página de Ajustes, na ordem. type: switch | select | number | range | list.
  // Os textos vêm do i18n: set.<k> (título) e set.<k>_ (linha de baixo). sec.<id> é o título da seção.
  const SECTIONS = [
    { id: 'geral', items: [{ k: 'on', type: 'switch' }, { k: 'botaoFlutuante', type: 'switch' }, { k: 'lang', type: 'lang' }] },
    { id: 'emdia', items: [{ k: 'emdia', type: 'switch' }, { k: 'emdiaShorts', type: 'switch' }, { k: 'emdiaLives', type: 'switch' }, { k: 'emdiaEstreias', type: 'switch' },
      { k: 'emdiaAgendados', type: 'switch' }, { k: 'emdiaInverter', type: 'switch' }, { k: 'emdiaMostrarPulados', type: 'switch' }] },
    { id: 'video', items: [{ k: 'velocidade', type: 'switch' }, { k: 'velPadrao', type: 'number', min: 0.07, max: 16, step: 0.01, canal: true },
      { k: 'qualidade', type: 'switch' }, { k: 'qualPadrao', type: 'select', opts: ['highres', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'], canal: true },
      { k: 'volMax', type: 'switch' }] },
    // perfil por canal: o que muda no player fica salvo para o canal e passa na frente dos padrões marcados "por canal"
    { id: 'canal', items: [{ k: 'perfilCanal', type: 'switch' }, { k: 'perfis', type: 'extra' }] },
    { id: 'controles', items: [{ k: 'rodaVolume', type: 'switch' }, { k: 'volPasso', type: 'number', min: 1, max: 20, step: 1 }, { k: 'rodaVelocidade', type: 'switch' },
      { k: 'velPasso', type: 'number', min: 0.01, max: 1, step: 0.01 }, { k: 'atalhos', type: 'switch' }, { k: 'atalhoMap', type: 'extra' }] },
    { id: 'tela', items: [{ k: 'teatroAuto', type: 'switch' }, { k: 'cinema', type: 'switch' }] },
    { id: 'comentarios', items: [{ k: 'comentOrdem', type: 'select', opts: ['', 'recentes', 'principais'] }, { k: 'escComentarios', type: 'switch' }] },
    { id: 'audio', items: [{ k: 'reforco', type: 'switch' }, { k: 'reforcoPadrao', type: 'number', min: 100, max: 400, step: 5, canal: true }, { k: 'igualar', type: 'switch' }] },
    { id: 'player', items: [{ k: 'loopAB', type: 'switch' }, { k: 'miniPlayer', type: 'switch' }, { k: 'popup', type: 'switch' }, { k: 'playlistReversa', type: 'switch' },
      { k: 'fundoSemAutoplay', type: 'switch' }, { k: 'fundoNaoBaixar', type: 'switch' }] },
    { id: 'imagem', items: [{ k: 'filtros', type: 'switch' }, { k: 'tema', type: 'select', opts: ['', 'grafite', 'noite', 'preto'] }, { k: 'screenshot', type: 'switch' },
      { k: 'semHfr', type: 'switch' }, { k: 'h264', type: 'switch' }] },
    { id: 'sb', items: [{ k: 'sb', type: 'switch' }, { k: 'sbCats', type: 'extra', canal: true }, { k: 'sbAviso', type: 'switch' }, { k: 'sbMarcas', type: 'switch' }] },
    { id: 'like', items: [{ k: 'likeAuto', type: 'switch' }, { k: 'likeModo', type: 'select', opts: ['pct', 'abrir', 'canais'] }, { k: 'likePct', type: 'number', min: 1, max: 100, step: 1 },
      { k: 'likeShorts', type: 'switch' }, { k: 'likeListas', type: 'extra' }] },
    { id: 'esconder', items: [{ k: 'escChat', type: 'switch' }, { k: 'escRelacionados', type: 'switch' }, { k: 'escShorts', type: 'switch' },
      { k: 'escTelaFinal', type: 'switch' }, { k: 'homeInscricoes', type: 'switch' }] },
  ];
  // storage.local (prefixo st.)
  const LOCAL = {
    onboard: 'st.onboard', // { tutorial: 'pendente'|'visto'|'pulado', visto: versão, novLidas: versão base }
    update: 'st.update', // estado da procura de versão (regra 14)
    adiado: 'st.adiado', // X do aviso de versão nova: adia 1 h
    log: 'st.log', // 30 últimos eventos, sem URL nem título de vídeo
    disco: 'st.disco', // versão na pasta (recarga sozinha)
    apoio: 'st.apoio', // escolha do quadro Apoiar
    perfis: 'st.perfis', // perfil por canal: { [UC…|h:@handle]: { n: nome, em: data, ... } }
    tema: 'st.tema', // último tema visto no YouTube ('dark'|'light'), para a página de Ajustes
    emdia: 'st.emdia', // Em Dia: { [videoId]: { s: 'p' (pulado) | 'v' (visto), em } }, apagado depois de 30 dias
    emdiaPeriodo: 'st.emdia.periodo', // última aba (24 | 72 | 168 h)
    fila: 'st.fila', // fila de reprodução: { ids, i, origem, modo, ativa, bloco, ... }
    sbCache: 'st.sb.cache', // segmentos por vídeo (6 h com segmentos, 1 h sem; até 200 vídeos)
    sbOficial: 'st.sb.oficial', // já avisou que o SponsorBlock oficial está ativo
    reverso: 'st.reverso', // playlists tocando ao contrário: { listId: data }
    mini: 'st.mini', // posição e tamanho do mini player: { w, h, right, bottom }
    like: 'st.like', // like automático: { canais: {id: nome}, nunca: {id: nome}, feitos: {videoId: data} } (feitos apagados depois de 30 dias)
  };
  globalThis.SINT_DEF = { SYNC, SECTIONS, LOCAL };
})();
