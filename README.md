# CPTM SOS · Relatos por estação

Projeto de nuvem AWS da disciplina Projeto em Ciência de Dados IV (IBM8942, Ibmec,
2º semestre de 2026), executado em ambiente simulado com LocalStack.

É o recorte de nuvem do [CPTM SOS](https://github.com/dantas6773/cptm-sos), o
redesenho do app da CPTM com um fluxo de emergência para quem se sente insegura no
trem. Aquele app age no momento do perigo; este age antes dele: passageiras
registram, com uma foto do local, os pontos das estações onde se sentiram
inseguras, e quem vai passar por ali consulta o que já foi relatado.

## Estrutura

```
docs/           documentos de cada sprint
apresentacoes/  apresentações das sprints, editáveis
infra/          scripts de provisionamento, 01 a 08, e o openapi.yaml da API
app/            as três funções (gravar, consultar, confirmar) e a página (site/);
                cptm-sos/ é a cópia do app original, só de referência, e não entra no deploy
eventos/        eventos para testar as funções pela linha de comando
demo/           página de demonstração da Sprint 3, antes de existir a API
testes/         testes de aceite (Sprint 5)
```

## Pré-requisitos

| Ferramenta | Para quê | Conferir com |
|---|---|---|
| Docker | roda o LocalStack | `docker --version` |
| lstk | sobe o LocalStack e chama o AWS CLI nele | `lstk --version` |
| AWS CLI v2 | o `lstk aws` chama o AWS CLI da máquina | `aws --version` |
| zip, curl, Python 3 | empacotar as funções, chamar a API, apoiar os testes | `zip -v`, `curl --version`, `python3 --version` |

No Windows, rode tudo no **Git Bash** (o PowerShell não executa os `.sh`) e deixe o
`lstk.exe` numa pasta que esteja no PATH, como `C:\lstk`; depois de mexer no PATH,
feche e abra o terminal. O Docker Desktop precisa estar aberto.

Versões usadas pela equipe (Windows 11, Git Bash): Docker 29.8.0, lstk 1.4.3,
AWS CLI 2.37.0, curl 8.21.0, Python 3.11.9. O `zip` não vem no Git Bash; sem ele,
os scripts empacotam as funções com `python -m zipfile`, então não precisa instalar.

## Como rodar

Com o Docker aberto, na raiz do repositório:

```bash
lstk start                 # sobe o LocalStack
./infra/deploy.sh          # cria tudo e termina em "aplicacao no ar"
open "http://cptm-sos-site.s3-website.localhost.localstack.cloud:4566"
```

No Windows, use `explorer` no lugar de `open`. O LocalStack começa vazio a cada
`lstk start`. O endereço do site e o da API aparecem nas duas últimas linhas do
deploy.

Para derrubar tudo, `./infra/destroy.sh` apaga o que o deploy criou e `lstk stop`
desliga o LocalStack.

| Rota | Função | O que faz |
|---|---|---|
| `POST /relatos` | `cptm-sos-registrar` | grava o relato, a foto e a ficha (RF-01, RF-02, RF-05) |
| `GET /relatos?estacao=BRS` | `cptm-sos-consultar` | lista os relatos da estação nos últimos 30 dias (RF-03) |
| `POST /confirmacoes` | `cptm-sos-confirmar` | soma uma confirmação a um relato de até 30 dias (RF-04) |

### A API pelo terminal

O endereço da API muda a cada deploy; o do momento fica em `infra/.url-api`.
O relato precisa de uma foto JPEG em base64 e de um código de envio novo: com o
mesmo código, no mesmo dia, a função reconhece o reenvio e devolve 200, e não 201.

```bash
source infra/config.sh
URL=$(cat infra/.url-api)
FOTO=$(base64 < demo/exemplo-escada-escura.jpg | tr -d '\n')

# 1. grava um relato: 201, o protocolo e o endereço da foto
printf '{"estacao": "Brás", "tipo": "iluminação precária", "faixa": "noite", "descricao": "%s", "codigo_envio": "curl-%s", "foto": "%s"}' \
  "Escada sem nenhuma lâmpada acesa" "$(date +%Y%m%d%H%M%S)" "$FOTO" |
  curl -s -w "\n" -X POST "$URL/relatos" -H "Content-Type: application/json" --data-binary @-

# 2. consulta a estação pelo código: a lista
curl -s -w "\n" "$URL/relatos?estacao=BRS"

# 3. consulta sem a estação: 400
curl -s -o /dev/null -w "%{http_code}\n" "$URL/relatos"
```

O corpo vai por `--data-binary @-`, e não por `-d`, porque a foto em base64 passa
do tamanho que o Windows aceita numa linha de comando.

Para confirmar, a chave do relato vem da consulta (`estacao_id` e `dia_protocolo`):

```bash
curl -s -w "\n" -X POST "$URL/confirmacoes" -H "Content-Type: application/json" \
  -d '{"estacao_id": "BRS", "dia_protocolo": "<dia_protocolo de um relato da lista>"}'
```

Cada função também pode ser testada sozinha, sem a API:

```bash
lstk aws lambda invoke --function-name "$FUNCAO_CONSULTAR" \
  --payload fileb://eventos/consultar-ok.json saida.json
cat saida.json
```

## Testes de aceite

Com a aplicação no ar (`./infra/deploy.sh`), na raiz do repositório:

```bash
./testes/executar.sh   # os 6 cenários da Sprint 1 e os RNF-01, 02, 04 e 05: OK ou FALHOU (40 verificações)
./testes/medir.sh      # o RNF-03: o p95 da consulta, com 300 relatos
```

O `executar.sh` apaga e recria os relatos de Tatuapé, Luz e Botujuru para montar
os cenários, e o `medir.sh` faz o mesmo com Mauá; isso só acontece no LocalStack.
O resultado de cada sprint está em `docs/`.

## Andamento

| Sprint | Entrega | Situação |
|---|---|---|
| 1 | [Documento de requisitos](docs/01-requisitos.md) · [versão Word](docs/01-requisitos.docx) · [apresentação](apresentacoes/sprint-1.pptx) | entregue · revisado pela professora |
| 2 | [Documento de arquitetura](docs/02-arquitetura.md) · [versão Word](docs/02-arquitetura.docx) · [diagrama](docs/diagrama.md) · [apresentação](apresentacoes/sprint-2.pptx) | entregue · revisado pela professora · ajustes feitos |
| 3 | [Scripts de provisionamento](infra/) · [função registrar](app/gravar/) · [demonstração](demo/) · [apresentação](apresentacoes/sprint-3.pdf) | feita |
| 4 | [API](infra/openapi.yaml) · [funções consultar](app/consultar/) e [confirmar](app/confirmar/) · [página](app/site/index.html) · deploy completo · [apresentação](apresentacoes/sprint-4.pptx) | feita |
| 5 | [Documento de validação](docs/03-validacao.md) · [testes de aceite](testes/executar.sh) · [medição do tempo](testes/medir.sh) | RNF-04 implementado; testes rodados em 14/11/2026: 40 passaram, 0 falharam; p95 de 159 ms · faltam as homologações e o fechamento |
