# Política de Privacidade — Optante Fácil

**Última atualização:** 9 de outubro de 2026

## Resumo

A extensão **Optante Fácil** **não coleta, não armazena e não transmite nenhum
dado pessoal**. Todo o funcionamento acontece dentro do seu navegador, na aba do
sistema ISS.net. Não existe servidor, conta, login, analytics ou telemetria
nesta extensão.

## O que a extensão faz

Ela automatiza um clique que você faria manualmente: preenche o campo
**Simples Nacional/MEI** (Não Optante, Optante SN ou Optante MEI) nas linhas
pendentes da tela *Declaração de Serviços Contratados* do ISS.net.

## Dados que a extensão acessa

A extensão é executada **somente** nos endereços `https://*.issnetonline.com.br/*`.
Nesses endereços ela lê e altera o conteúdo da página que já está aberta na sua
tela — os mesmos dados que você vê. Ela não lê nada de outros sites, não lê
senhas, não lê cookies e não acessa o conteúdo de outras abas.

## O que a extensão guarda

| Onde | O que | Finalidade | Por quanto tempo |
| --- | --- | --- | --- |
| `chrome.storage.local` | valor escolhido, velocidade, preferências de aviso e de painel minimizado | lembrar suas escolhas entre sessões | até você desinstalar a extensão |
| `chrome.storage.session` | estado do processamento em andamento (opção, velocidade, contagem e tentativas por linha) | permitir que o processamento continue em segundo plano e retomar após recarga | apenas durante a sessão do navegador |
| `sessionStorage` da aba do ISS.net | o mesmo estado acima, usado para retomar o job se a página recarregar | retomada automática | descartado ao concluir ou ao fechar a aba |

**Nenhum dado da declaração é armazenado**: nem CPF/CNPJ, nem valores, nem
números de notas, nem nomes de prestadores. A extensão guarda apenas números de
contagem (quantas linhas, qual índice) e as suas preferências.

## Com quem os dados são compartilhados

Com **ninguém**. A extensão não faz nenhuma requisição de rede: não usa `fetch`,
`XMLHttpRequest`, WebSocket, beacon, mascaramento de IP, serviço de analytics ou
qualquer servidor de terceiros. Não há venda, transferência ou compartilhamento
de dados, porque não há coleta.

## Permissões do navegador e por quê

| Permissão | Motivo |
| --- | --- |
| Acesso a `*.issnetonline.com.br` | é o único site onde a extensão precisa ler e preencher a grade da declaração |
| `storage` | guardar suas preferências e o estado do processamento |
| `alarms` | vigiar o processamento quando a aba está oculta |
| `scripting` | garantir que a extensão funcione nas abas já abertas no momento da instalação |
| `notifications` (**opcional**) | avisar quando o lote termina; só é pedida se você ativar o aviso |

## Segurança

- Nenhum código é carregado da internet em tempo de execução: todos os arquivos
  vêm dentro do pacote da extensão.
- Não há uso de `eval` nem de `innerHTML` com dados vindos da página.
- As mensagens entre a página e a extensão passam por validação de formato,
  versão de protocolo e handshake com token.

## Crianças

A extensão é uma ferramenta de trabalho para declarações fiscais municipais e não
se destina a crianças. Nenhum dado de menores é coletado.

## Alterações nesta política

Se a política mudar, a data acima é atualizada e a nova versão é publicada no
mesmo endereço. Como a extensão não coleta dados, não há notificação individual.

## Contato

Dúvidas ou solicitações: abra uma *issue* no repositório do projeto
(github.com/montx2/extensaochrome) ou fale com o responsável pela publicação na
Chrome Web Store, identificado na página do item na loja.
