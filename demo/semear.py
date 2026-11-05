"""Enche o LocalStack com relatos de exemplo para a demonstração.

Os relatos entram pela função registrar de verdade (pela página da demo, em
localhost:5050). As confirmações são gravadas direto na tabela, porque a função
confirmar só existe na Sprint 4.

uso: python3 demo/semear.py   (com o servidor.py rodando; precisa do Pillow;
     repetir depois de cada lstk start)
"""
import base64
import io
import json
import subprocess
import urllib.request
import uuid
from datetime import datetime, timezone

# (estação, tipo, faixa, descrição, cena da foto, confirmações)
RELATOS = [
    ("Brás", "iluminação precária", "noite", "Escada da saída para a rua sem nenhuma lâmpada acesa.", "escada", 7),
    ("Brás", "área isolada", "noite", "Passarela entre as linhas 11 e 12 fica vazia depois das 22h.", "passarela", 4),
    ("Brás", "sem agente de segurança", "madrugada", "Plataforma 5 sem nenhum agente no primeiro trem.", "plataforma", 2),
    ("Brás", "equipamento de segurança quebrado", "tarde", "Interfone de emergência da plataforma 6 não funciona.", "interfone", 0),
    ("Luz", "iluminação precária", "noite", "Corredor de baldeação com metade das luzes apagadas.", "corredor", 5),
    ("Luz", "área isolada", "manhã", "Acesso lateral sempre vazio e sem movimento.", "passarela", 1),
    ("Tatuapé", "iluminação precária", "noite", "Rampa de acesso ao terminal sem iluminação.", "escada", 3),
    ("Tatuapé", "sem agente de segurança", "noite", "Bilheteria fechada e nenhum agente no mezanino.", "corredor", 0),
    ("Palmeiras-Barra Funda", "equipamento de segurança quebrado", "tarde", "Câmera do corredor da linha 7 virada para a parede.", "camera", 6),
    ("Palmeiras-Barra Funda", "área isolada", "madrugada", "Passarela de ligação ao terminal vazia de madrugada.", "passarela", 2),
    ("Guaianases", "iluminação precária", "noite", "Escada do lado norte com lâmpadas queimadas.", "escada", 1),
    ("Guaianases", "outro", "manhã", "Piso da plataforma solto perto da escada.", "plataforma", 0),
]


def foto(cena):
    """Desenha uma cena simples de ambiente, sem pessoas, como JPEG em base64."""
    from PIL import Image, ImageDraw, ImageFilter
    W, H = 1000, 750
    im = Image.new("RGB", (W, H), (20, 22, 26))
    d = ImageDraw.Draw(im)
    if cena == "escada":
        for k in range(11):
            y = 330 + k * 38
            d.rectangle([180 - k * 12, y, 820 + k * 12, y + 38], fill=(46 + k * 4, 48 + k * 4, 54 + k * 4))
            d.line([180 - k * 12, y, 820 + k * 12, y], fill=(90, 92, 98), width=3)
        d.rectangle([410, 40, 590, 70], fill=(70, 70, 72))
    elif cena == "passarela":
        d.polygon([(0, 750), (1000, 750), (620, 330), (380, 330)], fill=(58, 60, 64))
        for x in range(60, 1000, 120):
            d.line([(x, 120), (x, 600)], fill=(80, 84, 90), width=4)
        d.rectangle([380, 230, 620, 330], fill=(12, 14, 18))
    elif cena == "plataforma":
        d.rectangle([0, 470, 1000, 750], fill=(70, 70, 66))
        d.rectangle([0, 455, 1000, 470], fill=(200, 170, 40))
        d.rectangle([0, 520, 1000, 750], fill=(30, 30, 30))
        d.ellipse([820, 60, 860, 100], fill=(60, 60, 60))
    elif cena == "corredor":
        d.polygon([(0, 0), (380, 260), (380, 490), (0, 750)], fill=(52, 54, 60))
        d.polygon([(1000, 0), (620, 260), (620, 490), (1000, 750)], fill=(52, 54, 60))
        d.rectangle([380, 260, 620, 490], fill=(16, 18, 22))
        for i, x in enumerate(range(150, 900, 150)):
            d.rectangle([x, 20, x + 80, 34], fill=(230, 230, 200) if i % 2 else (60, 60, 60))
    elif cena == "camera":
        d.rectangle([0, 0, 1000, 750], fill=(60, 62, 68))
        d.rectangle([420, 200, 600, 290], fill=(30, 30, 32))
        d.ellipse([400, 215, 460, 275], fill=(10, 10, 12))
        d.line([(600, 245), (700, 120)], fill=(30, 30, 32), width=14)
    elif cena == "interfone":
        d.rectangle([0, 0, 1000, 750], fill=(150, 150, 140))
        d.rectangle([400, 180, 600, 520], fill=(200, 40, 40))
        d.rectangle([440, 230, 560, 330], fill=(40, 40, 40))
        d.ellipse([470, 380, 530, 440], fill=(240, 220, 60))
        d.line([(400, 520), (600, 180)], fill=(20, 20, 20), width=8)
    im = im.filter(ImageFilter.GaussianBlur(1.0))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def confirma(estacao_id, dia, protocolo, n):
    chave = {"estacao_id": {"S": estacao_id}, "dia_protocolo": {"S": f"{dia}#{protocolo}"}}
    subprocess.run(["lstk", "aws", "--region", "us-east-1", "dynamodb", "update-item", "--table-name", "cptm-sos-relatos",
                    "--key", json.dumps(chave), "--update-expression", "SET confirmacoes = :n",
                    "--expression-attribute-values", json.dumps({":n": {"N": str(n)}})], check=True, capture_output=True)


if __name__ == "__main__":
    for estacao, tipo, faixa, descricao, cena, confirmacoes in RELATOS:
        dados = {"estacao": estacao, "tipo": tipo, "faixa": faixa, "descricao": descricao,
                 "foto": foto(cena), "codigo_envio": str(uuid.uuid4())}
        req = urllib.request.Request("http://localhost:5050/api/relatos", data=json.dumps(dados).encode(),
                                     headers={"Content-Type": "application/json"})
        r = json.load(urllib.request.urlopen(req, timeout=120))
        status, corpo = r.get("statusCode"), r.get("body") or {}
        if status != 201:
            print(f"{estacao:<24} {status} {corpo}")
            continue
        estacao_id = corpo["foto"].split("/fotos/")[1].split("/")[0]
        dia = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if confirmacoes:
            confirma(estacao_id, dia, corpo["protocolo"], confirmacoes)
        print(f"{estacao:<24} 201 protocolo {corpo['protocolo']} · {confirmacoes} confirmações")
