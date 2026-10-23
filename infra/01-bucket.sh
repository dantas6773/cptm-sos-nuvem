#!/usr/bin/env bash
# Cria o bucket das fotos e aplica a política dele: o público só lê as fotos,
# pelo endereço exato, e nada mais (RNF-02).
set -euo pipefail
source "$(dirname "$0")/config.sh"

if aws_local s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  echo "bucket ja existe: $BUCKET"
else
  aws_local s3api create-bucket --bucket "$BUCKET" >/dev/null
  echo "bucket criado: $BUCKET"
fi

# Uma única permissão pública: ler um objeto dentro de fotos/. Listar, gravar e
# apagar não aparecem, e as fichas (fichas/) ficam fechadas. Aplicar de novo
# só sobrescreve a mesma política.
POLITICA_BUCKET=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "LeituraPublicaDasFotos",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET}/fotos/*"
  }]
}
EOF
)
aws_local s3api put-bucket-policy --bucket "$BUCKET" --policy "$(uma_linha <<<"$POLITICA_BUCKET")"
echo "politica do bucket aplicada: $BUCKET (publico so le fotos/)"
