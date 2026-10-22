import { test, expect } from "@playwright/test";
import { autenticar, resetarBanco } from "./helpers";

// As telas internas passaram a compartilhar um cabeçalho só (assets/css/cabecalho.css).
// Antes cada folha tinha a sua cópia e elas divergiram: a home ganhou os trilhos e a
// saudação, enquanto pagamento e denúncia ficaram com a faixa larga antiga e uma foto
// de perfil que já havia sido removida. Estes testes existem para que a próxima
// divergência apareça aqui, e não numa captura de tela meses depois.
const TELAS = ["/home.html", "/pagamento.html", "/pagamento-pós.html", "/formularioDenuncia.html"];

test.beforeEach(async ({ context, request }) => {
    resetarBanco();
    await autenticar(context, request, "ana.souza@example.com");
});

test("toda tela interna saúda a pessoa pelo nome", async ({ page }) => {
    for (const tela of TELAS) {
        await page.goto(tela);
        await expect(page.locator("#boas-vindas"), tela).toHaveText("Olá, Ana");
    }
});

test("nenhuma tela interna voltou a exibir foto de perfil", async ({ page }) => {
    for (const tela of TELAS) {
        await page.goto(tela);
        await expect(page.locator("header img[src*='perfil' i]"), tela).toHaveCount(0);
    }
});

test("os trilhos e a altura do cabeçalho são os mesmos em todas as telas", async ({ page }) => {
    const medidas: { tela: string; altura: number; trilhos: number }[] = [];

    for (const tela of TELAS) {
        await page.goto(tela);
        await page.waitForTimeout(200);
        medidas.push({
            tela,
            ...(await page.evaluate(() => ({
                altura: document.querySelector(".header-todo")!.getBoundingClientRect().height,
                trilhos: document.querySelectorAll(".header-todo .barra").length,
            }))),
        });
    }

    const referencia = medidas[0];
    for (const m of medidas) {
        expect(m.trilhos, m.tela).toBe(1);
        expect(Math.abs(m.altura - referencia.altura), m.tela).toBeLessThan(1);
    }
});

// O saldo e a saudação vinham da mesma rota, pedida duas vezes na mesma tela.
test("a tela pede /api/usuario uma vez só", async ({ page }) => {
    let chamadas = 0;
    page.on("request", (r) => {
        if (new URL(r.url()).pathname === "/api/usuario") chamadas++;
    });

    await page.goto("/pagamento.html");
    await expect(page.locator("#dinheiro")).not.toHaveText("Carregando...");
    await expect(page.locator("#boas-vindas")).toHaveText("Olá, Ana");

    expect(chamadas).toBe(1);
});

// O rodapé precisa estar sempre na tela. A home e a denúncia já prendiam a
// altura da página e rolavam só o miolo; pagamento, pós-pagamento e denúncia
// deixavam a página inteira crescer — e no Safari do iPhone o fim da página cai
// atrás da barra do navegador, o que passa por rodapé sumido.
test("o rodapé fica visível sem rolar, em qualquer altura de tela", async ({ page }) => {
    for (const altura of [932, 745, 660, 568]) {
        await page.setViewportSize({ width: 393, height: altura });

        for (const tela of TELAS) {
            await page.goto(tela);
            await page.waitForTimeout(150);

            const m = await page.evaluate(() => {
                const rodape = document.querySelector("footer, .rodape-acao, .barra-navegacao")!.getBoundingClientRect();
                return {
                    fimDoRodape: Math.round(rodape.bottom),
                    janela: window.innerHeight,
                    paginaRola: document.documentElement.scrollHeight > window.innerHeight + 1,
                };
            });

            expect(m.fimDoRodape, `${tela} em ${altura}px`).toBeLessThanOrEqual(m.janela + 1);
            expect(m.paginaRola, `${tela} em ${altura}px rola a página inteira`).toBe(false);
        }
    }
});

// Quando o conteúdo não cabe, quem rola é o miolo — entre o cabeçalho e o
// rodapé, que continuam parados.
test("conteúdo que não cabe rola por dentro, sem levar as barras junto", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/pagamento-pós.html");

    const m = await page.evaluate(() => {
        const miolo = document.querySelector(".conteudo") as HTMLElement;
        const topoAntes = document.querySelector(".header-todo")!.getBoundingClientRect().top;
        miolo.scrollTop = miolo.scrollHeight;
        return {
            rolou: miolo.scrollTop > 0,
            cabecalhoParado:
                document.querySelector(".header-todo")!.getBoundingClientRect().top === topoAntes,
            rodapeNaTela:
                document.querySelector("footer, .rodape-acao, .barra-navegacao")!.getBoundingClientRect().bottom <= window.innerHeight + 1,
        };
    });

    expect(m.rolou).toBe(true);
    expect(m.cabecalhoParado).toBe(true);
    expect(m.rodapeNaTela).toBe(true);
});

// A barra de seções existia duas vezes, com marcações diferentes: a home usava
// <div class="botao-footer">, o mapa <div class="secoes"> — nenhuma alcançável
// por teclado, e só a denúncia da home tinha destino.
test("a barra de seções acende o item da tela em que se está", async ({ page }) => {
    for (const [tela, esperado] of [
        ["/home.html", "Home"],
        ["/mapa.html", "Localização"],
    ]) {
        await page.goto(tela);
        const aceso = page.locator('.item-nav[aria-current="page"]');
        await expect(aceso, tela).toHaveCount(1);
        await expect(aceso, tela).toContainText(esperado);
    }
});

test("os itens da barra são alcançáveis por teclado e levam a algum lugar", async ({ page }) => {
    await page.goto("/home.html");

    const links = page.locator(".item-nav[href]");
    await expect(links).toHaveCount(4);

    // Ajustes não tem tela no projeto: fica declarado como indisponível em vez
    // de parecer um botão que não faz nada.
    const semDestino = page.locator('.item-nav[aria-disabled="true"]');
    await expect(semDestino).toHaveCount(1);
    await expect(semDestino).toContainText("Ajustes");

    await links.nth(1).focus();
    await expect(links.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/mapa\.html$/);
});

test("a logo leva de volta à home, e não vira link na própria home", async ({ page }) => {
    await page.goto("/pagamento.html");
    await page.click(".logo-link");
    await page.waitForURL(/home\.html$/);

    // na home ela não é link: recarregar a página em que já se está é ruído
    await expect(page.locator(".logo-link")).toHaveCount(0);
});
