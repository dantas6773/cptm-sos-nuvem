#!/usr/bin/env bash
# Confere no LocalStack o modelo de dados da Sprint 2 (docs/02-arquitetura.md,
# seção 6): a tabela, a chave, a janela de 30 dias, o reenvio e a confirmação.
# Usa os critérios de aceite da Sprint 1 como dados de teste.
#
# uso: lstk start   (em outro terminal, ou antes)
#      bash testes/sprint2-dynamodb.sh
#
# Cria e apaga a tabela cptm-sos-relatos só no emulador local.

set -u
TABELA=cptm-sos-relatos
AWS="lstk aws"
OK=0
FALHA=0

# datas relativas a hoje, em UTC; GNU date (Linux, Git Bash) ou BSD date (macOS)
dia() { date -u -d "$1 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-"$1"d +%Y-%m-%d; }
hora() { date -u -d "$1 days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-"$1"d +%Y-%m-%dT%H:%M:%SZ; }

confere() { # descrição, esperado, obtido
  if [ "$2" = "$3" ]; then
    echo "  ok     $1 (esperado $2, obtido $3)"; OK=$((OK + 1))
  else
    echo "  FALHA  $1 (esperado $2, obtido $3)"; FALHA=$((FALHA + 1))
  fi
}

grava() { # estação, dias atrás, protocolo, confirmações, tipo
  $AWS dynamodb put-item --table-name $TABELA \
    --item "{\"estacao_id\":{\"S\":\"$1\"},\"dia_protocolo\":{\"S\":\"$(dia "$2")#$3\"},\"protocolo\":{\"S\":\"$3\"},\"tipo\":{\"S\":\"$5\"},\"faixa\":{\"S\":\"noite\"},\"foto\":{\"S\":\"fotos/$1/$3.jpg\"},\"enviado_em\":{\"S\":\"$(hora "$2")\"},\"confirmacoes\":{\"N\":\"$4\"}}" \
    --condition-expression "attribute_not_exists(dia_protocolo)" >/dev/null 2>&1
}

conta() { # estação -> "Count ScannedCount" da consulta da janela de 30 dias
  $AWS dynamodb query --table-name $TABELA \
    --key-condition-expression "estacao_id = :e AND dia_protocolo >= :d" \
    --expression-attribute-values "{\":e\":{\"S\":\"$1\"},\":d\":{\"S\":\"$(dia 30)\"}}" \
    --query "[Count,ScannedCount]" --output text 2>&1 | tr '\t' ' '
}

confirma() { # estação, chave de ordenação -> soma 1 só se o relato tiver até 30 dias
  $AWS dynamodb update-item --table-name $TABELA \
    --key "{\"estacao_id\":{\"S\":\"$1\"},\"dia_protocolo\":{\"S\":\"$2\"}}" \
    --update-expression "ADD confirmacoes :um SET ultima_confirmacao_em = :agora" \
    --condition-expression "enviado_em >= :limite" \
    --expression-attribute-values "{\":um\":{\"N\":\"1\"},\":agora\":{\"S\":\"$(hora 0)\"},\":limite\":{\"S\":\"$(hora 30)\"}}" \
    >/dev/null 2>&1
}

confirmacoes() { # estação, chave de ordenação -> número de confirmações
  $AWS dynamodb get-item --table-name $TABELA \
    --key "{\"estacao_id\":{\"S\":\"$1\"},\"dia_protocolo\":{\"S\":\"$2\"}}" \
    --query "Item.confirmacoes.N" --output text 2>&1
}

echo "1. Tabela: partição estacao_id, ordenação dia_protocolo, sob demanda"
$AWS dynamodb delete-table --table-name $TABELA >/dev/null 2>&1
$AWS dynamodb wait table-not-exists --table-name $TABELA >/dev/null 2>&1
$AWS dynamodb create-table --table-name $TABELA \
  --attribute-definitions AttributeName=estacao_id,AttributeType=S AttributeName=dia_protocolo,AttributeType=S \
  --key-schema AttributeName=estacao_id,KeyType=HASH AttributeName=dia_protocolo,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST >/dev/null
$AWS dynamodb wait table-exists --table-name $TABELA
confere "tabela criada e ativa" "ACTIVE" "$($AWS dynamodb describe-table --table-name $TABELA --query Table.TableStatus --output text)"
confere "chave da tabela" "estacao_id HASH dia_protocolo RANGE" \
  "$($AWS dynamodb describe-table --table-name $TABELA --query 'Table.KeySchema[].[AttributeName,KeyType]' --output text | tr '\t\n' '  ' | sed 's/ $//')"

echo "2. US-02, cenário 1: Tatuapé com 4 relatos nos últimos 30 dias e 1 de 45 dias"
grava TTP 1 a1 5 "área isolada"
grava TTP 3 a2 2 "iluminação precária"
grava TTP 10 a3 2 "sem agente de segurança"
grava TTP 20 a4 0 "iluminação precária"
grava TTP 45 a5 7 "iluminação precária"
confere "a consulta traz 4 relatos e lê só 4 (o de 45 dias não é lido)" "4 4" "$(conta TTP)"
ORDEM=$($AWS dynamodb query --table-name $TABELA \
  --key-condition-expression "estacao_id = :e AND dia_protocolo >= :d" \
  --expression-attribute-values "{\":e\":{\"S\":\"TTP\"},\":d\":{\"S\":\"$(dia 30)\"}}" \
  --query "Items[].[confirmacoes.N,enviado_em.S]" --output text | sort -k1,1nr -k2,2r | cut -f1 | tr '\n' ' ' | sed 's/ $//')
confere "ordem por confirmações, empate do mais recente (ordenação feita na função)" "5 2 2 0" "$ORDEM"

echo "3. US-02, cenário 2: Botujuru sem relatos"
confere "a consulta de Botujuru traz 0 relatos" "0 0" "$(conta BTJ)"

echo "4. RNF-01: 5 reenvios do mesmo relato gravam 1 só"
grava BRS 0 9c1e5a7b2f40d863 0 "iluminação precária"; R1=$?
RECUSAS=0
for i in 1 2 3 4 5; do grava BRS 0 9c1e5a7b2f40d863 0 "iluminação precária" || RECUSAS=$((RECUSAS + 1)); done
confere "primeira gravação aceita" "0" "$R1"
confere "os 5 reenvios recusados pela gravação condicional" "5" "$RECUSAS"
confere "a Brás tem exatamente 1 relato" "1 1" "$(conta BRS)"

echo "5. RF-04 / US-03: confirmação só em relato de até 30 dias"
grava LUZ 5 b1 2 "área isolada"
grava LUZ 5 b2 2 "área isolada"
grava LUZ 31 b3 4 "iluminação precária"
confirma LUZ "$(dia 5)#b1"
confere "cenário 1: A passa de 2 para 3" "3" "$(confirmacoes LUZ "$(dia 5)#b1")"
confere "cenário 1: B continua com 2" "2" "$(confirmacoes LUZ "$(dia 5)#b2")"
confirma LUZ "$(dia 31)#b3"; R=$?
confere "cenário 2: relato de 31 dias tem a confirmação recusada" "recusada" "$([ $R -ne 0 ] && echo recusada || echo aceita)"
confere "cenário 2: e continua com 4" "4" "$(confirmacoes LUZ "$(dia 31)#b3")"

echo "6. Consulta cara: tipo, de qualquer estação, exige scan"
SCAN=$($AWS dynamodb scan --table-name $TABELA \
  --filter-expression "tipo = :t" --expression-attribute-values '{":t":{"S":"iluminação precária"}}' \
  --query "[Count,ScannedCount]" --output text | tr '\t' ' ')
confere "o scan lê a tabela inteira (9 itens) para achar 5" "5 9" "$SCAN"

$AWS dynamodb delete-table --table-name $TABELA >/dev/null 2>&1
echo
echo "Resultado: $OK ok, $FALHA falha(s)"
[ "$FALHA" -eq 0 ]
