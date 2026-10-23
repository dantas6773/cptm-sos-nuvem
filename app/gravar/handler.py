"""Função registrar: recebe um relato pelo API Gateway e o grava.

Valida tudo antes de escrever qualquer coisa (RF-05). Com o relato válido,
grava a foto e a ficha no S3 e depois o item no DynamoDB (RF-01 e RF-02).
O reenvio do mesmo relato devolve o mesmo protocolo sem gravar de novo (RNF-01).

O registro (print) leva só identificadores: o protocolo, a estação e o nome do
campo recusado. Nunca o evento, o valor de um campo ou o IP (RD-01, LGPD).
"""

import base64
import binascii
import hashlib
import json
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

TABELA = os.environ["TABELA"]
BUCKET = os.environ["BUCKET"]
URL_FOTOS = os.environ["URL_FOTOS"]

TIPOS = {
    "iluminação precária",
    "área isolada",
    "sem agente de segurança",
    "equipamento de segurança quebrado",
    "outro",
}
FAIXAS = {"madrugada", "manhã", "tarde", "noite"}
FOTO_MAX_BYTES = 2 * 1024 * 1024
DESCRICAO_MAX = 500

# Nome oficial da estação -> código fixo, que é a chave de partição
with open(os.path.join(os.path.dirname(__file__), "estacoes.json"), encoding="utf-8") as f:
    ESTACOES = {e["nome"]: e["codigo"] for e in json.load(f)["estacoes"]}

s3 = boto3.client("s3")
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
    print(json.dumps({"operacao": "registrar", **campos}, ensure_ascii=False))


def le_corpo(event):
    """O API Gateway entrega os dados como texto no campo body."""
    corpo = event.get("body")
    if corpo is None:
        raise Recusa("body", "o corpo da requisição está vazio")
    if not isinstance(corpo, str):
        raise Recusa("body", "o corpo deve chegar como texto JSON, como o API Gateway envia")
    if event.get("isBase64Encoded"):
        corpo = base64.b64decode(corpo).decode("utf-8")
    try:
        dados = json.loads(corpo)
    except json.JSONDecodeError:
        raise Recusa("body", "o corpo não é um JSON válido")
    if not isinstance(dados, dict):
        raise Recusa("body", "o corpo deve ser um objeto JSON")
    return dados


def texto_obrigatorio(dados, campo):
    valor = dados.get(campo)
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        raise Recusa(campo, f"campo obrigatório ausente: {campo}")
    if not isinstance(valor, str):
        raise Recusa(campo, f"o campo {campo} deve ser texto")
    return valor.strip()


def valida(dados):
    """Confere os campos na ordem da seção 5.2 e para no primeiro recusado."""
    nome_estacao = texto_obrigatorio(dados, "estacao")
    if nome_estacao not in ESTACOES:
        raise Recusa("estacao", "estação não reconhecida: use o nome oficial da lista")

    tipo = texto_obrigatorio(dados, "tipo")
    if tipo not in TIPOS:
        raise Recusa("tipo", "tipo de problema fora da lista aceita")

    faixa = texto_obrigatorio(dados, "faixa")
    if faixa not in FAIXAS:
        raise Recusa("faixa", "faixa de horário fora da lista aceita")

    foto_b64 = texto_obrigatorio(dados, "foto")
    try:
        foto = base64.b64decode(foto_b64, validate=True)
    except (binascii.Error, ValueError):
        raise Recusa("foto", "a foto não está em base64")
    if len(foto) > FOTO_MAX_BYTES:
        raise Recusa("foto", "a foto passa de 2 MB")
    if not foto.startswith(b"\xff\xd8\xff"):
        raise Recusa("foto", "a foto deve ser JPEG")

    codigo_envio = texto_obrigatorio(dados, "codigo_envio")
    if not 8 <= len(codigo_envio) <= 100:
        raise Recusa("codigo_envio", "o código de envio deve ter entre 8 e 100 caracteres")

    descricao = dados.get("descricao")
    if descricao is not None:
        if not isinstance(descricao, str):
            raise Recusa("descricao", "o campo descricao deve ser texto")
        descricao = descricao.strip()
        if len(descricao) > DESCRICAO_MAX:
            raise Recusa("descricao", "a descrição passa de 500 caracteres")

    return {
        "estacao_id": ESTACOES[nome_estacao],
        "tipo": tipo,
        "faixa": faixa,
        "foto": foto,
        "codigo_envio": codigo_envio,
        "descricao": descricao or None,
    }


def lambda_handler(event, context):
    # 1. Validar tudo, sem escrever nada
    try:
        relato = valida(le_corpo(event))
    except Recusa as r:
        registra(resultado="recusado", campo=r.campo)
        return resposta(400, {"erro": r.mensagem, "campo": r.campo})

    # 2. Gerar o id: o protocolo é um resumo do código de envio, e não o código
    #    (seção 9). O mesmo código, no mesmo dia, dá a mesma chave.
    protocolo = hashlib.sha256(relato["codigo_envio"].encode("utf-8")).hexdigest()[:16]
    agora = datetime.now(timezone.utc)
    estacao_id = relato["estacao_id"]
    chave = {"estacao_id": estacao_id, "dia_protocolo": f"{agora:%Y-%m-%d}#{protocolo}"}
    caminho_foto = f"fotos/{estacao_id}/{protocolo}.jpg"
    corpo_sucesso = {"protocolo": protocolo, "foto": f"{URL_FOTOS}/{caminho_foto}"}

    try:
        # 3. Reenvio: o relato já existe, nada é gravado de novo (RNF-01)
        if "Item" in tabela.get_item(Key=chave):
            registra(resultado="reenvio", protocolo=protocolo, estacao_id=estacao_id)
            return resposta(200, corpo_sucesso)

        item = {
            **chave,
            "protocolo": protocolo,
            "tipo": relato["tipo"],
            "faixa": relato["faixa"],
            "foto": caminho_foto,
            "enviado_em": agora.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "confirmacoes": 0,
        }
        if relato["descricao"]:
            item["descricao"] = relato["descricao"]

        # 4. Primeiro a foto, depois a ficha, por último o item: nunca existe
        #    relato listado apontando para uma foto que não subiu
        s3.put_object(Bucket=BUCKET, Key=caminho_foto, Body=relato["foto"],
                      ContentType="image/jpeg")
        s3.put_object(Bucket=BUCKET, Key=f"fichas/{estacao_id}/{protocolo}.json",
                      Body=json.dumps(item, ensure_ascii=False, indent=2).encode("utf-8"),
                      ContentType="application/json; charset=utf-8")
        tabela.put_item(Item=item, ConditionExpression="attribute_not_exists(dia_protocolo)")
    except ClientError as e:
        codigo = e.response.get("Error", {}).get("Code", "")
        if codigo == "ConditionalCheckFailedException":
            # Dois reenvios ao mesmo tempo: o outro gravou primeiro
            registra(resultado="reenvio", protocolo=protocolo, estacao_id=estacao_id)
            return resposta(200, corpo_sucesso)
        registra(resultado="erro", protocolo=protocolo, estacao_id=estacao_id, codigo=codigo)
        return resposta(500, {"erro": "não foi possível gravar o relato agora; tente de novo"})

    registra(resultado="criado", protocolo=protocolo, estacao_id=estacao_id)
    return resposta(201, corpo_sucesso)
