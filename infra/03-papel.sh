#!/usr/bin/env bash
# Cria os três papéis, um para cada função (docs/02-arquitetura.md, seção 2.1).
# Em todos, quem pode assumir é só o Lambda; o que cada um pode fazer é só o
# que a sua função usa, sem nenhuma ação de apagar e sem "Resource": "*".
set -euo pipefail
source "$(dirname "$0")/config.sh"

# O número da conta entra nos ARNs. No Windows a saída vem com \r no fim.
CONTA=$(aws_local sts get-caller-identity --query Account --output text | tr -d '\r')
TABELA_ARN="arn:aws:dynamodb:${REGIAO}:${CONTA}:table/${TABELA}"

# Política de confiança, a mesma nos três: só o serviço Lambda assume o papel.
CONFIANCA=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF
)

# Os registros: cada função escreve só no grupo dela, /aws/lambda/<função>.
registros() { # nome da função
  cat <<EOF
    {
      "Sid": "RegistrosCriarGrupo",
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup"],
      "Resource": "arn:aws:logs:${REGIAO}:${CONTA}:log-group:/aws/lambda/$1"
    },
    {
      "Sid": "RegistrosEscrever",
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:${REGIAO}:${CONTA}:log-group:/aws/lambda/$1:*"
    }
EOF
}

# Cria o papel, se ainda não existe, e aplica a política. Aplicar de novo
# sobrescreve a mesma política, sem erro.
cria_papel() { # papel, política, permissões em JSON
  local papel="$1" politica="$2" permissoes="$3"
  if aws_local iam get-role --role-name "$papel" >/dev/null 2>&1; then
    echo "papel ja existe: $papel"
  else
    aws_local iam create-role --role-name "$papel" \
      --assume-role-policy-document "$(uma_linha <<<"$CONFIANCA")" >/dev/null
    echo "papel criado: $papel"
  fi
  aws_local iam put-role-policy --role-name "$papel" --policy-name "$politica" \
    --policy-document "$(uma_linha <<<"$permissoes")"
  echo "politica aplicada: $politica"
}

# registrar: ler um relato (para reconhecer o reenvio) e gravar um novo na
# tabela; gravar a foto e a ficha no bucket (RF-01, RF-02, RNF-01).
cria_papel "$PAPEL_GRAVAR" "$POLITICA_GRAVAR" "$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TabelaLerEGravar",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
      "Resource": "${TABELA_ARN}"
    },
    {
      "Sid": "BucketGravar",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    },
$(registros "$FUNCAO_GRAVAR")
  ]
}
EOF
)"

# consultar: só o Query na tabela. O RF-03 pede uma função que o IAM autoriza
# apenas a ler; ela não consegue gravar, alterar nem apagar nenhum relato.
cria_papel "$PAPEL_CONSULTAR" "$POLITICA_CONSULTAR" "$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TabelaSoLer",
      "Effect": "Allow",
      "Action": ["dynamodb:Query"],
      "Resource": "${TABELA_ARN}"
    },
$(registros "$FUNCAO_CONSULTAR")
  ]
}
EOF
)"

# confirmar: ler o relato (existe? tem até 30 dias?) e atualizar o número de
# confirmações (RF-04). Não grava relato novo nem toca no bucket.
cria_papel "$PAPEL_CONFIRMAR" "$POLITICA_CONFIRMAR" "$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TabelaLerEAtualizar",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:UpdateItem"],
      "Resource": "${TABELA_ARN}"
    },
$(registros "$FUNCAO_CONFIRMAR")
  ]
}
EOF
)"

echo "papeis prontos (conta $CONTA)"
