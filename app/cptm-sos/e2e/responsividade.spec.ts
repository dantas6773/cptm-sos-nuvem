import { test, expect } from "@playwright/test";
import { autenticar, resetarBanco } from "./helpers.ts";

const TELAS = [
    "login.html",
    "cadastro.html",
    "apelido.html",
    "carregamento.html",
    "home.html",
    "QR.html",
    "mapa.html",
    "pagamento.html",
    "pagamento-pós.html",
    "pré-denucia.html",
    "denuncia.html",
    "formularioDenuncia.html",
];

test.beforeEach(async ({ context, request }) => {
    resetarBanco();
    await autenticar(context, request, "ana.souza@example.com");
});

// Do menor celular ainda em uso ao desktop. O app é feito para celular, mas
// abrir no computador não pode render uma tela quebrada.
test("nenhuma tela rola na horizontal, em nenhuma largura", async ({ page }) => {
    for (const largura of [320, 360, 375, 390, 430, 768, 1280]) {
        await page.setViewportSize({ width: largura, height: 800 });

        for (const tela of TELAS) {
            await page.goto(`/${encodeURIComponent(tela)}`);
            const vaza = await page.evaluate(
                () => document.documentElement.scrollWidth > window.innerWidth + 1
            );
            expect(vaza, `${tela} em ${largura}px`).toBe(false);
        }
    }
});

// Alvo mínimo de toque da WCAG 2.2 (critério 2.5.8): 24x24. Os indicadores do
// carrossel tinham 8px — acertar isso com o dedo em movimento é sorte — e os
// controles de texto ficavam na altura da linha, de 15 a 20px.
test("todo controle tem pelo menos 24x24 de área de toque", async ({ page }) => {
    for (const tela of TELAS) {
        await page.goto(`/${encodeURIComponent(tela)}`);
        await page.waitForTimeout(150);

        const pequenos = await page.evaluate(() => {
            const fora: string[] = [];
            const controles = document.querySelectorAll(
                "button:not([hidden]), a[href], select, input:not([type=hidden]), [role=button]"
            );
            for (const el of Array.from(controles)) {
                const caixa = el.getBoundingClientRect();
                if (!caixa.width || !caixa.height) continue; // fora da tela agora
                if (caixa.height < 24 || caixa.width < 24) {
                    const nome = el.id || (el.className || "").toString().split(" ")[0] || el.tagName;
                    fora.push(`${nome} ${Math.round(caixa.width)}x${Math.round(caixa.height)}`);
                }
            }
            return fora;
        });

        expect(pequenos, tela).toEqual([]);
    }
});

// O ponto do carrossel continua com 8px de desenho: quem cresceu foi a área de
// toque em volta dele.
test("o ponto do carrossel cresceu de área sem crescer de tamanho", async ({ page }) => {
    await page.goto("/home.html");
    await page.locator(".avisos-indicadores").scrollIntoViewIfNeeded();

    const m = await page.locator(".avisos-indicadores button").first().evaluate((el) => ({
        alvo: el.getBoundingClientRect().height,
        ponto: parseFloat(getComputedStyle(el, "::before").height),
    }));

    expect(m.alvo).toBeGreaterThanOrEqual(24);
    expect(m.ponto).toBeLessThanOrEqual(10);
});
