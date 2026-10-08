# Documento de Requisitos

Entregável da Sprint 1, no formato do Template 1.

Projeto: CPTM SOS · Relatos por estação\
Cenário oficial escolhido: nenhum; ideia própria da equipe, aprovada pela professora\
Data: 08/10/2026\
Versão: 1.1

## 1. O cenário

### 1.1 Cenário escolhido

Ideia própria da equipe, aprovada pela professora. Um registro colaborativo dos pontos das estações de trem metropolitano onde passageiras se sentiram inseguras — a escada sem luz, a passarela vazia, o corredor sem nenhum agente —, com uma foto do local, que qualquer pessoa consulta por estação.

É o recorte de nuvem do [CPTM SOS](https://github.com/dantas6773/cptm-sos), projeto integrador do Ibmec que redesenhou o aplicativo da CPTM a partir de reclamações reais de usuárias e acrescentou a ele um fluxo de emergência.

Nas quatro linhas que todo projeto da disciplina precisa preencher:

| Pergunta | Resposta |
|---|---|
| O que o usuário cadastra | um relato de ponto inseguro, com estação, tipo de problema, faixa de horário e descrição |
| O arquivo que vem junto | a foto do local |
| O campo pelo qual se busca | a estação |
| A pergunta que a tela responde | o que foi relatado nesta estação nos últimos 30 dias |

### 1.2 O problema, em linguagem comum

Quem usa o trem todo dia sabe quais pontos de cada estação evitar: a escada sem luz, a passarela vazia depois das dez da noite, o corredor sem nenhum agente. Esse conhecimento circula entre amigas e grupos de mensagem e não chega a quem passa por ali pela primeira vez; os canais oficiais recebem a reclamação, mas não a mostram a outros passageiros. Quem vai embarcar à noite numa estação que não conhece não tem onde ver o que outras passageiras já perceberam, nem como saber se um problema se repete ou foi um caso isolado.

### 1.3 O recorte

| Dentro do escopo | Fora do escopo |
|---|---|
| Registro de um relato de ponto inseguro em uma estação, com foto do local | Botão de emergência, sirene e localização em tempo real |
| Consulta dos relatos dos últimos 30 dias de uma estação | Conta de usuário e autenticação |
| Confirmação de um relato existente por outra passageira | Denúncia de crime ou de pessoa |
| Recusa de relato sem foto, ou com estação, tipo ou faixa de horário inválidos | Moderação e remoção de relatos, e envio deles à operadora |

### 1.4 Por que este recorte

O CPTM SOS age no momento do perigo: a sirene, o "Me encontre", o "Ligar 190". O que ele não resolve é o antes — saber, antes de chegar, por onde não passar. É essa parte que vem para a nuvem, e é ela que tem a forma que o projeto pede: uma coisa que se cadastra, um arquivo, um campo de busca e uma pergunta que devolve uma lista.

Registrar e consultar vêm juntos porque um não existe sem o outro: a consulta só mostra o que alguém registrou, e ninguém registra o que ninguém vai ler. A foto entra porque o texto não basta para localizar o problema: uma estação como a Brás tem várias escadas, passarelas e acessos, e "a escada escura perto da saída" pode ser qualquer uma delas. A foto mostra qual é, e mostra a condição — a lâmpada apagada, o corredor vazio — melhor do que a descrição. A confirmação entra porque é ela que separa o problema recorrente do caso isolado. Sem ela, dez passageiras que passaram pela mesma escada escura gerariam dez relatos soltos, e quem consulta não teria como saber o que é persistente. Com ela, ficam um relato e nove confirmações, e o que se repete aparece primeiro.

O alarme ficou de fora porque já existe e funciona no app original, e porque acompanhar uma posição em tempo real exige serviços que não estão no percurso da disciplina. A autenticação ficou de fora por exigência, não por economia: um relato identificado afasta justamente quem tem medo de retaliação (RD-01). A denúncia de crime ou de pessoa ficou de fora porque acusa alguém que não está ali para se defender, e porque crime tem canal próprio, a polícia (RD-02 e RD-03). A moderação exigiria uma equipe e um perfil de moderador com login; no lugar dela, a janela de 30 dias limita o alcance de um relato falso, que, sem confirmações, fica no fim da lista e some da consulta depois de 30 dias. O envio dos relatos à operadora exigiria integração com um sistema que não controlamos, e o valor deste recorte está entre as próprias passageiras.

## 2. Requisitos funcionais

| ID | Requisito | Serviço AWS citado | Prioridade |
|---|---|---|---|
| RF-01 | O sistema deve registrar no Amazon DynamoDB cada relato enviado pela página ao Amazon API Gateway, com estação, tipo de problema, faixa de horário e descrição, gerando um protocolo único e guardando a data e a hora do envio. | Amazon API Gateway, Amazon DynamoDB | essencial |
| RF-02 | O sistema deve armazenar no Amazon S3 a foto do local anexada a cada relato aceito, deixando no relato o endereço pelo qual a foto pode ser vista. | Amazon S3 | essencial |
| RF-03 | O sistema deve listar os relatos de uma estação enviados nos últimos 30 dias por uma função AWS Lambda que o AWS IAM autoriza apenas a ler o Amazon DynamoDB, do mais confirmado para o menos confirmado e, no empate, do mais recente para o mais antigo. | AWS Lambda, AWS IAM, Amazon DynamoDB | essencial |
| RF-04 | O sistema deve somar uma confirmação ao relato gravado no Amazon DynamoDB quando uma passageira indicar que o problema continua, desde que o relato tenha sido enviado há no máximo 30 dias. | Amazon DynamoDB | importante |
| RF-05 | O sistema deve recusar, na função AWS Lambda que recebe o envio, um relato sem foto ou com estação, tipo de problema ou faixa de horário fora das listas aceitas, informando qual campo foi recusado e registrando a recusa no Amazon CloudWatch Logs, sem nenhum dado de quem enviou. | AWS Lambda, Amazon CloudWatch Logs | essencial |

Os seis serviços do percurso aparecem nos requisitos, cada um dentro de algo que o sistema faz e que pode ser verificado: o API Gateway recebe o envio (RF-01), o DynamoDB guarda, atualiza e devolve os relatos (RF-01, RF-04 e RF-03), o S3 guarda a foto (RF-02), a função Lambda valida e consulta (RF-03 e RF-05), o IAM garante que a consulta não consegue alterar nenhum relato (RF-03) e o CloudWatch Logs registra as recusas sem identificar ninguém (RF-05, em acordo com o RD-01).

As listas aceitas, que tornam o RF-05 verificável:

- **Estações:** as estações das linhas 7 a 13, cada uma pelo nome oficial. A lista de partida é a que o CPTM SOS já usa, com 97 estações; antes de ser usada, ela será conferida com a relação oficial das operadoras.
- **Tipos de problema:** iluminação precária; área isolada; sem agente de segurança; equipamento de segurança quebrado (câmera, interfone, botão de emergência); outro.
- **Faixas de horário:** madrugada (0h–6h); manhã (6h–12h); tarde (12h–18h); noite (18h–24h).

### 2.1 Verificação da estrutura

| ID | Verbo | Objeto | Condição |
|---|---|---|---|
| RF-01 | registrar | cada relato enviado ao API Gateway | gerando protocolo único e guardando data e hora do envio |
| RF-02 | armazenar | a foto do local | a cada relato aceito, deixando no relato o endereço da foto |
| RF-03 | listar | os relatos de uma estação | dos últimos 30 dias, por uma função autorizada só a ler, do mais confirmado ao menos confirmado |
| RF-04 | somar | uma confirmação ao relato gravado | quando a passageira indicar que o problema continua, se o relato tiver até 30 dias |
| RF-05 | recusar | o envio de um relato inválido | sem foto, ou com estação, tipo ou faixa fora das listas, informando o campo e registrando a recusa sem identificar quem enviou |

## 3. Requisitos de domínio

| ID | Restrição | Origem | O que ela impede ou obriga |
|---|---|---|---|
| RD-01 | O relato é anônimo: o sistema não coleta nome, CPF, e-mail, telefone nem qualquer identificador de quem relata ou confirma. | LGPD, art. 6º, III (princípio da necessidade); e regra do cenário: quem teme retaliação não relata se puder ser identificada. | Impede campos de identificação e a exigência de conta para relatar ou confirmar. |
| RD-02 | O relato trata do local, nunca de uma pessoa: nem o texto nem a foto podem identificar passageiros, funcionários ou suspeitos. | LGPD, art. 5º, I (imagem de pessoa identificável é dado pessoal); Código Penal, arts. 138 a 140 (calúnia, difamação e injúria). | Impede campo para descrever suspeito. Obriga o aviso, no envio, de que a foto deve mostrar o ambiente — escada, corredor, plataforma — e não pessoas. |
| RD-03 | O relato não é pedido de socorro nem registro de crime: ninguém o atende em tempo real. | Regra do cenário: emergência e crime são atribuição da polícia e da segurança da operadora. | Obriga a tela de relato a indicar o 190 para emergência. Impede qualquer mensagem que sugira que o relato aciona alguém. |

## 4. Histórias de usuário

As histórias usam "passageira" porque o projeto nasceu de reclamações de usuárias da CPTM. O sistema serve a qualquer pessoa.

**US-01**\
Como passageira que passou por um trecho da estação onde se sentiu insegura\
Eu quero registrar esse ponto com uma foto do local\
Para que outras passageiras saibam do risco antes de passar por ali

**US-02**\
Como passageira que vai embarcar à noite em uma estação que conhece pouco\
Eu quero ver os relatos recentes dessa estação\
Para que eu decida, antes de chegar, por qual acesso entrar e onde esperar o trem

**US-03**\
Como passageira que encontrou um problema que já estava relatado\
Eu quero confirmar o relato existente\
Para que quem consulta a estação perceba que o problema se repete, e não o confunda com um caso isolado

## 5. Critérios de aceite em BDD

**US-01, cenário 1**\
Dado que o sistema tem 12 relatos gravados, e eu escolho a estação Brás, o tipo "iluminação precária" e a faixa "noite", escrevo uma descrição e anexo uma foto JPEG de 2 MB\
Quando envio o relato\
Então o sistema devolve um protocolo e o endereço da foto, a foto abre por esse endereço, e o sistema passa a ter 13 relatos gravados, o novo com 0 confirmações

**US-01, cenário 2**\
Dado que o sistema tem 12 relatos gravados, e eu informo a estação "Barra Funda", que não está na lista aceita (o nome oficial é "Palmeiras-Barra Funda")\
Quando envio o relato\
Então o sistema recusa o envio, informa que a estação não foi reconhecida, continua com 12 relatos gravados e nenhuma foto nova, e 1 registro da recusa aparece no CloudWatch Logs, sem nenhum dado de quem enviou

**US-02, cenário 1**\
Dado que a estação Tatuapé tem 4 relatos enviados nos últimos 30 dias — com 5, 2, 2 e 0 confirmações — e 1 relato enviado há 45 dias\
Quando consulto a estação Tatuapé\
Então a lista traz exatamente 4 relatos, na ordem de 5, 2, 2 e 0 confirmações, com o mais recente dos dois empatados à frente, e o relato de 45 dias não aparece

**US-02, cenário 2**\
Dado que a estação Botujuru não tem nenhum relato nos últimos 30 dias\
Quando consulto a estação Botujuru\
Então a tela informa 0 relatos e exibe a mensagem "Nenhum relato nos últimos 30 dias. Isso não quer dizer que a estação seja segura."

**US-03, cenário 1**\
Dado que a estação Luz tem 2 relatos recentes, A e B, cada um com 2 confirmações\
Quando confirmo o relato A\
Então A passa a ter 3 confirmações, e B continua com 2

**US-03, cenário 2**\
Dado que um relato da estação Luz foi enviado há 31 dias e tem 4 confirmações\
Quando tento confirmá-lo\
Então o sistema recusa a confirmação, informa que o relato expirou e sugere registrar um relato novo, e o relato continua com 4 confirmações

### 5.1 O cenário de exceção

Metade dos critérios trata exceção, um por história:

- **US-01, cenário 2** trata **valor inválido**: estação fora da lista aceita.
- **US-02, cenário 2** trata **lista vazia**: estação sem relatos na janela de 30 dias.
- **US-03, cenário 2** trata **relato expirado**: tentativa de confirmar um relato com mais de 30 dias.

## 6. Avaliação INVEST

| História | I | N | V | E | S | T | O que seria ajustado |
|---|---|---|---|---|---|---|---|
| US-01 | sim | sim | sim | sim | sim | sim | — |
| US-02 | não | sim | sim | sim | sim | sim | depende de US-01 para ter o que listar, e de US-03 para que a ordem por confirmações possa ser observada |
| US-03 | não | sim | sim | sim | sim | sim | depende de US-01 para ter o que confirmar |

### 6.1 Justificativa das reprovações

As duas reprovações estão no I, de Independent, e nenhuma delas é descuido de escrita: são dependências do próprio problema.

US-03 depende de US-01 porque só se confirma um relato que existe. A dependência só sumiria juntando as duas histórias, e aí uma só somaria cadastro, foto, validação e confirmação — trabalho demais para uma sprint, o que trocaria a reprovação no I por uma no S.

US-02 tem duas dependências, e a segunda é a menos óbvia. Listar exige que existam relatos (US-01). E a ordem pelo número de confirmações, cobrada no cenário 1, só pode ser observada depois que confirmar for possível (US-03): antes disso, todo relato tem 0 confirmações, e a lista sai, na prática, do mais recente para o mais antigo.

Consideramos tirar a ordenação de US-02 e levá-la para US-03, o que deixaria US-02 dependente só de US-01. Descartamos porque a ordenação dá valor à consulta, não à confirmação: quem confirma não olha a lista reordenada; quem consulta, sim. Mantivemos as três histórias e ordenamos o backlog como US-01, US-03, US-02: as duas que gravam vêm antes da que consulta. Assim, quando a consulta for construída, já haverá relatos com números de confirmações diferentes para conferir a ordem.

## 7. Qualidade pelo FURPS

| Categoria | Preocupação principal no meu cenário |
|---|---|
| Functionality | Relato com mais de 30 dias não pode aparecer na consulta nem receber confirmação: informação velha sobre um local que pode já ter sido consertado gera medo sem motivo e afasta passageiras de um caminho que voltou a ser seguro. |
| Usability | A consulta é lida em pé, na plataforma, muitas vezes com uma mão ocupada: tipo do problema, faixa de horário e número de confirmações precisam ser legíveis sem abrir cada relato. |
| Reliability | Boa parte de uma viagem de trem passa por túnel e estação coberta, e o sinal cai. Se o envio falhar no meio e a passageira tentar de novo, o mesmo relato não pode ser gravado duas vezes: relato duplicado infla a estação e distorce a ordem da consulta. |
| Performance | A consulta é feita com o trem chegando e o sinal fraco: se a lista demorar mais do que o trem leva para parar, ela não serve para decidir onde esperar. E uma foto pesada não pode atrasar o texto. |
| Supportability | Estações mudam de nome e de operadora — as linhas 8 e 9, antes da CPTM, hoje são operadas pela ViaMobilidade. Quando o nome de exibição de uma estação mudar, os relatos antigos dela não podem ficar perdidos sob o nome anterior. |

Estas cinco linhas viram os requisitos não funcionais da Sprint 2.

## 8. Decisões e alternativas descartadas

| Decisão | Alternativa considerada | Por que não foi escolhida |
|---|---|---|
| O recorte do cenário | Levar para a nuvem o botão de emergência do CPTM SOS, com alarme e localização em tempo real | Acompanhar posição em tempo real exige serviços que não estão no percurso, e essa parte já existe e funciona no app original. O que falta à passageira não é mais um botão de pânico; é saber onde está o risco antes de precisar dele. |
| O recorte do cenário | Registrar denúncias de assédio e de roubo, como faz o formulário de denúncia do CPTM SOS | Denúncia descreve uma pessoa, e a foto de um suspeito é dado pessoal de alguém que não está ali para se defender (RD-02). Crime tem canal próprio, a polícia. O relato do local diz o mesmo sobre a estação sem acusar ninguém. |
| Onde citar os serviços da AWS | Citar só o mínimo do template, S3 e DynamoDB | Na devolutiva de 08/10/2026, a professora orientou que os cinco requisitos citem os seis serviços do percurso. Cada um entrou onde muda algo verificável — o IAM, por exemplo, aparece como a garantia de que a consulta não altera relatos —, e o verbo de cada requisito continua sendo o que o sistema faz, nunca "usar". |
| Quais cinco requisitos | Trocar a confirmação (RF-04) pela marcação de um relato como resolvido, feita pela segurança da estação | Marcar como resolvido exige saber quem é agente, o que pede autenticação, fora do escopo; sem ela, qualquer pessoa poderia apagar um alerta verdadeiro. A janela de 30 dias resolve o envelhecimento sem depender de alguém lembrar de fechar o relato. |
| Qual caso de exceção | Tratar só a falta da foto, um caso de dado ausente | Foto ausente continua coberta pelo RF-05, mas é o erro mais fácil de evitar na própria tela. O erro mais provável aqui é o nome da estação: a mesma estação tem vários nomes no uso comum ("Barra Funda" e "Palmeiras-Barra Funda"), e aceitar qualquer texto espalharia os relatos de um mesmo lugar sob nomes diferentes, e a consulta perderia relatos. Daí o valor inválido. A lista vazia entrou porque, numa consulta sobre segurança, "nenhum relato" é facilmente lido como "estação segura". |
| O campo pelo qual se consulta | Consultar por linha, e não por estação | A passageira decide por onde andar dentro de uma estação, não de uma linha: a Linha 11 tem 16 estações, e a consulta traria relatos de lugares por onde ela não vai passar. E a Brás atende três linhas: por linha, os relatos dela ficariam divididos em três consultas. |
| Confirmação sem identificar quem confirma | Exigir conta, ou guardar um identificador do aparelho, para impedir que a mesma pessoa confirme várias vezes | As duas opções identificam quem participa e contrariam o RD-01. Aceitamos o risco de confirmações repetidas e o declaramos aqui; ele volta na Sprint 2 como requisito não funcional. |

## 9. Revisão cruzada recebida

Revisado por: pendente, a revisão acontece na aula de 08/10/2026\
Data: 08/10/2026

| Pergunta | Resposta da equipe revisora |
|---|---|
| Algum requisito está escrito como decisão de arquitetura? | pendente — preenchido com a resposta da equipe revisora em 08/10/2026 |
| Algum "para que" é circular? | pendente — preenchido com a resposta da equipe revisora em 08/10/2026 |
| Algum cenário BDD cobre só o caminho feliz? | pendente — preenchido com a resposta da equipe revisora em 08/10/2026 |
| Alguma história falha no S do INVEST? | pendente — preenchido com a resposta da equipe revisora em 08/10/2026 |

### 9.1 O que foi ajustado depois da revisão

Ajuste após a devolutiva da professora (08/10/2026): os requisitos funcionais passaram a citar os seis serviços do percurso — API Gateway e DynamoDB no RF-01, S3 no RF-02, Lambda, IAM e DynamoDB no RF-03, DynamoDB no RF-04, Lambda e CloudWatch Logs no RF-05 — todo requisito cita ao menos um serviço. O critério US-01, cenário 2, passou a conferir o registro da recusa no CloudWatch Logs. Versão do documento: 1.1.

Ajustes da revisão cruzada: pendente, registrados aqui depois do retorno da equipe revisora.
