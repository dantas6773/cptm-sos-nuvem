# Documento de Validação

Entregável da Sprint 5, no formato do Template 3. As seções têm os mesmos números do template.

Projeto: CPTM SOS · Relatos por estação\
Cenário oficial escolhido: nenhum; ideia própria da equipe, aprovada pela professora\
Data: 05/11/2026\
Versão: 1.0

> Os testes foram rodados em 05/11/2026, a partir do ambiente vazio, e as saídas abaixo são as dessa execução. Continuam marcados com `[preencher: ...]` só o que depende de pessoas: as duas homologações (seções 5 e 6) e o fechamento (seção 8).

## 1. Reconstrução do ambiente

| Item | Resposta |
|---|---|
| Tempo do `deploy.sh` a partir do ambiente vazio | 46,6 s (`./infra/deploy.sh  9.94s user 3.14s system 28% cpu 46.582 total`), captura E5.3 |
| Foi necessário algum comando fora do script | não |
| Se sim, qual e por quê | não se aplica: o deploy rodou sem nenhum comando digitado à mão e terminou em "aplicacao no ar" |

O ambiente vazio é o de `./infra/destroy.sh` seguido de `lstk stop` e `lstk start`. O LocalStack começa vazio a cada `lstk start`.

## 2. Critérios de aceite executados

Os seis critérios são os da seção 5 do documento da Sprint 1 ([`docs/01-requisitos.md`](01-requisitos.md)). Cada um virou um bloco de [`testes/executar.sh`](../testes/executar.sh), que chama a API pelo `curl`. Os relatos com 45 e 31 dias são gravados direto no DynamoDB, porque a API só grava relatos com a data de hoje; os outros passam só pela API.

| # | Cenário BDD, em uma linha | Como foi executado | Resultado |
|---|---|---|---|
| C1 | US-01, cenário 1: relato válido de Brás, com foto, devolve protocolo e endereço, a foto abre e o relato nasce com 0 confirmações | `POST /relatos`, depois `GET` no endereço da foto e leitura do item (verificações `US-01-c1`) | passou |
| C2 | US-01, cenário 2: estação "Barra Funda", fora da lista, é recusada, nada é gravado e 1 recusa aparece no CloudWatch Logs sem dado de quem enviou | `POST /relatos`, contagem de itens e de fotos antes e depois, leitura do log (`US-01-c2`) | passou |
| C3 | US-02, cenário 1: Tatuapé lista 4 relatos de até 30 dias, na ordem 5-2-2-0, com o mais recente à frente no empate, e sem o de 45 dias | 5 itens gravados no DynamoDB e `GET /relatos?estacao=TTP` (`US-02-c1`) | passou |
| C4 | US-02, cenário 2: Botujuru, sem relatos, devolve 200 com total 0 e a página mostra a mensagem de lista vazia | `GET /relatos?estacao=BTJ` e busca da mensagem em `app/site/index.html` (`US-02-c2`) | passou |
| C5 | US-03, cenário 1: confirmar o relato A da Luz o leva de 2 para 3 e o B continua com 2 | `POST /confirmacoes` e leitura dos dois itens (`US-03-c1`) | passou |
| C6 | US-03, cenário 2: relato de 31 dias com 4 confirmações é recusado com a mensagem de expirado e continua com 4 | `POST /confirmacoes` em um item gravado no DynamoDB com 31 dias (`US-03-c2`) | passou |

Resultado: passou, falhou ou não verificável.

### 2.1 Saída do script

```
Testes de aceite · Sprint 5 · API: http://xjxuvdvgmj.execute-api.localhost.localstack.cloud:4566/dev
Preparando: apagando os relatos de TTP, LUZ e BTJ

US-01, cenário 1: relato válido de Brás, com foto de 2 MB no máximo
  OK      US-01-c1  o envio devolve 201 (esperado: 201)
  OK      US-01-c1  devolve um protocolo de 16 caracteres (esperado: 16)
  OK      US-01-c1  a foto abre pelo endereço devolvido (esperado: 200)
  OK      US-01-c1  o sistema passa a ter 1 relato a mais (esperado: 1)
  OK      US-01-c1  o relato novo tem 0 confirmações (esperado: 0)

US-01, cenário 2: estação "Barra Funda", fora da lista aceita
  OK      US-01-c2  o envio devolve 400 (esperado: 400)
  OK      US-01-c2  o campo recusado é a estação (esperado: estacao)
  OK      US-01-c2  a mensagem diz que a estação não foi reconhecida (esperado: True)
  OK      US-01-c2  nenhum relato novo (esperado: 1)
  OK      US-01-c2  nenhuma foto nova (esperado: 1)
  OK      US-01-c2  1 registro da recusa no CloudWatch Logs (esperado: 1)
  OK      US-01-c2  o registro não leva dado de quem enviou (nem o nome digitado) (esperado: 0)

US-02, cenário 1: Tatuapé, 4 relatos recentes (5, 2, 2 e 0) e 1 de 45 dias
  OK      US-02-c1  a consulta devolve 200 (esperado: 200)
  OK      US-02-c1  a lista traz exatamente 4 relatos (esperado: 4)
  OK      US-02-c1  ordem por confirmações (esperado: 5 2 2 0)
  OK      US-02-c1  no empate, o mais recente vem à frente (esperado: a1 a2 a3 a4)
  OK      US-02-c1  o relato de 45 dias não aparece (esperado: False)

US-02, cenário 2: Botujuru, sem relatos nos últimos 30 dias
  OK      US-02-c2  a consulta devolve 200, e não erro (esperado: 200)
  OK      US-02-c2  a lista tem 0 relatos (esperado: 0)
  OK      US-02-c2  a página tem a mensagem de lista vazia (esperado: sim)

US-03, cenário 1: Luz, dois relatos com 2 confirmações; confirma o A
  OK      US-03-c1  a confirmação devolve 200 (esperado: 200)
  OK      US-03-c1  A passa de 2 para 3 (esperado: 3)
  OK      US-03-c1  B continua com 2 (esperado: 2)

US-03, cenário 2: relato de 31 dias com 4 confirmações
  OK      US-03-c2  a confirmação é recusada (409) (esperado: 409)
  OK      US-03-c2  a mensagem diz que o relato expirou (esperado: True)
  OK      US-03-c2  o relato continua com 4 (esperado: 4)

RNF-01: 5 reenvios do mesmo relato gravam 1 só
  OK      RNF-01  o primeiro envio devolve 201 (esperado: 201)
  OK      RNF-01  os 5 reenvios devolvem 200 (esperado: 5)
  OK      RNF-01  os 5 reenvios devolvem o mesmo protocolo (esperado: 5)
  OK      RNF-01  a estação ganha exatamente 1 relato (esperado: 10)
  OK      RNF-01  e exatamente 1 foto (esperado: 1)

RNF-02: o público só lê a foto, pelo endereço exato
  OK      RNF-02  a política tem 1 única permissão (esperado: 1)
  OK      RNF-02  a única ação é s3:GetObject (esperado: s3:GetObject)
  OK      RNF-02  ela vale para o público (Principal *) (esperado: True)
  OK      RNF-02  e só para o que está em fotos/ (esperado: arn:aws:s3:::cptm-sos-fotos/fotos/*)
  OK      RNF-02  nenhuma ação de listar, gravar ou apagar (esperado: 0)

RF-03: o papel da função consultar só lê o DynamoDB
  OK      RF-03  nenhuma ação de gravar, atualizar ou apagar, nem curinga (esperado: 0)

RNF-05: 10 envios inválidos deixam 10 linhas no CloudWatch Logs em até 10 s
  OK      RNF-05  exatamente 10 linhas de recusa (esperado: 10)
  OK      RNF-05  visíveis em até 10 segundos (levou 1 s, contando os 10 envios) (esperado: sim)

RNF-04: 5 reenvios da mesma confirmação somam 1 (fora do recorte)
  FORA DO RECORTE  RNF-04  os 5 reenvios somaram 5, e não 1: o código da confirmação não foi implementado (docs/02-arquitetura.md, seção 8)

passaram: 39
falharam: 0
fora do recorte, documentados: 1
```

Na primeira tentativa, `./testes/executar.sh` não rodou ("permission denied"): os roteiros `executar.sh` e `medir.sh` tinham ido para o repositório sem a permissão de execução. A permissão foi corrigida no próprio repositório (`git update-index --chmod=+x`), e a saída acima é a da execução seguinte, sem nenhuma outra mudança.

### 2.2 Cenários não verificáveis por script

Nenhum cenário deixou de virar comando. Duas partes dos critérios são verificadas de forma indireta:

- **C4, "a tela exibe a mensagem":** o script confere a resposta da API (200, total 0) e que a mensagem exata está no código da página. Que ela aparece na tela é conferido no navegador, abrindo a página com a Botujuru na consulta: sim, a página mostra "Botujuru: 0 relatos. Nenhum relato nos últimos 30 dias. Isso não quer dizer que a estação seja segura." ([captura](evidencias/C4-botujuru-vazia.png), feita no WebKit, o motor do Safari).
- **C2, "sem nenhum dado de quem enviou":** o script confere que o nome digitado ("Barra Funda") não está nas linhas do registro. O registro da função só leva protocolo, estação e campo recusado, o que se confere também lendo `app/gravar/handler.py`.

## 3. Requisitos não funcionais medidos

Os valores declarados são os da seção 1 do documento da Sprint 2 ([`docs/02-arquitetura.md`](02-arquitetura.md)). A Sprint 2 declarou cinco requisitos não funcionais, e não quatro, por orientação da professora (15/10/2026): um para cada requisito funcional.

| ID | Valor declarado na Sprint 2 | Método | Valor obtido | Resultado |
|---|---|---|---|---|
| RNF-01 | com 5 reenvios do mesmo envio, 1 relato, 1 protocolo e 1 foto | demonstração: `executar.sh`, bloco `RNF-01` | 1 relato, 1 protocolo (o mesmo nos 5 reenvios, que devolvem 200) e 1 foto | cumprido |
| RNF-02 | o público só lê a foto pelo endereço exato; 0 ações de listar, gravar ou apagar na política | inspeção: `executar.sh` lê a política do bucket e confere a única permissão | 1 única permissão, `s3:GetObject`, para o público, só em `fotos/*`; 0 ações de listar, gravar ou apagar | cumprido |
| RNF-03 | p95 de até 500 ms, com 300 relatos dos últimos 30 dias na estação e 30 requisições seguidas | medição: `medir.sh` | p95 de 33 ms (mínimo 30, mediana 32, máximo 39), 0 respostas diferentes de 200 | cumprido |
| RNF-04 | com 5 reenvios da mesma confirmação, soma 1 | demonstração: `executar.sh`, bloco `RNF-04` | somou 5 | não cumprido (seção 7) |
| RNF-05 | exatamente 1 linha de recusa por envio inválido no CloudWatch Logs, visível em até 10 segundos, com 10 envios inválidos | demonstração: `executar.sh`, bloco `RNF-05` | 10 linhas para 10 envios, visíveis em 1 s | cumprido |

Método: medição, inspeção, demonstração ou análise.

Resultado: cumprido, cumprido em parte ou não cumprido.

### 3.1 Saída da medição

```
Medição do RNF-03 · API: http://xjxuvdvgmj.execute-api.localhost.localstack.cloud:4566/dev
Preparando: 300 relatos na estação MAU (10 por dia, nos últimos 30 dias)
relatos de MAU na tabela: 300
consultando 30 vezes seguidas: GET /relatos?estacao=MAU

tempos em ms, em ordem: 30 30 30 31 31 31 31 31 31 32 32 32 32 32 32 32 32 32 32 32 32 33 33 33 33 33 33 33 33 39 
respostas diferentes de 200: 0
minimo: 30 ms · mediana: 32 ms · maximo: 39 ms
p95: 33 ms (limite do RNF-03: 500 ms)

OK      RNF-03: p95 de 33 ms, dentro de 500 ms
```

### 3.2 Requisitos verificados por análise

- **RNF-02, a parte "zero ações de listar, gravar ou apagar":** o LocalStack não aplica a política do bucket aos pedidos feitos de fora, então não dá para provar a negação fazendo uma tentativa de listar. O que se prova é o conteúdo da política (uma única permissão, `s3:GetObject`, só em `fotos/*`), e que o S3 real aplica o que a política diz é análise a partir da documentação da AWS. As fichas (`fichas/`) ficam fora da permissão pelo mesmo motivo.
- **RNF-03, o valor obtido:** é medido num emulador, na máquina da equipe. O número não é o da AWS real; vale o método (amostra, aquecimento descartado, percentil, comparação com o valor declarado).
- **RNF-05, o prazo de 10 segundos:** no LocalStack o registro chega quase na hora. Na AWS real o CloudWatch Logs pode levar mais, e esse prazo é análise, e não medição.

## 4. Matriz de rastreabilidade

Toda linha das Sprints 1 e 2 aparece aqui: os 5 requisitos funcionais, os 5 não funcionais e as 3 histórias. "Captura" é a numeração do roteiro de evidências (E3.x, E4.x e E5.x).

| ID | O que foi prometido | Como foi verificado | Evidência | Resultado |
|---|---|---|---|---|
| RF-01 | registrar cada relato enviado ao API Gateway no DynamoDB, com protocolo único e data e hora do envio | teste C1 (`US-01-c1`): 201, protocolo de 16 caracteres, 1 relato a mais | E5.1 (saída do `executar.sh`) | cumprido |
| RF-02 | guardar a foto no S3 e deixar no relato o endereço para vê-la | teste C1: a foto abre pelo endereço devolvido; inspeção do bucket | E5.1; E3.4 / E4.4 (recursos listados) | cumprido |
| RF-03 | listar os relatos da estação dos últimos 30 dias, do mais confirmado ao menos, por função só com permissão de leitura | testes C3 e C4; inspeção do papel IAM da função consultar (`RF-03`) | E5.1 | cumprido |
| RF-04 | somar uma confirmação a um relato de até 30 dias | testes C5 e C6 | E5.1 | cumprido |
| RF-05 | recusar o relato inválido, informar o campo e registrar a recusa no CloudWatch Logs sem dado de quem enviou | teste C2; leitura do registro | E5.1 | cumprido |
| RNF-01 | 5 reenvios do mesmo relato gravam 1 só | demonstração: bloco `RNF-01` | E5.1 | cumprido |
| RNF-02 | o público só lê a foto | inspeção da política do bucket; negação por análise (seção 3.2) | E5.1 | cumprido |
| RNF-03 | consulta em até 500 ms no p95 | medição: `medir.sh` | E5.2 | cumprido |
| RNF-04 | 5 reenvios da mesma confirmação somam 1 | demonstração: bloco `RNF-04` | E5.1 (linha `FORA DO RECORTE`) | não cumprido |
| RNF-05 | 1 linha por recusa no CloudWatch Logs, em até 10 s | demonstração: bloco `RNF-05` | E5.1 | cumprido |
| US-01 | a passageira registra o ponto inseguro com uma foto do local | testes C1 e C2; demonstração na página | E5.1; E4.2 (página no navegador) | cumprido |
| US-02 | a passageira vê os relatos recentes da estação antes de embarcar | testes C3 e C4; demonstração na página | E5.1; E4.2 | cumprido |
| US-03 | a passageira confirma um relato existente | testes C5 e C6 | E5.1 | cumprido |

Resultado: cumprido, cumprido em parte ou não cumprido.

### 4.1 Resumo

| Resultado | Quantidade |
|---|---|
| Cumprido | 12 |
| Cumprido em parte | 0 |
| Não cumprido | 1 (RNF-04) |

Total: 13 linhas.

## 5. Homologação recebida

Equipe homologadora: [preencher]\
Data: [preencher]

| Pergunta | Resposta recebida |
|---|---|
| Conseguiu rodar seguindo só o README? | [preencher] |
| O que faltava no README? | [preencher] |
| Os testes passaram na máquina dela? | [preencher] |
| Alguma linha da matriz não bateu? | [preencher] |
| Em que ponto travou? | [preencher] |

### 5.1 O que foi corrigido depois da homologação

| O que foi apontado | O que foi mudado |
|---|---|
| [preencher, ou "não se aplica: a homologação não apontou nada"] | [preencher] |

## 6. Homologação realizada

Equipe homologada: [preencher]\
Data: [preencher] (captura E5.4)

[preencher: um parágrafo com o que a equipe encontrou no projeto da outra, respondendo às mesmas cinco perguntas da seção 5: se conseguiu rodar só com o README, o que faltava, se os testes passaram (e quantos), se alguma linha da matriz não bateu, e onde travou. Inclua o resultado do `executar.sh` dela, de que a captura E5.4 é a prova.]

## 7. O que não foi cumprido

Estes itens foram declarados como fora do recorte na seção 8 do documento da Sprint 2, e continuam fora.

| Item | Por que ficou de fora | O que seria necessário para cumprir |
|---|---|---|
| RNF-04: o reenvio de uma confirmação soma duas vezes | o recorte das Sprints 3 e 4 tinha de caber no tempo, e esta proteção cobre um caso raro: sinal que cai logo depois do toque | guardar na tabela o código da última confirmação, enviado pela página, e somar só se o código for outro (atualização condicional) |
| Limite de uma confirmação a cada 10 minutos por relato | protege contra abuso deliberado, não contra o uso normal | guardar `ultima_confirmacao_em` (a função já grava o campo) e recusar a soma antes do intervalo |
| Conferência do EXIF na função | a página já limpa a foto; a conferência na função protege só quem envia por fora da página | ler os metadados da imagem na função `registrar` e recusar ou remover a localização |

Escolhemos não identificar quem confirma (RD-01), então o risco de confirmações repetidas continua declarado, como na Sprint 1.

## 8. Fechamento

### 8.1 O que funcionou melhor do que o esperado

[preencher: escreva com as suas palavras, a partir do que você viu rodar.]

### 8.2 O que deu mais trabalho do que o esperado

[preencher.]

### 8.3 O que você faria diferente se recomeçasse

[preencher: uma decisão específica de projeto, e não uma intenção genérica de organização.]

## 9. Repositório

| Item | Resposta |
|---|---|
| URL do repositório | https://github.com/dantas6773/cptm-sos-nuvem |
| Número de commits | 34, contando os que registram esta validação |
| Há pelo menos um commit por sprint | sim: requisitos (Sprint 1), arquitetura (2), provisionamento e função registrar (3), API e página (4), testes e validação (5); a captura E5.5 mostra os commits por integrante |
| Endereço do site depois do deploy | http://cptm-sos-site.s3-website.localhost.localstack.cloud:4566 |
