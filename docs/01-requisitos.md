# Documento de Requisitos

Entregável da Sprint 1, no formato do Template 1.

Projeto: CPTM SOS · Relatos por estação\
Cenário oficial escolhido: nenhum; ideia própria da equipe\
Data: 07/10/2026\
Versão: 1.1 (conferência interna dos critérios da Sprint 1)

## 1. O cenário

### 1.1 Cenário escolhido

Ideia própria da equipe. A versão anterior registra aprovação pela professora; a confirmação desse registro pela equipe permanece pendente, pois não há evidência anexada neste repositório.

Um registro colaborativo dos pontos das estações de trem metropolitano onde passageiras se sentiram inseguras — a escada sem luz, a passarela vazia, o corredor sem nenhum agente —, com uma foto do local, que qualquer pessoa consulta por estação.

É o recorte de nuvem do [CPTM SOS](https://github.com/dantas6773/cptm-sos), projeto integrador do Ibmec que redesenhou o aplicativo da CPTM a partir de reclamações reais de usuárias e acrescentou a ele um fluxo de emergência.

Nas quatro linhas que todo projeto da disciplina precisa preencher:

| Pergunta | Resposta |
|---|---|
| O que o usuário cadastra | um relato de ponto inseguro, com estação, tipo de problema, faixa de horário e descrição |
| O arquivo que vem junto | a foto do local |
| O campo pelo qual se busca | a estação |
| A pergunta que a tela responde | o que foi relatado nesta estação nos últimos 30 dias |

### 1.2 O problema, em linguagem comum

Quem usa o trem pode encontrar escadas sem luz, passarelas vazias e corredores sem agentes.\
O conhecimento desses pontos circula entre amigas e grupos de mensagem, mas pode não chegar a quem visita a estação pela primeira vez.\
Quem vai embarcar à noite precisa conhecer os problemas percebidos por outras passageiras antes de escolher por onde passar.\
Também precisa distinguir um problema que continua acontecendo de uma ocorrência isolada.

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
| RF-01 | O sistema deve registrar um relato com estação, tipo de problema, faixa de horário e descrição, gerando um protocolo único e guardando a data e a hora do envio. | — | essencial |
| RF-02 | O sistema deve armazenar a foto do local no Amazon S3 a cada relato aceito, deixando no relato o endereço pelo qual a foto pode ser vista. | Amazon S3 | essencial |
| RF-03 | O sistema deve listar os relatos de uma estação enviados nos últimos 30 dias consultando o Amazon DynamoDB, do mais confirmado para o menos confirmado e, no empate, do mais recente para o mais antigo. | Amazon DynamoDB | essencial |
| RF-04 | O sistema deve somar uma confirmação a um relato quando uma passageira indicar que o problema continua, desde que o relato tenha sido enviado há no máximo 30 dias. | — | importante |
| RF-05 | O sistema deve recusar o envio de um relato sem foto, ou com estação, tipo de problema ou faixa de horário fora das listas aceitas, informando qual campo foi recusado. | — | essencial |

As listas aceitas, que tornam o RF-05 verificável:

- **Estações:** as estações das linhas 7 a 13, cada uma pelo nome oficial. A lista de partida é a que o CPTM SOS já usa, com 97 estações; antes de ser usada, ela será conferida com a relação oficial das operadoras.
- **Tipos de problema:** iluminação precária; área isolada; sem agente de segurança; equipamento de segurança quebrado (câmera, interfone, botão de emergência); outro.
- **Faixas de horário:** madrugada (0h–6h); manhã (6h–12h); tarde (12h–18h); noite (18h–24h).

### 2.1 Verificação da estrutura

| ID | Verbo | Objeto | Condição |
|---|---|---|---|
| RF-01 | registrar | um relato com estação, tipo de problema, faixa de horário e descrição | gerando protocolo único e guardando data e hora do envio |
| RF-02 | armazenar | a foto do local | no Amazon S3 a cada relato aceito, deixando no relato o endereço pelo qual a foto pode ser vista |
| RF-03 | listar | os relatos de uma estação | enviados nos últimos 30 dias, consultando o Amazon DynamoDB, por confirmações decrescentes e, no empate, do mais recente ao mais antigo |
| RF-04 | somar | uma confirmação a um relato | quando a passageira indicar que o problema continua, se o relato tiver até 30 dias |
| RF-05 | recusar | o envio de um relato inválido | sem foto, ou com estação, tipo ou faixa fora das listas, informando o campo recusado |

## 3. Requisitos de domínio

| ID | Restrição | Origem | O que ela impede ou obriga |
|---|---|---|---|
| RD-01 | O relato é anônimo: o sistema não coleta nome, CPF, e-mail, telefone nem qualquer identificador de quem relata ou confirma. | Regra do projeto: preservar a participação de quem teme retaliação. A ausência de autenticação é uma decisão do recorte, não uma obrigação legal demonstrada neste documento. | Impede campos de identificação e a exigência de conta para relatar ou confirmar. |
| RD-02 | O relato trata do local, nunca de uma pessoa: nem o texto nem a foto podem identificar passageiros, funcionários ou suspeitos. | Regra do projeto: restringir o conteúdo ao ambiente e evitar exposição ou acusação de pessoas. Não se atribui esta proibição absoluta a uma obrigação legal específica sem validação jurídica. | Impede campo para descrever suspeito. Obriga o aviso, no envio, de que a foto deve mostrar o ambiente — escada, corredor, plataforma — e não pessoas. |
| RD-03 | O relato não é pedido de socorro nem registro de crime: ninguém o atende em tempo real. | Regra do projeto: o serviço compartilha informações preventivas e não oferece atendimento de emergência nem registro policial. | Obriga a tela de relato a indicar o 190 para emergência. Impede qualquer mensagem que sugira que o relato aciona alguém. |

As três restrições acima são regras do projeto. A versão anterior citava dispositivos legais como origem; esta conferência não valida sua aplicabilidade nem declara conformidade jurídica. Eventuais obrigações legais precisam de análise própria, sem confundi-las com as escolhas deste recorte.

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
Dado que o sistema tem 12 relatos gravados, e eu informo a estação "Barra Funda", que não está na lista aceita (o nome oficial é "Palmeiras-Barra Funda"), com tipo "iluminação precária", faixa "noite", descrição preenchida e foto JPEG de 2 MB\
Quando envio o relato\
Então o sistema recusa o envio, informa que a estação não foi reconhecida, e continua com 12 relatos gravados e 0 fotos novas

**US-02, cenário 1**\
Dado que a estação Tatuapé tem 4 relatos enviados nos últimos 30 dias — com 5, 2, 2 e 0 confirmações; os dois com 2 confirmações foram enviados há 3 e 10 dias — e 1 relato enviado há 45 dias\
Quando consulto a estação Tatuapé\
Então a lista traz exatamente 4 relatos, na ordem de 5, 2, 2 e 0 confirmações, com o relato de 3 dias à frente do de 10 dias no empate, e o relato de 45 dias não aparece

**US-02, cenário 2**\
Dado que a estação Botujuru não tem nenhum relato nos últimos 30 dias\
Quando consulto a estação Botujuru\
Então a tela informa 0 relatos e exibe a mensagem "Nenhum relato nos últimos 30 dias. Isso não quer dizer que a estação seja segura."

**US-03, cenário 1**\
Dado que a estação Luz tem 2 relatos, A e B, enviados há 5 dias, cada um com 2 confirmações\
Quando confirmo o relato A\
Então A passa a ter 3 confirmações, e B continua com 2

**US-03, cenário 2**\
Dado que um relato da estação Luz foi enviado há 31 dias e tem 4 confirmações\
Quando tento confirmá-lo\
Então o sistema recusa a confirmação, informa que o relato expirou e sugere registrar um relato novo, e o relato continua com 4 confirmações

### 5.1 Identificação dos cenários de exceção

Metade dos critérios trata exceção, um por história:

- **US-01, cenário 2** trata **valor inválido**: estação fora da lista aceita.
- **US-02, cenário 2** trata **lista vazia**: estação sem relatos na janela de 30 dias.
- **US-03, cenário 2** trata **relato expirado**: tentativa de confirmar um relato com mais de 30 dias.

## 6. Avaliação INVEST

I = independente; N = negociável; V = valiosa; E = estimável; S = pequena; T = testável. Os “sim” são avaliações documentais preliminares: E e S devem ser confirmados pela equipe conforme sua capacidade, sem afirmar que já houve estimativa de esforço.

| História | I | N | V | E | S | T | O que seria ajustado |
|---|---|---|---|---|---|---|---|
| US-01 | sim | sim | sim | sim | sim | sim | confirmar estimativa e tamanho; decompor em tarefas de validação, foto e registro sem criar novas histórias nesta entrega |
| US-02 | não | sim | sim | sim | sim | sim | depende dos relatos de US-01 no fluxo integrado; US-03 fornece confirmações em uso real; tratar com a ordem registrada e dados de teste, conforme 6.1 |
| US-03 | não | sim | sim | sim | sim | sim | depende de US-01 para ter o que confirmar |

### 6.1 Justificativa das reprovações

As duas reprovações estão no I, de Independent, e nenhuma delas é descuido de escrita: são dependências do próprio problema.

US-03 depende de US-01 porque só se confirma um relato que existe. Juntar as duas histórias concentraria cadastro, foto, validação e confirmação, aumentando o risco de falha no S. Mantê-las separadas permite tratar a dependência pela ordem do backlog e por dados de teste, sem afirmar um esforço que a equipe ainda não estimou.

US-02 depende dos dados de relatos de US-01 para uso integrado. O documento original também registra dependência de US-03 para observar a ordenação por confirmações em uso real. Essa segunda dependência não impede conferir a consulta isoladamente: dados de teste podem conter contagens diferentes sem executar a confirmação.

O tratamento registrado é manter o backlog US-01, US-03, US-02, sem deslocar a ordenação para a história de confirmação, pois esse benefício pertence a quem consulta. Como proposta de conferência interna, dados de teste preparados podem permitir validar US-02 e US-03 separadamente; isso não elimina a dependência dos dados no fluxo integrado nem constitui nova decisão do grupo.

### 6.2 Evidência das demais letras

| Letra | US-01 | US-02 | US-03 |
|---|---|---|---|
| N — negociável | detalhes da interação podem ser negociados, preservando foto e campos exigidos | apresentação da lista pode ser negociada, preservando janela e ordem | interação para confirmar pode ser negociada, preservando contagem e expiração |
| V — valiosa | informa outras passageiras sobre um ponto antes de passarem por ele | apoia a escolha de acesso e local de espera | mostra que um problema continua ocorrendo |
| E — estimável | entradas, saída e rejeição estão descritas; esforço a confirmar | filtro, ordenação e lista vazia estão descritos; esforço a confirmar | incremento e recusa por expiração estão descritos; esforço a confirmar |
| S — pequena | um fluxo de cadastro, sem conta ou atendimento de emergência; capacidade da equipe a confirmar | uma consulta por estação, sem mapa ou análise adicional; capacidade a confirmar | uma ação de confirmação, sem perfil de agente; capacidade a confirmar |
| T — testável | cenários verificam 12 → 13 relatos ou manutenção de 12 | cenários verificam 4 resultados ordenados ou 0 resultados | cenários verificam 2 → 3 confirmações ou manutenção de 4 |

## 7. Qualidade pelo FURPS

| Categoria | Preocupação principal no meu cenário |
|---|---|
| Functionality | Relato com mais de 30 dias não pode aparecer na consulta nem receber confirmação: informação velha sobre um local que pode já ter sido consertado gera medo sem motivo e afasta passageiras de um caminho que voltou a ser seguro. |
| Usability | A consulta é lida em pé, na plataforma, muitas vezes com uma mão ocupada: tipo do problema, faixa de horário e número de confirmações precisam ser legíveis sem abrir cada relato. |
| Reliability | Boa parte de uma viagem de trem passa por túnel e estação coberta, e o sinal cai. Se o envio falhar no meio e a passageira tentar de novo, o mesmo relato não pode ser gravado duas vezes: relato duplicado infla a estação e distorce a ordem da consulta. |
| Performance | A consulta é feita com o trem chegando e o sinal fraco: se a lista demorar mais do que o trem leva para parar, ela não serve para decidir onde esperar. E uma foto pesada não pode atrasar o texto. |
| Supportability | Estações podem mudar de nome e de operadora. Quando o nome de exibição de uma estação mudar, os relatos antigos dela não podem ficar perdidos sob o nome anterior. |

Estas cinco linhas viram os requisitos não funcionais da Sprint 2.

## 8. Decisões e alternativas descartadas

| Decisão | Alternativa considerada | Por que não foi escolhida |
|---|---|---|
| O recorte do cenário | Levar para a nuvem o botão de emergência do CPTM SOS, com alarme e localização em tempo real | Acompanhar posição em tempo real exige serviços que não estão no percurso, e essa parte já existe e funciona no app original. O que falta à passageira não é mais um botão de pânico; é saber onde está o risco antes de precisar dele. |
| O recorte do cenário | Registrar denúncias de assédio e de roubo, como faz o formulário de denúncia do CPTM SOS | Denúncias e fotos de suspeitos deslocariam o foco do ambiente para pessoas, contrariando a regra do recorte (RD-02). Crime tem canal próprio, a polícia. O relato do local diz o mesmo sobre a estação sem acusar ninguém. |
| Quais cinco requisitos | Trocar a confirmação (RF-04) pela marcação de um relato como resolvido, feita pela segurança da estação | Marcar como resolvido exige saber quem é agente, o que pede autenticação, fora do escopo; sem ela, qualquer pessoa poderia apagar um alerta verdadeiro. A janela de 30 dias resolve o envelhecimento sem depender de alguém lembrar de fechar o relato. |
| Qual caso de exceção | Tratar só a falta da foto, um caso de dado ausente | Foto ausente continua coberta pelo RF-05, mas é o erro mais fácil de evitar na própria tela. O erro mais provável aqui é o nome da estação: a mesma estação tem vários nomes no uso comum ("Barra Funda" e "Palmeiras-Barra Funda"), e aceitar qualquer texto espalharia os relatos de um mesmo lugar sob nomes diferentes, e a consulta perderia relatos. Daí o valor inválido. A lista vazia entrou porque, numa consulta sobre segurança, "nenhum relato" é facilmente lido como "estação segura". |
| O campo pelo qual se consulta | Consultar por linha, e não por estação | A passageira decide por onde andar dentro de uma estação, não de uma linha: uma linha reúne várias estações, e a consulta traria relatos de lugares por onde ela não vai passar. Uma estação atendida por várias linhas também poderia ter seus relatos divididos entre consultas. |
| Confirmação sem identificar quem confirma | Exigir conta, ou guardar um identificador do aparelho, para impedir que a mesma pessoa confirme várias vezes | As duas opções identificam quem participa e contrariam o RD-01. Aceitamos o risco de confirmações repetidas e o declaramos aqui; ele volta na Sprint 2 como requisito não funcional. |

Os cinco requisitos cumprem os papéis já justificados nas seções 1.4 e 2: RF-01 registra e identifica o relato; RF-02 permite reconhecer o local pela foto; RF-03 responde à consulta por estação; RF-04 evidencia persistência; RF-05 evita registros sem foto ou com categorias inválidas. A alternativa de substituir RF-04 por resolução está registrada na tabela. Não há registro de alternativas específicas descartadas para cada um dos demais requisitos; não se atribuem deliberações adicionais ao grupo.

O terceiro caso de exceção, relato expirado, verifica o limite de RF-04: aceitar confirmações de relatos antigos contrariaria a janela de 30 dias. Esta é uma justificativa da conferência interna a partir da regra existente, não o registro de uma nova deliberação da equipe.

## 9. Revisão cruzada recebida

Equipe revisora: **pendente — preencher com a identificação real de outra equipe**.\
Data efetiva da revisão: **pendente — preencher quando ocorrer**.\
Previsão registrada na versão anterior: 08/10/2026; não comprova revisão realizada.

| Pergunta do template ou verificação da aula | Resposta da equipe revisora |
|---|---|
| Algum requisito está escrito como decisão de arquitetura? | Pendente — registrar resposta e requisito citado, se houver. |
| Algum "para que" é circular? | Pendente — registrar resposta e história citada, se houver. |
| Algum cenário BDD cobre só o caminho feliz? | Pendente — avaliar os cenários e a cobertura de exceções por história. |
| Alguma história falha no S do INVEST? | Pendente — registrar avaliação de tamanho e eventual ajuste. |
| O escopo explicita o que fica de fora? | Pendente — registrar resposta. |
| Existem exatamente 5 requisitos, 3 histórias e 6 cenários? | Pendente — registrar contagem conferida. |
| Pelo menos 2 requisitos citam serviços AWS? | Pendente — registrar requisitos conferidos. |
| Pelo menos 1 cenário trata exceção? | Pendente — registrar cenário conferido. |
| Todos os cenários têm números verificáveis? | Pendente — registrar resultados numéricos conferidos. |

### 9.1 O que foi ajustado depois da revisão cruzada

**Pendente.** Após receber o retorno, registrar o comentário real, a seção afetada e o ajuste realizado, ou a justificativa para não alterar. Não há revisão cruzada recebida comprovada nesta versão.

### 9.2 Conferência interna da documentação

Conferência realizada pelo assistente em 07/10/2026, a pedido do usuário, usando os critérios fornecidos na conversa. **Não substitui a revisão cruzada, a validação da equipe nem a aprovação da professora.**

| Pergunta | Resultado da conferência interna |
|---|---|
| Algum requisito está escrito como decisão de arquitetura? | RF-02 e RF-03 citam serviços por exigência da sprint, associados a comportamentos verificáveis: foto acessível e lista filtrada/ordenada. Não especificam topologia, chaves de banco ou implementação de API. |
| Algum "para que" é circular? | Não identificado: os benefícios são conhecer o ponto, escolher o acesso/local de espera e perceber persistência. |
| Algum cenário BDD cobre só o caminho feliz? | Sim: o cenário 1 de cada história verifica sucesso. O cenário 2 de cada história cobre uma exceção, explicitada em 5.1. |
| Alguma história falha no S do INVEST? | Não identificada documentalmente; o tamanho de US-01 e a capacidade para executar as três histórias precisam ser confirmados pela equipe. |
| O escopo explicita o que fica de fora? | Sim, seção 1.3, com justificativa em 1.4. |
| Existem exatamente 5 requisitos, 3 histórias e 6 cenários? | Sim: RF-01 a RF-05, US-01 a US-03 e 2 cenários por história. |
| Pelo menos 2 requisitos citam serviços AWS? | Sim: RF-02 cita Amazon S3 e RF-03 cita Amazon DynamoDB no próprio requisito. |
| Pelo menos 1 cenário trata exceção? | Sim: 3 cenários, identificados em 5.1. |
| Todos os cenários têm números verificáveis? | Sim: 13 relatos/0 confirmações; 12 relatos/0 fotos novas; 4 resultados ordenados; 0 resultados; contagens 3 e 2; manutenção de 4 confirmações. |

Ajustes desta conferência: problema em 4 linhas, versão atualizada, origens dos requisitos de domínio identificadas como regras do projeto, tabela de verbo/objeto/condição alinhada, pré-condições BDD mais explícitas, explicação das letras INVEST e separação entre revisão prevista, revisão recebida e conferência interna.

### 9.3 Pendências reais para fechar a Sprint 1

- Confirmar com a equipe a aprovação do cenário que havia sido declarada na versão anterior, sem atribuir nova aprovação à professora.
- Receber a revisão de outra equipe e preencher identificação, data efetiva e as 9 respostas da seção 9.
- Registrar em 9.1 os ajustes decorrentes desse retorno, ou a justificativa de manutenção do texto.
- Confirmar E e S do INVEST conforme estimativa e capacidade reais da equipe.
- Conferir a lista oficial de estações antes de usá-la; a lista de partida com 97 estações é mencionada, mas não está anexada ao repositório. O exemplo BDD pressupõe a lista aceita indicada no documento.
- Completar a seção 8 com alternativas adicionais somente se realmente discutidas pela equipe; a escolha dos cinco requisitos está justificada, mas não há registro de uma alternativa descartada individual para cada requisito.
