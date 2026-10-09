# Textos para a Chrome Web Store

Tudo pronto para copiar e colar no painel do desenvolvedor.
Peças gráficas prontas: `store/promo/marquee-1400x560.png` e
`store/promo/small-promo-440x280.png`. Capturas de tela: veja
`store/screenshots/README.md`.

---

## Nome do item (máx. 45 caracteres)

```
Optante Fácil — Simples Nacional/MEI
```

> Observação: evite usar "ISS.net" ou "Nota Control" no nome — são marcas de
> terceiros e isso é uma das causas comuns de reprovação. O termo aparece na
> descrição, o que é aceitável.

## Resumo (máx. 132 caracteres)

```
Marca em lote Não Optante, Optante SN ou Optante MEI na Declaração de Serviços Contratados do ISS.net.
```

## Categoria

Produtividade

## Idioma

Português (Brasil) — configurado como `default_locale = pt_BR`.

## Palavras-chave

```
ISS, ISSQN, Simples Nacional, MEI, declaração de serviços
```

## Descrição completa

```
Marque Não Optante, Optante SN ou Optante MEI em todas as linhas pendentes da
Declaração de Serviços Contratados de uma só vez.

Quem declara serviços contratados no ISS.net sabe: cada nota importada chega com
o campo "Simples Nacional/MEI" em "Selecione", e é preciso abrir linha por linha
para escolher o enquadramento do prestador. O Optante Fácil faz isso em lote,
no seu ritmo, e para quando você mandar.

COMO USAR
1. Abra Declaração de Serviços Contratados > Incluir e carregue as notas.
2. O painel aparece no canto inferior direito da página. Escolha o valor.
3. Clique em Aplicar. Use Parar para interromper a qualquer momento.

RECURSOS
• Três valores: Não Optante, Optante SN e Optante MEI.
• Continua trabalhando em segundo plano: troque de aba, abra outra janela ou
  minimize o navegador — o processamento segue, e o andamento aparece no ícone.
• Velocidade ajustável: Rápida, Normal ou Cautelosa (para quando o sistema está
  lento).
• Retomada automática: se a página recarregar no meio do processo, ele continua
  de onde parou.
• Linhas que o sistema recusa ficam destacadas em vermelho, para você resolver
  manualmente sem perder tempo procurando.
• Painel minimizável e aviso opcional ao concluir.

PRIVACIDADE
A extensão não coleta, não envia e não compartilha nenhum dado. Funciona apenas
em *.issnetonline.com.br, não faz nenhuma requisição de rede, não tem servidor
nem analytics. Guarda somente as suas preferências (valor, velocidade e avisos)
no próprio navegador. Nenhum dado da declaração é armazenado.

IMPORTANTE
O valor escolhido é aplicado a TODAS as linhas ainda pendentes. O enquadramento
no Simples Nacional/MEI influencia a retenção do ISS: confira a declaração antes
de transmitir. A extensão é uma ferramenta de apoio e não substitui a conferência
do responsável pela declaração.

Compatível com Chrome e Edge (versão 111 ou superior).
```

## Finalidade única (campo "Single purpose", se solicitado)

```
A extensão tem uma única finalidade: preencher em lote o campo Simples
Nacional/MEI na tela Declaração de Serviços Contratados do sistema ISS.net. Não
exibe anúncios, não altera páginas fora desse sistema e não coleta dados.
```

## Permissões — justificativa (obrigatório no envio)

Cole no campo de justificativa de cada permissão.

**Acesso a `https://*.issnetonline.com.br/*` (leitura e alteração de dados)**

```
Necessário para ler a grade da Declaração de Serviços Contratados e preencher o
campo Simples Nacional/MEI em cada linha, que é a única finalidade da extensão.
Nenhum dado é lido de outros sites e nada é enviado para fora do navegador.
```

**`storage`**

```
Guarda as preferências do usuário (valor a aplicar, velocidade e opção de
notificação) e o estado do processamento em andamento, para que ele continue em
segundo plano e possa ser retomado após uma recarga da página. Nenhum dado da
declaração é armazenado.
```

**`alarms`**

```
Usado por um vigia que verifica, a cada minuto, se o processamento em segundo
plano continua ativo. Se a aba estiver bloqueada ou descartada, a extensão avisa
o usuário em vez de ficar indefinidamente em silêncio.
```

**`scripting`**

```
Permite carregar os scripts nas abas do ISS.net que já estavam abertas no momento
da instalação ou da atualização, evitando que o usuário precise recarregar a
página manualmente. Os scripts fazem parte do pacote da extensão; nenhum código é
carregado da internet.
```

**`notifications` (permissão opcional)**

```
Solicitada somente se o usuário ativar "Avisar ao concluir". Exibe um aviso
quando o lote termina, é interrompido ou quando alguma linha não aceita a
alteração — útil porque o processamento continua com o usuário em outras abas.
Pode ser desativada a qualquer momento no popup, e a extensão funciona sem ela.
```

## Práticas de privacidade (formulário da loja)

- **Coleta de dados do usuário:** não coleta nada.
- **Dados pessoais e confidenciais:** não são tratados.
- **Uso de dados fora da finalidade declarada:** não se aplica.
- **Transferência de dados:** não há.
- **URL da política de privacidade:**
  `https://docs.google.com/document/d/1f-1R8r-VFWlaSVw0wi68d5rSwynmSh2bivbO57-lfak/edit?usp=sharing`

  > Antes de enviar: abra o documento, clique em **Compartilhar** e troque o
  > acesso geral para **Qualquer pessoa com o link → Leitor**. Sem isso, a
  > revisão da loja não consegue abrir a política.

## Visibilidade recomendada

- **Não listada (unlisted)** para distribuir só à equipe: não aparece nas
  buscas, funciona por link direto e evita o aviso de "modo do desenvolvedor"
  que o Chrome mostra em extensões carregadas descompactadas.
- **Pública** quando quiser que apareça nas buscas da loja — aí as capturas de
  tela e o marquee fazem diferença.

## Checklist antes de enviar

- [ ] `npm run release` executado (check + testes + ZIP gerado)
- [ ] ZIP de `release/` enviado (nunca a pasta `src/`)
- [ ] Nome, resumo e descrição preenchidos com os textos acima
- [ ] Ícone 128x128 enviado (`src/icons/icon128.png`)
- [ ] Marquee 1400x560 e promo 440x280 enviados (`store/promo/`)
- [ ] Pelo menos 1 captura de tela 1280x800 (ver `store/screenshots/README.md`)
- [ ] URL pública da política de privacidade informada
- [ ] Justificativa de cada permissão preenchida
- [ ] Finalidade única declarada
- [ ] Conta de desenvolvedor verificada (taxa única de US$ 5)
