#!/usr/bin/env bash
# Empacota app/confirmar/ num zip e publica a função confirmar, com o papel que
# só lê e atualiza a tabela (RF-04). É a função a mais do projeto: a API das
# três rotas (06) precisa dela, por isso o deploy a cria antes do 06.
set -euo pipefail
source "$(dirname "$0")/config.sh"

empacota "$PACOTE_CONFIRMAR" "$PASTA_CONFIRMAR/handler.py"

publica_funcao "$FUNCAO_CONFIRMAR" "$PAPEL_CONFIRMAR" "$PACOTE_CONFIRMAR" \
  "Variables={TABELA=${TABELA}}"
