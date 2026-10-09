# Changelog

Todas as mudanças relevantes da extensão. Formato inspirado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/), versões em
[Semantic Versioning](https://semver.org/lang/pt-BR/).

## [3.0.0] — 2026-10-09

Versão de publicação: reescrita para funcionar fora da aba do ISS.net e para o
padrão da Chrome Web Store.

### Adicionado

- **Service worker** como cérebro da extensão: mantém o estado do processamento
  fora da aba, com badge no ícone, contagem de linhas restantes e watchdog.
- **Popup** profissional, disponível em qualquer aba: mostra o andamento e
  permite aplicar/parar sem voltar para a página do ISS.net.
- **Modo segundo plano**: keep-awake com áudio inaudível impede que o Chrome
  estrangule os temporizadores da aba oculta; avisa quando o navegador bloqueia.
- **Notificação opcional** ao concluir, interromper ou quando há linhas
  recusadas (permissão solicitada só quando ativada).
- **Retomada negociada**: após recarga da página, o executor pergunta ao service
  worker se deve continuar (janela de 5 minutos) em vez de retomar sozinho.
- Locales `pt-BR` (padrão) e `en`, manifest com nome/descrição localizados.
- Pipeline de publicação: `npm run check` (verificação estática),
  `npm test` (13 testes jsdom), `npm run build` (dist minificado) e
  `npm run package` (ZIP da loja).
- Política de privacidade, documento de segurança, textos da loja e peças de
  divulgação (marquee 1400x560 e promo 440x280).
- Ícones novos (16, 32, 48, 128), gerados por script.
- Guia de publicação **gratuita** na Microsoft Edge Add-ons (oculta, só por link)
  e `INSTALAR.md` com o passo a passo para a equipe.

### Alterado

- Arquitetura em quatro camadas: `shared/protocol.js` (contrato),
  `content/core.js` (DOM), `content/executor.js` (painel + laço) e
  `content/bridge.js` (ponte validada entre mundo MAIN e extensão).
- O valor aplicado passa a ser guardado junto do estado do job, garantindo que a
  retomada use a mesma opção escolhida.
- Mensagens entre página e extensão agora exigem versão de protocolo, canal,
  allowlist de tipos, handshake com token e limite de 50 mensagens por segundo.
- Textos de status são montados com nós de texto (sem `innerHTML` dinâmico).
- Velocidades ajustadas: Rápida 0,7 s, Normal 1,2 s, Cautelosa 2,2 s.

### Corrigido

- `npm run package` / `npm run release` no **Windows**: o ZIP passa a ser
  gerado em Node puro. Antes o build chamava o comando Unix `zip` e falhava
  com `spawnSync zip ENOENT`.
- Script de testes lista os arquivos explicitamente, sem depender de glob
  (`tests/*.test.mjs` não expande no Prompt de Comando do Windows).
- O botão **Parar** agora interrompe entre linhas, sem esperar a espera longa
  terminar (antes podia levar vários segundos).
- Contagem de progresso não é mais distorcida quando a grade é recarregada no
  meio do processo.
- Estado preso quando a aba era fechada no meio do job: o watchdog encerra o
  estado após 5 minutos sem notícias e limpa o badge.
- Linhas recusadas recebem destaque por propriedades de `outline` individuais,
  evitando falha de estilo em alguns navegadores.

## [2.0.0] — 2026-10-09

- Escolha entre Não Optante, Optante SN e Optante MEI (antes só "Não Optante").
- Painel reformulado, com barra de progresso, minimizar e velocidade.
- Destaque em vermelho para linhas que não aceitam a alteração.
- Ícones e README de instalação.

## [1.0.0] — uso pessoal

- Versão original, marcava todas as linhas como "Não Optante".
