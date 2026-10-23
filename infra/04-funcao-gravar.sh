#!/usr/bin/env bash
# Empacota app/gravar/ num zip e publica a função registrar. Se ela já existe,
# troca o código e a configuração em vez de falhar.
set -euo pipefail
source "$(dirname "$0")/config.sh"

# O pacote: handler.py e a lista de estações, na raiz do zip. Tudo com caminho
# relativo, porque o Python e o AWS CLI do Windows não entendem /c/Users/...
cd "$RAIZ"
rm -f "$PACOTE"
if command -v zip >/dev/null 2>&1; then
  zip -q -j "$PACOTE" "$PASTA_FUNCAO/handler.py" "$PASTA_FUNCAO/estacoes.json"
else
  PYTHON=$(command -v python3 || command -v python)
  "$PYTHON" -m zipfile -c "$PACOTE" "$PASTA_FUNCAO/handler.py" "$PASTA_FUNCAO/estacoes.json"
fi
echo "pacote gerado: $PACOTE"

PAPEL_ARN=$(aws_local iam get-role --role-name "$PAPEL" --query Role.Arn --output text | tr -d '\r')
AMBIENTE="Variables={TABELA=${TABELA},BUCKET=${BUCKET},URL_FOTOS=${URL_FOTOS}}"

if aws_local lambda get-function --function-name "$FUNCAO" >/dev/null 2>&1; then
  aws_local lambda update-function-code --function-name "$FUNCAO" \
    --zip-file "fileb://$PACOTE" >/dev/null
  aws_local lambda wait function-updated-v2 --function-name "$FUNCAO"
  aws_local lambda update-function-configuration --function-name "$FUNCAO" \
    --role "$PAPEL_ARN" --runtime "$RUNTIME" --handler "$HANDLER" \
    --environment "$AMBIENTE" >/dev/null
  aws_local lambda wait function-updated-v2 --function-name "$FUNCAO"
  echo "funcao ja existe: $FUNCAO (codigo atualizado)"
else
  aws_local lambda create-function --function-name "$FUNCAO" \
    --runtime "$RUNTIME" --handler "$HANDLER" --role "$PAPEL_ARN" \
    --zip-file "fileb://$PACOTE" --timeout 15 \
    --environment "$AMBIENTE" >/dev/null
  aws_local lambda wait function-active-v2 --function-name "$FUNCAO"
  echo "funcao criada: $FUNCAO"
fi
