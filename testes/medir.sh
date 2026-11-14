#!/usr/bin/env bash
# Mede o RNF-03 (docs/02-arquitetura.md, seção 1): a consulta dos relatos de uma
# estação responde em no máximo 500 ms no percentil 95, com 300 relatos dos
# últimos 30 dias na estação e 30 requisições seguidas.
#
# uso:  ./testes/medir.sh      (com a aplicação no ar: ./infra/deploy.sh)
#
# Monta 300 relatos na estação Mauá (MAU), 10 por dia, faz 2 consultas de
# aquecimento e 30 consultas medidas, mostra o p95 e apaga os relatos de Mauá.

set -u
source "$(dirname "$0")/../infra/config.sh"
source "$(dirname "$0")/lib.sh"

ESTACAO=MAU
RELATOS=300
REQUISICOES=30
LIMITE_MS=500

echo "Medição do RNF-03 · API: $URL"
echo "Preparando: $RELATOS relatos na estação $ESTACAO (10 por dia, nos últimos 30 dias)"
limpa_estacao "$ESTACAO"
"$PY" testes/lote.py semear "$TABELA" "$ESTACAO" "$RELATOS" "$TMP" |
  while read -r lote; do
    lote=${lote%$'\r'}   # o Python do Windows termina a linha com \r
    aws_local dynamodb batch-write-item --request-items "file://$lote" >/dev/null
  done
rm -f "$TMP"/lote-*.json

NA_TABELA=$(aws_local dynamodb query --table-name "$TABELA" \
  --key-condition-expression "estacao_id = :e" \
  --expression-attribute-values "{\":e\":{\"S\":\"$ESTACAO\"}}" \
  --select COUNT --query Count --output text | tr -d '\r')
echo "relatos de $ESTACAO na tabela: $NA_TABELA"

# aquecimento: a primeira chamada de uma função Lambda é mais lenta (partida a frio)
for i in 1 2; do curl -s -o /dev/null "$URL/relatos?estacao=$ESTACAO&limite=100"; done

echo "consultando $REQUISICOES vezes seguidas: GET /relatos?estacao=$ESTACAO"
: > "$TMP/tempos.txt"
ERROS=0
for i in $(seq 1 "$REQUISICOES"); do
  LINHA=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" "$URL/relatos?estacao=$ESTACAO&limite=100")
  CODIGO=${LINHA%% *}
  [ "$CODIGO" = "200" ] || ERROS=$((ERROS + 1))
  echo "${LINHA#* }" | tr -d '\r' | LC_ALL=C awk '{ printf "%.0f\n", $1 * 1000 }' >> "$TMP/tempos.txt"
done
sort -n "$TMP/tempos.txt" > "$TMP/ordenados.txt"

POSICAO=$(( (REQUISICOES * 95 + 99) / 100 ))      # posto mais próximo: 29 de 30
P95=$(sed -n "${POSICAO}p" "$TMP/ordenados.txt")
MIN=$(sed -n "1p" "$TMP/ordenados.txt")
MEDIANA=$(sed -n "$(( (REQUISICOES + 1) / 2 ))p" "$TMP/ordenados.txt")
MAX=$(sed -n "${REQUISICOES}p" "$TMP/ordenados.txt")

echo
echo "tempos em ms, em ordem: $(tr '\n' ' ' < "$TMP/ordenados.txt")"
echo "respostas diferentes de 200: $ERROS"
echo "minimo: ${MIN} ms · mediana: ${MEDIANA} ms · maximo: ${MAX} ms"
echo "p95: ${P95} ms (limite do RNF-03: ${LIMITE_MS} ms)"

limpa_estacao "$ESTACAO"
rm -rf "$TMP"
echo
if [ "$P95" -le "$LIMITE_MS" ] && [ "$ERROS" -eq 0 ]; then
  echo "OK      RNF-03: p95 de ${P95} ms, dentro de ${LIMITE_MS} ms"
else
  echo "FALHOU  RNF-03: p95 de ${P95} ms (limite ${LIMITE_MS} ms), ${ERROS} resposta(s) com erro"
  exit 1
fi
