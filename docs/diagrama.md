# Diagrama de arquitetura — CPTM SOS · Relatos por estação

Entregável da Sprint 2, seção 5. O diagrama foi feito no Lucidchart e está em
[`diagrama.png`](diagrama.png). Abaixo, a mesma versão em Mermaid, que o GitHub
desenha como imagem ao abrir este arquivo.

```mermaid
flowchart TB
    subgraph apresentacao["Camada de apresentação"]
        nav["Navegador<br/>relato, consulta e confirmação<br/>limpa a foto e gera o protocolo"]
        site["Amazon S3<br/>cptm-sos-site<br/>index.html, config.js, estacoes.json"]
    end

    subgraph negocio["Camada de negócio"]
        api["Amazon API Gateway<br/>três rotas"]
        registrar["AWS Lambda<br/>registrar<br/>RF-01 RF-02 RF-05 RNF-02 RNF-03"]
        consultar["AWS Lambda<br/>consultar<br/>RF-03 RNF-01"]
        confirmar["AWS Lambda<br/>confirmar<br/>RF-04 RNF-02 RNF-04"]
    end

    subgraph dados["Camada de dados"]
        tabela["Amazon DynamoDB<br/>cptm-sos-relatos<br/>partição: estacao_id<br/>ordenação: dia_protocolo"]
        fotos["Amazon S3<br/>cptm-sos-fotos<br/>fotos/estacao_id/protocolo.jpg"]
    end

    subgraph apoio["Apoio"]
        iam["AWS IAM<br/>um papel por função<br/>consultar só lê: RF-03"]
        logs["Amazon CloudWatch Logs<br/>sem IP nem EXIF<br/>RF-05 RNF-03"]
    end

    nav -->|"carrega a página"| site
    nav -->|"POST /relatos"| api
    nav -->|"GET /relatos?estacao="| api
    nav -->|"POST /confirmacoes"| api
    nav -->|"abre a foto pelo endereço, só leitura"| fotos

    api --> registrar
    api --> consultar
    api --> confirmar

    registrar -->|"1. put_object da foto"| fotos
    registrar -->|"2. put_item, só se o protocolo for novo"| tabela
    consultar -->|"query: estação e últimos 30 dias"| tabela
    confirmar -->|"update_item condicional"| tabela

    iam -.->|"autoriza"| registrar
    iam -.->|"autoriza só leitura"| consultar
    iam -.->|"autoriza"| confirmar

    registrar -.->|"print"| logs
    consultar -.->|"print"| logs
    confirmar -.->|"print"| logs
```

## Como ler

As setas cheias são o caminho do dado. As pontilhadas são autorização e
registro: não carregam dado da passageira, mas sem elas nada funciona e nada é
auditável.

**Nenhuma seta liga o navegador à tabela.** O único caminho até os relatos passa
pelo API Gateway e por uma função, como descreve a seção 2.1 do documento de
arquitetura. A única seta do navegador até a camada de dados é a da foto, e ela
é só de leitura: o navegador abre uma foto cujo endereço já recebeu, sem poder
listar o bucket, gravar ou apagar.

A função `registrar` tem duas setas de saída, numeradas porque a ordem importa:
primeiro a foto, depois o relato. É a preocupação de Reliability do FURPS — não
pode existir relato listado apontando para uma foto que nunca subiu.

A seta do IAM para a `consultar` diz "só leitura" porque é ela que cumpre o
RF-03: a função que responde à consulta não consegue alterar nenhum relato.
