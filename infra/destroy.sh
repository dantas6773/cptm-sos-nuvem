#!/usr/bin/env bash
# Apaga tudo, na ordem inversa do deploy. Sem "set -e" de propósito: se um
# recurso já não existe, o script avisa e segue para o próximo, em vez de
# deixar os outros para trás.
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

remove "funcao" "$FUNCAO" aws_local lambda delete-function --function-name "$FUNCAO"
remove "grupo de registros" "/aws/lambda/$FUNCAO" \
  aws_local logs delete-log-group --log-group-name "/aws/lambda/$FUNCAO"

# O IAM não apaga um papel que ainda tem política: primeiro a política.
remove "politica" "$POLITICA" \
  aws_local iam delete-role-policy --role-name "$PAPEL" --policy-name "$POLITICA"
remove "papel" "$PAPEL" aws_local iam delete-role --role-name "$PAPEL"

remove "tabela" "$TABELA" aws_local dynamodb delete-table --table-name "$TABELA"
aws_local dynamodb wait table-not-exists --table-name "$TABELA" >/dev/null 2>&1

# O S3 não apaga um bucket com arquivos: --force esvazia antes.
remove "bucket" "$BUCKET" aws_local s3 rb "s3://$BUCKET" --force

rm -f "$RAIZ/$PACOTE"

echo "recursos removidos"
