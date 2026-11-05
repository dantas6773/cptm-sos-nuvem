#!/usr/bin/env bash
# Empacota app/gravar/ num zip e publica a função registrar. Se ela já existe,
# troca o código e a configuração em vez de falhar (publica_funcao, config.sh).
set -euo pipefail
source "$(dirname "$0")/config.sh"

# O pacote: handler.py e a lista de estações, na raiz do zip
empacota "$PACOTE_GRAVAR" "$PASTA_GRAVAR/handler.py" "$PASTA_GRAVAR/estacoes.json"

publica_funcao "$FUNCAO_GRAVAR" "$PAPEL_GRAVAR" "$PACOTE_GRAVAR" \
  "Variables={TABELA=${TABELA},BUCKET=${BUCKET},URL_FOTOS=${URL_FOTOS}}"
