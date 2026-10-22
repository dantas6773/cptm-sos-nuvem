// Cálculo de rota. Substituiu um script Python que dependia de networkx e folium
// num ambiente virtual à parte — e que, mesmo funcionando, desenhava as estações
// em coordenadas inventadas por uma simulação de forças.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularRota, listarEstacoes, corDaLinha, carregarLinhas } from "../assets/src/rota.ts";

test("todas as 176 estações da rede são listadas, sem repetição", () => {
    const estacoes = listarEstacoes();
    assert.equal(estacoes.length, 176);
    assert.equal(new Set(estacoes).size, estacoes.length);
});

// A busca guarda o estado como "estação|linha". A primeira versão separava por
// espaço com split(), e "Ana Rosa 2" virava a estação "Ana" na linha NaN — 94
// das 176 estações têm espaço no nome. Este teste percorre um trajeto inteiro
// de nomes compostos e confere que voltam exatos.
test("estações de nome composto atravessam a busca inteiras", () => {
    const compostas = listarEstacoes().filter((e) => e.includes(" "));
    assert.ok(compostas.length > 90, "esperado que a maioria dos nomes tenha espaço");

    const rota = calcularRota("Ana Rosa", "Vila Madalena")!;
    assert.equal(rota.pernas[0].embarque, "Ana Rosa");
    assert.equal(rota.pernas[rota.pernas.length - 1].desembarque, "Vila Madalena");

    // e nenhum nome sai truncado no meio do caminho
    for (const perna of rota.pernas) {
        assert.ok(listarEstacoes().includes(perna.embarque), `embarque inválido: ${perna.embarque}`);
        assert.ok(listarEstacoes().includes(perna.desembarque), `desembarque inválido: ${perna.desembarque}`);
    }
});

test("trecho direto numa linha só conta as paradas certas", () => {
    const rota = calcularRota("Sé", "Tucuruvi")!;

    assert.equal(rota.pernas.length, 1);
    assert.equal(rota.pernas[0].linha, "Linha 1 - Azul");
    assert.equal(rota.pernas[0].embarque, "Sé");
    assert.equal(rota.pernas[0].desembarque, "Tucuruvi");
    assert.equal(rota.paradas, 10);
    assert.equal(rota.baldeacoes, 0);
});

test("a linha azul inteira são 22 paradas, de ponta a ponta", () => {
    const rota = calcularRota("Jabaquara", "Tucuruvi")!;
    assert.equal(rota.paradas, 22);
    assert.equal(rota.baldeacoes, 0);
});

// Consolação (verde) e Paulista (amarela) são a mesma transferência com nomes
// diferentes, declarada só no campo `ligacoes`. Sem tratá-la, o trajeto daria
// uma volta absurda ou não existiria.
test("baldeia entre estações de nomes diferentes", () => {
    const rota = calcularRota("Butantã", "Ana Rosa")!;

    assert.equal(rota.baldeacoes, 1);
    assert.equal(rota.pernas.length, 2);
    assert.equal(rota.pernas[0].linha, "Linha 4 - Amarela");
    assert.equal(rota.pernas[0].desembarque, "Paulista");
    assert.equal(rota.pernas[1].embarque, "Consolação");
    assert.equal(rota.pernas[1].linha, "Linha 2 - Verde");
    assert.equal(rota.pernas[1].desembarque, "Ana Rosa");
});

test("ir de uma ponta da baldeação à outra é atravessar a estação, não viajar", () => {
    const rota = calcularRota("Consolação", "Paulista")!;

    assert.equal(rota.mesmaBaldeacao, true);
    assert.equal(rota.pernas.length, 0);
    assert.equal(rota.paradas, 0);
});

test("estação que não existe não devolve rota", () => {
    assert.equal(calcularRota("Hogsmeade", "Luz"), null);
    assert.equal(calcularRota("Luz", "Hogsmeade"), null);
});

test("origem igual ao destino é rota de zero paradas", () => {
    const rota = calcularRota("Luz", "Luz")!;
    assert.equal(rota.paradas, 0);
    assert.equal(rota.pernas.length, 0);
    assert.equal(rota.mesmaBaldeacao, false);
});

// Ida e volta percorrem o mesmo caminho: se não percorrerem, a busca está
// preferindo um trajeto por acaso da ordem em que os vizinhos são visitados.
test("ida e volta têm o mesmo número de paradas", () => {
    const pares: Array<[string, string]> = [
        ["Butantã", "Ana Rosa"],
        ["Jundiaí", "Jabaquara"],
        ["Vila Madalena", "Vila Prudente"],
        ["Tucuruvi", "Sé"],
    ];

    for (const [a, b] of pares) {
        const ida = calcularRota(a, b)!;
        const volta = calcularRota(b, a)!;
        assert.equal(ida.paradas, volta.paradas, `${a} para ${b}`);
        assert.equal(ida.baldeacoes, volta.baldeacoes, `${a} para ${b}`);
    }
});

// Sem peso na baldeação a busca troca de linha para economizar uma parada e
// devolve trajetos que ninguém faz. Neste par a diferença é gritante: com peso
// são 25 paradas e 1 baldeação; sem peso, 24 paradas e 3 baldeações — duas
// trocas de trem a mais para poupar uma estação.
test("não troca de linha para economizar uma parada", () => {
    const rota = calcularRota("2 Bueno", "Anhangabaú")!;
    assert.equal(rota.baldeacoes, 1);
});

test("trecho de uma linha só continua de uma linha só", () => {
    const rota = calcularRota("Vergueiro", "Armênia")!;
    assert.equal(rota.baldeacoes, 0);
    assert.equal(rota.pernas.length, 1);
    assert.equal(rota.pernas[0].linha, "Linha 1 - Azul");
});

test("existe rota entre qualquer par de estações da rede", () => {
    const estacoes = listarEstacoes();
    const alvo = "Luz";
    const semRota = estacoes.filter((e) => e !== alvo && calcularRota(e, alvo) === null);
    assert.deepEqual(semRota, []);
});

test("o tempo estimado cresce com paradas e baldeações", () => {
    const curta = calcularRota("Sé", "Luz")!;
    const longa = calcularRota("Jabaquara", "Tucuruvi")!;
    assert.ok(longa.minutos > curta.minutos);

    // a conta é declaradamente por taxa fixa: 2 min por parada, 4 por baldeação
    const comBaldeacao = calcularRota("Butantã", "Ana Rosa")!;
    assert.equal(comBaldeacao.minutos, comBaldeacao.paradas * 2 + comBaldeacao.baldeacoes * 4);
});

test("cada linha da rede tem uma cor própria", () => {
    const linhas = carregarLinhas();
    const cores = linhas.map((l) => corDaLinha(l.nome));

    // nenhuma caiu no azul padrão por falta de correspondência
    assert.equal(cores.filter((c) => c === "#1B4680").length, 0);
    assert.equal(new Set(cores).size >= 11, true);
    assert.equal(corDaLinha("Linha 1 - Azul"), "#0455A1");
    assert.equal(corDaLinha("Linha 13 – Jade"), "#00A650");
});
