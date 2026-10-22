import { test, expect } from "@playwright/test";
import { autenticar, resetarBanco } from "./helpers.ts";

// O app não deve se comportar como página web: arrastar o dedo sobre um texto o
// realçava, o toque longo abria o menu Copiar do iOS e o toque duplo dava zoom.
// As regras vivem em assets/css/base.css, que todas as telas carregam.
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

test("nenhuma tela permite selecionar o texto da interface", async ({ page }) => {
    for (const tela of TELAS) {
        await page.goto(`/${encodeURIComponent(tela)}`);
        const estilo = await page.evaluate(() => {
            const raiz = getComputedStyle(document.documentElement);
            return { selecao: raiz.userSelect, toque: raiz.touchAction };
        });
        expect(estilo.selecao, tela).toBe("none");
        // `manipulation` desliga o toque duplo mantendo rolagem e pinça
        expect(estilo.toque, tela).toBe("manipulation");
    }
});

test("campos de formulário continuam selecionáveis e editáveis", async ({ page }) => {
    await page.goto("/cadastro.html");
    const cpf = page.locator('input[type="text"]').first();
    await cpf.fill("12345678901");

    const resultado = await cpf.evaluate((el: HTMLInputElement) => {
        el.setSelectionRange(0, 3);
        return {
            selecao: getComputedStyle(el).userSelect,
            trecho: el.value.slice(el.selectionStart!, el.selectionEnd!),
        };
    });

    expect(resultado.selecao).toBe("text");
    expect(resultado.trecho).toBe("123");
});

test("a descrição da denúncia continua selecionável", async ({ page }) => {
    await page.goto("/formularioDenuncia.html");
    await page.locator(".categoria").first().click();

    const area = page.locator("textarea");
    await area.fill("Relato de teste");
    expect(await area.evaluate((el) => getComputedStyle(el).userSelect)).toBe("text");
});

// A tela diz "Guarde o número de protocolo para acompanhar a ocorrência" — se o
// bloqueio de seleção valesse aqui, ela pediria algo que ela mesma impede.
test("o número de protocolo continua copiável", async ({ page }) => {
    await page.goto("/formularioDenuncia.html");
    await page.locator(".categoria").first().click();
    await page.fill("textarea", "Relato de teste para gerar protocolo.");
    await page.click("#enviar");

    const protocolo = page.locator(".protocolo");
    await expect(protocolo).toBeVisible();

    const r = await protocolo.evaluate((el) => {
        const faixa = document.createRange();
        faixa.selectNodeContents(el);
        const selecao = window.getSelection()!;
        selecao.removeAllRanges();
        selecao.addRange(faixa);
        return { estilo: getComputedStyle(el).userSelect, texto: el.textContent, selecionado: String(window.getSelection()) };
    });

    expect(r.estilo).toBe("text");
    expect(r.selecionado).toBe(r.texto);
    expect(r.selecionado!.length).toBeGreaterThan(0);
});

// O controle de arrastar do alarme trata o gesto por conta própria; o navegador
// não pode reivindicar o arrasto horizontal no meio do caminho.
test("o slider do alarme reserva o gesto de arrastar para si", async ({ page }) => {
    await page.goto("/denuncia.html");
    const toque = await page
        .locator(".slider-button")
        .evaluate((el) => getComputedStyle(el).touchAction);
    expect(toque).toBe("none");
});

// Bloquear o zoom por completo tiraria a única saída de quem precisa ampliar.
test("a pinça para ampliar continua disponível", async ({ page }) => {
    for (const tela of TELAS) {
        await page.goto(`/${encodeURIComponent(tela)}`);
        const conteudo = await page.getAttribute('meta[name="viewport"]', "content");
        expect(conteudo, tela).not.toMatch(/user-scalable\s*=\s*no/);
        expect(conteudo, tela).not.toMatch(/maximum-scale/);
    }
});

// Cada tela é um documento próprio, então trocar de tela descartava tudo e
// remontava — daí o flash branco a cada toque. A transição entre documentos
// guarda o quadro anterior e faz a passagem, sem deixar de ser multipágina.
test("a troca de tela usa transição em vez de recarregar à vista", async ({ page }) => {
    await page.goto("/home.html");

    const estado = await page.evaluate(() => {
        let encontrada = null;
        for (const folha of Array.from(document.styleSheets)) {
            try {
                for (const regra of Array.from(folha.cssRules)) {
                    if (/@view-transition/.test(regra.cssText || "")) encontrada = regra.cssText;
                }
            } catch {
                // folha de outra origem: não há nenhuma, mas o acesso pode lançar
            }
        }
        return {
            regra: encontrada,
            // cabeçalho e barra têm nome próprio, então ficam parados enquanto o
            // miolo troca, em vez de a tela inteira dissolver
            cabecalho: getComputedStyle(document.querySelector(".header-todo")!).viewTransitionName,
            barra: getComputedStyle(document.querySelector(".barra-navegacao")!).viewTransitionName,
        };
    });

    expect(estado.regra).toContain("navigation: auto");
    expect(estado.cabecalho).toBe("cabecalho");
    expect(estado.barra).toBe("barra-secoes");
});

// A transição é conforto visual; para parte das pessoas o movimento é o
// contrário disso, e o sistema já diz quando é o caso.
test("quem pede menos movimento no sistema não recebe animação", async ({ browser }) => {
    const contexto = await browser.newContext({ reducedMotion: "reduce" });
    const pagina = await contexto.newPage();
    await pagina.goto("/login.html");

    const regra = await pagina.evaluate(() => {
        for (const folha of Array.from(document.styleSheets)) {
            try {
                for (const r of Array.from(folha.cssRules)) {
                    const texto = r.cssText || "";
                    if (texto.includes("prefers-reduced-motion") && texto.includes("view-transition")) {
                        return texto;
                    }
                }
            } catch {
                // ignora
            }
        }
        return null;
    });

    expect(regra, "regra de movimento reduzido ausente").not.toBeNull();
    // o navegador devolve o atalho na forma longa, então a checagem é pelo nome
    // da animação (none) e pelo !important, não pelo texto que foi escrito
    expect(regra).toMatch(/animation:[^;}]*none[^;}]*!important/);
    expect(regra).toContain("::view-transition-group(*)");

    await contexto.close();
});
