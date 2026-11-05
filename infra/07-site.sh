#!/usr/bin/env bash
# Publica a página: cria o bucket do site, liga o modo site, libera a leitura
# pública dele e envia index.html, config.js e a lista de estações.
# O bucket do site é separado do das fotos: este é público por inteiro, e a
# política que libera a página liberaria também as fichas, se fosse um só.
# Precisa do endereço da API (06), que vai para o config.js.
set -euo pipefail
source "$(dirname "$0")/config.sh"
cd "$RAIZ"

if [ ! -s infra/.url-api ]; then
  echo "falta o endereco da API: rode antes o ./infra/06-api.sh" >&2
  exit 1
fi
URL_API=$(tr -d '\r\n' < infra/.url-api)

if aws_local s3api head-bucket --bucket "$BUCKET_SITE" >/dev/null 2>&1; then
  echo "bucket do site ja existe: $BUCKET_SITE"
else
  aws_local s3api create-bucket --bucket "$BUCKET_SITE" >/dev/null
  echo "bucket do site criado: $BUCKET_SITE"
fi

aws_local s3 website "s3://${BUCKET_SITE}" --index-document index.html

POLITICA_SITE=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "LeituraPublicaDaPagina",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET_SITE}/*"
  }]
}
EOF
)
aws_local s3api put-bucket-policy --bucket "$BUCKET_SITE" --policy "$(uma_linha <<<"$POLITICA_SITE")"
echo "politica do site aplicada: $BUCKET_SITE (publico le a pagina)"

# O config.js leva só o endereço público da API, nenhuma credencial (seção 2.1)
echo "const URL_API = \"${URL_API}\";" > app/site/config.js

# A mesma lista de estações que vai no pacote da função registrar (seção 6.3).
# no-cache: depois de um deploy novo, o navegador não fica com o endereço velho.
for ARQUIVO in app/site/index.html app/site/config.js app/gravar/estacoes.json; do
  aws_local s3 cp "$ARQUIVO" "s3://${BUCKET_SITE}/$(basename "$ARQUIVO")" \
    --cache-control no-cache >/dev/null
  echo "enviado: $(basename "$ARQUIVO")"
done

echo "site publicado em: $URL_SITE"
