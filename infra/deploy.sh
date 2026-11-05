#!/usr/bin/env bash
# Põe a aplicação inteira no ar, na ordem de dependência: primeiro onde os
# dados ficam (o bucket e a tabela), depois os papéis que dão acesso a eles,
# depois as três funções, que só podem ser criadas apontando para um papel
# que já existe; a API, que precisa das três funções; e por último a página,
# que precisa do endereço da API.
# Pode rodar quantas vezes for preciso: cada script confere antes de criar.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/config.sh"

bash "$DIR/01-bucket.sh"
bash "$DIR/02-tabela.sh"
bash "$DIR/03-papel.sh"
bash "$DIR/04-funcao-gravar.sh"
bash "$DIR/05-funcao-consultar.sh"
bash "$DIR/08-funcao-confirmar.sh"
bash "$DIR/06-api.sh"     # precisa das três funções
bash "$DIR/07-site.sh"    # precisa do endereço da API

echo
echo "aplicacao no ar"
echo "site: $URL_SITE"
echo "api:  $(cat "$DIR/.url-api")"
