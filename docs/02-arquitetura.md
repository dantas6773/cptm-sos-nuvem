# Documento de Arquitetura

Entregável da Sprint 2, no formato do Template 2. As seções têm os mesmos números do template.

Projeto: CPTM SOS · Relatos por estação\
Cenário oficial escolhido: nenhum; ideia própria da equipe, aprovada pela professora\
Data: 15/10/2026\
Versão: 1.0

## 1. Requisitos não funcionais

Fórmula obrigatória: `[Categoria] + [Métrica Numérica Mensurável] + [Condição de Execução]`.

Os quatro saem do que a Sprint 1 deixou escrito. A Performance e a Reliability do FURPS viraram o RNF-01 e o RNF-02, agora com número. O RNF-03 dá número ao RD-01, o relato anônimo, no ponto em que ele é mais fácil de quebrar sem querer. O RNF-04 cumpre o que a seção 8 da Sprint 1 prometeu: o risco de confirmações repetidas volta aqui como requisito. As outras três linhas do FURPS não viraram requisito não funcional, e a seção 1.2 diz para onde cada uma foi.

### RNF-01

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

### RNF-02

```
requisito
  [Reliability] O reenvio de um mesmo relato, ou de uma
  mesma confirmação, deve gravar zero duplicados: com 5
  reenvios seguidos do mesmo pedido, a estação ganha
  exatamente 1 relato e 1 foto, e o relato confirmado
  ganha exatamente 1 confirmação.

serviço AWS
  Amazon DynamoDB, com gravação condicional, e Amazon S3,
  com a foto guardada sob o protocolo

pilar do Well-Architected
  3, Confiabilidade

razão
  No túnel o sinal cai, e o envio pode ter sido gravado
  com a resposta perdida no caminho. Tentar de novo é o
  certo a fazer, e só é seguro se o sistema reconhecer o
  pedido repetido. A página gera um código aleatório
  para cada envio e repete o mesmo código a cada nova
  tentativa; a função deriva dele o protocolo. Se o
  protocolo já existe na tabela, é um reenvio: a função
  devolve o mesmo protocolo sem tocar na foto nem na
  tabela. A confirmação faz o mesmo com o código da
  última confirmação somada.
```

O protocolo é um resumo do código, os 16 primeiros caracteres do seu SHA-256, e não o próprio código. O protocolo aparece na consulta, porque é por ele que se confirma um relato; o código, não. Se o protocolo fosse o código, quem o lesse na consulta poderia reenviá-lo com outra foto e trocar a foto de um relato alheio (seção 9). E o código identifica o envio, e não quem enviou: é novo a cada relato e a cada confirmação, e a página o descarta quando recebe a resposta. Por isso ele não fere o RD-01.

### RNF-03

```
requisito
  [Segurança] Nenhum dado de quem relata ou confirma deve
  ficar guardado: zero ocorrências de endereço IP, de
  identificação do navegador e de metadados EXIF de
  localização ou de aparelho, conferidas no CloudWatch
  Logs, na tabela e nas fotos do bucket depois de 20
  relatos e 20 confirmações.

serviço AWS
  AWS Lambda e Amazon CloudWatch Logs

pilar do Well-Architected
  2, Segurança

razão
  O RD-01 não se quebra por um campo de nome no
  formulário: quebra-se sem que ninguém perceba. O API
  Gateway entrega à função, dentro do evento, o IP e o
  navegador de quem chamou, e um print(event), o hábito
  mais comum de depuração, gravaria o IP de cada
  passageira no CloudWatch. A foto tirada no celular
  carrega no EXIF a latitude, a longitude e o modelo do
  aparelho. Por isso a função registra só campos
  nomeados (operação, estação, resultado) e recusa
  foto com EXIF; a página limpa a foto antes de enviar.
```

O registro de acesso do próprio API Gateway, que guardaria o IP de cada chamada, fica desligado pelo mesmo motivo.

O RNF-03 acrescenta um cuidado ao critério US-01, cenário 1, da Sprint 1: a foto JPEG de 2 MB tem de chegar sem EXIF. Pela página ela chega, porque a página a limpa; mandada direto à API como saiu da câmera, ela seria recusada, e é isso que o RNF-03 pede.

### RNF-04

```
requisito
  [Segurança] Um mesmo relato deve somar no máximo 1
  confirmação a cada 10 minutos, com 20 confirmações
  disparadas em sequência contra o mesmo relato.

serviço AWS
  Amazon DynamoDB, com atualização condicional

pilar do Well-Architected
  2, Segurança

razão
  Impedir que a mesma pessoa confirme duas vezes exigiria
  saber quem ela é, e o RD-01 proíbe. O que dá para
  limitar sem identificar ninguém é a velocidade: a
  confirmação só é somada se a última tiver mais de 10
  minutos, o que a tabela confere na mesma atualização
  que soma. Cinquenta confirmações falsas, que hoje
  caberiam em um segundo, passam a exigir mais de oito
  horas.
```

O limite não impede a fraude; ele a torna lenta, e o risco que sobra está declarado na seção 9. Ele também não atrapalha o uso real: duas passageiras que confirmam o mesmo problema em menos de 10 minutos não acrescentam informação, e a segunda recebe a mensagem de que o relato acabou de ser confirmado.

O RNF-04 também acrescenta um dado ao critério US-03, cenário 1, da Sprint 1: para que o relato A passe de 2 para 3 confirmações, a última confirmação dele tem de ter mais de 10 minutos. Isso entra no "Dado que" quando o teste for escrito, na Sprint 5.

### 1.1 Resumo

| ID | Categoria | Métrica | Serviço AWS | Pilar |
|---|---|---|---|---|
| RNF-01 | Performance | p95 ≤ 500 ms, até 300 relatos na janela da estação | Amazon DynamoDB | 4 |
| RNF-02 | Reliability | zero duplicados em 5 reenvios do mesmo pedido | Amazon DynamoDB e Amazon S3 | 3 |
| RNF-03 | Segurança | zero IP, navegador ou EXIF guardados, em 20 relatos e 20 confirmações | AWS Lambda e Amazon CloudWatch Logs | 2 |
| RNF-04 | Segurança | no máximo 1 confirmação por relato a cada 10 min | Amazon DynamoDB | 2 |

Pilares: 1 Excelência Operacional, 2 Segurança, 3 Confiabilidade, 4 Eficiência de Performance, 5 Otimização de Custos, 6 Sustentabilidade.

Ter dois requisitos no pilar 2 não é acaso. Num sistema de relatos anônimos sobre segurança, a ameaça vem de dois lados: expor quem relatou (RNF-03) e falsificar o que foi relatado (RNF-04).

### 1.2 O pilar não contemplado

Ficaram de fora três pilares: o 1, o 5 e o 6.

O pilar 1, Excelência Operacional, não virou requisito porque ninguém opera este sistema no dia a dia: a Sprint 1 deixou a moderação fora do escopo, e não há quem leia os registros para agir sobre um relato. O registro que importa, a recusa sem dado de quem enviou, já é requisito funcional (RF-05), e o ambiente inteiro vai ser criado por script, porque esse é o percurso das Sprints 3 e 4. Sem um operador, um número de tempo até o registro aparecer mediria algo que ninguém usa.

O pilar 5, Otimização de Custos, não virou requisito porque em ambiente emulado não existe fatura, e qualquer número de custo seria inventado. Mesmo sem ele, o desenho escolhe serviços cobrados por uso: parado, o Lambda não custa nada, e o DynamoDB em modo sob demanda cobra só o que é lido, gravado e guardado. E a página reduz a foto antes de enviar, o que diminui o que se transfere e o que se guarda.

O pilar 6, Sustentabilidade, fica de fora pela mesma razão: sem medir o consumo de máquina, o número seria inventado. O passo de sustentabilidade que este desenho deixa para depois é não guardar o que ninguém usa: relatos com mais de 30 dias não aparecem em nenhuma consulta, mas continuam na tabela, porque a confirmação precisa dizer que o relato expirou (US-03, cenário 2). Apagá-los depois de um prazo maior caberia ao TTL do próprio DynamoDB, sem dar a nenhuma função permissão de excluir, e fica para quando houver volume que justifique.

Das cinco preocupações do FURPS da Sprint 1, duas viraram requisito não funcional aqui. As outras três foram para outro lugar:

| FURPS | Para onde foi |
|---|---|
| Functionality: relato com mais de 30 dias não aparece nem é confirmado | já é regra dos requisitos funcionais RF-03 e RF-04, e se confere pelos critérios de aceite da US-02 e da US-03 |
| Usability: a lista é lida em pé, com uma mão ocupada | vira o desenho da página na Sprint 4; não há número que se confira no LocalStack |
| Reliability: o reenvio não pode duplicar o relato | RNF-02 |
| Performance: a lista tem de chegar antes de o trem parar | RNF-01 |
| Supportability: a estação que muda de nome não pode perder os relatos antigos | resolvida no modelo de dados, pela chave de partição (seção 6.2) |

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

Há uma leitura direta, e ela é de propósito: o navegador abre a foto pelo endereço dela no bucket de fotos. O RF-02 pede um endereço pelo qual a foto possa ser vista, e a `consultar` não pode assinar um endereço temporário, porque o RF-03 a limita a ler a tabela. O que o navegador consegue fazer ali é ler um arquivo cujo endereço ele já recebeu. Ele não consegue listar o bucket, nem gravar, nem apagar, e o que ele lê não tem dado de ninguém (RD-02 e RNF-03).

## 3. Estilo arquitetural

| Item | Resposta |
|---|---|
| Estilo adotado | Distributed: três funções independentes, `registrar`, `consultar` e `confirmar`, atrás de um ponto único de entrada |
| Por que ele serve a este projeto | As três operações têm cargas e permissões diferentes. A consulta é a que mais acontece, na hora do pico, com o trem chegando; o relato e a confirmação são raros. Com funções separadas, cada uma cresce no seu ritmo, e uma falha no relato não derruba a consulta, que é o que a passageira precisa à noite. E o RF-03 exige que a consulta não consiga alterar nenhum relato: isso só é possível porque a consulta é uma função separada, com um papel do IAM só dela. |
| Estilo descartado | Implicit Invocation: a foto chega ao S3, e a chegada dispara sozinha uma função que limpa a foto e grava o relato |
| Por que foi descartado | Por duas razões do cenário. Entre a chegada da foto ao bucket e a limpeza, a foto ficaria guardada com a localização do aparelho no EXIF, o que o RD-01 e o RNF-03 não permitem nem por alguns segundos. E a passageira enviaria o relato sem receber, na mesma resposta, o protocolo ou o campo recusado, que a US-01 cobra nos dois cenários. |

Estilos: Data Flow, Call and Return, Implicit Invocation, Repository, Distributed, Virtual Machines.

## 4. Padrões arquiteturais identificados

| Padrão | Onde ele aparece no meu desenho | O que ele resolve aqui |
|---|---|---|
| API Gateway | O Amazon API Gateway, como porta única das três rotas: `POST /relatos`, `GET /relatos?estacao=` e `POST /confirmacoes` | A página conhece um endereço só, e as funções não precisam cuidar de roteamento. É também o único ponto por onde algo vindo de fora chega à tabela |
| MVC | A página é a visão; as três funções são o controle; o relato, na tabela e no bucket, é o modelo | A regra que recusa "Barra Funda" (RF-05) e a janela de 30 dias ficam no controle. A página pode ser refeita para ser lida em pé, com uma mão (a preocupação de Usability), sem tocar nelas |

Uma pergunta provável: a `consultar` só lê e as outras duas só gravam, cada uma com o seu papel no IAM; isso é CQRS? É a metade dele. Os caminhos de leitura e de gravação estão separados, mas leem e gravam o mesmo modelo, a mesma tabela. CQRS de verdade teria um modelo próprio de leitura, como uma lista por estação já ordenada. Por isso ele não entra na tabela acima.

### 4.1 O padrão que faria falta

**Event Sourcing.** Hoje o relato guarda o estado atual: quantas confirmações recebeu e quando foi a última. A soma esconde o ritmo. Um relato com 9 confirmações pode tê-las recebido todas na primeira semana e nenhuma depois, e o problema pode já ter sido consertado; ou pode ter recebido uma por semana, o que diz que ele continua. Para quem decide por onde andar, essa diferença importa mais do que o total. Com Event Sourcing, cada confirmação seria guardada como um acontecimento, com a data, sem apagar nenhum, e o número exibido seria a soma deles. A consulta poderia mostrar "confirmado 3 vezes na última semana", e uma rajada de confirmações no mesmo dia, o sinal de fraude que o RNF-04 só desacelera, ficaria visível.

Ele entraria na função `confirmar`, que passaria a gravar um item por confirmação na partição da estação, e na `consultar`, que passaria a somá-los. Não entra no desenho porque a consulta passaria a ler um item por confirmação, além de um por relato, e o RNF-01 foi escrito para 300 relatos, não para 300 relatos e milhares de confirmações. O que o desenho atual já consegue mostrar é a data da última confirmação; o ritmo, não.

## 5. Diagrama de arquitetura de ponta a ponta

O diagrama foi feito no Lucidchart e está em [`docs/diagrama.png`](diagrama.png). A mesma versão, em Mermaid, está em [`docs/diagrama.md`](diagrama.md), que o GitHub desenha ao abrir.

### 5.1 Legenda das caixas

| Caixa | Serviço AWS | O que ela faz | Requisito que a justifica |
|---|---|---|---|
| Navegador | — | Mostra o formulário, a consulta e o botão de confirmar; limpa e reduz a foto e gera o código de envio antes de enviar | US-01, US-02, US-03, RNF-02, RNF-03 |
| Site estático | Amazon S3, bucket `cptm-sos-site` | Serve `index.html`, `config.js` e `estacoes.json` | US-01, US-02, US-03 |
| Entrada da API | Amazon API Gateway | Recebe as três rotas e invoca a função certa | US-01, US-02, US-03: é por ela que passam as três rotas |
| Função registrar | AWS Lambda | Valida, deriva o protocolo e grava a foto e o relato, só se o protocolo for novo | RF-01, RF-02, RF-05, RNF-02, RNF-03 |
| Função consultar | AWS Lambda | Faz o `query` na partição da estação, só nos últimos 30 dias, e ordena | RF-03, RNF-01 |
| Função confirmar | AWS Lambda | Soma 1 confirmação, só se o relato tiver até 30 dias e a última tiver mais de 10 minutos | RF-04, RNF-02, RNF-04 |
| Tabela de relatos | Amazon DynamoDB, `cptm-sos-relatos` | Guarda o relato, com `estacao_id` como chave de partição | RF-01, RF-03, RF-04, RNF-01 |
| Bucket de fotos | Amazon S3, `cptm-sos-fotos` | Guarda a foto em `fotos/<estacao_id>/<protocolo>.jpg`, com leitura pelo endereço exato | RF-02, RNF-02 |
| Papéis das funções | AWS IAM | Concede a cada função só o que ela usa: a `consultar` só lê | RF-03 |
| Registros | Amazon CloudWatch Logs | Guarda uma linha por execução, sem dado de quem chamou | RF-05, RNF-03 |

### 5.2 O fluxo de uma requisição

A passageira escolhe a estação na lista, o tipo de problema e a faixa de horário, escreve a descrição, tira ou escolhe a foto e toca em "Enviar relato". Antes de enviar, a página faz duas coisas: redesenha a foto, o que tira dela os metadados EXIF e a reduz para no máximo 1600 pixels no lado maior (RNF-03), e gera um código aleatório para aquele envio, que ela repete se precisar tentar de novo (RNF-02). Envia tudo em um único POST para a rota `/relatos` do API Gateway, com a foto em base64.

O API Gateway invoca a função `registrar`. Ela confere, nesta ordem, a estação na lista aceita, o tipo de problema, a faixa de horário, a foto (presente, com até 2 MB e sem EXIF) e a descrição, se houver, com até 500 caracteres. No primeiro campo recusado, devolve 400 dizendo qual foi, e imprime uma linha com a operação e o nome do campo recusado. O valor recusado não vai para o registro: é texto escrito por quem enviou, e o registro não guarda nada de quem enviou (RF-05 e RNF-03).

Com tudo válido, a função deriva o protocolo do código de envio e confere se ele já existe na tabela. Se existir, é um reenvio: a função não toca na foto nem na tabela e devolve o mesmo protocolo (RNF-02). Se não existir, a foto vai primeiro: ela é gravada no S3, em `fotos/<estacao_id>/<protocolo>.jpg`. Só depois o relato é gravado na tabela, com 0 confirmações, numa gravação condicional que só acontece se o protocolo ainda não existir, o que cobre dois reenvios que cheguem ao mesmo tempo. A ordem é a preocupação de Reliability do FURPS da Sprint 1: não pode existir relato listado apontando para uma foto que nunca subiu. O pior caso no sentido contrário é uma foto sem relato, que nenhuma consulta mostra; e, se a passageira reenviar, a mesma foto é regravada no mesmo endereço.

Com o relato gravado, a função imprime a linha de registro e devolve 201 com o protocolo e o endereço da foto. A página mostra o protocolo e recarrega a consulta da estação: um GET em `/relatos?estacao=BRS`, que chega à função `consultar`. Ela faz um `query` na partição da estação, só com as chaves de ordenação a partir do dia de 30 dias atrás; descarta o que passou de 30 dias na hora exata; ordena por confirmações e, no empate, do mais recente para o mais antigo; e devolve a lista com o endereço de cada foto. Se a lista vier vazia, a página mostra "Nenhum relato nos últimos 30 dias. Isso não quer dizer que a estação seja segura."

A confirmação faz o mesmo caminho até a função `confirmar`, que soma 1 ao relato numa única atualização condicional: a soma só acontece se o relato tiver até 30 dias (RF-04), se a última confirmação tiver mais de 10 minutos (RNF-04) e se o código daquela confirmação não for o da última somada (RNF-02). Se a condição falhar, a função lê o relato para dizer o porquê: expirou, foi confirmado há pouco, ou aquela mesma confirmação já tinha sido somada, e então é um reenvio e a resposta é de sucesso.

### 5.3 O que acontece se uma caixa cair

| Caixa | Efeito da queda | O que o sistema ainda consegue fazer |
|---|---|---|
| Site estático | Ninguém chega pela tela | A API continua respondendo: outro cliente, ou o `curl`, continua relatando, consultando e confirmando |
| Função registrar | Nenhum relato novo entra | A consulta e a confirmação continuam: quem vai embarcar ainda vê o que já foi relatado, que é o que mais importa à noite |
| Função consultar | A passageira não vê os relatos da estação | Relatos e confirmações continuam sendo aceitos e nada se perde; a lista volta quando a função voltar |
| Função confirmar | Nenhuma confirmação é somada | Relato e consulta continuam; a ordem da lista fica parada nos números que já tinha |
| Tabela de relatos | Nada funciona | Nada. As fotos continuam no bucket, com a estação e o protocolo no caminho, mas sem o tipo, a faixa e a descrição: o acervo não se reconstrói a partir delas |
| Bucket de fotos | O relato falha antes de gravar na tabela, porque a foto vai primeiro; as fotos dos relatos existentes não abrem | A consulta continua mostrando os relatos em texto, e a confirmação continua |
| Registros | Some o registro das recusas | Relatar, consultar e confirmar continuam funcionando; o que se perde é a prova do RF-05 e do RNF-03 durante a queda |

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
| Relato | `ultima_confirmacao_em` | texto, data e hora em ISO 8601, UTC | não: só depois da primeira confirmação (RNF-04) |
| Relato | `ultimo_codigo_confirmacao` | texto, UUID gerado pela página para cada confirmação | não: só depois da primeira confirmação (RNF-02) |

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
| A foto do local | Amazon S3, bucket `cptm-sos-fotos`, em `fotos/<estacao_id>/<protocolo>.jpg` | Uma foto chega a 2 MB, e um item do DynamoDB aceita no máximo 400 KB. A tabela guarda só o caminho. O protocolo no nome faz o reenvio regravar a mesma foto, em vez de criar outra (RNF-02) |
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
| RNF-03 | Zero IP, navegador ou EXIF guardados | RNF | Alta |
| RF-04 | Somar uma confirmação a um relato de até 30 dias | RF | Média |
| US-03 | A passageira confirma um relato existente | US | Média |
| RNF-01 | Consulta da estação em até 500 ms no p95 | RNF | Média |
| RNF-02 | Zero duplicados em 5 reenvios do mesmo pedido | RNF | Média |
| RNF-04 | No máximo 1 confirmação por relato a cada 10 minutos | RNF | Baixa |

### 7.1 Distribuição

| Prioridade | Quantidade |
|---|---|
| Alta | 7 |
| Média | 4 |
| Baixa | 1 |

Pouco mais da metade ficou em alta. A prioridade dos requisitos funcionais é a mesma da Sprint 1: o que lá era essencial aqui é alta, e o que era importante aqui é média. A US-03 e o RF-04 falam da mesma coisa, confirmar um relato, e por isso estão na mesma prioridade.

O RNF-03 é o único não funcional em alta, e é porque ele é o RD-01 com número. Sem ele o sistema funciona, mas guarda o IP de quem relatou um lugar onde se sentiu insegura; e um sistema que faz isso não pode ser posto no ar, por melhor que funcione.

O RNF-01 ficou em média, e não em alta: sem ele a consulta continua respondendo, só mais devagar. Ele não custa código, porque quem o sustenta é a chave de partição da seção 6.2; custa só a medição da Sprint 5. O RNF-02 ficou em média porque o sistema funciona sem ele, mas uma estação com relatos duplicados mostra uma ordem errada.

O RNF-04 ficou em baixa porque protege a ordem da lista contra uma fraude que ainda não aconteceu, e que ele só desacelera. No primeiro dia, com poucas passageiras, ninguém sente a falta dele.

Prioridade não é ordem de construção. A US-02 está acima da US-03, porque a consulta é o que dá valor ao sistema; mas a US-03 é construída antes, na ordem que a Sprint 1 definiu (US-01, US-03, US-02), para que já existam relatos com números de confirmações diferentes quando a ordenação da consulta for conferida.

## 8. Recorte de implementação

| Item | Resposta |
|---|---|
| O que será implementado nas Sprints 3 e 4 | Os doze itens do backlog. Na Sprint 3, o caminho da gravação: RF-01, RF-02, RF-05, o RNF-02 do relato e o RNF-03 na função. Na Sprint 4, o que depende de haver o que listar e de existir a página, nesta ordem: RF-04, US-03, o RNF-02 da confirmação e o RNF-04; depois RF-03, US-02 e RNF-01; e a US-01, que só se completa com a página. |
| O que fica especificado e não implementado | Nenhum item do backlog. Continuam fora do escopo, como declarado na Sprint 1: o botão de emergência, a sirene e a localização em tempo real; conta de usuário e autenticação; denúncia de crime ou de pessoa; moderação e remoção de relatos; e o envio dos relatos à operadora. Também fica de fora a consulta por linha, descartada na Sprint 1 e cara pela chave escolhida aqui. |
| Por que este corte | Toda a prioridade alta cabe nas duas sprints, porque é o percurso do roteiro: uma função que grava e uma que consulta, atrás de uma API e de uma página. Os itens de média e de baixa entraram por decisão. A US-03 tem custo: obriga a escrever uma terceira função, `confirmar`, que o roteiro não ensina, e a razão está logo abaixo desta tabela. O RNF-01 não custa código, só medição. O RNF-02 e o RNF-04 custam poucas linhas: condições na gravação, que a própria tabela confere. |

A alternativa mais barata seria declarar a confirmação fora do recorte, e é uma resposta legítima. Optamos por implementar porque a confirmação é o que separa o problema recorrente do caso isolado, que é a razão de ela estar no escopo desde a Sprint 1. Sem ela, todo relato teria 0 confirmações, a consulta sairia do mais recente para o mais antigo, e dez passageiras que passaram pela mesma escada escura gerariam dez relatos soltos.

Antes de a função `registrar` ser escrita, na Sprint 3, a lista de estações precisa ser conferida com a relação oficial das operadoras, como a Sprint 1 já tinha previsto, e cada estação recebe o seu código fixo. A partir daí o código não muda; o nome pode mudar.

## 9. Decisões e alternativas descartadas

| Decisão | Alternativa considerada | Por que não foi escolhida |
|---|---|---|
| Estilo arquitetural: Distributed | Implicit Invocation: a chegada da foto ao S3 dispara a função que limpa a foto e grava o relato | Entre a chegada e a limpeza, a foto ficaria guardada com a localização do aparelho, o que o RD-01 não permite; e a passageira não receberia na mesma resposta o protocolo ou o campo recusado, que a US-01 cobra. |
| Chave de partição: `estacao_id`, o código fixo da estação | O nome da estação como chave de partição | O nome muda: quando uma estação fosse renomeada, os relatos antigos ficariam sob o nome velho, e a consulta pelo nome novo viria vazia numa estação com problemas relatados. |
| Recorte de implementação: os doze itens | Só a prioridade alta, deixando a confirmação especificada e não implementada | Seria mais barato e é legítimo, mas a consulta perderia o que a diferencia de uma lista de reclamações: saber o que se repete. |
| A chave de ordenação começa pelo dia do envio | O protocolo como chave de ordenação, com um filtro de 30 dias depois da leitura | O filtro é aplicado depois de ler: a consulta leria todos os relatos que a estação já teve, desde o primeiro dia, e o tempo cresceria para sempre. O preço desta decisão é um defeito conhecido: um reenvio que atravesse a meia-noite em UTC, 21h em Brasília, cai em outro dia, ganha outra chave e duplica o relato. A janela é de segundos, e fica declarada aqui. |
| O protocolo é derivado do código de envio, por um hash | O protocolo é o próprio código gerado pela página | O protocolo aparece na consulta. Se ele fosse o código, quem o lesse poderia reenviá-lo num outro dia, com outra foto, e a foto nova seria gravada no endereço da foto do relato original. Com o hash, conhecer o protocolo não permite chegar ao código. |
| Contra confirmações repetidas, um intervalo de 10 minutos por relato | Exigir conta, ou guardar um identificador do aparelho, para que cada pessoa confirme uma vez | As duas identificam quem participa e contrariam o RD-01. O intervalo não impede a fraude: torna-a lenta. Quem quiser inflar um relato ainda consegue, com paciência; esse é o risco que sobra, e ele está escrito. |
| A página limpa a foto, e a função só confere | A função limpa a foto, com uma biblioteca de imagens | A biblioteca precisaria ser empacotada com a função, o que o percurso das Sprints 3 e 4 não cobre. A página já precisa redesenhar a foto para reduzi-la, e redesenhar tira o EXIF de graça. A função não confia nisso: confere a ausência do EXIF e recusa a foto que o tiver. |
| A foto tem leitura pública pelo endereço exato | Endereço temporário assinado, gerado pela função `consultar` | Assinar exige que a `consultar` tenha permissão no S3, e o RF-03 a limita a ler a tabela. A foto já é conteúdo público por definição (RF-02), e não carrega dado de ninguém (RNF-03). O que não é público é listar o bucket, gravar ou apagar. |
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

Pendente: registrado aqui depois do retorno da equipe revisora.
