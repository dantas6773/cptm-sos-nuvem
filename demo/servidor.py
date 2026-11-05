"""Demonstração da Sprint 3: uma página que envia relatos à função registrar
(AWS Lambda no LocalStack) e lista os relatos da estação, lidos do DynamoDB.

Não é a entrega da Sprint 4: aqui não existe API Gateway nem função consultar.
O servidor faz esses dois papéis só para a demonstração, chamando o LocalStack
pelo `lstk aws`, como os scripts de infra/ fazem.

uso: python3 demo/servidor.py       (depois de lstk start e bash infra/deploy.sh)
     abre http://localhost:5050
"""
import json
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

AQUI = Path(__file__).resolve().parent
REPO = AQUI.parent
ESTACOES = REPO / "app" / "gravar" / "estacoes.json"
FUNCAO = "cptm-sos-registrar"
TABELA = "cptm-sos-relatos"
URL_FOTOS = "http://localhost:4566/cptm-sos-fotos"
PORTA = 5050


def lstk_aws(*args):
    r = subprocess.run(["lstk", "aws", "--region", "us-east-1", *args], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or r.stdout.strip())
    return r.stdout


def envia_relato(dados):
    """Monta o evento que o API Gateway entregaria e invoca a função registrar."""
    evento = {"httpMethod": "POST", "path": "/relatos", "headers": {"Content-Type": "application/json"},
              "isBase64Encoded": False, "body": json.dumps(dados, ensure_ascii=False)}
    with tempfile.TemporaryDirectory() as tmp:
        entrada, saida = Path(tmp, "evento.json"), Path(tmp, "saida.json")
        entrada.write_text(json.dumps(evento, ensure_ascii=False), encoding="utf-8")
        lstk_aws("lambda", "invoke", "--function-name", FUNCAO, "--cli-binary-format", "raw-in-base64-out",
                 "--payload", f"fileb://{entrada}", str(saida))
        resposta = json.loads(saida.read_text(encoding="utf-8"))
    corpo = resposta.get("body")
    return resposta.get("statusCode", 500), (json.loads(corpo) if isinstance(corpo, str) else corpo)


def lista_relatos(estacao_id):
    """O que a função consultar vai fazer na Sprint 4: query na partição da estação,
    só a partir do dia de 30 dias atrás, e ordem por confirmações e data."""
    agora = datetime.now(timezone.utc)
    limite = agora - timedelta(days=30)
    saida = lstk_aws("dynamodb", "query", "--table-name", TABELA, "--output", "json",
                     "--key-condition-expression", "estacao_id = :e AND dia_protocolo >= :d",
                     "--expression-attribute-values",
                     json.dumps({":e": {"S": estacao_id}, ":d": {"S": limite.strftime("%Y-%m-%d")}}))
    itens = []
    for bruto in json.loads(saida).get("Items", []):
        item = {k: list(v.values())[0] for k, v in bruto.items()}
        if item.get("enviado_em", "") < limite.strftime("%Y-%m-%dT%H:%M:%SZ"):
            continue
        item["confirmacoes"] = int(item.get("confirmacoes", 0))
        item["foto_url"] = f"{URL_FOTOS}/{item['foto']}"
        itens.append(item)
    itens.sort(key=lambda i: i.get("enviado_em", ""), reverse=True)
    itens.sort(key=lambda i: i["confirmacoes"], reverse=True)
    return itens


class Pedido(BaseHTTPRequestHandler):
    def _json(self, status, corpo):
        dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path in ("/", "/index.html"):
            dados = (AQUI / "index.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(dados)))
            self.end_headers()
            self.wfile.write(dados)
        elif url.path == "/api/estacoes":
            self._json(200, json.loads(ESTACOES.read_text(encoding="utf-8"))["estacoes"])
        elif url.path == "/api/relatos":
            estacao = parse_qs(url.query).get("estacao", [""])[0]
            try:
                self._json(200, {"relatos": lista_relatos(estacao)})
            except Exception as e:
                self._json(502, {"erro": f"não consegui ler a tabela no LocalStack: {e}"})
        else:
            self._json(404, {"erro": "não encontrado"})

    def do_POST(self):
        if urlparse(self.path).path != "/api/relatos":
            return self._json(404, {"erro": "não encontrado"})
        tamanho = int(self.headers.get("Content-Length", 0))
        try:
            dados = json.loads(self.rfile.read(tamanho).decode("utf-8"))
            status, corpo = envia_relato(dados)
            self._json(200, {"statusCode": status, "body": corpo})
        except Exception as e:
            self._json(502, {"erro": f"não consegui chamar a função no LocalStack: {e}"})

    def log_message(self, formato, *args):  # só o essencial no terminal, sem IP
        print(f"[demo] {self.command} {urlparse(self.path).path}", flush=True)


if __name__ == "__main__":
    print(f"[demo] página em http://localhost:{PORTA}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORTA), Pedido).serve_forever()
