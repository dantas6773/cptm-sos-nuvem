#!/usr/bin/env bash
# Apoio dos testes da Sprint 5. Não roda sozinho: executar.sh e medir.sh fazem
# "source" deste arquivo, depois de carregar infra/config.sh.

PY="$(command -v python3 || command -v python)"
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8

cd "$RAIZ"
TMP="testes/.tmp"             # caminho relativo: o AWS CLI do Windows não entende /c/Users/...
mkdir -p "$TMP"

if [ ! -f infra/.url-api ]; then
  echo "A API não está no ar (falta infra/.url-api). Rode antes: ./infra/deploy.sh"
  exit 2
fi
URL=$(tr -d '\r\n' < infra/.url-api)

# datas relativas a hoje, em UTC; GNU date (Linux, Git Bash) ou BSD date (macOS)
dia()  { date -u -d "$1 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-"$1"d +%Y-%m-%d; }
hora() { date -u -d "$1 days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-"$1"d +%Y-%m-%dT%H:%M:%SZ; }
agora_ms() { echo $(( $(date +%s) * 1000 )); }

# valor de um campo de um JSON: jval arquivo 'expressão em Python sobre d'
jval() {
  "$PY" -c 'import json,sys; d=json.load(open(sys.argv[1],encoding="utf-8")); print(eval(sys.argv[2]))' "$1" "$2" 2>/dev/null
}

# protocolo de 16 hexadecimais a partir de 2 caracteres: a1 -> a1a1a1a1a1a1a1a1
protocolo() { printf '%s%s%s%s%s%s%s%s' "$1" "$1" "$1" "$1" "$1" "$1" "$1" "$1"; }

# --- chamadas à API (a resposta fica em $TMP/resp.json; o código HTTP sai na tela)
posta_relato() { # código de envio, estação, tipo, faixa
  printf '{"estacao": "%s", "tipo": "%s", "faixa": "%s", "descricao": "Teste de aceite", "codigo_envio": "%s", "foto": "%s"}' \
    "$2" "$3" "$4" "$1" "$FOTO" > "$TMP/corpo.json"
  curl -s -o "$TMP/resp.json" -w "%{http_code}" -X POST "$URL/relatos" \
    -H "Content-Type: application/json" --data-binary @"$TMP/corpo.json"
}
consulta() { # estação -> código HTTP
  curl -s -o "$TMP/resp.json" -w "%{http_code}" "$URL/relatos?estacao=$1&limite=100"
}
confirma_api() { # estação, dia_protocolo, [código da confirmação] -> código HTTP
  # Sem o terceiro argumento, cada chamada é um toque novo (código novo)
  local cod="${3:-$(python3 -c 'import uuid; print(uuid.uuid4())' 2>/dev/null || python -c 'import uuid; print(uuid.uuid4())')}"
  curl -s -o "$TMP/resp.json" -w "%{http_code}" -X POST "$URL/confirmacoes" \
    -H "Content-Type: application/json" \
    -d "{\"estacao_id\": \"$1\", \"dia_protocolo\": \"$2\", \"codigo_confirmacao\": \"$cod\"}"
}

# --- acesso direto ao DynamoDB, para montar cenários que a API não monta
total_relatos() {
  aws_local dynamodb scan --table-name "$TABELA" --select COUNT --query Count --output text | tr -d '\r'
}
poe_relato() { # estação, dias atrás, protocolo (16 hex), confirmações
  aws_local dynamodb put-item --table-name "$TABELA" --item \
    "{\"estacao_id\":{\"S\":\"$1\"},\"dia_protocolo\":{\"S\":\"$(dia "$2")#$3\"},\"protocolo\":{\"S\":\"$3\"},\"tipo\":{\"S\":\"outro\"},\"faixa\":{\"S\":\"noite\"},\"foto\":{\"S\":\"fotos/$1/$3.jpg\"},\"enviado_em\":{\"S\":\"$(hora "$2")\"},\"confirmacoes\":{\"N\":\"$4\"}}" >/dev/null
}
confirmacoes_de() { # estação, chave de ordenação
  aws_local dynamodb get-item --table-name "$TABELA" \
    --key "{\"estacao_id\":{\"S\":\"$1\"},\"dia_protocolo\":{\"S\":\"$2\"}}" \
    --query "Item.confirmacoes.N" --output text | tr -d '\r'
}
limpa_estacao() { # apaga todos os relatos de uma estação (só no emulador)
  aws_local dynamodb query --table-name "$TABELA" \
    --key-condition-expression "estacao_id = :e" \
    --expression-attribute-values "{\":e\":{\"S\":\"$1\"}}" \
    --query "Items[].[estacao_id.S,dia_protocolo.S]" --output text | tr -d '\r' |
    "$PY" testes/lote.py apagar "$TABELA" "$TMP" |
    while read -r lote; do
      aws_local dynamodb batch-write-item --request-items "file://$lote" >/dev/null
    done
  rm -f "$TMP"/lote-*.json
}
