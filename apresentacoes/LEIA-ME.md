# Apresentações

As apresentações das sprints. A da Sprint 3, feita pela Mari, é o modelo; as
das Sprints 1 e 2 seguem esse modelo e estão editáveis: capa e fecho em azul; conteúdo em creme, com a trilha em
monoespaçada no alto, o número num círculo amarelo e o título curto numa faixa
laranja.

| Arquivo | Sprint | Slides | Conteúdo de origem |
|---|---|---|---|
| [sprint-1.pptx](sprint-1.pptx) | 1 · do problema ao requisito | 12 | [docs/01-requisitos.md](../docs/01-requisitos.md) |
| [sprint-2.pptx](sprint-2.pptx) | 2 · do requisito ao desenho | 12 | [docs/02-arquitetura.md](../docs/02-arquitetura.md) |
| [sprint-3.pdf](sprint-3.pdf) | 3 · do desenho ao script | 11 | [infra/](../infra/) e [app/gravar/](../app/gravar/) |

O conteúdo das Sprints 1 e 2 está fechado e revisado contra os documentos. O
que falta é aplicar o design final, o mesmo da Sprint 3.

## Para adaptar ao design system

Tudo é texto e forma nativos do PowerPoint; a única imagem é o diagrama do
Lucidchart, no slide 8 da Sprint 2.

- **Cores:** ficam no tema do arquivo. Trocar a paleta do tema muda todos os
  slides de uma vez.

  | Papel | Cor | No tema |
  |---|---|---|
  | azul da capa e do fecho | `2340BF` | Escuro 2 |
  | creme do fundo | `F3EBDD` | Claro 2 |
  | laranja da faixa do título | `E84E1B` | Ênfase 1 |
  | amarelo do círculo e dos destaques | `FDC13A` | Ênfase 2 |
  | verde | `2E6B45` | Ênfase 3 |
  | areia dos cartões e etiquetas | `E6D7BD` | Ênfase 4 |
  | marrom da trilha e dos rótulos | `6B5E52` | Ênfase 5 |
  | texto escuro e tabelas | `1E1714` | Escuro 1 |

- **Fontes:** as do tema são substitutas: Cambria nos títulos e Calibri no
  texto. Trocar as duas fontes do tema muda o deck inteiro. Os rótulos e o
  código usam Courier New, que fica fora do tema: essa precisa ser trocada à
  parte.
- **Layouts:** **Capa**, **Conteúdo**, **Conteúdo em areia** e **Fecho**. O
  círculo do número, a trilha e o lugar do título estão nos layouts: ajustar
  um layout ajusta todos os slides que o usam.
- **A faixa laranja do título** é uma forma separada atrás do título, com a
  largura calculada para cada um. Ao trocar a fonte ou o texto do título, a
  largura da faixa precisa ser ajustada à mão.
- **Notas do apresentador:** todo slide tem. As do slide 8 da Sprint 2 trazem
  o que acontece se cada caixa do diagrama cair, que é a pergunta da arguição.
- **Capa:** "[nomes da equipe]" está para ser preenchido, como na capa da
  Sprint 3.

## Cuidados

- O diagrama no slide 8 da Sprint 2 é o do modelo AWS do Lucidchart, com o
  ícone de cada serviço. Ele é largo, e o texto das caixas fica com cerca de
  4 pt: para explicar caixa por caixa, vale abrir a página "Arquitetura AWS" do
  documento "CPTM SOS - Arquitetura (Sprint 2)" no Lucidchart e dar zoom.
- Se o conteúdo de um documento mudar, a apresentação daquela sprint precisa
  mudar junto: os números, os requisitos e as decisões dos slides vêm de lá.
