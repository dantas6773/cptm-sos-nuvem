#!/usr/bin/env bash
# Nomes de todos os recursos, num lugar só. Os outros scripts leem daqui
# (source "$(dirname "$0")/config.sh"); nenhum nome fica escrito neles nem no
# código da função, que recebe a tabela e o bucket por variável de ambiente.

PREFIXO="cptm-sos"
REGIAO="us-east-1"

# Amazon S3: o bucket das fotos e das fichas (docs/02-arquitetura.md, seção 6.3)
BUCKET="${PREFIXO}-fotos"

# Amazon DynamoDB: a tabela de relatos e a chave (seção 6.2)
TABELA="${PREFIXO}-relatos"
CHAVE_PARTICAO="estacao_id"
CHAVE_ORDENACAO="dia_protocolo"

# AWS IAM: o papel da função registrar e a política de permissões dele
PAPEL="${PREFIXO}-registrar-papel"
POLITICA="${PREFIXO}-registrar-permissoes"

# AWS Lambda: a função registrar, que grava o relato (código em app/gravar/)
FUNCAO="${PREFIXO}-registrar"
RUNTIME="python3.12"
HANDLER="handler.lambda_handler"
PASTA_FUNCAO="app/gravar"
PACOTE="registrar.zip"

# Endereço pelo qual a foto é aberta no navegador (RF-02), no LocalStack
URL_FOTOS="http://localhost:4566/${BUCKET}"

# A raiz do repositório, para que os scripts rodem de qualquer pasta
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# No Git Bash, impede que "/aws/lambda/..." vire um caminho do Windows
export MSYS_NO_PATHCONV=1

# Todo comando da AWS passa pelo LocalStack, sempre na mesma região
aws_local() {
  lstk aws --region "$REGIAO" "$@"
}

# Junta um JSON numa linha só. No Windows o AWS CLI roda por um .cmd, que
# corta o argumento na primeira quebra de linha.
uma_linha() {
  tr -d '\r\n'
}
