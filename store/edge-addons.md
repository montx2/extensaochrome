# Publicar 100% de graça — Microsoft Edge Add-ons

A Chrome Web Store cobra **US$ 5 únicos** para criar a conta de desenvolvedor —
isso vale também para itens não listados. A **Microsoft Edge Add-ons não cobra
nada** e permite publicar como **oculta** (*hidden*): o item não aparece nas
buscas e só instala quem receber o link. É exatamente o cenário "só para a
equipe".

Como o Edge é Chromium, **o mesmo pacote serve**: não é preciso mudar uma linha
de código. O ZIP gerado por `npm run package` é enviado do jeito que está.

Resumo da comparação:

| | Chrome Web Store | Microsoft Edge Add-ons |
| --- | --- | --- |
| Taxa | US$ 5 (obrigatória) | **nenhuma** |
| Conta | Google | Microsoft pessoal (MSA) |
| Oculta/não listada | sim | **sim (Hidden)** |
| Pacote | o mesmo ZIP MV3 | o mesmo ZIP MV3 |
| Capturas | 1280x800 ou 640x400 | 1280x800 ou 640x480 |
| Descrição | texto livre | 250 a 10.000 caracteres |
| Revisão | dias a semanas | até 7 dias úteis |

---

## 1. Criar a conta (grátis)

1. Acesse <https://partner.microsoft.com/dashboard/microsoftedge/overview>.
2. Entre com uma **conta Microsoft pessoal** (hotmail/outlook/live). Contas
   corporativas ou de estudante não são aceitas.
3. Aceite o programa Microsoft Edge. Não há cobrança em nenhuma etapa — se
   aparecer qualquer tela pedindo pagamento, você saiu do fluxo do Edge.
4. Escolha **Individual** (para conta pessoal). Cuidado: o tipo de conta e o
   país **não podem ser trocados depois**.

## 2. Criar a submissão

1. **Criar nova extensão** → envie o ZIP: `release/optante-facil-v3.0.0.zip`.
2. Complete as páginas: *Propriedades*, *Disponibilidade*, *Descrição*,
   *Capturas de tela* e *Notas de certificação*.

### Propriedades

- **Categoria:** Produtividade (ou "Ferramentas de negócios", se existir).
- **Termos de busca** (até 7, 30 caracteres cada):
  `ISS`, `ISSQN`, `Simples Nacional`, `MEI`, `optante`, `declaração`, `Itaúna`

### Disponibilidade

- **Visibilidade: Hidden** ← é aqui que ela fica "não listada".
- **Mercados:** pode deixar todos (241) ou restringir ao Brasil.

### Descrição (cole o texto abaixo; tem ~1.500 de 10.000 caracteres)

```
Marque Não Optante, Optante SN ou Optante MEI em todas as linhas pendentes da Declaração de Serviços Contratados de uma só vez.

Quem declara serviços contratados no ISS.net sabe: cada nota importada chega com o campo "Simples Nacional/MEI" em "Selecione", e é preciso abrir linha por linha para escolher o enquadramento do prestador. O Optante Fácil faz isso em lote, no seu ritmo, e para quando você mandar.

COMO USAR
1. Abra Declaração de Serviços Contratados > Incluir e carregue as notas.
2. O painel aparece no canto inferior direito da página. Escolha o valor.
3. Clique em Aplicar. Use Parar para interromper a qualquer momento.

RECURSOS
• Três valores: Não Optante, Optante SN e Optante MEI.
• Continua trabalhando em segundo plano: troque de aba, abra outra janela ou minimize o navegador — o processamento segue, e o andamento aparece no ícone.
• Velocidade ajustável: Rápida, Normal ou Cautelosa (para quando o sistema está lento).
• Retomada automática: se a página recarregar no meio do processo, ele continua de onde parou.
• Linhas que o sistema recusa ficam destacadas em vermelho, para você resolver manualmente sem perder tempo procurando.
• Painel minimizável e aviso opcional ao concluir.

PRIVACIDADE
A extensão não coleta, não envia e não compartilha nenhum dado. Funciona apenas em *.issnetonline.com.br, não faz nenhuma requisição de rede, não tem servidor nem analytics. Guarda somente as suas preferências (valor, velocidade e avisos) no próprio navegador. Nenhum dado da declaração é armazenado.

IMPORTANTE
O valor escolhido é aplicado a TODAS as linhas ainda pendentes. O enquadramento no Simples Nacional/MEI influencia a retenção do ISS: confira a declaração antes de transmitir. A extensão é uma ferramenta de apoio e não substitui a conferência do responsável pela declaração.
```

### Capturas de tela

Envie pelo menos 1 (recomendado 3): `1280x800` ou `640x480`.
Roteiro e cuidados em `store/screenshots/README.md`.

### Política de privacidade

Informe:
<https://docs.google.com/document/d/1f-1R8r-VFWlaSVw0wi68d5rSwynmSh2bivbO57-lfak/edit?usp=sharing>

> Antes de enviar, abra o documento e defina **Compartilhar → Acesso geral →
> Qualquer pessoa com o link → Leitor**. Sem isso o revisor não consegue abrir.

### Notas de certificação (copie — é o que o revisor precisa para testar)

```
A extensão atua somente no sistema ISS.net (https://www.issnetonline.com.br/itauna/online/),
na tela "Declaração de Serviços Contratados > Incluir".

Passos para teste:
1. Instalar a extensão e abrir https://www.issnetonline.com.br/itauna/online/.
2. Fazer login com um usuário do sistema (o revisor pode usar qualquer conta de
   homologação do próprio município; a extensão não exige cadastro próprio).
3. Ir em Declaração de Serviços Contratados > Incluir e carregar as notas de uma
   competência.
4. O painel "Optante Fácil" aparece no canto inferior direito, com a contagem de
   linhas pendentes.
5. Escolher "Optante SN" e clicar em Aplicar. Observar a barra de progresso e as
   linhas sendo preenchidas.
6. Opcional: trocar de aba durante o processo — o andamento continua e aparece
   no ícone da extensão.

Permissões: acesso a *.issnetonline.com.br (necessário para ler e preencher a
grade), storage (preferências e estado do processo), alarms (vigia em segundo
plano), scripting (injeção nas abas já abertas). Notificações é opcional e só é
solicitada se o usuário ativar o aviso de conclusão.

Nenhum dado é transmitido: a extensão não faz requisições de rede.
```

## 3. Publicar

Clique em **Publicar**. A certificação leva até 7 dias úteis. Quando o status
mudar para **In the Store**, a página da extensão terá um link direto — é esse
link que você manda para a equipe.

## 4. Atualizações

1. Suba a versão em `src/manifest.json` **e** em `package.json`.
2. `npm run release` (roda verificação, testes e gera o ZIP).
3. No Partner Center: **Nova versão** → envie o ZIP → publique.
   Usuários recebem a atualização automaticamente em algumas horas.

## 5. Se alguém da equipe usa Chrome

Não há como publicar de graça na Chrome Web Store. As opções são:

1. **Usar o Edge** para essa tarefa (o Windows já vem com ele) — instalação em
   um clique pelo link oculto.
2. **Instalação manual (modo desenvolvedor)**, sem custo: siga `INSTALAR.md`.
   O Chrome mostra um aviso periódico sobre extensões de desenvolvedor.
3. **Política da empresa (TI)**: dá para instalar forçadamente e sem aviso via
   `ExtensionInstallForcelist` (política de grupo / Chrome Enterprise). Custo
   zero, mas exige que as máquinas sejam gerenciadas.
4. **Pagar os US$ 5** e publicar também na Chrome Web Store como não listada,
   usando os textos de `store/listing.md`.

## Observações técnicas

- O pacote é idêntico para as duas lojas. Se o Partner Center reclamar da chave
  `minimum_chrome_version` no manifest, basta remover essa linha — ela é só uma
  proteção para navegadores antigos.
- Não inclua `update_url` no manifest (a loja cuida das atualizações).
- A primeira submissão precisa ser manual; as próximas podem ser automatizadas
  pela API de complementos do Edge.
