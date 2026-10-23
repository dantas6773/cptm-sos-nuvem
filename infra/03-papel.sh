#!/usr/bin/env bash
# Cria o papel da função registrar: quem pode assumi-lo (só o Lambda) e o que
# ele pode fazer (só o que a função usa, sem nenhuma ação de apagar).
set -euo pipefail
source "$(dirname "$0")/config.sh"

# O número da conta entra nos ARNs. No Windows a saída vem com \r no fim.
CONTA=$(aws_local sts get-caller-identity --query Account --output text | tr -d '\r')

# Política de confiança: só o serviço Lambda pode assumir este papel.
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

# Política de permissões, cada ação presa a um recurso:
#   - a tabela: ler um relato (para reconhecer o reenvio) e gravar um novo;
#   - o bucket: gravar a foto e a ficha;
#   - os registros: só os grupos /aws/lambda/<prefixo>-*.
# Nenhum Delete, nenhum "Resource": "*".
PERMISSOES=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TabelaLerEGravar",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:${REGIAO}:${CONTA}:table/${TABELA}"
    },
    {
      "Sid": "BucketGravar",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    },
    {
      "Sid": "RegistrosCriarGrupo",
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup"],
      "Resource": "arn:aws:logs:${REGIAO}:${CONTA}:log-group:/aws/lambda/${PREFIXO}-*"
    },
    {
      "Sid": "RegistrosEscrever",
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:${REGIAO}:${CONTA}:log-group:/aws/lambda/${PREFIXO}-*:*"
    }
  ]
}
EOF
)

if aws_local iam get-role --role-name "$PAPEL" >/dev/null 2>&1; then
  echo "papel ja existe: $PAPEL"
else
  aws_local iam create-role --role-name "$PAPEL" \
    --assume-role-policy-document "$(uma_linha <<<"$CONFIANCA")" >/dev/null
  echo "papel criado: $PAPEL"
fi

# Aplicar de novo sobrescreve a mesma política, sem erro.
aws_local iam put-role-policy --role-name "$PAPEL" --policy-name "$POLITICA" \
  --policy-document "$(uma_linha <<<"$PERMISSOES")"
echo "politica aplicada: $POLITICA (conta $CONTA)"
