# Como instalar o Optante Fácil

## Opção 1 — Edge, pelo link da loja (recomendado)

A extensão está publicada de forma **oculta** na Microsoft Edge Add-ons: não
aparece nas buscas, mas quem tem o link instala em um clique.

1. Abra o link da extensão **no Microsoft Edge** (o Windows já vem com ele).
2. Clique em **Obter** (ou *Adicionar*) e confirme.
3. O ícone ✔ azul aparece na barra de ferramentas.
4. Abra o ISS.net, vá em **Declaração de Serviços Contratados > Incluir** e
   carregue as notas. O painel aparece no canto inferior direito.

> Se você usa **Chrome**, use a Opção 2 — a publicação na Chrome Web Store exige
> uma taxa paga, então ela não está disponível lá.

## Opção 2 — Chrome ou Edge, sem loja (modo desenvolvedor)

Funciona em qualquer computador, de graça. Leva uns 2 minutos.

1. Baixe o arquivo `optante-facil-v3.0.0.zip`.
2. **Extraia** o ZIP (botão direito → Extrair tudo) em uma pasta que não será
   apagada — por exemplo `Documentos\OptanteFacil`.
   ⚠️ Não apague e não mova essa pasta depois: a extensão é lida dali.
3. Abra `chrome://extensions` (no Edge: `edge://extensions`).
4. Ative **Modo do desenvolvedor** no canto superior direito.
5. Clique em **Carregar sem compactação** e escolha a pasta extraída.
6. Abra o ISS.net, vá em **Declaração de Serviços Contratados > Incluir** e
   recarregue a página (F5) se ela já estava aberta.

### Avisos que podem aparecer (e o que fazer)

- **"Desativar extensões do modo de desenvolvedor"**: o navegador mostra esse
  aviso de vez em quando. Clique em **Manter** (ou ignore). A extensão continua
  funcionando normalmente.
- **"Erro ao carregar o manifest"**: você apontou para o ZIP ou para a pasta
  errada. Aponte para a pasta que contém o `manifest.json` na raiz.
- **Painel não aparece**: recarregue a página do ISS.net (F5). O painel só
  aparece quando a grade com o campo Simples Nacional/MEI está na tela.

## Como usar

1. Na tela da declaração, escolha **Não Optante**, **Optante SN** ou
   **Optante MEI**.
2. Clique em **Aplicar**. Pode trocar de aba: o processo continua e o andamento
   aparece no ícone da extensão.
3. Use **Parar** para interromper.
4. Linhas que o sistema não aceitar ficam marcadas em vermelho — preencha essas
   manualmente.

⚠️ **Confira antes de transmitir.** O valor escolhido vale para **todas** as
linhas pendentes, e o enquadramento influencia a retenção do ISS.

## Atualizar para uma nova versão

- **Pela loja (Edge):** a atualização chega sozinha.
- **Modo desenvolvedor:** baixe o novo ZIP, extraia **por cima** da mesma pasta,
  vá em `chrome://extensions` e clique no ícone de recarregar da extensão.
  Depois dê F5 na página do ISS.net.

## Problemas frequentes

| Sintoma | Solução |
| --- | --- |
| O painel não aparece | F5 na página do ISS.net; confira se a grade está carregada |
| O processo ficou lento | o navegador reduziu a aba: clique em **Ativar** no painel ou mantenha a aba visível |
| Ícone com `!` | a aba ficou muito tempo oculta; abra a aba do ISS.net que ela retoma |
| Someu depois de uma faxina no PC | a pasta foi apagada: reinstale pela Opção 1 |
