#!/usr/bin/env bash
# Cria a tabela de relatos: partição pela estação, ordenação pelo dia e pelo
# protocolo, cobrada por uso (docs/02-arquitetura.md, seção 6.2).
set -euo pipefail
source "$(dirname "$0")/config.sh"

if aws_local dynamodb describe-table --table-name "$TABELA" >/dev/null 2>&1; then
  echo "tabela ja existe: $TABELA"
else
  # Só os dois campos da chave são declarados: o DynamoDB não tem esquema para
  # o resto do item, e declarar um campo que não é chave dá erro.
  aws_local dynamodb create-table \
    --table-name "$TABELA" \
    --attribute-definitions \
      AttributeName="$CHAVE_PARTICAO",AttributeType=S \
      AttributeName="$CHAVE_ORDENACAO",AttributeType=S \
    --key-schema \
      AttributeName="$CHAVE_PARTICAO",KeyType=HASH \
      AttributeName="$CHAVE_ORDENACAO",KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST >/dev/null
  aws_local dynamodb wait table-exists --table-name "$TABELA"
  echo "tabela criada: $TABELA"
fi
