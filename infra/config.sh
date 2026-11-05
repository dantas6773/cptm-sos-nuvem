#!/usr/bin/env bash
# Nomes de todos os recursos, num lugar só. Os outros scripts leem daqui
# (source "$(dirname "$0")/config.sh"); nenhum nome fica escrito neles nem no
# código das funções, que recebem a tabela e o bucket por variável de ambiente.

PREFIXO="cptm-sos"
REGIAO="us-east-1"

# Amazon S3: o bucket das fotos e das fichas (docs/02-arquitetura.md, seção 6.3)
BUCKET="${PREFIXO}-fotos"

# Amazon DynamoDB: a tabela de relatos e a chave (seção 6.2)
TABELA="${PREFIXO}-relatos"
CHAVE_PARTICAO="estacao_id"
CHAVE_ORDENACAO="dia_protocolo"

# AWS Lambda: as três funções (seção 3), todas em Python
RUNTIME="python3.12"
HANDLER="handler.lambda_handler"

# A função registrar grava o relato (código em app/gravar/)
FUNCAO_GRAVAR="${PREFIXO}-registrar"
PASTA_GRAVAR="app/gravar"
PACOTE_GRAVAR="registrar.zip"

# A função consultar lista os relatos de uma estação (código em app/consultar/)
FUNCAO_CONSULTAR="${PREFIXO}-consultar"
PASTA_CONSULTAR="app/consultar"
PACOTE_CONSULTAR="consultar.zip"

# A função confirmar soma uma confirmação a um relato (código em app/confirmar/)
FUNCAO_CONFIRMAR="${PREFIXO}-confirmar"
PASTA_CONFIRMAR="app/confirmar"
PACOTE_CONFIRMAR="confirmar.zip"

# AWS IAM: um papel por função, cada um com só o que ela usa (seção 2.1)
PAPEL_GRAVAR="${PREFIXO}-registrar-papel"
POLITICA_GRAVAR="${PREFIXO}-registrar-permissoes"
PAPEL_CONSULTAR="${PREFIXO}-consultar-papel"
POLITICA_CONSULTAR="${PREFIXO}-consultar-permissoes"
PAPEL_CONFIRMAR="${PREFIXO}-confirmar-papel"
POLITICA_CONFIRMAR="${PREFIXO}-confirmar-permissoes"

# Amazon API Gateway: a API e o estágio publicado
API_NOME="${PREFIXO}-api"
ESTAGIO="dev"

# Amazon S3, em modo site: o bucket da página, separado do bucket das fotos
BUCKET_SITE="${PREFIXO}-site"

# Endereços no LocalStack: a foto aberta no navegador (RF-02) e a página
URL_FOTOS="http://localhost:4566/${BUCKET}"
URL_SITE="http://${BUCKET_SITE}.s3-website.localhost.localstack.cloud:4566"

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

# Empacota arquivos na raiz de um zip, dentro da raiz do repositório. Tudo com
# caminho relativo, porque o Python e o AWS CLI do Windows não entendem
# /c/Users/...
empacota() { # pacote, arquivos...
  local pacote="$1"
  shift
  cd "$RAIZ"
  rm -f "$pacote"
  if command -v zip >/dev/null 2>&1; then
    zip -q -j "$pacote" "$@"
  else
    "$(command -v python3 || command -v python)" -m zipfile -c "$pacote" "$@"
  fi
  echo "pacote gerado: $pacote"
}

# Publica uma função. Se ela já existe, troca o código e a configuração em vez
# de falhar. Roda na raiz do repositório, onde o empacota deixou o zip.
publica_funcao() { # nome, papel, pacote, variáveis de ambiente
  local nome="$1" papel="$2" pacote="$3" ambiente="$4" papel_arn
  cd "$RAIZ"
  papel_arn=$(aws_local iam get-role --role-name "$papel" --query Role.Arn --output text | tr -d '\r')

  if aws_local lambda get-function --function-name "$nome" >/dev/null 2>&1; then
    aws_local lambda update-function-code --function-name "$nome" \
      --zip-file "fileb://$pacote" >/dev/null
    aws_local lambda wait function-updated-v2 --function-name "$nome"
    aws_local lambda update-function-configuration --function-name "$nome" \
      --role "$papel_arn" --runtime "$RUNTIME" --handler "$HANDLER" \
      --environment "$ambiente" >/dev/null
    aws_local lambda wait function-updated-v2 --function-name "$nome"
    echo "funcao ja existe: $nome (codigo atualizado)"
  else
    aws_local lambda create-function --function-name "$nome" \
      --runtime "$RUNTIME" --handler "$HANDLER" --role "$papel_arn" \
      --zip-file "fileb://$pacote" --timeout 15 \
      --environment "$ambiente" >/dev/null
    aws_local lambda wait function-active-v2 --function-name "$nome"
    echo "funcao criada: $nome"
  fi
}
