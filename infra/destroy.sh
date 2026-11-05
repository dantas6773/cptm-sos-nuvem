#!/usr/bin/env bash
# Apaga tudo, na ordem inversa do deploy: a página e a API, que dependem das
# funções; as funções; os papéis; e por último os dados. Sem "set -e" de
# propósito: se um recurso já não existe, o script avisa e segue para o
# próximo, em vez de deixar os outros para trás.
source "$(dirname "$0")/config.sh"

remove() { # descrição, nome, comando...
  local descricao="$1" nome="$2"
  shift 2
  if "$@" >/dev/null 2>&1; then
    echo "removido: $descricao $nome"
  else
    echo "nao existia (ou falhou ao remover): $descricao $nome"
  fi
}

# O S3 não apaga um bucket com arquivos: --force esvazia antes.
remove "bucket do site" "$BUCKET_SITE" aws_local s3 rb "s3://$BUCKET_SITE" --force

# A API é achada pelo nome, e não pelo infra/.id-api, que pode não existir
ID_API=$(aws_local apigateway get-rest-apis \
  --query "items[?name=='${API_NOME}'].id | [0]" --output text 2>/dev/null | tr -d '\r')
if [ -n "$ID_API" ] && [ "$ID_API" != "None" ]; then
  remove "api" "$API_NOME ($ID_API)" aws_local apigateway delete-rest-api --rest-api-id "$ID_API"
else
  echo "nao existia: api $API_NOME"
fi

for FUNCAO in "$FUNCAO_CONFIRMAR" "$FUNCAO_CONSULTAR" "$FUNCAO_GRAVAR"; do
  remove "funcao" "$FUNCAO" aws_local lambda delete-function --function-name "$FUNCAO"
  remove "grupo de registros" "/aws/lambda/$FUNCAO" \
    aws_local logs delete-log-group --log-group-name "/aws/lambda/$FUNCAO"
done

# O IAM não apaga um papel que ainda tem política: primeiro a política.
remove_papel() { # papel, política
  remove "politica" "$2" aws_local iam delete-role-policy --role-name "$1" --policy-name "$2"
  remove "papel" "$1" aws_local iam delete-role --role-name "$1"
}
remove_papel "$PAPEL_CONFIRMAR" "$POLITICA_CONFIRMAR"
remove_papel "$PAPEL_CONSULTAR" "$POLITICA_CONSULTAR"
remove_papel "$PAPEL_GRAVAR" "$POLITICA_GRAVAR"

remove "tabela" "$TABELA" aws_local dynamodb delete-table --table-name "$TABELA"
aws_local dynamodb wait table-not-exists --table-name "$TABELA" >/dev/null 2>&1

remove "bucket" "$BUCKET" aws_local s3 rb "s3://$BUCKET" --force

# Os arquivos que o deploy gera e recria: os pacotes, o endereço da API, o
# openapi com os endereços preenchidos e o config.js da página
rm -f "$RAIZ/$PACOTE_GRAVAR" "$RAIZ/$PACOTE_CONSULTAR" "$RAIZ/$PACOTE_CONFIRMAR" \
      "$RAIZ/infra/.id-api" "$RAIZ/infra/.url-api" "$RAIZ/infra/openapi-pronto.yaml" \
      "$RAIZ/app/site/config.js"

echo "recursos removidos"
