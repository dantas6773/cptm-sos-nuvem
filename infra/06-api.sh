#!/usr/bin/env bash
# Põe a API no ar a partir do infra/openapi.yaml: importa a descrição no API
# Gateway, autoriza o API Gateway a chamar as três funções e publica o estágio.
# O endereço muda a cada deploy; o do momento fica guardado em infra/.url-api.
# Precisa das três funções já criadas (04, 05 e 08).
set -euo pipefail
source "$(dirname "$0")/config.sh"
cd "$RAIZ/infra"

CONTA=$(aws_local sts get-caller-identity --query Account --output text | tr -d '\r')

# O endereço pelo qual o API Gateway invoca uma função. A invocação do Lambda
# só aceita POST: por isso a integração diz httpMethod: POST mesmo na rota GET.
uri_da_funcao() { # nome da função
  local arn
  arn=$(aws_local lambda get-function --function-name "$1" \
    --query Configuration.FunctionArn --output text | tr -d '\r')
  echo "arn:aws:apigateway:${REGIAO}:lambda:path/2015-03-31/functions/${arn}/invocations"
}
URI_GRAVAR=$(uri_da_funcao "$FUNCAO_GRAVAR")
URI_CONSULTAR=$(uri_da_funcao "$FUNCAO_CONSULTAR")
URI_CONFIRMAR=$(uri_da_funcao "$FUNCAO_CONFIRMAR")

# O openapi.yaml tem marcadores, e não endereços fixos: o ARN de cada função só
# existe depois que ela é criada. O arquivo pronto é gerado e não vai ao Git.
sed -e "s|API_NOME|${API_NOME}|" \
    -e "s|URI_GRAVAR|${URI_GRAVAR}|" \
    -e "s|URI_CONSULTAR|${URI_CONSULTAR}|" \
    -e "s|URI_CONFIRMAR|${URI_CONFIRMAR}|" \
    openapi.yaml > openapi-pronto.yaml

ID_API=$(aws_local apigateway get-rest-apis \
  --query "items[?name=='${API_NOME}'].id | [0]" --output text | tr -d '\r')

if [ -z "$ID_API" ] || [ "$ID_API" = "None" ]; then
  ID_API=$(aws_local apigateway import-rest-api \
    --body fileb://openapi-pronto.yaml --query id --output text | tr -d '\r')
  echo "api criada: $API_NOME ($ID_API)"
else
  aws_local apigateway put-rest-api --rest-api-id "$ID_API" --mode overwrite \
    --body fileb://openapi-pronto.yaml >/dev/null
  echo "api ja existe: $API_NOME ($ID_API, rotas atualizadas)"
fi

# Sem esta permissão, o API Gateway chega à função e leva 500. Tira a antiga
# (de uma API anterior) e dá de novo, presa a esta API.
ORIGEM="arn:aws:execute-api:${REGIAO}:${CONTA}:${ID_API}/*/*"
for FUNCAO in "$FUNCAO_GRAVAR" "$FUNCAO_CONSULTAR" "$FUNCAO_CONFIRMAR"; do
  aws_local lambda remove-permission --function-name "$FUNCAO" \
    --statement-id "apigw-${API_NOME}" >/dev/null 2>&1 || true
  aws_local lambda add-permission --function-name "$FUNCAO" \
    --statement-id "apigw-${API_NOME}" --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com --source-arn "$ORIGEM" >/dev/null
  echo "permissao dada: a api chama $FUNCAO"
done

# A definição importada é um rascunho; quem responde é o estágio. Sem o
# create-deployment, nada vai ao ar: 403 Missing Authentication Token.
aws_local apigateway create-deployment --rest-api-id "$ID_API" \
  --stage-name "$ESTAGIO" >/dev/null

URL="http://${ID_API}.execute-api.localhost.localstack.cloud:4566/${ESTAGIO}"
echo "$ID_API" > .id-api
echo "$URL" > .url-api

echo "api publicada em: $URL"
