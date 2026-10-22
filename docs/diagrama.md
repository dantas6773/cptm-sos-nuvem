# Diagrama de arquitetura — CPTM SOS · Relatos por estação

Entregável da Sprint 2, seção 5. O diagrama foi feito no Lucidchart, no
documento "CPTM SOS - Arquitetura (Sprint 2)", e a imagem exportada de lá está em
[`diagrama.png`](diagrama.png). Ele foi gerado pelo recurso "Diagrama em código"
do Lucidchart, a partir do código Mermaid abaixo, que o GitHub também desenha ao
abrir este arquivo. Para mudar o desenho, mude o código e gere de novo no Lucidchart.

```mermaid
%%{init: {"theme": "default"}}%%
flowchart TB
    subgraph apresentacao["Camada de apresentação"]
        nav["Navegador<br/>relato, consulta e confirmação<br/>limpa a foto e gera os códigos de envio"]
        site["Amazon S3<br/>cptm-sos-site<br/>index.html, config.js, estacoes.json"]
    end

    subgraph negocio["Camada de negócio"]
        api["Amazon API Gateway<br/>três rotas"]
        subgraph funcoes["Funções AWS Lambda"]
            registrar["registrar<br/>RF-01 RF-02 RF-05<br/>RNF-01 RNF-05"]
            confirmar["confirmar<br/>RF-04 RNF-04"]
            consultar["consultar<br/>RF-03 RNF-03"]
        end
    end

    subgraph dados["Camada de dados"]
        fotos["Amazon S3<br/>cptm-sos-fotos<br/>fotos/estacao_id/protocolo.jpg<br/>público só lê: RNF-02"]
        tabela["Amazon DynamoDB<br/>cptm-sos-relatos<br/>partição: estacao_id<br/>ordenação: dia_protocolo"]
    end

    subgraph apoio["Apoio"]
        iam["AWS IAM<br/>um papel por função<br/>consultar só lê: RF-03"]
        logs["Amazon CloudWatch Logs<br/>sem dado de quem chamou<br/>RF-05 RNF-05"]
    end

    nav -->|"carrega a página"| site
    nav -->|"POST /relatos<br/>GET /relatos?estacao=<br/>POST /confirmacoes"| api
    nav -->|"abre a foto pelo endereço, só leitura"| fotos

    api --> registrar
    api --> confirmar
    api --> consultar

    registrar -->|"1. put_object da foto"| fotos
    registrar -->|"2. put_item, só se o protocolo for novo"| tabela
    confirmar -->|"update_item condicional"| tabela
    consultar -->|"query: estação e últimos 30 dias"| tabela

    iam -.->|"autoriza cada função"| funcoes
    funcoes -.->|"uma linha por execução"| logs
```

## Como ler

As setas cheias são o caminho do dado. As pontilhadas são autorização e
registro: não carregam dado da passageira, mas sem elas nada funciona e nada é
auditável. As duas pontilhadas valem para as três funções: cada função tem o
seu papel no IAM, e cada uma deixa uma linha no CloudWatch Logs.

**Nenhuma seta liga o navegador à tabela.** O único caminho até os relatos passa
pelo API Gateway e por uma função, como descreve a seção 2.1 do documento de
arquitetura. A única seta do navegador até a camada de dados é a da foto, e ela
é só de leitura: o navegador abre uma foto cujo endereço já recebeu, sem poder
listar o bucket, gravar ou apagar (RNF-02).

A função `registrar` tem duas setas de saída, numeradas porque a ordem importa:
primeiro a foto, depois o relato. É a preocupação de Reliability do FURPS — não
pode existir relato listado apontando para uma foto que nunca subiu.

O papel do IAM da `consultar` só permite ler a tabela: é ele que cumpre o
RF-03, porque a função que responde à consulta não consegue alterar nenhum
relato.
