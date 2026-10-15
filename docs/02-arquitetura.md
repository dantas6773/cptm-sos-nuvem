# Documento de Arquitetura

Entregável da Sprint 2, no formato do Template 2. As seções têm os mesmos números do template.

Projeto: CPTM SOS · Relatos por estação\
Cenário oficial escolhido: nenhum; ideia própria da equipe, aprovada pela professora\
Data: 15/10/2026\
Versão: 1.1

## 1. Requisitos não funcionais

Fórmula obrigatória: `[Categoria] + [Métrica Numérica Mensurável] + [Condição de Execução]`.

Os cinco requisitos não funcionais saem dos cinco requisitos funcionais da Sprint 1, um para um: o RNF-01 diz com que qualidade o RF-01 tem de acontecer, o RNF-02 faz o mesmo com o RF-02, e assim por diante. O requisito funcional diz o que o sistema faz; o não funcional diz com que número isso se confere e em que serviço da AWS esse número se apoia.

| Requisito funcional da Sprint 1 | Requisito não funcional | A qualidade cobrada |
|---|---|---|
| RF-01, registrar o relato | RNF-01 | o reenvio não duplica o relato |
| RF-02, guardar a foto no S3 | RNF-02 | o bucket só deixa o público ler a foto |
| RF-03, listar os relatos da estação | RNF-03 | a lista chega em até 500 ms |
| RF-04, somar a confirmação | RNF-04 | o reenvio não soma a confirmação duas vezes |
| RF-05, recusar e registrar a recusa | RNF-05 | a recusa aparece no registro em até 10 segundos |

### RNF-01

```
requisito
  [Reliability] O reenvio de um mesmo relato deve gravar
  zero duplicados: com 5 reenvios seguidos do mesmo
  envio, a estação ganha exatamente 1 relato, com 1
  protocolo e 1 foto.

serviço AWS
  Amazon DynamoDB, com gravação condicional

pilar do Well-Architected
  3, Confiabilidade

razão
  O RF-01 promete um protocolo único por relato. No túnel
  o sinal cai, e o envio pode ter sido gravado com a
  resposta perdida no caminho. Tentar de novo é o certo a
  fazer, e só é seguro se o sistema reconhecer o pedido
  repetido. A página gera um código aleatório para cada
  envio e repete o mesmo código a cada nova tentativa; a
  função deriva dele o protocolo. Se o protocolo já
  existe na tabela, é um reenvio: a função devolve o
  mesmo protocolo sem tocar na foto nem na tabela.
```

O protocolo é um resumo do código, os 16 primeiros caracteres do seu SHA-256, e não o próprio código. O protocolo aparece na consulta, porque é por ele que se confirma um relato; o código, não. Se o protocolo fosse o código, quem o lesse na consulta poderia reenviá-lo com outra foto e trocar a foto de um relato alheio (seção 9). E o código identifica o envio, e não quem enviou: é novo a cada relato, e a página o descarta quando recebe a resposta. Por isso ele não fere o RD-01.

### RNF-02

```
requisito
  [Segurança] O bucket de fotos deve permitir ao público
  uma única ação, ler uma foto pelo endereço exato, e
  zero ações de listar, gravar ou apagar, o que se
  confere na política do bucket.

serviço AWS
  Amazon S3, com a política do bucket

pilar do Well-Architected
  2, Segurança

razão
  O RF-02 exige um endereço pelo qual a foto possa ser
  vista, e isso torna o bucket público para leitura.
  Público para ler não pode virar público para o resto.
  Listar entregaria de uma vez as fotos de todas as
  estações, sem passar pela consulta nem pela janela de
  30 dias; gravar permitiria trocar a foto de um relato
  por outra, inclusive por uma foto de pessoa, que o
  RD-02 proíbe; apagar faria a foto sumir. Só a função
  registrar grava no bucket, pelo papel dela no IAM.
```

O endereço de cada foto leva o protocolo, que não se adivinha: quem não recebeu o endereço de uma foto pela consulta não tem como chegar a ela.

### RNF-03

```
requisito
  [Performance] A consulta dos relatos de uma estação deve
  responder em no máximo 500 ms no percentil 95, com até
  300 relatos dos últimos 30 dias na estação consultada e
  30 requisições seguidas.

serviço AWS
  Amazon DynamoDB

pilar do Well-Architected
  4, Eficiência de Performance

razão
  A chave de partição é a estação, e a chave de ordenação
  começa pelo dia do envio. A consulta vai direto à
  partição da estação e lê só a fatia dos últimos 30 dias:
  o relato de dois anos atrás nem chega a ser lido. O
  tempo cresce com a janela de uma estação, e não com a
  tabela inteira. E a resposta leva o endereço da foto, e
  não a foto: a lista chega inteira antes de a primeira
  imagem começar a baixar.
```

De onde vêm os números. A consulta é feita na plataforma, com o sinal fraco, e a parte da espera que vem da rede da estação não é nossa; a parte que é nossa tem de ser pequena para que a soma das duas caiba no tempo de o trem parar. Os 300 relatos equivalem a dez por dia, todo dia, na mesma estação: muito mais do que qualquer estação terá no começo, e o número precisa continuar valendo quando o uso crescer.

### RNF-04

```
requisito
  [Reliability] O reenvio de uma mesma confirmação deve
  somar exatamente 1: com 5 reenvios seguidos da mesma
  confirmação, o relato ganha 1 confirmação, e não 5.

serviço AWS
  Amazon DynamoDB, com atualização condicional

pilar do Well-Architected
  3, Confiabilidade

razão
  O RF-04 soma uma confirmação quando a passageira indica
  que o problema continua. Ela toca em "confirmar" na
  plataforma, o sinal cai, e ela toca de novo. Sem este
  requisito, uma confirmação viraria duas, e a ordem da
  consulta mentiria. A página manda um código para cada
  confirmação; a tabela guarda o código da última
  confirmação somada e só soma se o código for outro, na
  mesma atualização que soma, sem ler o relato antes.
```

### RNF-05

```
requisito
  [Observabilidade] Toda recusa de relato deve deixar
  exatamente 1 linha no CloudWatch Logs, com o campo
  recusado, visível em no máximo 10 segundos após a
  chamada, conferido com 10 envios inválidos.

serviço AWS
  Amazon CloudWatch Logs

pilar do Well-Architected
  1, Excelência Operacional

razão
  O RF-05 manda registrar a recusa, sem dizer quando nem
  como. Sem número, "registrar" pode ser uma linha que
  aparece minutos depois, duas linhas para a mesma recusa,
  ou nenhuma. É pelo registro que se descobre se a lista
  de estações está recusando um jeito de escrever que as
  passageiras usam: quarenta recusas do campo estação num
  mesmo dia dizem que a lista precisa mudar, e não que
  quarenta passageiras erraram. O registro serve para
  operar e ajustar o sistema, e não para recuperá-lo; por
  isso o pilar 1, e não o 3.
```

A linha leva o nome do campo recusado, e não o valor: o valor é texto escrito por quem enviou, e o registro não guarda nada de quem enviou, como o próprio RF-05 exige.

### 1.1 Resumo

| ID | Categoria | Métrica | Serviço AWS | Pilar |
|---|---|---|---|---|
| RNF-01 | Reliability | zero duplicados em 5 reenvios do mesmo relato | Amazon DynamoDB | 3 |
| RNF-02 | Segurança | 1 ação pública, ler pelo endereço, e 0 de listar, gravar ou apagar | Amazon S3 | 2 |
| RNF-03 | Performance | p95 ≤ 500 ms, até 300 relatos na janela da estação | Amazon DynamoDB | 4 |
| RNF-04 | Reliability | 1 confirmação somada em 5 reenvios da mesma confirmação | Amazon DynamoDB | 3 |
| RNF-05 | Observabilidade | 1 linha por recusa, visível em ≤ 10 s | Amazon CloudWatch Logs | 1 |

Pilares: 1 Excelência Operacional, 2 Segurança, 3 Confiabilidade, 4 Eficiência de Performance, 5 Otimização de Custos, 6 Sustentabilidade.

Ter dois requisitos no pilar 3 não é acaso: os dois caminhos que gravam, o relato e a confirmação, atravessam o mesmo túnel sem sinal.

### 1.2 O pilar não contemplado

Ficaram de fora dois pilares: o 5 e o 6.

O pilar 5, Otimização de Custos, não virou requisito porque em ambiente emulado não existe fatura, e qualquer número de custo seria inventado. Mesmo sem ele, o desenho escolhe serviços cobrados por uso: parado, o Lambda não custa nada, e o DynamoDB em modo sob demanda cobra só o que é lido, gravado e guardado. E a página reduz a foto antes de enviar, o que diminui o que se transfere e o que se guarda.

O pilar 6, Sustentabilidade, fica de fora pela mesma razão: sem medir o consumo de máquina, o número seria inventado. O passo de sustentabilidade que este desenho deixa para depois é não guardar o que ninguém usa: relatos com mais de 30 dias não aparecem em nenhuma consulta, mas continuam na tabela, porque a confirmação precisa dizer que o relato expirou (US-03, cenário 2). Apagá-los depois de um prazo maior caberia ao TTL do próprio DynamoDB, sem dar a nenhuma função permissão de excluir, e fica para quando houver volume que justifique.

As preocupações do FURPS da Sprint 1 também foram para algum lugar:

| FURPS | Para onde foi |
|---|---|
| Functionality: relato com mais de 30 dias não aparece nem é confirmado | já é regra dos requisitos funcionais RF-03 e RF-04, e se confere pelos critérios de aceite da US-02 e da US-03 |
| Usability: a lista é lida em pé, com uma mão ocupada | vira o desenho da página na Sprint 4 |
| Reliability: o reenvio não pode duplicar o relato | RNF-01 e RNF-04 |
| Performance: a lista tem de chegar antes de o trem parar | RNF-03 |
| Supportability: a estação que muda de nome não pode perder os relatos antigos | resolvida no modelo de dados, pela chave de partição (seção 6.2) |

Duas proteções que o desenho tem não são requisitos não funcionais, porque não são a qualidade de um dos cinco requisitos funcionais: são decisões, e estão na seção 9. A primeira é o anonimato no registro e nas fotos: o RD-01 já é a regra, e o desenho a garante nos pontos em que ela quebraria sem ninguém perceber, o IP que chega à função e o EXIF que vem na foto. A segunda é o limite de uma confirmação a cada 10 minutos por relato, que é a resposta ao risco de confirmações repetidas que a seção 8 da Sprint 1 deixou declarado.

## 2. A arquitetura em três camadas

| Camada | O que fica nela, neste projeto | Serviço AWS |
|---|---|---|
| Apresentação | A página `index.html`: o formulário de relato, com o aviso de que a foto mostra o ambiente e não pessoas (RD-02) e o 190 para emergência (RD-03); a consulta por estação; o botão de confirmar | Amazon S3, em modo site estático |
| Negócio | As três funções, `registrar`, `consultar` e `confirmar`, a lista de estações aceitas e a porta de entrada que chama as funções | AWS Lambda e Amazon API Gateway |
| Dados | A tabela de relatos e as fotos dos locais | Amazon DynamoDB e Amazon S3 |

O S3 aparece em duas camadas, com dois papéis e dois buckets separados: um guarda a página, que é apresentação; o outro guarda as fotos, que são dados.

### 2.1 Como a separação é garantida

A página é um arquivo estático servido pelo S3 e não tem credencial nenhuma: o `config.js` carrega apenas o endereço público da API. Mesmo que alguém leia todo o código-fonte da página no navegador, e qualquer pessoa pode, não há nada ali que permita falar com o DynamoDB.

O único caminho até a tabela é o API Gateway, e o API Gateway só sabe invocar as três funções. Quem decide o que entra é a função `registrar`, não a página. A lista de estações da página é uma conveniência para quem usa: quem mandar "Barra Funda" direto para a API, sem passar pela página, é recusado do mesmo jeito, porque a regra do RF-05 está na função. O critério US-01, cenário 2, confere exatamente isso, e não depende da página para passar.

A permissão de falar com os dados fica nos papéis do IAM, um para cada função, do lado da AWS, e nunca chega ao navegador. A `consultar` só lê a tabela (RF-03); a `registrar` lê e grava na tabela e grava no bucket de fotos, sem nenhuma permissão de excluir; a `confirmar` lê e atualiza a tabela, também sem excluir.

Há uma leitura direta, e ela é de propósito: o navegador abre a foto pelo endereço dela no bucket de fotos. O RF-02 pede um endereço pelo qual a foto possa ser vista, e a `consultar` não pode assinar um endereço temporário, porque o RF-03 a limita a ler a tabela. O que o navegador consegue fazer ali é ler um arquivo cujo endereço ele já recebeu. Ele não consegue listar o bucket, nem gravar, nem apagar (RNF-02), e o que ele lê não tem dado de ninguém (RD-02 e a limpeza da foto, seção 9).

## 3. Estilo arquitetural

| Item | Resposta |
|---|---|
| Estilo adotado | Distributed: três funções independentes, `registrar`, `consultar` e `confirmar`, atrás de um ponto único de entrada |
| Por que ele serve a este projeto | As três operações têm cargas e permissões diferentes. A consulta é a que mais acontece, na hora do pico, com o trem chegando; o relato e a confirmação são raros. Com funções separadas, cada uma cresce no seu ritmo, e uma falha no relato não derruba a consulta, que é o que a passageira precisa à noite. E o RF-03 exige que a consulta não consiga alterar nenhum relato: isso só é possível porque a consulta é uma função separada, com um papel do IAM só dela. |
| Estilo descartado | Implicit Invocation: a foto chega ao S3, e a chegada dispara sozinha uma função que limpa a foto e grava o relato |
| Por que foi descartado | Por duas razões do cenário. Entre a chegada da foto ao bucket e a limpeza, a foto ficaria guardada com a localização do aparelho no EXIF, o que o RD-01 não permite nem por alguns segundos. E a passageira enviaria o relato sem receber, na mesma resposta, o protocolo ou o campo recusado, que a US-01 cobra nos dois cenários. |

Estilos: Data Flow, Call and Return, Implicit Invocation, Repository, Distributed, Virtual Machines.

## 4. Padrões arquiteturais identificados

| Padrão | Onde ele aparece no meu desenho | O que ele resolve aqui |
|---|---|---|
| API Gateway | O Amazon API Gateway, como porta única das três rotas: `POST /relatos`, `GET /relatos?estacao=` e `POST /confirmacoes` | A página conhece um endereço só, e as funções não precisam cuidar de roteamento. É também o único ponto por onde algo vindo de fora chega à tabela |
| MVC | A página é a visão; as três funções são o controle; o relato, na tabela e no bucket, é o modelo | A regra que recusa "Barra Funda" (RF-05) e a janela de 30 dias ficam no controle. A página pode ser refeita para ser lida em pé, com uma mão (a preocupação de Usability), sem tocar nelas |

Uma pergunta provável: a `consultar` só lê e as outras duas só gravam, cada uma com o seu papel no IAM; isso é CQRS? É a metade dele. Os caminhos de leitura e de gravação estão separados, mas leem e gravam o mesmo modelo, a mesma tabela. CQRS de verdade teria um modelo próprio de leitura, como uma lista por estação já ordenada. Por isso ele não entra na tabela acima.

### 4.1 O padrão que faria falta

**Event Sourcing.** Hoje o relato guarda o estado atual: quantas confirmações recebeu e quando foi a última. A soma esconde o ritmo. Um relato com 9 confirmações pode tê-las recebido todas na primeira semana e nenhuma depois, e o problema pode já ter sido consertado; ou pode ter recebido uma por semana, o que diz que ele continua. Para quem decide por onde andar, essa diferença importa mais do que o total. Com Event Sourcing, cada confirmação seria guardada como um acontecimento, com a data, sem apagar nenhum, e o número exibido seria a soma deles. A consulta poderia mostrar "confirmado 3 vezes na última semana", e uma rajada de confirmações no mesmo dia, o sinal de fraude que o limite de 10 minutos só desacelera, ficaria visível.

Ele entraria na função `confirmar`, que passaria a gravar um item por confirmação na partição da estação, e na `consultar`, que passaria a somá-los. Não entra no desenho porque a consulta passaria a ler um item por confirmação, além de um por relato, e o RNF-03 foi escrito para 300 relatos, não para 300 relatos e milhares de confirmações. O que o desenho atual já consegue mostrar é a data da última confirmação; o ritmo, não.

## 5. Diagrama de arquitetura de ponta a ponta

O diagrama está abaixo e no arquivo [`docs/diagrama.png`](diagrama.png). O código que o desenha, em Mermaid, está em [`docs/diagrama.md`](diagrama.md), com a explicação de como ler as setas.

![Diagrama de arquitetura de ponta a ponta do CPTM SOS · Relatos por estação](diagrama.png)

### 5.1 Legenda das caixas

| Caixa | Serviço AWS | O que ela faz | Requisito que a justifica |
|---|---|---|---|
| Navegador | — | Mostra o formulário, a consulta e o botão de confirmar; limpa e reduz a foto e gera o código de cada envio e de cada confirmação | US-01, US-02, US-03, RNF-01, RNF-04 |
| Site estático | Amazon S3, bucket `cptm-sos-site` | Serve `index.html`, `config.js` e `estacoes.json` | US-01, US-02, US-03 |
| Entrada da API | Amazon API Gateway | Recebe as três rotas e invoca a função certa | US-01, US-02, US-03: é por ela que passam as três rotas |
| Função registrar | AWS Lambda | Valida, deriva o protocolo e grava a foto e o relato, só se o protocolo for novo | RF-01, RF-02, RF-05, RNF-01, RNF-05 |
| Função consultar | AWS Lambda | Faz o `query` na partição da estação, só nos últimos 30 dias, e ordena | RF-03, RNF-03 |
| Função confirmar | AWS Lambda | Soma 1 confirmação, só se o relato tiver até 30 dias e o código da confirmação for novo | RF-04, RNF-04 |
| Tabela de relatos | Amazon DynamoDB, `cptm-sos-relatos` | Guarda o relato, com `estacao_id` como chave de partição | RF-01, RF-03, RF-04, RNF-03 |
| Bucket de fotos | Amazon S3, `cptm-sos-fotos` | Guarda a foto em `fotos/<estacao_id>/<protocolo>.jpg`; o público só lê, pelo endereço exato | RF-02, RNF-02 |
| Papéis das funções | AWS IAM | Concede a cada função só o que ela usa: a `consultar` só lê, e só a `registrar` grava no bucket | RF-03, RNF-02 |
| Registros | Amazon CloudWatch Logs | Guarda uma linha por execução, sem dado de quem chamou | RF-05, RNF-05 |

### 5.2 O fluxo de uma requisição

A passageira escolhe a estação na lista, o tipo de problema e a faixa de horário, escreve a descrição, tira ou escolhe a foto e toca em "Enviar relato". Antes de enviar, a página faz duas coisas: redesenha a foto, o que tira dela os metadados EXIF e a reduz para no máximo 1600 pixels no lado maior (RD-01, seção 9), e gera um código aleatório para aquele envio, que ela repete se precisar tentar de novo (RNF-01). Envia tudo em um único POST para a rota `/relatos` do API Gateway, com a foto em base64.

O API Gateway invoca a função `registrar`. Ela confere, nesta ordem, a estação na lista aceita, o tipo de problema, a faixa de horário, a foto (presente, com até 2 MB e sem EXIF) e a descrição, se houver, com até 500 caracteres. No primeiro campo recusado, devolve 400 dizendo qual foi, e imprime uma linha com a operação e o nome do campo recusado, sem o valor e sem nada de quem enviou (RF-05 e RNF-05).

Com tudo válido, a função deriva o protocolo do código de envio e confere se ele já existe na tabela. Se existir, é um reenvio: a função não toca na foto nem na tabela e devolve o mesmo protocolo (RNF-01). Se não existir, a foto vai primeiro: ela é gravada no S3, em `fotos/<estacao_id>/<protocolo>.jpg`. Só depois o relato é gravado na tabela, com 0 confirmações, numa gravação condicional que só acontece se o protocolo ainda não existir, o que cobre dois reenvios que cheguem ao mesmo tempo. A ordem é a preocupação de Reliability do FURPS da Sprint 1: não pode existir relato listado apontando para uma foto que nunca subiu. O pior caso no sentido contrário é uma foto sem relato, que nenhuma consulta mostra; e, se a passageira reenviar, a mesma foto é regravada no mesmo endereço.

Com o relato gravado, a função imprime a linha de registro e devolve 201 com o protocolo e o endereço da foto. A página mostra o protocolo e recarrega a consulta da estação: um GET em `/relatos?estacao=BRS`, que chega à função `consultar`. Ela faz um `query` na partição da estação, só com as chaves de ordenação a partir do dia de 30 dias atrás; descarta o que passou de 30 dias na hora exata; ordena por confirmações e, no empate, do mais recente para o mais antigo; e devolve a lista com o endereço de cada foto. Se a lista vier vazia, a página mostra "Nenhum relato nos últimos 30 dias. Isso não quer dizer que a estação seja segura."

A confirmação faz o mesmo caminho até a função `confirmar`, que soma 1 ao relato numa única atualização condicional: a soma só acontece se o relato tiver até 30 dias (RF-04), se o código daquela confirmação não for o da última somada (RNF-04) e se a última confirmação tiver mais de 10 minutos (seção 9). Se a condição falhar, a função lê o relato para dizer o porquê: expirou, foi confirmado há pouco, ou aquela mesma confirmação já tinha sido somada, e então é um reenvio e a resposta é de sucesso.

### 5.3 O que acontece se uma caixa cair

| Caixa | Efeito da queda | O que o sistema ainda consegue fazer |
|---|---|---|
| Site estático | Ninguém chega pela tela | A API continua respondendo: outro cliente, ou o `curl`, continua relatando, consultando e confirmando |
| Função registrar | Nenhum relato novo entra | A consulta e a confirmação continuam: quem vai embarcar ainda vê o que já foi relatado, que é o que mais importa à noite |
| Função consultar | A passageira não vê os relatos da estação | Relatos e confirmações continuam sendo aceitos e nada se perde; a lista volta quando a função voltar |
| Função confirmar | Nenhuma confirmação é somada | Relato e consulta continuam; a ordem da lista fica parada nos números que já tinha |
| Tabela de relatos | Nada funciona | Nada. As fotos continuam no bucket, com a estação e o protocolo no caminho, mas sem o tipo, a faixa e a descrição: o acervo não se reconstrói a partir delas |
| Bucket de fotos | O relato falha antes de gravar na tabela, porque a foto vai primeiro; as fotos dos relatos existentes não abrem | A consulta continua mostrando os relatos em texto, e a confirmação continua |
| Registros | Some o registro das recusas | Relatar, consultar e confirmar continuam funcionando; o que se perde é a prova do RF-05 e do RNF-05 durante a queda |

## 6. Modelo de dados

### 6.1 Entidades

| Entidade | Campo | Tipo | Obrigatório |
|---|---|---|---|
| Relato | `estacao_id` | texto, chave de partição: o código fixo da estação, como `BRS` | sim |
| Relato | `dia_protocolo` | texto, chave de ordenação: o dia do envio e o protocolo, como `2026-10-15#<protocolo>` | sim, gerado |
| Relato | `protocolo` | texto, gerado pela função: os 16 primeiros caracteres do SHA-256 do código de envio criado pela página | sim, gerado |
| Relato | `tipo` | texto: iluminação precária, área isolada, sem agente de segurança, equipamento de segurança quebrado ou outro | sim |
| Relato | `faixa` | texto: madrugada, manhã, tarde ou noite | sim |
| Relato | `descricao` | texto livre, até 500 caracteres | não |
| Relato | `foto` | texto, caminho do objeto no S3 | sim: relato sem foto é recusado (RF-05) |
| Relato | `enviado_em` | texto, data e hora em ISO 8601, UTC | sim, gerado |
| Relato | `confirmacoes` | número | sim, começa em 0 |
| Relato | `ultima_confirmacao_em` | texto, data e hora em ISO 8601, UTC | não: só depois da primeira confirmação (limite de 10 minutos, seção 9) |
| Relato | `ultimo_codigo_confirmacao` | texto, UUID gerado pela página para cada confirmação | não: só depois da primeira confirmação (RNF-04) |

O relato não guarda o nome da estação, só o código. O nome que aparece na tela vem da lista de estações (seção 6.3).

Um relato gravado, como ele fica na tabela:

```json
{
  "estacao_id": "BRS",
  "dia_protocolo": "2026-10-15#9c1e5a7b2f40d863",
  "protocolo": "9c1e5a7b2f40d863",
  "tipo": "iluminação precária",
  "faixa": "noite",
  "descricao": "Escada entre a passarela e a plataforma, sem nenhuma lâmpada acesa.",
  "foto": "fotos/BRS/9c1e5a7b2f40d863.jpg",
  "enviado_em": "2026-10-15T22:41:07Z",
  "confirmacoes": 0
}
```

### 6.2 A chave de partição

| Item | Resposta |
|---|---|
| Campo escolhido como chave de partição | `estacao_id`, o código fixo da estação |
| Campo escolhido como chave de ordenação | `dia_protocolo`, o dia do envio seguido do protocolo |
| Qual consulta esta escolha torna barata | "Os relatos da Brás nos últimos 30 dias": um `query` que vai direto à partição `BRS` e lê só as chaves a partir do dia de 30 dias atrás |
| Qual consulta esta escolha torna cara | "Todos os relatos de iluminação precária, de qualquer estação": exige um `scan` na tabela inteira |
| Alternativa descartada | O nome da estação como chave de partição: é o que a passageira escolhe na tela, mas o nome muda, e os relatos antigos ficariam presos sob o nome anterior |

A pergunta que a tela responde, escrita na Sprint 1, é "o que foi relatado nesta estação nos últimos 30 dias". Ela tem duas partes, e cada uma virou uma parte da chave. "Nesta estação" é a chave de partição: toda consulta do sistema pergunta por uma estação, e nenhuma pede os relatos de todas. "Nos últimos 30 dias" é o começo da chave de ordenação: como ela começa pelo dia, a consulta pede só a fatia da janela, e os relatos antigos da estação não são lidos.

A chave de partição é o código, e não o nome, por causa da preocupação de Supportability do FURPS: as linhas 8 e 9 já mudaram de operadora, e estações mudam de nome. Se a partição fosse o nome, a renomeação deixaria os relatos antigos sob o nome velho, e a consulta pelo nome novo viria vazia, numa estação que tem problemas relatados. Com o código, renomear uma estação é mudar uma linha da lista de estações, sem regravar nenhum relato.

A consulta por linha também fica cara: não há chave para ela, e a Linha 11 viraria 16 consultas, uma por estação. Isso não é descuido: a Sprint 1 já descartou consultar por linha (seção 8 daquele documento), porque a passageira decide por onde andar dentro de uma estação, e não de uma linha.

O protocolo sozinho também não serve de partição, embora seja único: nenhuma tela busca um relato pelo protocolo, e listar uma estação viraria um `scan`. Ele entra no fim da chave de ordenação, o que dá à chave a unicidade de que ela precisa.

### 6.3 O que fica no S3 e o que fica no DynamoDB

| Dado | Onde fica | Por quê |
|---|---|---|
| Os campos do relato: estação, tipo, faixa, descrição, data, confirmações e o caminho da foto | Amazon DynamoDB, tabela `cptm-sos-relatos` | São pequenos e são o que a consulta filtra, ordena e mostra |
| A foto do local | Amazon S3, bucket `cptm-sos-fotos`, em `fotos/<estacao_id>/<protocolo>.jpg` | Uma foto chega a 2 MB, e um item do DynamoDB aceita no máximo 400 KB. A tabela guarda só o caminho. O protocolo no nome faz o reenvio regravar a mesma foto, em vez de criar outra (RNF-01) |
| A lista de estações aceitas: código, nome de exibição e linhas | Arquivo `estacoes.json`, no pacote da função `registrar` e no bucket do site | Não é dado que a passageira cadastra: é regra, e muda raramente. Um arquivo só, no repositório, publicado nos dois lugares pelo mesmo script, de modo que a lista da página e a da função não divergem |
| A página: `index.html` e `config.js` | Amazon S3, bucket `cptm-sos-site` | Apresentação, sem credencial nenhuma |

## 7. Backlog priorizado

| ID | Item | Tipo | Prioridade |
|---|---|---|---|
| RF-01 | Registrar o relato com estação, tipo, faixa e descrição, gerando o protocolo e guardando data e hora | RF | Alta |
| RF-02 | Armazenar a foto do local no Amazon S3, deixando o endereço no relato | RF | Alta |
| RF-03 | Listar os relatos da estação dos últimos 30 dias, do mais confirmado ao menos confirmado | RF | Alta |
| RF-05 | Recusar relato sem foto ou com estação, tipo ou faixa fora da lista, dizendo o campo e registrando a recusa | RF | Alta |
| US-01 | A passageira registra um ponto inseguro com a foto do local | US | Alta |
| US-02 | A passageira vê os relatos recentes da estação antes de embarcar | US | Alta |
| RNF-02 | O público só lê a foto: zero ações de listar, gravar ou apagar no bucket | RNF | Alta |
| RF-04 | Somar uma confirmação a um relato de até 30 dias | RF | Média |
| US-03 | A passageira confirma um relato existente | US | Média |
| RNF-01 | Zero relatos duplicados em 5 reenvios do mesmo relato | RNF | Média |
| RNF-03 | Consulta da estação em até 500 ms no p95 | RNF | Média |
| RNF-04 | Uma confirmação somada em 5 reenvios da mesma confirmação | RNF | Média |
| RNF-05 | Uma linha por recusa no CloudWatch Logs, visível em até 10 segundos | RNF | Baixa |

### 7.1 Distribuição

| Prioridade | Quantidade |
|---|---|
| Alta | 7 |
| Média | 5 |
| Baixa | 1 |

Pouco mais da metade ficou em alta. A prioridade dos requisitos funcionais é a mesma da Sprint 1: o que lá era essencial aqui é alta, e o que era importante aqui é média. A US-03 e o RF-04 falam da mesma coisa, confirmar um relato, e por isso estão na mesma prioridade; o RNF-04, que é a qualidade do RF-04, está com eles.

O RNF-02 é o único não funcional em alta. Sem ele o sistema funciona, mas com um bucket que qualquer pessoa pode listar e regravar: as fotos de todas as estações saem de uma vez, e a foto de um relato pode ser trocada por uma foto de pessoa. Um sistema assim não pode ser posto no ar, por melhor que funcione.

O RNF-01 e o RNF-03 ficaram em média, embora a qualidade que cobram seja de requisitos em alta: sem eles o sistema funciona, só pior. Sem o RNF-01, um reenvio duplica o relato e a estação mostra uma ordem errada; sem o RNF-03, a consulta responde, só mais devagar. O RNF-03 não custa código, porque quem o sustenta é a chave de partição da seção 6.2; custa só a medição da Sprint 5.

O RNF-05 ficou em baixa porque serve a quem opera o sistema, e não a quem usa: a recusa em si, o RF-05, está em alta; o prazo de 10 segundos para ela aparecer no registro, a passageira nunca sente.

Prioridade não é ordem de construção. A US-02 está acima da US-03, porque a consulta é o que dá valor ao sistema; mas a US-03 é construída antes, na ordem que a Sprint 1 definiu (US-01, US-03, US-02), para que já existam relatos com números de confirmações diferentes quando a ordenação da consulta for conferida.

## 8. Recorte de implementação

| Item | Resposta |
|---|---|
| O que será implementado nas Sprints 3 e 4 | Os treze itens do backlog. Na Sprint 3, o caminho da gravação: RF-01, RF-02, RF-05, RNF-01, RNF-02 e RNF-05. Na Sprint 4, o que depende de haver o que listar e de existir a página, nesta ordem: RF-04, US-03 e RNF-04; depois RF-03, US-02 e RNF-03; e a US-01, que só se completa com a página. |
| O que fica especificado e não implementado | Nenhum item do backlog. Continuam fora do escopo, como declarado na Sprint 1: o botão de emergência, a sirene e a localização em tempo real; conta de usuário e autenticação; denúncia de crime ou de pessoa; moderação e remoção de relatos; e o envio dos relatos à operadora. Também fica de fora a consulta por linha, descartada na Sprint 1 e cara pela chave escolhida aqui. |
| Por que este corte | Toda a prioridade alta cabe nas duas sprints, porque é o percurso do roteiro: uma função que grava e uma que consulta, atrás de uma API e de uma página. Os itens de média e de baixa entraram por decisão. A US-03 tem custo: obriga a escrever uma terceira função, `confirmar`, que o roteiro não ensina, e a razão está logo abaixo desta tabela. O RNF-03 não custa código, só medição. O RNF-01 e o RNF-04 custam poucas linhas: condições na gravação, que a própria tabela confere. O RNF-05 é uma linha de registro por recusa. |

A alternativa mais barata seria declarar a confirmação fora do recorte, e é uma resposta legítima. Optamos por implementar porque a confirmação é o que separa o problema recorrente do caso isolado, que é a razão de ela estar no escopo desde a Sprint 1. Sem ela, todo relato teria 0 confirmações, a consulta sairia do mais recente para o mais antigo, e dez passageiras que passaram pela mesma escada escura gerariam dez relatos soltos.

Antes de a função `registrar` ser escrita, na Sprint 3, a lista de estações precisa ser conferida com a relação oficial das operadoras, como a Sprint 1 já tinha previsto, e cada estação recebe o seu código fixo. A partir daí o código não muda; o nome pode mudar.

## 9. Decisões e alternativas descartadas

| Decisão | Alternativa considerada | Por que não foi escolhida |
|---|---|---|
| Estilo arquitetural: Distributed | Implicit Invocation: a chegada da foto ao S3 dispara a função que limpa a foto e grava o relato | Entre a chegada e a limpeza, a foto ficaria guardada com a localização do aparelho, o que o RD-01 não permite; e a passageira não receberia na mesma resposta o protocolo ou o campo recusado, que a US-01 cobra. |
| Chave de partição: `estacao_id`, o código fixo da estação | O nome da estação como chave de partição | O nome muda: quando uma estação fosse renomeada, os relatos antigos ficariam sob o nome velho, e a consulta pelo nome novo viria vazia numa estação com problemas relatados. |
| Recorte de implementação: os treze itens | Só a prioridade alta, deixando a confirmação especificada e não implementada | Seria mais barato e é legítimo, mas a consulta perderia o que a diferencia de uma lista de reclamações: saber o que se repete. |
| Os RNFs são a qualidade dos cinco RFs da Sprint 1, um para um | Escolher os RNFs pelas categorias de nuvem, como Segurança e Observabilidade, independentemente dos RFs | Com um RNF por RF, nenhum requisito funcional fica sem número que o confira, e cada número tem um dono no código. O anonimato e o limite de confirmações, que não são a qualidade de um RF só, ficaram como decisões nesta tabela. |
| O registro de cada função leva só campos nomeados, e o registro de acesso do API Gateway fica desligado | Registrar o evento inteiro, com `print(event)`, e ligar o registro de acesso do API Gateway | O evento que o API Gateway entrega à função traz o IP e o navegador de quem chamou, e o registro de acesso guarda o IP de cada chamada. As duas coisas gravariam no CloudWatch quem relatou, e o RD-01 seria quebrado sem ninguém perceber. |
| A página limpa a foto, e a função só confere | A função limpa a foto, com uma biblioteca de imagens | A foto do celular carrega no EXIF a latitude, a longitude e o modelo do aparelho (RD-01). A biblioteca precisaria ser empacotada com a função, o que o percurso das Sprints 3 e 4 não cobre. A página já precisa redesenhar a foto para reduzi-la, e redesenhar tira o EXIF de graça. A função não confia nisso: confere a ausência do EXIF e recusa a foto que o tiver. |
| Contra confirmações repetidas, um intervalo de 10 minutos por relato | Exigir conta, ou guardar um identificador do aparelho, para que cada pessoa confirme uma vez | As duas identificam quem participa e contrariam o RD-01. O intervalo não impede a fraude: torna-a lenta. Cinquenta confirmações falsas, que caberiam em um segundo, passam a exigir mais de oito horas. Quem quiser inflar um relato ainda consegue, com paciência; esse é o risco que a Sprint 1 declarou e que sobra, escrito aqui. Para que o critério US-03, cenário 1, passe, a última confirmação do relato A tem de ter mais de 10 minutos. |
| O protocolo é derivado do código de envio, por um hash | O protocolo é o próprio código gerado pela página | O protocolo aparece na consulta. Se ele fosse o código, quem o lesse poderia reenviá-lo num outro dia, com outra foto, e a foto nova seria gravada no endereço da foto do relato original. Com o hash, conhecer o protocolo não permite chegar ao código. |
| A chave de ordenação começa pelo dia do envio | O protocolo como chave de ordenação, com um filtro de 30 dias depois da leitura | O filtro é aplicado depois de ler: a consulta leria todos os relatos que a estação já teve, desde o primeiro dia, e o tempo cresceria para sempre. O preço desta decisão é um defeito conhecido: um reenvio que atravesse a meia-noite em UTC, 21h em Brasília, cai em outro dia, ganha outra chave e duplica o relato. A janela é de segundos, e fica declarada aqui. |
| A foto tem leitura pública pelo endereço exato | Endereço temporário assinado, gerado pela função `consultar` | Assinar exige que a `consultar` tenha permissão no S3, e o RF-03 a limita a ler a tabela. A foto já é conteúdo público por definição (RF-02). O que não é público é listar o bucket, gravar ou apagar (RNF-02). |
| A lista de estações é um arquivo | Uma segunda tabela no DynamoDB, com as estações | São 97 estações, que ninguém cadastra pela página e que mudam raramente. Uma tabela custaria uma leitura a mais em cada relato. Se um dia houver uma tela para manter a lista, a tabela passa a ser a escolha certa. |

## 10. Revisão cruzada recebida

Revisado por: pendente, a revisão acontece na aula\
Data: pendente

| Pergunta | Resposta da equipe revisora |
|---|---|
| Algum requisito não funcional está sem número? | pendente — preenchido com a resposta da equipe revisora |
| O pilar escolhido faz sentido para aquele requisito? | pendente — preenchido com a resposta da equipe revisora |
| Alguma caixa do diagrama não corresponde a requisito? | pendente — preenchido com a resposta da equipe revisora |
| O recorte cabe em duas sprints? | pendente — preenchido com a resposta da equipe revisora |

### 10.1 O que foi ajustado depois da revisão

Ajuste após a orientação da professora (15/10/2026): os requisitos não funcionais passaram de quatro para cinco, um para cada requisito funcional da Sprint 1. O anonimato no registro e nas fotos e o limite de uma confirmação a cada 10 minutos, que eram requisitos não funcionais, passaram a decisões da seção 9, e o pilar 1 passou a ter requisito (RNF-05). Versão do documento: 1.1.

Ajustes da revisão cruzada: pendente, registrados aqui depois do retorno da equipe revisora.
