# Demonstração da Sprint 3

Uma página que envia relatos à função `registrar` (AWS Lambda no LocalStack) e
lista os relatos de uma estação, lidos da tabela `cptm-sos-relatos` (DynamoDB).

Não é a entrega da Sprint 4: aqui não existe API Gateway nem função
`consultar`. O `servidor.py` faz esses dois papéis só para mostrar a gravação
funcionando, chamando o LocalStack pelo `lstk aws`, como os scripts de `infra/`.

## Como rodar

Na raiz do repositório:

```bash
lstk start                 # sobe o LocalStack (precisa do Docker aberto)
bash infra/deploy.sh       # cria bucket, tabela, papel e função
python3 demo/servidor.py   # abre a página em http://localhost:5050
```

Para encher a tela com 12 relatos de exemplo, em outro terminal, com o
servidor rodando (precisa do Pillow: `pip install pillow`):

```bash
python3 demo/semear.py
```

O LocalStack começa vazio a cada `lstk start`: depois de reiniciar, rode o
`deploy.sh` e o `semear.py` de novo.

## O que mostrar

- **Enviar relato**: a função devolve **201** e o protocolo.
- **Reenviar o mesmo**: devolve **200** e o mesmo protocolo, sem gravar de novo (RNF-01).
- **Testar estação inválida**: devolve **400** e diz qual campo foi recusado (RF-05).
- **A lista da direita**: os relatos da estação nos últimos 30 dias, do mais
  confirmado ao menos confirmado. As confirmações dos exemplos são gravadas
  direto na tabela, porque a função `confirmar` só existe na Sprint 4.

`exemplo-escada-escura.jpg` é uma foto de exemplo para usar no formulário. É
uma imagem desenhada, sem pessoas e sem EXIF.
