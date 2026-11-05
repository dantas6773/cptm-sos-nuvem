# Documento de Validação

Entregável da Sprint 5, no formato do Template 3. As seções têm os mesmos números do template.

Projeto: CPTM SOS · Relatos por estação\
Cenário oficial escolhido: nenhum; ideia própria da equipe, aprovada pela professora\
Data: [preencher: data em que os testes foram rodados]\
Versão: 1.0

> Rascunho. O que depende de uma execução está marcado com `[preencher: ...]` e sai das capturas E5.1 a E5.5 e das saídas dos roteiros. O resto já está escrito a partir dos documentos das Sprints 1 a 4.

## 1. Reconstrução do ambiente

| Item | Resposta |
|---|---|
| Tempo do `deploy.sh` a partir do ambiente vazio | [preencher: a linha `real` de `time ./infra/deploy.sh`, captura E5.3] |
| Foi necessário algum comando fora do script | [preencher: sim ou não] |
| Se sim, qual e por quê | [preencher, ou "não se aplica: o deploy rodou sem nenhum comando digitado à mão"] |

O ambiente vazio é o de `./infra/destroy.sh` seguido de `lstk stop` e `lstk start`. O LocalStack começa vazio a cada `lstk start`.

## 2. Critérios de aceite executados

Os seis critérios são os da seção 5 do documento da Sprint 1 ([`docs/01-requisitos.md`](01-requisitos.md)). Cada um virou um bloco de [`testes/executar.sh`](../testes/executar.sh), que chama a API pelo `curl`. Os relatos com 45 e 31 dias são gravados direto no DynamoDB, porque a API só grava relatos com a data de hoje; os outros passam só pela API.

| # | Cenário BDD, em uma linha | Como foi executado | Resultado |
|---|---|---|---|
| C1 | US-01, cenário 1: relato válido de Brás, com foto, devolve protocolo e endereço, a foto abre e o relato nasce com 0 confirmações | `POST /relatos`, depois `GET` no endereço da foto e leitura do item (verificações `US-01-c1`) | [preencher: passou / falhou] |
| C2 | US-01, cenário 2: estação "Barra Funda", fora da lista, é recusada, nada é gravado e 1 recusa aparece no CloudWatch Logs sem dado de quem enviou | `POST /relatos`, contagem de itens e de fotos antes e depois, leitura do log (`US-01-c2`) | [preencher] |
| C3 | US-02, cenário 1: Tatuapé lista 4 relatos de até 30 dias, na ordem 5-2-2-0, com o mais recente à frente no empate, e sem o de 45 dias | 5 itens gravados no DynamoDB e `GET /relatos?estacao=TTP` (`US-02-c1`) | [preencher] |
| C4 | US-02, cenário 2: Botujuru, sem relatos, devolve 200 com total 0 e a página mostra a mensagem de lista vazia | `GET /relatos?estacao=BTJ` e busca da mensagem em `app/site/index.html` (`US-02-c2`) | [preencher] |
| C5 | US-03, cenário 1: confirmar o relato A da Luz o leva de 2 para 3 e o B continua com 2 | `POST /confirmacoes` e leitura dos dois itens (`US-03-c1`) | [preencher] |
| C6 | US-03, cenário 2: relato de 31 dias com 4 confirmações é recusado com a mensagem de expirado e continua com 4 | `POST /confirmacoes` em um item gravado no DynamoDB com 31 dias (`US-03-c2`) | [preencher] |

Resultado: passou, falhou ou não verificável.

### 2.1 Saída do script

```
[preencher: cole aqui a saída completa de ./testes/executar.sh, com as linhas
finais "passaram:" e "falharam:". É a captura E5.1 (captura de tela 12).]
```

### 2.2 Cenários não verificáveis por script

Nenhum cenário deixou de virar comando. Duas partes dos critérios são verificadas de forma indireta:

- **C4, "a tela exibe a mensagem":** o script confere a resposta da API (200, total 0) e que a mensagem exata está no código da página. Que ela aparece na tela é conferido no navegador, abrindo a página com a Botujuru: [preencher: sim ou não, e a captura].
- **C2, "sem nenhum dado de quem enviou":** o script confere que o nome digitado ("Barra Funda") não está nas linhas do registro. O registro da função só leva protocolo, estação e campo recusado, o que se confere também lendo `app/gravar/handler.py`.

## 3. Requisitos não funcionais medidos

Os valores declarados são os da seção 1 do documento da Sprint 2 ([`docs/02-arquitetura.md`](02-arquitetura.md)). A Sprint 2 declarou cinco requisitos não funcionais, e não quatro, por orientação da professora (15/10/2026): um para cada requisito funcional.

| ID | Valor declarado na Sprint 2 | Método | Valor obtido | Resultado |
|---|---|---|---|---|
| RNF-01 | com 5 reenvios do mesmo envio, 1 relato, 1 protocolo e 1 foto | demonstração: `executar.sh`, bloco `RNF-01` | [preencher] | [preencher] |
| RNF-02 | o público só lê a foto pelo endereço exato; 0 ações de listar, gravar ou apagar na política | inspeção: `executar.sh` lê a política do bucket e confere a única permissão | [preencher] | [preencher] |
| RNF-03 | p95 de até 500 ms, com 300 relatos dos últimos 30 dias na estação e 30 requisições seguidas | medição: `medir.sh` | [preencher: p95 em ms] | [preencher] |
| RNF-04 | com 5 reenvios da mesma confirmação, soma 1 | demonstração: `executar.sh`, bloco `RNF-04` | [preencher: quanto somou] | não cumprido (seção 7) |
| RNF-05 | exatamente 1 linha de recusa por envio inválido no CloudWatch Logs, visível em até 10 segundos, com 10 envios inválidos | demonstração: `executar.sh`, bloco `RNF-05` | [preencher: linhas e segundos] | [preencher] |

Método: medição, inspeção, demonstração ou análise.

Resultado: cumprido, cumprido em parte ou não cumprido.

### 3.1 Saída da medição

```
[preencher: cole aqui a saída de ./testes/medir.sh, com o p95. É a captura E5.2.]
```

### 3.2 Requisitos verificados por análise

- **RNF-02, a parte "zero ações de listar, gravar ou apagar":** o LocalStack não aplica a política do bucket aos pedidos feitos de fora, então não dá para provar a negação fazendo uma tentativa de listar. O que se prova é o conteúdo da política (uma única permissão, `s3:GetObject`, só em `fotos/*`), e que o S3 real aplica o que a política diz é análise a partir da documentação da AWS. As fichas (`fichas/`) ficam fora da permissão pelo mesmo motivo.
- **RNF-03, o valor obtido:** é medido num emulador, na máquina da equipe. O número não é o da AWS real; vale o método (amostra, aquecimento descartado, percentil, comparação com o valor declarado).
- **RNF-05, o prazo de 10 segundos:** no LocalStack o registro chega quase na hora. Na AWS real o CloudWatch Logs pode levar mais, e esse prazo é análise, e não medição.

## 4. Matriz de rastreabilidade

Toda linha das Sprints 1 e 2 aparece aqui: os 5 requisitos funcionais, os 5 não funcionais e as 3 histórias. "Captura" é a numeração do roteiro de evidências (E3.x, E4.x e E5.x).

| ID | O que foi prometido | Como foi verificado | Evidência | Resultado |
|---|---|---|---|---|
| RF-01 | registrar cada relato enviado ao API Gateway no DynamoDB, com protocolo único e data e hora do envio | teste C1 (`US-01-c1`): 201, protocolo de 16 caracteres, 1 relato a mais | E5.1 (saída do `executar.sh`) | [preencher] |
| RF-02 | guardar a foto no S3 e deixar no relato o endereço para vê-la | teste C1: a foto abre pelo endereço devolvido; inspeção do bucket | E5.1; E3.4 / E4.4 (recursos listados) | [preencher] |
| RF-03 | listar os relatos da estação dos últimos 30 dias, do mais confirmado ao menos, por função só com permissão de leitura | testes C3 e C4; inspeção do papel IAM da função consultar (`RF-03`) | E5.1 | [preencher] |
| RF-04 | somar uma confirmação a um relato de até 30 dias | testes C5 e C6 | E5.1 | [preencher] |
| RF-05 | recusar o relato inválido, informar o campo e registrar a recusa no CloudWatch Logs sem dado de quem enviou | teste C2; leitura do registro | E5.1 | [preencher] |
| RNF-01 | 5 reenvios do mesmo relato gravam 1 só | demonstração: bloco `RNF-01` | E5.1 | [preencher] |
| RNF-02 | o público só lê a foto | inspeção da política do bucket; negação por análise (seção 3.2) | E5.1 | [preencher] |
| RNF-03 | consulta em até 500 ms no p95 | medição: `medir.sh` | E5.2 | [preencher] |
| RNF-04 | 5 reenvios da mesma confirmação somam 1 | demonstração: bloco `RNF-04` | E5.1 (linha `FORA DO RECORTE`) | não cumprido |
| RNF-05 | 1 linha por recusa no CloudWatch Logs, em até 10 s | demonstração: bloco `RNF-05` | E5.1 | [preencher] |
| US-01 | a passageira registra o ponto inseguro com uma foto do local | testes C1 e C2; demonstração na página | E5.1; E4.2 (página no navegador) | [preencher] |
| US-02 | a passageira vê os relatos recentes da estação antes de embarcar | testes C3 e C4; demonstração na página | E5.1; E4.2 | [preencher] |
| US-03 | a passageira confirma um relato existente | testes C5 e C6 | E5.1 | [preencher] |

Resultado: cumprido, cumprido em parte ou não cumprido.

### 4.1 Resumo

| Resultado | Quantidade |
|---|---|
| Cumprido | [preencher] |
| Cumprido em parte | [preencher] |
| Não cumprido | [preencher: no mínimo 1, o RNF-04] |

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
| Número de commits | [preencher: `git rev-list --count HEAD`] |
| Há pelo menos um commit por sprint | [preencher: sim ou não, conferindo `git log --oneline`; a captura E5.5 mostra os commits por integrante] |
| Endereço do site depois do deploy | http://cptm-sos-site.s3-website.localhost.localstack.cloud:4566 |
