/**
 * Cálculo de rota entre duas estações.
 *
 * Substitui o script Python que fazia isso antes. O script dependia de networkx
 * e folium num ambiente virtual à parte — quebrava em qualquer máquina que não o
 * tivesse montado — e desenhava o resultado num mapa geográfico cujas posições
 * ele mesmo inventava: o comentário no topo do arquivo dizia "layout geográfico
 * sintético (não há lat/lon no JSON original)", e as coordenadas saíam de uma
 * simulação de forças jogada sobre o centro de São Paulo.
 *
 * O que os dados sustentam de verdade é a sequência: por quais linhas se passa,
 * onde se baldeia e quantas paradas são. É isso que este módulo calcula.
 */
import fs from "fs";
import path from "path";

export interface Perna {
    linha: string;
    cor: string;
    embarque: string;
    desembarque: string;
    paradas: number;
}

export interface Rota {
    origem: string;
    destino: string;
    pernas: Perna[];
    paradas: number;
    baldeacoes: number;
    minutos: number;
    /**
     * Verdadeiro quando as duas estações são a mesma transferência com nomes
     * diferentes — Consolação e Paulista. Não há trecho de trem: quem vai de uma
     * à outra atravessa a estação a pé, e a tela precisa dizer isso em vez de
     * mostrar um trajeto vazio.
     */
    mesmaBaldeacao: boolean;
}

interface Linha {
    id: number;
    nome: string;
    trajeto: string[];
    ligacoes?: Array<{ estacao: string; linhas: number[] }>;
}

// Estimativas de tempo. Não há tabela de horários no projeto, então o número é
// declaradamente uma estimativa por taxa fixa — a tela diz "estimado".
const MINUTOS_POR_PARADA = 2;
const MINUTOS_POR_BALDEACAO = 4;

// Baldear custa mais do que seguir na mesma linha: sem este peso a busca troca
// de linha à toa para economizar uma parada, e devolve trajetos que ninguém faz.
const PESO_BALDEACAO = 4;

const CORES: Record<string, string> = {
    azul: "#0455A1",
    verde: "#007E5E",
    vermelha: "#EE372F",
    amarela: "#FFF00E",
    "lilás": "#9B3894",
    rubi: "#A43541",
    diamante: "#9A9A9A",
    esmeralda: "#00A99D",
    turquesa: "#00B0AC",
    coral: "#F4A900",
    safira: "#153E7E",
    jade: "#00A650",
    prata: "#9B9B9B",
};

export function corDaLinha(nome: string): string {
    const chaveCor = nome.split(/[-–]/).pop()?.trim().toLowerCase() ?? "";
    return CORES[chaveCor] ?? "#1B4680";
}

let cacheLinhas: Linha[] | null = null;

export function carregarLinhas(caminho?: string): Linha[] {
    if (cacheLinhas && !caminho) return cacheLinhas;
    const arquivo = caminho || path.join(__dirname, "estacoes.json");
    const linhas = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Linha[];
    if (!caminho) cacheLinhas = linhas;
    return linhas;
}

export function listarEstacoes(linhas = carregarLinhas()): string[] {
    const nomes = new Set<string>();
    for (const linha of linhas) for (const estacao of linha.trajeto) nomes.add(estacao);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Baldeações entre estações de nomes diferentes. A maioria das transferências
 * acontece na mesma estação, presente no trajeto de duas linhas. Mas há o caso
 * de Consolação (verde) com Paulista (amarela): é a mesma transferência, com
 * nomes distintos de cada lado, e só o campo `ligacoes` a declara.
 */
function paresDeNomesDiferentes(linhas: Linha[]): Array<[string, string]> {
    const porId = new Map(linhas.map((l) => [l.id, l]));
    const pares: Array<[string, string]> = [];

    for (const linha of linhas) {
        for (const ligacao of linha.ligacoes ?? []) {
            for (const outroId of ligacao.linhas) {
                const outra = porId.get(outroId);
                if (!outra || outra.trajeto.includes(ligacao.estacao)) continue;

                // a contraparte é a estação da outra linha que aponta de volta
                // para esta e também não compartilha o nome
                const contraparte = (outra.ligacoes ?? []).find(
                    (l) => l.linhas.includes(linha.id) && !linha.trajeto.includes(l.estacao)
                );
                if (contraparte) pares.push([ligacao.estacao, contraparte.estacao]);
            }
        }
    }
    return pares;
}

type Estado = string; // "estação|idDaLinha"

// A barra separa a estação da linha. Não pode ser espaço: 94 das 176 estações
// têm espaço no nome, e "Ana Rosa 2" seria lido como a estação "Ana" na linha
// NaN. Nenhum nome contém "|", e há teste garantindo que continue assim.
const SEPARADOR = "|";

const chave = (estacao: string, linha: number): Estado => `${estacao}${SEPARADOR}${linha}`;
const separar = (estado: Estado) => {
    const corte = estado.lastIndexOf(SEPARADOR);
    return { estacao: estado.slice(0, corte), linha: Number(estado.slice(corte + 1)) };
};

/**
 * Menor caminho por Dijkstra sobre estados (estação, linha). O estado carrega a
 * linha para que trocar de linha tenha custo próprio e para que a resposta saiba
 * dizer em que linha cada trecho foi feito.
 */
export function calcularRota(origem: string, destino: string, linhas = carregarLinhas()): Rota | null {
    const estacoes = new Set(listarEstacoes(linhas));
    if (!estacoes.has(origem) || !estacoes.has(destino)) return null;
    if (origem === destino) {
        return { origem, destino, pernas: [], paradas: 0, baldeacoes: 0, minutos: 0, mesmaBaldeacao: false };
    }

    const porId = new Map(linhas.map((l) => [l.id, l]));
    const linhasDaEstacao = new Map<string, number[]>();
    for (const linha of linhas) {
        for (const estacao of linha.trajeto) {
            if (!linhasDaEstacao.has(estacao)) linhasDaEstacao.set(estacao, []);
            linhasDaEstacao.get(estacao)!.push(linha.id);
        }
    }

    const apelidos = new Map<string, string[]>();
    for (const [a, b] of paresDeNomesDiferentes(linhas)) {
        if (!apelidos.has(a)) apelidos.set(a, []);
        if (!apelidos.has(b)) apelidos.set(b, []);
        apelidos.get(a)!.push(b);
        apelidos.get(b)!.push(a);
    }

    const vizinhos = (estado: Estado): Array<{ para: Estado; custo: number }> => {
        const { estacao, linha } = separar(estado);
        const saidas: Array<{ para: Estado; custo: number }> = [];

        // seguir na mesma linha
        const trajeto = porId.get(linha)!.trajeto;
        const i = trajeto.indexOf(estacao);
        for (const j of [i - 1, i + 1]) {
            if (j >= 0 && j < trajeto.length) saidas.push({ para: chave(trajeto[j], linha), custo: 1 });
        }

        // baldear na mesma estação
        for (const outra of linhasDaEstacao.get(estacao) ?? []) {
            if (outra !== linha) saidas.push({ para: chave(estacao, outra), custo: PESO_BALDEACAO });
        }

        // baldear para uma estação de outro nome (Consolação e Paulista)
        for (const vizinha of apelidos.get(estacao) ?? []) {
            for (const outra of linhasDaEstacao.get(vizinha) ?? []) {
                saidas.push({ para: chave(vizinha, outra), custo: PESO_BALDEACAO });
            }
        }

        return saidas;
    };

    const distancia = new Map<Estado, number>();
    const anterior = new Map<Estado, Estado>();
    const fila: Array<{ estado: Estado; custo: number }> = [];

    for (const linha of linhasDaEstacao.get(origem) ?? []) {
        const inicio = chave(origem, linha);
        distancia.set(inicio, 0);
        fila.push({ estado: inicio, custo: 0 });
    }

    let fim: Estado | null = null;
    while (fila.length) {
        // fila pequena (176 estações vezes 13 linhas); a busca linear basta e
        // mantém o código legível
        fila.sort((a, b) => a.custo - b.custo);
        const atual = fila.shift()!;
        if (atual.custo > (distancia.get(atual.estado) ?? Infinity)) continue;

        if (separar(atual.estado).estacao === destino) {
            fim = atual.estado;
            break;
        }

        for (const { para, custo } of vizinhos(atual.estado)) {
            const novo = atual.custo + custo;
            if (novo < (distancia.get(para) ?? Infinity)) {
                distancia.set(para, novo);
                anterior.set(para, atual.estado);
                fila.push({ estado: para, custo: novo });
            }
        }
    }

    if (!fim) return null;

    const caminho: Estado[] = [];
    for (let no: Estado | undefined = fim; no; no = anterior.get(no)) caminho.unshift(no);

    // agrupa o caminho em trechos por linha
    const pernas: Perna[] = [];
    let paradas = 0;
    for (const estado of caminho) {
        const { estacao, linha } = separar(estado);
        const ultima = pernas[pernas.length - 1];
        const nome = porId.get(linha)!.nome;

        if (ultima && ultima.linha === nome && ultima.desembarque !== estacao) {
            ultima.desembarque = estacao;
            ultima.paradas += 1;
            paradas += 1;
        } else if (!ultima || ultima.linha !== nome) {
            pernas.push({
                linha: nome,
                cor: corDaLinha(nome),
                embarque: estacao,
                desembarque: estacao,
                paradas: 0,
            });
        }
    }

    // trechos sem deslocamento são baldeação, não viagem
    const comViagem = pernas.filter((p) => p.paradas > 0);
    const baldeacoes = Math.max(0, comViagem.length - 1);

    return {
        origem,
        destino,
        pernas: comViagem,
        paradas,
        baldeacoes,
        minutos: paradas * MINUTOS_POR_PARADA + baldeacoes * MINUTOS_POR_BALDEACAO,
        mesmaBaldeacao: comViagem.length === 0,
    };
}
