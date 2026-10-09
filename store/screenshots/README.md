# Capturas de tela para a loja

As capturas são **obrigatórias** e precisam mostrar a extensão em uso — por isso
não podem ser geradas por script. Este guia deixa o processo rápido.

## Especificações

| Item | Requisito |
| --- | --- |
| Formato | PNG (preferível) ou JPEG |
| Tamanho | 1280x800 px (recomendado). Chrome aceita também 640x400; o Edge aceita 640x480 |
| Quantidade | de 1 a 5 |
| Conteúdo | a extensão em uso, sem moldura de janela, sem bordas e sem anotações soltas |
| Proporção | 16:10 |

## Como capturar (Windows)

1. Carregue a versão de testes (pasta `dist`) em `chrome://extensions`.
2. Abra a tela **Declaração de Serviços Contratados > Incluir** com uma
   competência de exemplo — **use dados fictícios ou uma tela de homologação**,
   nunca dados reais de contribuintes.
3. Ajuste o zoom da página para 100% (`Ctrl+0`) e deixe o painel da extensão
   visível no canto inferior direito.
4. `Windows + Shift + S` → modo retangular → selecione exatamente 1280x800
   (use a régua: ative a exibição do tamanho no Snip & Sketch ou recorte depois
   no Paint).
5. Salve como PNG em `store/screenshots/01-grade-com-painel.png`.
6. Para publicar no exterior, duplique a imagem e troque os textos, ou gere uma
   versão `en`.

## Roteiro sugerido (5 imagens)

1. `01-grade-com-painel.png` — a grade da declaração com o painel aberto,
   mostrando as linhas pendentes.
2. `02-aplicando.png` — processamento em andamento: barra de progresso, texto
   "Marcando linha X de Y…" e o badge no ícone da extensão.
3. `03-concluido.png` — mensagem "Concluído. N linhas atualizadas." com as
   linhas já preenchidas.
4. `04-popup-status.png` — o popup aberto em **outra aba** (mostra que dá para
   acompanhar de qualquer página), com a contagem de pendentes e o botão Aplicar.
5. `05-popup-opcoes.png` — o popup com as três opções, velocidade e os controles
   de notificação/segundo plano.

## Cuidados

- **Nada de dados reais**: CPF/CNPJ, razão social e valores de notas não devem
  aparecer. Use um CNPJ de exemplo (como 00.000.000/0001-91) ou borre os campos.
- Mantenha o painel da extensão dentro do recorte — é o que a revisão da loja
  quer ver.
- Evite barras de rolagem no meio do recorte e janelas de outros programas.
- Se alguma imagem ficar com texto ilegível após o redimensionamento, refaça a
  captura em vez de ampliar.

Depois de salvar, confira os tamanhos:

```bash
python3 -c "from PIL import Image; import glob; [print(f, Image.open(f).size) for f in sorted(glob.glob('store/screenshots/*.png'))]"
```
