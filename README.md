# Optante Fácil — Simples Nacional/MEI

Extensão para **Chrome e Edge** (Manifest V3) que preenche em lote o campo
**Simples Nacional/MEI** na tela *Declaração de Serviços Contratados* do ISS.net
(`*.issnetonline.com.br`), usada pela Prefeitura de Itaúna-MG e por outros
municípios no mesmo domínio.

Em vez de abrir linha por linha, você escolhe **Não Optante**, **Optante SN** ou
**Optante MEI** e aplica a todas as linhas ainda em *Selecione*. Linhas já
preenchidas nunca são alteradas.

> ⚠️ O valor escolhido é aplicado a **todas** as linhas pendentes. O
> enquadramento do prestador influencia a retenção do ISS: confira a declaração
> antes de transmitir.

---

## Como usar

1. Acesse **Declaração de Serviços Contratados > Incluir** e carregue as notas.
2. O painel **Optante Fácil** aparece no canto inferior direito da página.
3. Escolha o valor e clique em **Aplicar**. Use **Parar** para interromper.
4. O andamento também aparece no ícone da extensão — dá para acompanhar e parar
   de **qualquer outra aba**.

Recursos:

| Recurso | Detalhe |
| --- | --- |
| Valores | Não Optante, Optante SN, Optante MEI |
| Velocidades | Rápida (0,7 s), Normal (1,2 s), Cautelosa (2,2 s) entre linhas |
| Segundo plano | continua processando com a aba oculta, em outra janela ou com o navegador minimizado |
| Retomada | se a página recarregar no meio, o job continua de onde parou (janela de 5 min) |
| Linhas recusadas | ficam destacadas em vermelho na grade; a tela rola até a primeira |
| Minimizar | o botão **−** reduz o painel a uma pílula com o número de linhas pendentes |
| Notificação | aviso opcional ao concluir (permissão solicitada só se você ativar) |

## Como funciona o modo segundo plano

O Chrome reduz drasticamente os temporizadores de abas ocultas: depois de alguns
minutos, um `setTimeout` de 1 s pode demorar até 1 minuto — o processamento
pareceria travado. A extensão resolve isso em três camadas:

1. **Keep-awake inaudível** — durante o processamento, um fluxo de áudio
   inaudível (~-74 dBFS, sem nenhum som) mantém a aba classificada como "com
   áudio", condição que o Chrome não estrangula. É iniciado pelo clique do
   usuário e encerrado ao final do job.
2. **Estado fora da aba** — o service worker guarda o andamento, o badge do ícone
   e o resultado. Trocar de aba, minimizar ou abrir outra janela não interfere.
3. **Vigia (watchdog)** — um alarme de 1 minuto detecta silêncio prolongado,
   marca o job como lento e notifica; após 5 minutos sem notícias o estado é
   encerrado com segurança.

Se o navegador bloquear o áudio (política de autoplay), a extensão avisa no
painel e no popup e oferece o botão **Ativar**. Nesse caso, manter a aba visível
garante a velocidade normal.

## Privacidade e segurança

- **Nenhum dado sai do navegador.** Não há `fetch`, `XMLHttpRequest`, WebSocket,
  beacon, analytics nem servidor próprio. A verificação estática (`npm run check`)
  falha se aparecer qualquer um deles.
- **Escopo mínimo.** A extensão só é injetada em `*.issnetonline.com.br` e pede
  apenas `storage`, `alarms` e `scripting`. **Notificações** é permissão opcional,
  solicitada só quando você ativa o aviso de conclusão.
- **Sem código remoto.** Nada é carregado da internet em tempo de execução; todos
  os arquivos vêm dentro do pacote.
- **Sem `eval` e sem `innerHTML` dinâmico.** Os textos da interface são montados
  com nós de texto; o único `innerHTML` é o template estático do painel.
- **Sem dados sensíveis guardados.** Só as preferências (valor, velocidade,
  avisos) vão para o `chrome.storage.local`. O estado do job fica em
  `chrome.storage.session` e em `sessionStorage` da aba, e é descartado ao
  terminar.
- **Mensagens validadas.** A ponte entre a página e a extensão usa allowlist de
  tipos, versão de protocolo, handshake com token e limite de mensagens por
  segundo.

Veja [PRIVACY.md](PRIVACY.md) e [SECURITY.md](SECURITY.md).

Política publicada (usar essa URL no envio da loja):
<https://docs.google.com/document/d/1f-1R8r-VFWlaSVw0wi68d5rSwynmSh2bivbO57-lfak/edit?usp=sharing>
— lembre de deixá-la como **Qualquer pessoa com o link → Leitor**.

## Estrutura do projeto

```
src/
  manifest.json              # MV3, permissões mínimas, locales pt-BR/en
  background/service-worker.js  # cérebro: estado, badge, notificações, watchdog
  content/bridge.js          # mundo isolado: valida e retransmite mensagens
  content/core.js            # mundo MAIN: reconhecimento e escrita no DOM
  content/executor.js        # mundo MAIN: painel flutuante + laço de execução
  shared/protocol.js         # contrato único entre todos os contextos
  popup/                     # popup (status, aplicar/parar, preferências)
  _locales/                  # textos da loja e do navegador
  icons/                     # 16, 32, 48, 128
tests/                       # testes de unidade e integração (jsdom)
scripts/check.mjs            # verificação estática antes de publicar
scripts/build.mjs            # gera dist/ minificado e o ZIP da loja
tools/make_assets.py         # gera ícones e peças de divulgação
store/                       # textos da loja, promo e capturas
```

Por que dois mundos de conteúdo? O campo do ISS.net é manipulado por scripts da
própria página (ASP.NET WebForms), então a escrita precisa acontecer no **mundo
MAIN**. Como esse mundo não tem acesso a `chrome.runtime`, a comunicação passa
pela ponte no **mundo isolado**, que valida tudo que entra e sai.

## Desenvolvimento

```bash
npm install          # dependências de desenvolvimento (esbuild, jsdom)
npm run check        # sintaxe, padrões proibidos e integridade do manifest
npm test             # 13 testes (unidade + integração em jsdom)
npm run build        # dist/ minificado
npm run package      # dist/ + release/optante-facil-vX.Y.Z.zip
npm run release      # check + test + pacote (use antes de publicar)
```

Para testar no navegador: `chrome://extensions` → **Modo do desenvolvedor** →
**Carregar sem compactação** → escolha a pasta `src` (ou `dist` para testar exatamente
o que vai para a loja).

Regenerar ícones e peças da loja (requer Pillow):

```bash
python3 tools/make_assets.py
```

## Publicação na Chrome Web Store

1. `npm run release` — gera `release/optante-facil-vX.Y.Z.zip`.
2. Acesse o [painel do desenvolvedor](https://chrome.google.com/webstore/devconsole)
   (taxa única de US$ 5), **Novo item** e envie o ZIP.
3. Preencha com os textos prontos em [store/listing.md](store/listing.md).
4. **Privacidade**: informe a URL pública da política (o `PRIVACY.md` publicado)
   e declare que a extensão não coleta dados.
5. **Justificativa de permissões**: o modelo está em `store/listing.md`, seção
   "Permissões — justificativa".
6. **Capturas de tela**: siga `store/screenshots/README.md` (são obrigatórias e
   precisam mostrar a extensão em uso).
7. Envie para revisão. O tempo médio é de 1 a 3 dias úteis.

Dica: para distribuir só para a equipe, publique como **não listada**
(*unlisted*). O item não aparece nas buscas da loja, mas funciona por link — sem
o aviso de "extensão do desenvolvedor" que aparece no modo descompactado.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| O painel não aparece | a página foi aberta antes de instalar a extensão | recarregue a página (F5) |
| O painel não aparece | a grade ainda não foi carregada | abra **Declaração de Serviços Contratados > Incluir** e carregue as notas |
| Fica lento em segundo plano | navegador bloqueou o áudio de keep-awake | clique em **Ativar** no painel ou mantenha a aba visível |
| Alguma linha não muda | a linha recusa a alteração no servidor | ela fica destacada em vermelho: preencha manualmente |
| Badge com `!` | aba oculta há muito tempo ou aba descartada | abra a aba do ISS.net; o job continua de onde parou |
| Nada acontece após atualizar | a página precisa recarregar os scripts | F5 na página do ISS.net |

## Versão

3.0.0 — veja o [CHANGELOG](CHANGELOG.md).
