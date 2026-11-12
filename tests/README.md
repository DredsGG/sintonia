# Testes da Sintonia

E2E num Chromium (Playwright 1.63.0) com a extensão carregada, perfil novo e temporário a cada rodada.
O YouTube é simulado (`mock.mjs`) com o DOM e a API do player medidos ao vivo em 2026-11-11
(Jarvis/02-projetos/extensoes/telao/sintonia-engenharia-reversa.md).

## Preparar (uma vez)
```
npm i            # instala o playwright 1.63.0 desta pasta
```
O vídeo de teste é `media/ep.webm` (100 s, WebM, porque o Chromium do Playwright não toca H.264).

**Windows (app Claude, MSIX):** o `env.mjs` acha sozinho o Chromium em `%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Local\ms-playwright`
(sem isso dá `spawn UNKNOWN`). Fora do app, defina `PLAYWRIGHT_BROWSERS_PATH` se precisar.

## Rodar
Regressão inteira (em paralelo, resume no fim):
```
node sintaxe-teste.mjs && node i18n-teste.mjs && node datas-teste.mjs
bash rodar.sh e2e-base e2e-emdia e2e-fila e2e-player e2e-like e2e-audio e2e-sb e2e-player2 e2e-imagem recarga-e2e
bash rodar.sh ao-vivo
```
| Teste | Fase | O que cobre |
|---|---|---|
| `sintaxe-teste.mjs` | todas | todo .js compila, manifest, permissões, listas de reinjeção, rede só para os 2 hosts |
| `i18n-teste.mjs` | todas | PT/EN/ES com as mesmas chaves e tipos, novidades da versão, título de todo ajuste |
| `datas-teste.mjs` | 1 | data relativa PT/EN/ES e tipo do card |
| `e2e-base.mjs` | 0 | tutorial, botão, painel, rodapé, perfil, navegação, idiomas, Relatar bug, Apoiar, regra 14, abas, reinjeção, plano B, novidades, Ajustes |
| `recarga-e2e.mjs` | 0 | regra 7a (detecção da versão nova na pasta e reinjeção; a recarga em si o Playwright não deixa) |
| `e2e-emdia.mjs` | 1 | Em Dia (Inscrições simuladas, 150 itens) e a fila |
| `e2e-fila.mjs` | 1 | v1.1.0: avanço garantido da fila (plano A/B, bloco 50→51, autoplay desligado, loop, A–B, 8×, anúncio, SponsorBlock, tela cheia, miniplayers) e fim da fila (aviso, volta para a Em Dia) |
| `e2e-player.mjs` | 2 | velocidade que não volta para 1×, por canal, volume, qualidade, roda, atalhos, teatro, cinema |
| `e2e-like.mjs` | 3 | like automático e esconder distrações |
| `e2e-audio.mjs` | 4 | reforço, igualar, nunca mudo (mede o som pelo analisador) |
| `e2e-sb.mjs` | 5 | SponsorBlock por prefixo, pular, Desfazer, marcas, por canal, oficial ativo |
| `e2e-player2.mjs` | 6 | loop A–B, mini player, pop-up, playlist ao contrário, aba de fundo |
| `e2e-imagem.mjs` | 7 | filtros, temas, foto do quadro, codec |
| `ao-vivo.mjs` | 0–7 | youtube.com real, perfil novo, sem login |
| `desempenho.mjs com|sem 10` | 8 | CPU e memória da aba em 10 min de vídeo real |

PC carregado (outras sessões com muitos Chromium abertos) deixa tudo mais lento: os tempos de espera já são longos (até 25 s para o guia abrir).
