# Segurança — Optante Fácil

## Modelo de ameaças

| Ameaça | Como o projeto responde |
| --- | --- |
| Vazamento de dados da declaração | Nenhuma chamada de rede existe no código (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` e `EventSource` são proibidos por verificação estática). Nada sai da aba. |
| Execução de código remoto | Nenhum recurso é carregado de fora do pacote. A CSP padrão do MV3 (`script-src 'self'`) é mantida. |
| Página maliciosa se passando pela extensão | A ponte valida canal, versão de protocolo, allowlist de tipos, handshake com token e limite de 50 mensagens por segundo. Mensagens de outros frames são descartadas (`event.source`). |
| Extensão afetar sites fora do escopo | `content_scripts` e `host_permissions` ficam restritos a `https://*.issnetonline.com.br/*`. |
| Injeção de HTML/CSS na interface | Nenhum `innerHTML` com dados dinâmicos: os textos são montados com `textContent` e nós `<b>`. O único `innerHTML` é o template estático do painel. |
| Vazamento entre abas/janelas | O estado é isolado por `tabId`/`frameId`; o encerramento de aba remove o registro e o job. |
| Permissões excessivas | Instalação pede apenas `storage`, `alarms`, `scripting` e o host do ISS.net. `notifications` é opcional e só é solicitada se o usuário ativar. |
| Dependências vulneráveis | Não há dependências em tempo de execução. `esbuild` e `jsdom` são usados apenas no desenvolvimento. |
| Código ofuscado escondendo comportamento | O código publicado é **minificado** (não ofuscado): nomes de variáveis locais são reduzidos, mas a lógica permanece auditável. |

## Sobre "proteger o código-fonte"

Extensões de navegador são executadas no dispositivo do usuário: **qualquer
código client-side pode ser inspecionado** por quem tem acesso físico ao
computador, por mais que esteja minificado ou ofuscado. Não existe proteção
absoluta, e ofuscar código costuma gerar desconfiança na revisão da loja.

O que este projeto faz, de fato:

1. **Publica apenas o pacote minificado** (`dist/`), sem comentários, sem
   caminhos de desenvolvimento, sem testes e sem histórico.
2. **Não embute nenhum segredo** — não há chaves, tokens, URLs internas nem
   credenciais no pacote, porque a extensão não fala com servidor algum.
3. **Mantém o repositório como único dono do fonte legível**: recomenda-se
   deixá-lo **privado** e publicar somente o ZIP gerado por `npm run package`.

## Verificação estática

`npm run check` falha o build se:

- um script não parsear;
- aparecer `eval`, `new Function`, `document.write`, requisição de rede ou
  `innerHTML` dinâmico;
- o manifest declarar arquivo inexistente, permissão fora da allowlist ou host
  fora de `issnetonline.com.br`;
- a versão do `manifest.json` divergir do `package.json`;
- faltar locale obrigatório ou a descrição passar de 132 caracteres.

## Reportar uma vulnerabilidade

Abra uma *issue* no repositório (ou contate o publicador indicado na loja)
descrevendo o impacto, os passos para reproduzir e, se possível, a versão
afetada. Não inclua dados reais de declarações em relatórios.
