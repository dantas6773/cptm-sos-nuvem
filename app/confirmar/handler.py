"""Função confirmar: soma uma confirmação a um relato de até 30 dias (RF-04).

A página manda a chave do relato, que a consulta já devolve em cada item:
{"estacao_id": "BRS", "dia_protocolo": "2026-11-05#9c1e5a7b2f40d863"}.

A soma é uma atualização condicional (docs/02-arquitetura.md, seção 5.2): o
DynamoDB só soma se o relato existir e tiver sido enviado há no máximo 30
dias. Relato que passou disso é recusado com a mensagem de expirado, e o
número dele não muda (US-03, cenário 2).

Fica de fora do recorte, como diz a seção 8: o código de cada confirmação
(RNF-04), que impediria o reenvio de somar duas vezes, e o limite de uma
confirmação a cada 10 minutos.

O registro (print) leva só a estação e o protocolo, nunca o evento.
"""

import base64
import json
import os
import re
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError

TABELA = os.environ["TABELA"]

JANELA_DIAS = 30
CODIGO_ESTACAO = re.compile(r"^[A-Z]{3}$")
DIA_PROTOCOLO = re.compile(r"^\d{4}-\d{2}-\d{2}#[0-9a-f]{16}$")
FORMATO_DATA = "%Y-%m-%dT%H:%M:%SZ"

tabela = boto3.resource("dynamodb").Table(TABELA)


class Recusa(Exception):
    def __init__(self, campo, mensagem):
        super().__init__(mensagem)
        self.campo = campo
        self.mensagem = mensagem


def resposta(status, corpo):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(corpo, ensure_ascii=False),
    }


def registra(**campos):
    print(json.dumps({"operacao": "confirmar", **campos}, ensure_ascii=False))


def le_chave(event):
    """O API Gateway entrega os dados como texto no campo body."""
    corpo = event.get("body")
    if not isinstance(corpo, str) or not corpo.strip():
        raise Recusa("body", "o corpo da requisição está vazio")
    if event.get("isBase64Encoded"):
        corpo = base64.b64decode(corpo).decode("utf-8")
    try:
        dados = json.loads(corpo)
    except json.JSONDecodeError:
        raise Recusa("body", "o corpo não é um JSON válido")
    if not isinstance(dados, dict):
        raise Recusa("body", "o corpo deve ser um objeto JSON")

    estacao_id = dados.get("estacao_id")
    if not isinstance(estacao_id, str) or not CODIGO_ESTACAO.match(estacao_id.strip()):
        raise Recusa("estacao_id", "campo obrigatório ausente ou inválido: estacao_id")
    dia_protocolo = dados.get("dia_protocolo")
    if not isinstance(dia_protocolo, str) or not DIA_PROTOCOLO.match(dia_protocolo.strip()):
        raise Recusa("dia_protocolo", "campo obrigatório ausente ou inválido: dia_protocolo")

    return {"estacao_id": estacao_id.strip(), "dia_protocolo": dia_protocolo.strip()}


def expirado(protocolo):
    return resposta(409, {
        "erro": "o relato expirou: foi enviado há mais de 30 dias. "
                "Se o problema continua, registre um relato novo.",
        "protocolo": protocolo,
    })


def lambda_handler(event, context):
    try:
        chave = le_chave(event)
    except Recusa as r:
        registra(resultado="recusado", campo=r.campo)
        return resposta(400, {"erro": r.mensagem, "campo": r.campo})

    protocolo = chave["dia_protocolo"].split("#", 1)[1]
    agora = datetime.now(timezone.utc)
    limite = (agora - timedelta(days=JANELA_DIAS)).strftime(FORMATO_DATA)

    try:
        # 1. Ler o relato, para dizer por que a confirmação não entra
        item = tabela.get_item(Key=chave).get("Item")
        if item is None:
            registra(resultado="inexistente", estacao_id=chave["estacao_id"], protocolo=protocolo)
            return resposta(404, {"erro": "relato não encontrado"})
        if item.get("enviado_em", "") < limite:
            registra(resultado="expirado", estacao_id=chave["estacao_id"], protocolo=protocolo)
            return expirado(protocolo)

        # 2. Somar 1, só se o relato ainda existir e ainda tiver até 30 dias
        #    no instante da gravação (a condição é conferida pelo DynamoDB)
        novo = tabela.update_item(
            Key=chave,
            UpdateExpression="SET confirmacoes = if_not_exists(confirmacoes, :zero) + :um, "
                             "ultima_confirmacao_em = :agora",
            ConditionExpression="attribute_exists(dia_protocolo) AND enviado_em >= :limite",
            ExpressionAttributeValues={
                ":zero": 0,
                ":um": 1,
                ":agora": agora.strftime(FORMATO_DATA),
                ":limite": limite,
            },
            ReturnValues="UPDATED_NEW",
        )["Attributes"]
    except ClientError as e:
        codigo = e.response.get("Error", {}).get("Code", "")
        if codigo == "ConditionalCheckFailedException":
            # Expirou entre a leitura e a gravação
            registra(resultado="expirado", estacao_id=chave["estacao_id"], protocolo=protocolo)
            return expirado(protocolo)
        registra(resultado="erro", estacao_id=chave["estacao_id"], protocolo=protocolo, codigo=codigo)
        return resposta(500, {"erro": "não foi possível confirmar agora; tente de novo"})

    confirmacoes = int(novo["confirmacoes"])
    registra(resultado="confirmado", estacao_id=chave["estacao_id"], protocolo=protocolo,
             confirmacoes=confirmacoes)
    return resposta(200, {
        "protocolo": protocolo,
        "confirmacoes": confirmacoes,
        "ultima_confirmacao_em": novo["ultima_confirmacao_em"],
    })
