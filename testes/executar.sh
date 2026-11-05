#!/usr/bin/env bash
# Testes de aceite da Sprint 5: confere, contra a API no ar, os seis cenários
# BDD da Sprint 1 e os requisitos não funcionais RNF-01, RNF-02, RNF-04 e
# RNF-05. (O RNF-03, o tempo de resposta, é medido por testes/medir.sh.)
#
# uso:  lstk start
#       ./infra/deploy.sh
#       source infra/config.sh      (opcional)
#       ./testes/executar.sh
#
# Cada verificação mostra OK ou FALHOU; a última linha traz "passaram:" e
# "falharam:". O RNF-04 está fora do recorte (docs/02-arquitetura.md, seção 8):
# é conferido e mostrado como FORA DO RECORTE, sem entrar na conta.
#
# Atenção: apaga e recria os relatos das estações Tatuapé (TTP), Luz (LUZ) e
# Botujuru (BTJ), para montar os cenários. Só mexe no LocalStack local.

set -u
source "$(dirname "$0")/../infra/config.sh"
source "$(dirname "$0")/lib.sh"

OK=0; FALHA=0; FORA=0
FOTO=$(base64 < demo/exemplo-escada-escura.jpg | tr -d '\r\n')

confere() { # id, descrição, esperado, obtido
  if [ "$3" = "$4" ]; then
    echo "  OK      $1  $2 (esperado: $3)"; OK=$((OK + 1))
  else
    echo "  FALHOU  $1  $2 (esperado: $3; obtido: $4)"; FALHA=$((FALHA + 1))
  fi
}
secao() { echo; echo "$1"; }

fotos_no_bucket() { # prefixo -> quantidade de objetos
  local n
  n=$(aws_local s3api list-objects-v2 --bucket "$BUCKET" --prefix "$1" \
        --query "length(Contents)" --output text | tr -d '\r')
  [ "$n" = "None" ] && n=0
  echo "$n"
}
linhas_de_recusa() { # início em ms -> linhas "recusado" do registrar desde então
  aws_local logs filter-log-events --log-group-name "/aws/lambda/$FUNCAO_GRAVAR" \
    --start-time "$1" --query "events[].message" --output text 2>/dev/null |
    grep -o '"resultado": "recusado"' | wc -l | tr -d ' \r'
}

echo "Testes de aceite · Sprint 5 · API: $URL"
echo "Preparando: apagando os relatos de TTP, LUZ e BTJ"
for E in TTP LUZ BTJ; do limpa_estacao "$E"; done

# ---------------------------------------------------------------- US-01 c.1
secao "US-01, cenário 1: relato válido de Brás, com foto de 2 MB no máximo"
ANTES=$(total_relatos)
COD="aceite-$(date +%s)-c1"
S=$(posta_relato "$COD" "Brás" "iluminação precária" "noite")
PROT=$(jval "$TMP/resp.json" "d['protocolo']")
FOTO_URL=$(jval "$TMP/resp.json" "d['foto']")
confere "US-01-c1" "o envio devolve 201" "201" "$S"
confere "US-01-c1" "devolve um protocolo de 16 caracteres" "16" "${#PROT}"
confere "US-01-c1" "a foto abre pelo endereço devolvido" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$FOTO_URL")"
confere "US-01-c1" "o sistema passa a ter 1 relato a mais" "$((ANTES + 1))" "$(total_relatos)"
confere "US-01-c1" "o relato novo tem 0 confirmações" "0" "$(confirmacoes_de BRS "$(dia 0)#$PROT")"

# ---------------------------------------------------------------- US-01 c.2
secao "US-01, cenário 2: estação \"Barra Funda\", fora da lista aceita"
ANTES=$(total_relatos); FOTOS=$(fotos_no_bucket "fotos/")
MARCA=$(agora_ms)
S=$(posta_relato "aceite-$(date +%s)-c2" "Barra Funda" "iluminação precária" "noite")
confere "US-01-c2" "o envio devolve 400" "400" "$S"
confere "US-01-c2" "o campo recusado é a estação" "estacao" "$(jval "$TMP/resp.json" "d['campo']")"
confere "US-01-c2" "a mensagem diz que a estação não foi reconhecida" "True" \
  "$(jval "$TMP/resp.json" "'reconhecida' in d['erro']")"
confere "US-01-c2" "nenhum relato novo" "$ANTES" "$(total_relatos)"
confere "US-01-c2" "nenhuma foto nova" "$FOTOS" "$(fotos_no_bucket "fotos/")"
sleep 3
confere "US-01-c2" "1 registro da recusa no CloudWatch Logs" "1" "$(linhas_de_recusa "$MARCA")"
LOG=$(aws_local logs filter-log-events --log-group-name "/aws/lambda/$FUNCAO_GRAVAR" \
  --start-time "$MARCA" --query "events[].message" --output text 2>/dev/null | tr -d '\r')
confere "US-01-c2" "o registro não leva dado de quem enviou (nem o nome digitado)" "0" \
  "$(echo "$LOG" | grep -c 'Barra Funda')"

# ---------------------------------------------------------------- US-02 c.1
secao "US-02, cenário 1: Tatuapé, 4 relatos recentes (5, 2, 2 e 0) e 1 de 45 dias"
poe_relato TTP 1  "$(protocolo a1)" 5
poe_relato TTP 3  "$(protocolo a2)" 2
poe_relato TTP 10 "$(protocolo a3)" 2
poe_relato TTP 20 "$(protocolo a4)" 0
poe_relato TTP 45 "$(protocolo a5)" 7
S=$(consulta TTP)
confere "US-02-c1" "a consulta devolve 200" "200" "$S"
confere "US-02-c1" "a lista traz exatamente 4 relatos" "4" "$(jval "$TMP/resp.json" "len(d['relatos'])")"
confere "US-02-c1" "ordem por confirmações" "5 2 2 0" \
  "$(jval "$TMP/resp.json" "' '.join(str(r['confirmacoes']) for r in d['relatos'])")"
confere "US-02-c1" "no empate, o mais recente vem à frente" "a1 a2 a3 a4" \
  "$(jval "$TMP/resp.json" "' '.join(r['protocolo'][:2] for r in d['relatos'])")"
confere "US-02-c1" "o relato de 45 dias não aparece" "False" \
  "$(jval "$TMP/resp.json" "any(r['protocolo'].startswith('a5') for r in d['relatos'])")"

# ---------------------------------------------------------------- US-02 c.2
secao "US-02, cenário 2: Botujuru, sem relatos nos últimos 30 dias"
S=$(consulta BTJ)
confere "US-02-c2" "a consulta devolve 200, e não erro" "200" "$S"
confere "US-02-c2" "a lista tem 0 relatos" "0" "$(jval "$TMP/resp.json" "d['total']")"
confere "US-02-c2" "a página tem a mensagem de lista vazia" "sim" \
  "$(grep -q 'Nenhum relato nos últimos 30 dias' app/site/index.html && echo sim || echo nao)"

# ---------------------------------------------------------------- US-03 c.1
secao "US-03, cenário 1: Luz, dois relatos com 2 confirmações; confirma o A"
poe_relato LUZ 5 "$(protocolo b1)" 2
poe_relato LUZ 5 "$(protocolo b2)" 2
S=$(confirma_api LUZ "$(dia 5)#$(protocolo b1)")
confere "US-03-c1" "a confirmação devolve 200" "200" "$S"
confere "US-03-c1" "A passa de 2 para 3" "3" "$(confirmacoes_de LUZ "$(dia 5)#$(protocolo b1)")"
confere "US-03-c1" "B continua com 2" "2" "$(confirmacoes_de LUZ "$(dia 5)#$(protocolo b2)")"

# ---------------------------------------------------------------- US-03 c.2
secao "US-03, cenário 2: relato de 31 dias com 4 confirmações"
poe_relato LUZ 31 "$(protocolo c1)" 4
S=$(confirma_api LUZ "$(dia 31)#$(protocolo c1)")
confere "US-03-c2" "a confirmação é recusada (409)" "409" "$S"
confere "US-03-c2" "a mensagem diz que o relato expirou" "True" \
  "$(jval "$TMP/resp.json" "'expirou' in d['erro']")"
confere "US-03-c2" "o relato continua com 4" "4" "$(confirmacoes_de LUZ "$(dia 31)#$(protocolo c1)")"

# ---------------------------------------------------------------- RNF-01
secao "RNF-01: 5 reenvios do mesmo relato gravam 1 só"
ANTES=$(total_relatos)
COD="aceite-$(date +%s)-rnf01"
S1=$(posta_relato "$COD" "Brás" "área isolada" "tarde")
P1=$(jval "$TMP/resp.json" "d['protocolo']")
REENVIOS_200=0; MESMO_PROTOCOLO=0
for i in 1 2 3 4 5; do
  S=$(posta_relato "$COD" "Brás" "área isolada" "tarde")
  [ "$S" = "200" ] && REENVIOS_200=$((REENVIOS_200 + 1))
  [ "$(jval "$TMP/resp.json" "d['protocolo']")" = "$P1" ] && MESMO_PROTOCOLO=$((MESMO_PROTOCOLO + 1))
done
confere "RNF-01" "o primeiro envio devolve 201" "201" "$S1"
confere "RNF-01" "os 5 reenvios devolvem 200" "5" "$REENVIOS_200"
confere "RNF-01" "os 5 reenvios devolvem o mesmo protocolo" "5" "$MESMO_PROTOCOLO"
confere "RNF-01" "a estação ganha exatamente 1 relato" "$((ANTES + 1))" "$(total_relatos)"
confere "RNF-01" "e exatamente 1 foto" "1" "$(fotos_no_bucket "fotos/BRS/$P1")"

# ---------------------------------------------------------------- RNF-02
secao "RNF-02: o público só lê a foto, pelo endereço exato"
aws_local s3api get-bucket-policy --bucket "$BUCKET" --query Policy --output text | tr -d '\r' > "$TMP/politica.txt"
"$PY" -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1],encoding="utf-8"))))' "$TMP/politica.txt" > "$TMP/politica.json" 2>/dev/null
confere "RNF-02" "a política tem 1 única permissão" "1" "$(jval "$TMP/politica.json" "len(d['Statement'])")"
confere "RNF-02" "a única ação é s3:GetObject" "s3:GetObject" "$(jval "$TMP/politica.json" "d['Statement'][0]['Action']")"
confere "RNF-02" "ela vale para o público (Principal *)" "True" \
  "$(jval "$TMP/politica.json" "'*' in str(d['Statement'][0]['Principal'])")"
confere "RNF-02" "e só para o que está em fotos/" "arn:aws:s3:::$BUCKET/fotos/*" \
  "$(jval "$TMP/politica.json" "d['Statement'][0]['Resource']")"
confere "RNF-02" "nenhuma ação de listar, gravar ou apagar" "0" \
  "$(grep -o -E 's3:(List|Put|Delete)[A-Za-z]*' "$TMP/politica.json" | wc -l | tr -d ' \r')"

# ---------------------------------------------------------------- RF-03 (IAM)
secao "RF-03: o papel da função consultar só lê o DynamoDB"
aws_local iam get-role-policy --role-name "$PAPEL_CONSULTAR" --policy-name "$POLITICA_CONSULTAR" \
  --query PolicyDocument --output json | tr -d '\r' > "$TMP/papel.json"
confere "RF-03" "nenhuma ação de gravar, atualizar ou apagar, nem curinga" "0" \
  "$(grep -o -E '"(dynamodb:)?(Put|Update|Delete|BatchWrite)[A-Za-z]*"|"(dynamodb:)?\*"' "$TMP/papel.json" | wc -l | tr -d ' \r')"

# ---------------------------------------------------------------- RNF-05
secao "RNF-05: 10 envios inválidos deixam 10 linhas no CloudWatch Logs em até 10 s"
sleep 1
MARCA=$(agora_ms); INICIO=$(date +%s)
for i in 1 2 3 4 5 6 7 8 9 10; do
  posta_relato "aceite-$(date +%s)-r5-$i" "Estacao Inexistente $i" "outro" "noite" >/dev/null
done
N=0
for t in 1 2 3 4 5 6 7 8 9 10; do
  N=$(linhas_de_recusa "$MARCA")
  [ "$N" -ge 10 ] && break
  sleep 1
done
ESPERA=$(( $(date +%s) - INICIO ))
confere "RNF-05" "exatamente 10 linhas de recusa" "10" "$N"
# o prazo conta a partir do primeiro envio, e não só a partir da última chamada
confere "RNF-05" "visíveis em até 10 segundos (levou ${ESPERA} s, contando os 10 envios)" "sim" \
  "$([ "$ESPERA" -le 10 ] && echo sim || echo "nao, ${ESPERA} s")"

# ---------------------------------------------------------------- RNF-04
secao "RNF-04: 5 reenvios da mesma confirmação somam 1 (fora do recorte)"
ANTES=$(confirmacoes_de LUZ "$(dia 5)#$(protocolo b2)")
for i in 1 2 3 4 5; do confirma_api LUZ "$(dia 5)#$(protocolo b2)" >/dev/null; done
SOMOU=$(( $(confirmacoes_de LUZ "$(dia 5)#$(protocolo b2)") - ANTES ))
if [ "$SOMOU" -eq 1 ]; then
  confere "RNF-04" "5 reenvios da mesma confirmação somam 1" "1" "$SOMOU"
else
  echo "  FORA DO RECORTE  RNF-04  os 5 reenvios somaram $SOMOU, e não 1: o código da confirmação não foi implementado (docs/02-arquitetura.md, seção 8)"
  FORA=$((FORA + 1))
fi

# ---------------------------------------------------------------- fim
for E in TTP LUZ BTJ; do limpa_estacao "$E"; done
rm -rf "$TMP"
echo
echo "passaram: $OK"
echo "falharam: $FALHA"
echo "fora do recorte, documentados: $FORA"
[ "$FALHA" -eq 0 ]
