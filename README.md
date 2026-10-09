# ISS.net Itaúna - Assistente de Optante

Extensão para Chrome e Edge que preenche em lote o campo **Simples Nacional/MEI** na tela
**Declaração de Serviços Contratados** do ISS.net.

Em vez de abrir linha por linha, você escolhe o valor e aplica a todas as linhas ainda não preenchidas
("Selecione"). Linhas que já têm valor nunca são alteradas.

## Instalação

1. Extraia o arquivo `.zip` em uma pasta que não será apagada (por exemplo, `Documentos\iss-itauna-optante`).
2. No navegador, abra `chrome://extensions` (no Edge: `edge://extensions`).
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta extraída.
5. Se já usava a versão antiga ("Marcar Não Optante"), remova-a para não aparecer dois painéis.

> O Chrome pode exibir, de tempos em tempos, um aviso sobre extensões do modo desenvolvedor.
> É esperado; basta manter a extensão ativada.

## Como usar

1. Acesse **Declaração de Serviços Contratados > Incluir** e carregue as notas.
2. O painel **Assistente de Optante** aparece no canto inferior direito.
3. Escolha **Não Optante**, **Optante SN** ou **Optante MEI**.
4. Clique em **Aplicar**. Use **Parar** se precisar interromper.

Dicas:

- O botão **−** minimiza o painel; o contador no botão minimizado mostra quantas linhas faltam.
- Em **Velocidade**, use *Cautelosa* se o sistema estiver lento.
- Se alguma linha não aceitar a alteração, ela é destacada em vermelho para preenchimento manual.
- A escolha e a velocidade ficam salvas no navegador.

## Atenção

O valor escolhido é aplicado a **todas** as linhas pendentes. Confira a declaração antes de transmitir:
o enquadramento do prestador no Simples Nacional/MEI influencia a retenção do ISS.

## Privacidade

A extensão funciona somente em `issnetonline.com.br`, não envia nenhum dado para fora do navegador
e não usa serviços externos. Armazena apenas suas preferências (valor e velocidade) localmente.

## Solução de problemas

- **O painel não aparece:** recarregue a página (F5). Ele só é exibido quando a grade com o campo
  Simples Nacional/MEI está na tela.
- **Atualizou a pasta da extensão:** em `chrome://extensions`, clique no ícone de recarregar da extensão.
- Requer Chrome ou Edge versão 111 ou superior.

Versão 2.0.0
