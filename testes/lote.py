"""Apoio dos testes da Sprint 5: monta lotes para o batch-write-item do DynamoDB.

  python3 testes/lote.py semear TABELA ESTACAO QTD PASTA
      grava em PASTA os arquivos lote-NN.json (25 relatos cada) e escreve os
      nomes na saída. Os QTD relatos saem 10 por dia, nos últimos 30 dias.

  python3 testes/lote.py apagar TABELA PASTA
      lê da entrada padrão linhas "estacao_id<TAB>dia_protocolo" e faz o mesmo
      com pedidos de exclusão.
"""
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone

FORMATO = "%Y-%m-%dT%H:%M:%SZ"


def escreve_lotes(tabela, pedidos, pasta):
    os.makedirs(pasta, exist_ok=True)
    for n in range(0, len(pedidos), 25):
        nome = os.path.join(pasta, f"lote-{n // 25:02d}.json").replace("\\", "/")
        with open(nome, "w", encoding="utf-8") as f:
            json.dump({tabela: pedidos[n:n + 25]}, f, ensure_ascii=False)
        print(nome)


def semear(tabela, estacao, qtd, pasta):
    agora = datetime.now(timezone.utc)
    pedidos = []
    for i in range(qtd):
        enviado = agora - timedelta(days=i // 10, minutes=i % 10 + 1)
        protocolo = hashlib.sha256(f"carga-{estacao}-{i}".encode()).hexdigest()[:16]
        item = {
            "estacao_id": {"S": estacao},
            "dia_protocolo": {"S": f"{enviado:%Y-%m-%d}#{protocolo}"},
            "protocolo": {"S": protocolo},
            "tipo": {"S": "outro"},
            "faixa": {"S": "noite"},
            "foto": {"S": f"fotos/{estacao}/{protocolo}.jpg"},
            "enviado_em": {"S": enviado.strftime(FORMATO)},
            "confirmacoes": {"N": str(i % 7)},
        }
        pedidos.append({"PutRequest": {"Item": item}})
    escreve_lotes(tabela, pedidos, pasta)


def apagar(tabela, pasta):
    pedidos = []
    for linha in sys.stdin:
        partes = linha.strip().split("\t")
        if len(partes) == 2:
            chave = {"estacao_id": {"S": partes[0]}, "dia_protocolo": {"S": partes[1]}}
            pedidos.append({"DeleteRequest": {"Key": chave}})
    escreve_lotes(tabela, pedidos, pasta)


if __name__ == "__main__":
    modo = sys.argv[1]
    if modo == "semear":
        semear(sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5])
    elif modo == "apagar":
        apagar(sys.argv[2], sys.argv[3])
