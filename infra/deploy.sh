#!/usr/bin/env bash
# Provisiona tudo, na ordem de dependência: primeiro onde os dados ficam (o
# bucket e a tabela), depois o papel que dá acesso a eles, e por último a
# função, que só pode ser criada apontando para um papel que já existe.
# Pode rodar quantas vezes for preciso: cada script confere antes de criar.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

bash "$DIR/01-bucket.sh"
bash "$DIR/02-tabela.sh"
bash "$DIR/03-papel.sh"
bash "$DIR/04-funcao-gravar.sh"

echo "provisionamento concluido"
