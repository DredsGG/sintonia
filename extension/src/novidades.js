// Sintonia — novidades por versão (regra 12). Atualizar em toda versão nova, nos três idiomas.
// Frases curtas, do ponto de vista de quem usa. Aparece uma vez, na primeira abertura depois da atualização.
globalThis.SINT_NOVIDADES = {
  pt: {
    '1.2.0': [
      'Selo "Inscrito": um ✓ ao lado do nome do canal nos vídeos do início, dos relacionados e da busca quando você já é inscrito (Ajustes > Canais em que você é inscrito).',
      'Dá para esmaecer os vídeos de canais inscritos (voltam ao normal com o mouse; nunca esconde). A Sintonia lê a sua lista de inscrições, só leitura, e guarda só no navegador.',
    ],
    '1.1.0': [
      'Em Dia: o vídeo da fila que acaba passa sozinho para o próximo, mesmo com a reprodução automática do YouTube desligada, com loop ligado ou depois de um anúncio.',
      'Fim da fila: aparece "Fila concluída ✓" com o resumo e, em 5 segundos, a Sintonia volta para a Em Dia (Ficar aqui ou Esc cancela).',
      'Ajustes: o menu do lado acompanha a rolagem e destaca a seção em que você está.',
    ],
    '1.0.0': [
      'Sintonia 1.0: tudo das versões de teste revisado e conferido no YouTube de verdade. Obrigado por testar junto!',
      'O tutorial (o ? no rodapé) agora explica o menu flutuante, o 1× na barra do player e o "Lembrar por canal".',
    ],
    '0.10.2': [
      'Pular partes: vídeo novo, ainda sem marcação no SponsorBlock, é consultado de novo a cada 5 min enquanto toca; a marcação que chegar entra na hora.',
      'O painel mostra o que o SponsorBlock tem para o vídeo: quantos trechos marcados ou "ninguém marcou ainda".',
    ],
    '0.10.1': [
      'A barra da Em Dia não cobre mais o like: fica sempre logo abaixo do vídeo. O botão 1× agora muda a velocidade no clique (botão direito volta).',
      'Na barra do player: Repetir, A–B, foto do quadro, abrir em janela e playlist ao contrário, cada um só quando está ligado.',
      'Menu mais organizado: Agora mostra só o que está ligado, separado em "Este vídeo" e "Este canal · perfil". Ajustes tem busca, a seção Comentários (Mais recentes ou Principais) e não volta mais para o topo a cada clique.',
    ],
    '0.10.0': [
      'Menu flutuante: um botão redondo no canto do YouTube abre a Sintonia. Arraste para onde quiser; com ele à vista, o clique no ícone da extensão não abre nada.',
      'O menu tem duas abas: Agora (o que vale para este vídeo) e Ajustes (tudo, por seção), com uma explicação curta em cada item.',
      'Comentários sempre em "Mais recentes" (Ajustes > Comentários). Em Dia com cara de YouTube, botão ao lado de "Todas as inscrições" e Selecionar: marque vários, "Não quero ver" ou "Não quero ver e começar".',
    ],
    '0.9.2': [
      'Like automático voltou a funcionar: o player novo do YouTube tem um segundo botão de like escondido, e a Sintonia pegava esse.',
    ],
    '0.9.1': [
      'Em Dia: o card mostra o nome do canal (antes aparecia o número de visualizações) e lives com "N assistindo" contam como live.',
    ],
    '0.9.0': [
      'Revisão geral: o modo cinema não pega mais clique quando clareia, e um aviso escondido deixava de pegar clique na parte de baixo da tela.',
      'Em Dia: canais com nomes como "Live…" ou "Estreia…" não somem mais da lista; a fila não se mistura entre abas.',
      'Like automático mais cuidadoso: só clica vendo o like e o dislike do vídeo certo. Várias outras correções pequenas.',
    ],
    '0.8.0': [
      'Filtros por vídeo: brilho, contraste, saturação, cinza, inverter e girar, com Zerar (no painel).',
      'Três temas escuros: Grafite, Noite azul e Preto total (com o tema escuro do YouTube ligado).',
      'Foto do quadro em PNG, com o nome do vídeo e o tempo. Para PC fraco: evitar 60 fps e forçar H.264.',
    ],
    '0.7.0': [
      'Repetir o vídeo inteiro ou só um trecho entre A e B (botões no painel e Alt+L, Alt+A, Alt+B).',
      'Mini player: ao descer até os comentários, o vídeo flutua no canto. Arraste e mude o tamanho: fica lembrado.',
      'Abrir em janela própria no ponto atual, playlist ao contrário e não tocar sozinho em aba de fundo (com opção de parar de baixar).',
    ],
    '0.6.0': [
      'Pular partes: patrocínio, autopromoção, pedido de inscrição, intro e mais, com os dados do SponsorBlock (ligue em Ajustes).',
      'Marcas coloridas na barra de progresso e aviso "Patrocínio pulado · Desfazer". Categorias para todos os canais ou por canal.',
      'Privacidade: só 4 caracteres de um código do vídeo saem do navegador. Se o SponsorBlock oficial estiver instalado, a Sintonia deixa essa parte com ele.',
    ],
    '0.5.0': [
      'Reforço de volume acima de 100%, até 400%, para vídeo baixo (também por canal).',
      'Volume igualado entre vídeos: aproxima os baixos e os altos.',
      'Começa no primeiro clique ou tecla na página, e o vídeo nunca fica mudo (troca de vídeo, aba de fundo, mini player).',
    ],
    '0.4.0': [
      'Like automático (desligado de fábrica): depois de X% assistido, ao abrir, ou só nos canais marcados. Nunca mexe em vídeo que já tem like ou dislike.',
      'Lista "nunca curtir" por canal, no painel da Sintonia.',
      'Esconder comentários, chat, relacionados, Shorts (em toda parte), tela final e cards, e levar o início direto às Inscrições. Uma chave para cada.',
    ],
    '0.3.0': [
      'Velocidade de 0,07× a 16×, e ela nunca mais volta para 1× sozinha entre vídeos da fila ou da playlist.',
      'Lembrar por canal: velocidade, qualidade e volume mudados no player ficam salvos para aquele canal.',
      'Volume no máximo ao abrir, roda do mouse no vídeo (volume; com Shift, velocidade), atalhos com Alt, teatro automático e modo cinema. Tudo em Ajustes, desligado de fábrica.',
    ],
    '0.2.0': [
      'Nova: Em Dia, nas Inscrições. Um botão mostra os vídeos de hoje, 3 ou 7 dias, do mais antigo para o mais novo (ligue em Ajustes).',
      '"Não quero ver" apaga o card e tira da contagem, só aqui no seu navegador: nada muda na sua conta do YouTube.',
      '"Começar a assistir" toca o que sobrou em sequência, com a barra "Em Dia 3/12 · Pular · Sair da fila". Saiu? Dá para continuar de onde parou.',
    ],
    '0.1.0': [
      'Primeira versão: o botão da Sintonia na barra do player, o painel rápido e a página de Ajustes.',
      'Base do perfil por canal: o que você ajustar num canal vai ficar salvo só para ele.',
    ],
  },
  en: {
    '1.2.0': [
      '"Subscribed" badge: a ✓ next to the channel name on videos in Home, related and search when you already subscribe (Settings > Channels you subscribe to).',
      'You can also fade videos from subscribed channels (back to normal on hover; it never hides anything). Sintonia reads your subscription list, read-only, and keeps it only in your browser.',
    ],
    '1.1.0': [
      'Em Dia: a queued video that ends now moves on to the next one by itself, even with YouTube autoplay off, with loop on, or after an ad.',
      'End of the queue: "Queue complete ✓" shows a summary and, after 5 seconds, Sintonia goes back to Em Dia (Stay here or Esc cancels).',
      'Settings: the side menu follows your scrolling and highlights the section you are in.',
    ],
    '1.0.0': [
      'Sintonia 1.0: everything from the test versions reviewed and checked on real YouTube. Thanks for testing along!',
      'The tutorial (the ? in the footer) now explains the floating menu, the 1× button in the player bar and "Remember per channel".',
    ],
    '0.10.2': [
      'Skip parts: a new video with no SponsorBlock marks yet is checked again every 5 min while it plays; new marks apply right away.',
      'The panel shows what SponsorBlock has for the video: how many parts are marked, or "nobody has marked it yet".',
    ],
    '0.10.1': [
      'The Em Dia bar no longer covers the like button: it always sits right below the video. The 1× button now changes speed on click (right-click goes back).',
      'In the player bar: Loop, A–B, frame screenshot, open in a window and reverse playlist, each one only when it is on.',
      'Tidier menu: Now shows only what is on, split into "This video" and "This channel · profile". Settings has search and a Comments section (Newest or Top), and no longer jumps to the top on every click.',
    ],
    '0.10.0': [
      'Floating menu: a round button in the YouTube corner opens Sintonia. Drag it anywhere; while it is visible, clicking the extension icon does nothing.',
      'The menu has two tabs: Now (what applies to this video) and Settings (everything, by section), with a short explanation on each item.',
      'Comments always on "Newest first" (Settings > Comments). Em Dia looks like YouTube, sits next to "All subscriptions" and has Select: mark several, then "Not for me" or "Not for me, then start".',
    ],
    '0.9.2': [
      'Auto like works again: the new YouTube player has a second, hidden like button, and Sintonia was picking that one.',
    ],
    '0.9.1': [
      'Em Dia: cards show the channel name (it showed the view count before), and live streams shown as "N watching" count as live.',
    ],
    '0.9.0': [
      'General review: cinema mode no longer catches clicks when it lights up, and a hidden notice no longer catches clicks at the bottom of the screen.',
      'Em Dia: channels named like "Live…" or "Premiere…" no longer vanish from the list; the queue no longer mixes between tabs.',
      'Safer auto like: it only clicks when it sees the like and dislike of the right video. Several other small fixes.',
    ],
    '0.8.0': [
      'Per-video filters: brightness, contrast, saturation, grayscale, invert and rotate, with Reset (in the panel).',
      'Three dark themes: Graphite, Blue night and Pure black (with the YouTube dark theme on).',
      'Frame screenshot as PNG, named with the video and the time. For slow PCs: avoid 60 fps and force H.264.',
    ],
    '0.7.0': [
      'Loop the whole video or just a section between A and B (panel buttons and Alt+L, Alt+A, Alt+B).',
      'Mini player: when you scroll down to the comments, the video floats in the corner. Drag and resize: it is remembered.',
      'Open in its own window at the current time, reverse playlist, and no autoplay in background tabs (with an option to stop downloading).',
    ],
    '0.6.0': [
      'Skip segments: sponsors, self-promotion, subscribe reminders, intros and more, with SponsorBlock data (turn it on in settings).',
      'Colored marks on the progress bar and a "Sponsor skipped · Undo" notice. Categories for all channels or per channel.',
      'Privacy: only 4 characters of a video code leave the browser. If the official SponsorBlock is installed, Sintonia leaves this part to it.',
    ],
    '0.5.0': [
      'Volume boost above 100%, up to 400%, for quiet videos (also per channel).',
      'Even volume across videos: brings quiet and loud ones closer.',
      'Starts on the first click or key on the page, and the video is never muted (video change, background tab, mini player).',
    ],
    '0.4.0': [
      'Auto like (off by default): after X% watched, on open, or only on marked channels. Never touches a video that already has a like or dislike.',
      'A "never like" list per channel, in the Sintonia panel.',
      'Hide comments, chat, related, Shorts (everywhere), end screen and cards, and send home straight to Subscriptions. One switch each.',
    ],
    '0.3.0': [
      'Speed from 0.07× to 16×, and it never goes back to 1× by itself between queue or playlist videos.',
      'Remember per channel: speed, quality and volume changed in the player are saved for that channel.',
      'Max volume on open, mouse wheel on the video (volume; with Shift, speed), Alt shortcuts, automatic theater mode and cinema mode. All in settings, off by default.',
    ],
    '0.2.0': [
      'New: Em Dia, on Subscriptions. A button shows the videos from today, 3 or 7 days, oldest to newest (turn it on in settings).',
      '"Not for me" dims the card and takes it out of the count, only in your browser: nothing changes in your YouTube account.',
      '"Start watching" plays what is left in a row, with the "Em Dia 3/12 · Skip · Leave queue" bar. Left? You can continue where you stopped.',
    ],
    '0.1.0': [
      'First version: the Sintonia button in the player bar, the quick panel and the settings page.',
      'Groundwork for per-channel profiles: what you adjust on a channel will be saved for that channel only.',
    ],
  },
  es: {
    '1.2.0': [
      'Insignia "Suscrito": un ✓ junto al nombre del canal en los videos de Inicio, relacionados y búsqueda cuando ya estás suscrito (Ajustes > Canales a los que estás suscrito).',
      'También puedes atenuar los videos de canales suscritos (vuelven a la normalidad al pasar el mouse; nunca oculta nada). Sintonia lee tu lista de suscripciones, solo lectura, y la guarda solo en tu navegador.',
    ],
    '1.1.0': [
      'Em Dia: el video de la cola que termina pasa solo al siguiente, incluso con la reproducción automática de YouTube desactivada, con repetición activada o después de un anuncio.',
      'Fin de la cola: aparece "Cola completada ✓" con el resumen y, en 5 segundos, Sintonia vuelve a Em Dia (Quedarme aquí o Esc cancela).',
      'Ajustes: el menú lateral acompaña el desplazamiento y resalta la sección en la que estás.',
    ],
    '1.0.0': [
      'Sintonia 1.0: todo lo de las versiones de prueba revisado y comprobado en YouTube de verdad. ¡Gracias por probar con nosotros!',
      'El tutorial (el ? del pie) ahora explica el menú flotante, el 1× en la barra del reproductor y "Recordar por canal".',
    ],
    '0.10.2': [
      'Saltar partes: un video nuevo, aún sin marcas en SponsorBlock, se vuelve a consultar cada 5 min mientras se reproduce; las marcas nuevas se aplican al momento.',
      'El panel muestra lo que SponsorBlock tiene para el video: cuántas partes marcadas o "nadie lo marcó todavía".',
    ],
    '0.10.1': [
      'La barra de Em Dia ya no tapa el me gusta: siempre queda justo debajo del video. El botón 1× ahora cambia la velocidad con un clic (clic derecho vuelve).',
      'En la barra del reproductor: Repetir, A–B, foto del cuadro, abrir en ventana y lista al revés, cada uno solo cuando está activado.',
      'Menú más ordenado: Ahora muestra solo lo activado, separado en "Este video" y "Este canal · perfil". Ajustes tiene búsqueda y la sección Comentarios (Más recientes o Principales), y ya no vuelve arriba en cada clic.',
    ],
    '0.10.0': [
      'Menú flotante: un botón redondo en la esquina de YouTube abre Sintonia. Arrástralo adonde quieras; mientras se ve, el clic en el icono de la extensión no abre nada.',
      'El menú tiene dos pestañas: Ahora (lo que vale para este video) y Ajustes (todo, por sección), con una explicación corta en cada opción.',
      'Comentarios siempre en "Más recientes" (Ajustes > Comentarios). Em Dia con aspecto de YouTube, junto a "Todas las suscripciones" y con Seleccionar: marca varios y luego "No quiero ver" o "No quiero ver y empezar".',
    ],
    '0.9.2': [
      'El me gusta automático vuelve a funcionar: el reproductor nuevo de YouTube tiene un segundo botón de me gusta oculto, y Sintonia tomaba ese.',
    ],
    '0.9.1': [
      'Em Dia: la tarjeta muestra el nombre del canal (antes salía el número de vistas) y los directos con "N viendo" cuentan como directo.',
    ],
    '0.9.0': [
      'Revisión general: el modo atenuado ya no atrapa clics al aclarar, y un aviso oculto ya no atrapa clics en la parte de abajo de la pantalla.',
      'Em Dia: los canales con nombres como "Live…" o "Estreno…" ya no desaparecen de la lista; la cola ya no se mezcla entre pestañas.',
      'Me gusta automático más cuidadoso: solo hace clic viendo el me gusta y el no me gusta del video correcto. Varias otras correcciones pequeñas.',
    ],
    '0.8.0': [
      'Filtros por video: brillo, contraste, saturación, gris, invertir y girar, con Restablecer (en el panel).',
      'Tres temas oscuros: Grafito, Noche azul y Negro total (con el tema oscuro de YouTube activado).',
      'Foto del cuadro en PNG, con el nombre del video y el tiempo. Para PC lenta: evitar 60 fps y forzar H.264.',
    ],
    '0.7.0': [
      'Repetir el video entero o solo un tramo entre A y B (botones en el panel y Alt+L, Alt+A, Alt+B).',
      'Minirreproductor: al bajar a los comentarios, el video flota en la esquina. Arrastra y cambia el tamaño: se recuerda.',
      'Abrir en ventana propia en el punto actual, lista al revés y no reproducir solo en pestaña de fondo (con opción de dejar de descargar).',
    ],
    '0.6.0': [
      'Saltar partes: patrocinios, autopromoción, pedidos de suscripción, intros y más, con los datos de SponsorBlock (actívalo en los ajustes).',
      'Marcas de colores en la barra de progreso y el aviso "Patrocinio saltado · Deshacer". Categorías para todos los canales o por canal.',
      'Privacidad: solo 4 caracteres de un código del video salen del navegador. Si el SponsorBlock oficial está instalado, Sintonia le deja esta parte.',
    ],
    '0.5.0': [
      'Refuerzo de volumen por encima del 100%, hasta 400%, para videos bajos (también por canal).',
      'Volumen igualado entre videos: acerca los bajos y los altos.',
      'Empieza con el primer clic o tecla en la página, y el video nunca queda en silencio (cambio de video, pestaña de fondo, minirreproductor).',
    ],
    '0.4.0': [
      'Me gusta automático (desactivado de fábrica): después de ver X%, al abrir, o solo en los canales marcados. Nunca toca un video que ya tiene me gusta o no me gusta.',
      'Lista "nunca me gusta" por canal, en el panel de Sintonia.',
      'Ocultar comentarios, chat, relacionados, Shorts (en todas partes), pantalla final y tarjetas, y llevar el inicio directo a Suscripciones. Un interruptor para cada uno.',
    ],
    '0.3.0': [
      'Velocidad de 0,07× a 16×, y ya no vuelve sola a 1× entre videos de la cola o de la lista.',
      'Recordar por canal: la velocidad, calidad y volumen cambiados en el reproductor se guardan para ese canal.',
      'Volumen al máximo al abrir, rueda del mouse en el video (volumen; con Shift, velocidad), atajos con Alt, modo cine automático y atenuar alrededor. Todo en los ajustes, desactivado de fábrica.',
    ],
    '0.2.0': [
      'Nuevo: Em Dia, en Suscripciones. Un botón muestra los videos de hoy, 3 o 7 días, del más antiguo al más nuevo (actívalo en los ajustes).',
      '"No quiero ver" atenúa la tarjeta y la saca del conteo, solo en tu navegador: nada cambia en tu cuenta de YouTube.',
      '"Empezar a ver" reproduce lo que queda seguido, con la barra "Em Dia 3/12 · Saltar · Salir de la cola". ¿Saliste? Puedes continuar donde quedaste.',
    ],
    '0.1.0': [
      'Primera versión: el botón de Sintonia en la barra del reproductor, el panel rápido y la página de ajustes.',
      'Base del perfil por canal: lo que ajustes en un canal se guardará solo para él.',
    ],
  },
};
