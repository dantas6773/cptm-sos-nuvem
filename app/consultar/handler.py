"""Função consultar: lista os relatos de uma estação nos últimos 30 dias (RF-03).

A consulta é um query na partição da estação, e não um scan. Como a chave de
ordenação começa pelo dia do envio (docs/02-arquitetura.md, seção 6.2), o query
pede só a fatia a partir do dia de 30 dias atrás: os relatos antigos da
estação nem são lidos. É o que sustenta o RNF-03.

A lista sai do mais confirmado para o menos confirmado e, no empate, do mais
recente para o mais antigo. Lista vazia é resposta certa (200), e não erro.

O papel desta função no IAM só permite Query: ela não consegue alterar nenhum
relato. O registro (print) leva só a estação e o total, nunca o evento.
"""

import json
import os
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

TABELA = os.environ["TABELA"]
URL_FOTOS = os.environ["URL_FOTOS"]

JANELA_DIAS = 30
LIMITE_PADRAO = 50
LIMITE_MAXIMO = 100  # ninguém pede a janela inteira de uma estação de uma vez
CODIGO_ESTACAO = re.compile(r"^[A-Z]{3}$")

tabela = boto3.resource("dynamodb").Table(TABELA)


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
    print(json.dumps({"operacao": "consultar", **campos}, ensure_ascii=False))


class Recusa(Exception):
    def __init__(self, campo, mensagem):
        super().__init__(mensagem)
        self.campo = campo
        self.mensagem = mensagem


def le_parametros(event):
    """O ?estacao=BRS&limite=20 chega em queryStringParameters."""
    parametros = event.get("queryStringParameters") or {}

    estacao = (parametros.get("estacao") or "").strip().upper()
    if not estacao:
        raise Recusa("estacao", "parâmetro obrigatório ausente: estacao")
    if not CODIGO_ESTACAO.match(estacao):
        raise Recusa("estacao", "use o código da estação, com três letras, como BRS")

    try:
        limite = int(parametros.get("limite") or LIMITE_PADRAO)
    except ValueError:
        raise Recusa("limite", "o limite deve ser um número")

    return estacao, max(1, min(limite, LIMITE_MAXIMO))


def relatos_da_janela(estacao, desde):
    """Query na partição, a partir do dia de 30 dias atrás. Repete enquanto o
    DynamoDB disser que há mais páginas (LastEvaluatedKey)."""
    condicao = Key("estacao_id").eq(estacao) & Key("dia_protocolo").gte(f"{desde:%Y-%m-%d}")
    pedido = {"KeyConditionExpression": condicao}
    itens = []
    while True:
        pagina = tabela.query(**pedido)
        itens.extend(pagina.get("Items", []))
        if "LastEvaluatedKey" not in pagina:
            return itens
        pedido["ExclusiveStartKey"] = pagina["LastEvaluatedKey"]


def para_resposta(item):
    """O que a página precisa de cada relato. O número vem do DynamoDB como
    Decimal, que o json não sabe escrever."""
    return {
        "estacao_id": item["estacao_id"],
        "dia_protocolo": item["dia_protocolo"],
        "protocolo": item["protocolo"],
        "tipo": item["tipo"],
        "faixa": item["faixa"],
        "descricao": item.get("descricao"),
        "foto_url": f"{URL_FOTOS}/{item['foto']}",
        "enviado_em": item["enviado_em"],
        "confirmacoes": int(item.get("confirmacoes", Decimal(0))),
        "ultima_confirmacao_em": item.get("ultima_confirmacao_em"),
    }


def lambda_handler(event, context):
    try:
        estacao, limite = le_parametros(event)
    except Recusa as r:
        registra(resultado="recusado", campo=r.campo)
        return resposta(400, {"erro": r.mensagem, "campo": r.campo})

    agora = datetime.now(timezone.utc)
    desde = agora - timedelta(days=JANELA_DIAS)

    try:
        itens = relatos_da_janela(estacao, desde)
    except ClientError as e:
        registra(resultado="erro", estacao_id=estacao, codigo=e.response.get("Error", {}).get("Code", ""))
        return resposta(500, {"erro": "não foi possível consultar agora; tente de novo"})

    # O query corta pelo dia; aqui o corte é na hora exata de 30 dias atrás
    limite_iso = desde.strftime("%Y-%m-%dT%H:%M:%SZ")
    itens = [i for i in itens if i.get("enviado_em", "") >= limite_iso]

    # Do mais confirmado ao menos; no empate, do mais recente ao mais antigo
    itens.sort(key=lambda i: (int(i.get("confirmacoes", 0)), i.get("enviado_em", "")), reverse=True)
    relatos = [para_resposta(i) for i in itens[:limite]]

    registra(resultado="ok", estacao_id=estacao, total=len(relatos))
    return resposta(200, {"estacao_id": estacao, "total": len(relatos), "relatos": relatos})
