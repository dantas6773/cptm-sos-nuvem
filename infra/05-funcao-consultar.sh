#!/usr/bin/env bash
# Empacota app/consultar/ num zip e publica a função consultar, com o papel
# que só lê a tabela (RF-03). Se ela já existe, troca o código e a configuração.
set -euo pipefail
source "$(dirname "$0")/config.sh"

empacota "$PACOTE_CONSULTAR" "$PASTA_CONSULTAR/handler.py"

publica_funcao "$FUNCAO_CONSULTAR" "$PAPEL_CONSULTAR" "$PACOTE_CONSULTAR" \
  "Variables={TABELA=${TABELA},URL_FOTOS=${URL_FOTOS}}"
