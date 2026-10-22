// Home: o carrossel de avisos e o indicador de página. Sem o indicador, o segundo
// card aparece cortado na borda e nada sinaliza que há mais conteúdo — dava para
// confundir com corte acidental de layout.
import { test, expect } from "@playwright/test";
import { autenticar, resetarBanco } from "./helpers.ts";

test.beforeEach(async ({ context, request }) => {
    resetarBanco();
    await autenticar(context, request, "ana.souza@example.com");
});

test("o carrossel de avisos tem um indicador por aviso", async ({ page }) => {
    await page.goto("/home.html");

    const cards = page.locator(".aviso-card");
    const pontos = page.locator(".avisos-indicadores button");

    await expect(pontos).toHaveCount(await cards.count());
    await expect(pontos.first()).toHaveAttribute("aria-selected", "true");
});

test("clicar num indicador leva ao aviso correspondente", async ({ page }) => {
    await page.goto("/home.html");

    await page.locator(".avisos-indicadores button").nth(2).click();

    await expect(page.locator('.avisos-indicadores button[aria-selected="true"]'))
        .toHaveAttribute("aria-label", /3 de/);
});

test("rolar o carrossel atualiza o indicador", async ({ page }) => {
    await page.goto("/home.html");

    await page.evaluate(() => {
        const lista = document.querySelector(".avisos-lista")!;
        lista.scrollTo({ left: lista.scrollWidth });
    });

    await expect(page.locator('.avisos-indicadores button[aria-selected="true"]'))
        .not.toHaveAttribute("aria-label", /1 de/);
});

test("a home carrega sem erro de script", async ({ page }) => {
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(String(e)));

    await page.goto("/home.html");
    await page.waitForTimeout(600);

    expect(erros).toEqual([]);
});

test("o botão de ocultar saldo alterna e anuncia o estado", async ({ page }) => {
    await page.goto("/home.html");

    const olho = page.locator("#olho");
    const valor = page.locator("#valor-saldo");

    await expect(valor).toHaveText(/R\$/);
    await expect(olho).toHaveAttribute("aria-label", "Ocultar saldo");

    await olho.click();
    await expect(valor).toHaveText("********");
    await expect(olho).toHaveAttribute("aria-pressed", "true");
    await expect(olho).toHaveAttribute("aria-label", "Mostrar saldo");

    await olho.click();
    await expect(valor).toHaveText(/R\$/);
    await expect(olho).toHaveAttribute("aria-pressed", "false");
});

// Os trilhos ficam no canto justamente para não disputar espaço com a saudação:
// antes a faixa cruzava o cabeçalho e já se sobrepunha ao texto com um nome comum.
test("os trilhos do cabeçalho não invadem a área da saudação", async ({ page }) => {
    await page.goto("/home.html");

    const medidas = await page.evaluate(() => {
        const trilhos = document.querySelector(".barra")!.getBoundingClientRect();
        const saudacao = document.getElementById("boas-vindas")!.getBoundingClientRect();
        return { trilhosEsquerda: trilhos.left, saudacaoDireita: saudacao.right };
    });

    expect(medidas.saudacaoDireita).toBeLessThanOrEqual(medidas.trilhosEsquerda);
});

test("apelido comprido não quebra o cabeçalho", async ({ page, request }) => {
    const resp = await request.post("/api/login", {
        data: { email: "ana.souza@example.com", senha: "demo1234" },
    });
    const { token } = await resp.json();

    await request.put("/api/usuario/apelido", {
        data: { apelido: "A".repeat(40) },
        headers: { Authorization: `Bearer ${token}` },
    });

    await page.setViewportSize({ width: 393, height: 800 });
    await page.goto("/home.html");
    await page.waitForTimeout(600);

    const medidas = await page.evaluate(() => {
        const saudacao = document.getElementById("boas-vindas")!;
        const trilhos = document.querySelector(".barra")!.getBoundingClientRect();
        return {
            saudacaoDireita: saudacao.getBoundingClientRect().right,
            trilhosEsquerda: trilhos.left,
            truncou: saudacao.scrollWidth > saudacao.clientWidth,
            vazaNaHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
    });

    // o texto corta com reticências em vez de empurrar o que vem depois
    expect(medidas.truncou).toBe(true);
    expect(medidas.saudacaoDireita).toBeLessThanOrEqual(medidas.trilhosEsquerda);
    expect(medidas.vazaNaHorizontal).toBe(false);
});

// Cabeçalho e rodapé derivam da mesma variável de altura. Antes um dependia do
// tamanho da foto de perfil e o outro do ícone mais o rótulo: ficavam próximos
// por ajuste manual, e mudar qualquer um deles separava os dois sem aviso.
test("cabeçalho e rodapé têm a mesma altura, em qualquer tela", async ({ page }) => {
    for (const altura of [660, 800, 917]) {
        await page.setViewportSize({ width: 393, height: altura });
        await page.goto("/home.html");
        await page.waitForTimeout(300);

        const m = await page.evaluate(() => ({
            cabecalho: document.querySelector(".header-todo")!.getBoundingClientRect().height,
            rodape: document.querySelector(".barra-navegacao")!.getBoundingClientRect().height,
        }));

        expect(Math.abs(m.cabecalho - m.rodape), `em tela de ${altura}px`).toBeLessThan(1);
    }
});

// O endereço fica centrado entre o fim da busca e a base do cartão. Estava preso
// a uma distância fixa da borda, que desalinhava se a busca ou o cartão mudassem.
test("o endereço fica centrado no espaço abaixo da busca", async ({ page }) => {
    await page.goto("/home.html");
    await page.waitForTimeout(400);

    const m = await page.evaluate(() => {
        const cartao = document.querySelector(".mapa")!.getBoundingClientRect();
        const busca = document.querySelector(".input-busca")!.getBoundingClientRect();
        const endereco = document.querySelector(".endereco")!.getBoundingClientRect();
        const centroDisponivel = busca.bottom + (cartao.bottom - busca.bottom) / 2;
        const centroTexto = endereco.top + endereco.height / 2;
        return Math.abs(centroTexto - centroDisponivel);
    });

    expect(m).toBeLessThan(2);
});
