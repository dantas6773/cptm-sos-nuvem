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
app/            as três funções (gravar, consultar, confirmar) e a página (site/)
eventos/        eventos para testar as funções pela linha de comando
demo/           página de demonstração da Sprint 3, antes de existir a API
testes/         testes de aceite (Sprint 5)
```

## Como rodar

Com o Docker aberto, na raiz do repositório:

```bash
lstk start                 # sobe o LocalStack
./infra/deploy.sh          # cria tudo e termina em "aplicacao no ar"
open "http://cptm-sos-site.s3-website.localhost.localstack.cloud:4566"
```

No Windows, use `explorer` no lugar de `open`. O LocalStack começa vazio a cada
`lstk start`, e o `./infra/destroy.sh` apaga tudo o que o deploy criou.

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

## Andamento

| Sprint | Entrega | Situação |
|---|---|---|
| 1 | [Documento de requisitos](docs/01-requisitos.md) · [versão Word](docs/01-requisitos.docx) · [apresentação](apresentacoes/sprint-1.pptx) | entregue · revisado pela professora |
| 2 | [Documento de arquitetura](docs/02-arquitetura.md) · [versão Word](docs/02-arquitetura.docx) · [diagrama](docs/diagrama.md) · [apresentação](apresentacoes/sprint-2.pptx) | entregue · revisado pela professora · ajustes feitos |
| 3 | [Scripts de provisionamento](infra/) · [função registrar](app/gravar/) · [demonstração](demo/) · [apresentação](apresentacoes/sprint-3.pdf) | feita |
| 4 | [API](infra/openapi.yaml) · [funções consultar](app/consultar/) e [confirmar](app/confirmar/) · [página](app/site/index.html) · deploy completo | feita |
| 5 | Validação e homologação | — |
