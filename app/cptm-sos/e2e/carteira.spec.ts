// Fluxo de dinheiro pela tela: comprar bilhete CREDITA a carteira (o pagamento
// acontece por fora) e passar o QR na catraca DEBITA uma passagem.
import { test, expect } from "@playwright/test";
import { autenticar, resetarBanco, lerBanco } from "./helpers.ts";

const EMAIL = "teste1@example.com"; // começa com saldo 0 no seed
const PRECO = 5.2;

function saldoDe(email: string) {
    return lerBanco().usuarios.find((u: any) => u.email === email).saldo;
}

test.beforeEach(async ({ context, request }) => {
    resetarBanco();
    await autenticar(context, request, EMAIL);
});

test("comprar bilhetes credita o saldo", async ({ page }) => {
    await page.goto("/pagamento-pós.html");

    await page.click("#incrementar-bilhetes");
    await page.click("#incrementar-bilhetes");
    await page.click("#botao-comprar");

    await expect.poll(() => saldoDe(EMAIL), { timeout: 5000 }).toBeCloseTo(2 * PRECO, 2);
});

test("passar na catraca debita uma passagem", async ({ page, request }) => {
    // credita o equivalente a um bilhete pela API, para focar o teste na catraca
    const resp = await request.post("/api/login", { data: { email: EMAIL, senha: "demo1234" } });
    const { token } = await resp.json();
    await request.post("/api/usuario/compra", {
        data: { quantidade: 1 },
        headers: { Authorization: `Bearer ${token}` },
    });

    await page.goto("/QR.html");
    await expect(page.locator(".saldo")).toContainText("5,20");

    await page.click("#btn-catraca");

    // A confirmação chega na home, como a da compra e a do alarme: o bilhete foi
    // usado, então a tela do QR não tem mais função.
    await page.waitForURL(/home\.html$/);
    await expect(page.locator(".dialogo-confirmacao")).toBeVisible();
    await expect(page.locator(".confirmacao-cartao h2")).toHaveText("Passagem liberada!");
    await expect(page.locator(".confirmacao-detalhe")).toContainText("5,20 descontados");
    await expect(page.locator(".confirmacao-detalhe")).toContainText("R$ 0,00");
    await expect(page.locator(".confirmacao-botao")).toHaveText("FECHAR");

    expect(saldoDe(EMAIL)).toBe(0);
    // o saldo da home já é o de depois da passagem
    await expect(page.locator("#valor-saldo")).toContainText("0,00");
});

// A recusa deixou de esperar o toque: sem saldo o botão já nasce desligado e a
// tela diz quanto custa a passagem, em vez de aceitar a ação para negá-la depois.
test("sem saldo, a catraca avisa antes e não deixa nem tentar", async ({ page }) => {
    await page.goto("/QR.html");
    await expect(page.locator(".saldo")).toContainText("0,00");

    await expect(page.locator("#btn-catraca")).toBeDisabled();
    await expect(page.locator("#aviso-catraca")).toContainText("Saldo insuficiente");
    await expect(page.locator("#aviso-catraca")).toContainText("5,20");

    expect(saldoDe(EMAIL)).toBe(0);
});

// O botão desligado é conveniência, não a trava. Quem chamar a rota direto
// continua recusado, e o saldo não pode ficar negativo.
test("a recusa por saldo continua valendo no servidor, não só na tela", async ({ request }) => {
    const login = await request.post("/api/login", { data: { email: EMAIL, senha: "demo1234" } });
    const { token } = await login.json();

    const resp = await request.post("/api/usuario/passagem", {
        headers: { Authorization: `Bearer ${token}` },
    });

    expect(resp.status()).toBe(400);
    expect(saldoDe(EMAIL)).toBe(0);
});

// A tarifa mostrada na tela é a que o servidor cobra — não um número repetido no
// JavaScript, que passaria a mentir se a tarifa mudasse.
test("a tarifa exibida no QR vem do servidor", async ({ page }) => {
    const { precoBilhete } = await (await page.request.get("/api/config")).json();

    await page.goto("/QR.html");
    const mostrado = await page.locator("#preco-passagem").textContent();

    const numero = Number(mostrado!.replace(/[^\d,]/g, "").replace(",", "."));
    expect(numero).toBeCloseTo(precoBilhete, 2);
});

// Pix, cartão e boleto levavam à mesma tela e a escolha se perdia: quem clicava
// em Boleto via exatamente o que quem clicou em Pix, sem nada confirmando o que
// tinha selecionado.
test("o método escolhido chega à tela de compra", async ({ page }) => {
    for (const [metodo, rotulo] of [
        ["pix", "Pix"],
        ["cartao", "Cartão de Crédito"],
        ["boleto", "Boleto Bancário"],
    ]) {
        await page.goto("/pagamento.html");
        await page.click(`[data-metodo="${metodo}"]`);

        await expect(page).toHaveURL(new RegExp(`metodo=${metodo}$`));
        await expect(page.locator("#metodo-nome")).toHaveText(rotulo);
    }
});

test("chegar à compra sem escolher método não mostra linha vazia", async ({ page }) => {
    await page.goto("/pagamento-pós.html");
    await expect(page.locator("#metodo-escolhido")).toBeHidden();

    // e um método inventado na URL não vira texto na tela
    await page.goto("/pagamento-pós.html?metodo=qualquer-coisa");
    await expect(page.locator("#metodo-escolhido")).toBeHidden();
});

// O contador subia sem limite e o servidor recusava em 21; COMPRAR ficava ativo
// com zero bilhetes e só então avisava.
test("os limites da compra aparecem nos botões, não em recusa do servidor", async ({ page }) => {
    await page.goto("/pagamento-pós.html");

    await expect(page.locator("#botao-comprar")).toBeDisabled();
    await expect(page.locator("#decrecimo-bilhetes")).toBeDisabled();

    await page.click("#incrementar-bilhetes");
    await expect(page.locator("#botao-comprar")).toBeEnabled();
    await expect(page.locator("#decrecimo-bilhetes")).toBeEnabled();

    // sobe até o teto vindo de /api/config
    const { maxBilhetes } = await (await page.request.get("/api/config")).json();
    for (let i = 1; i < maxBilhetes; i++) await page.click("#incrementar-bilhetes");

    await expect(page.locator("#quantidade-bilhetes")).toHaveText(String(maxBilhetes));
    await expect(page.locator("#incrementar-bilhetes")).toBeDisabled();
});

// A compra encerra o fluxo: quem comprou volta para a home, onde o saldo novo
// está à vista, e a confirmação chega lá. O retorno era um alert() do navegador,
// que bloqueava a tela e sumia sem deixar rastro para leitor de tela.
test("a compra leva de volta à home com a confirmação", async ({ page }) => {
    let houveCaixaDoSistema = false;
    page.on("dialog", async (d) => {
        houveCaixaDoSistema = true;
        await d.dismiss();
    });

    await page.goto("/pagamento-pós.html?metodo=pix");
    await page.click("#incrementar-bilhetes");
    await page.click("#incrementar-bilhetes");
    await page.click("#incrementar-bilhetes");
    await page.click("#botao-comprar");

    await page.waitForURL(/home\.html$/);

    await expect(page.locator(".dialogo-confirmacao")).toBeVisible();
    await expect(page.locator(".confirmacao-cartao h2")).toHaveText("Compra concluída!");
    await expect(page.locator(".confirmacao-detalhe")).toContainText("3 bilhetes");
    await expect(page.locator(".confirmacao-detalhe")).toContainText("15,60");

    // o saldo da home já é o de depois da compra
    await expect(page.locator("#valor-saldo")).toContainText("15,60");
    expect(houveCaixaDoSistema).toBe(false);
});

test("um bilhete só é anunciado no singular", async ({ page }) => {
    await page.goto("/pagamento-pós.html");
    await page.click("#incrementar-bilhetes");
    await page.click("#botao-comprar");
    await page.waitForURL(/home\.html$/);

    await expect(page.locator(".confirmacao-detalhe")).toContainText("1 bilhete —");
});

test("a confirmação não volta a aparecer ao recarregar a home", async ({ page }) => {
    await page.goto("/pagamento-pós.html");
    await page.click("#incrementar-bilhetes");
    await page.click("#botao-comprar");
    await page.waitForURL(/home\.html$/);
    await expect(page.locator(".dialogo-confirmacao")).toBeVisible();

    await page.locator(".confirmacao-botao").click();
    await expect(page.locator(".dialogo-confirmacao")).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".dialogo-confirmacao")).toHaveCount(0);
});

// Só dois números atravessam o localStorage, e a frase é montada na home. Assim
// nada guardado no navegador vira texto na tela.
test("confirmação adulterada no armazenamento não vira mensagem", async ({ page }) => {
    await page.goto("/home.html");

    for (const lixo of [
        '{"quantidade":"<img src=x onerror=alert(1)>","total":1}',
        '{"quantidade":-5,"total":10}',
        '{"quantidade":2}',
        "isto não é json",
    ]) {
        await page.evaluate((v) => localStorage.setItem("compraConcluida", v), lixo);
        await page.reload();
        await expect(page.locator(".dialogo-confirmacao"), lixo).toHaveCount(0);
    }
});

// O caminho de erro continua respondendo na própria tela, sem redirecionar.
test("compra recusada avisa na tela e não sai dela", async ({ page }) => {
    await page.route("**/api/usuario/compra", (rota) =>
        rota.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ mensagem: "Recusado no teste" }) })
    );

    await page.goto("/pagamento-pós.html");
    await page.click("#incrementar-bilhetes");
    await page.click("#botao-comprar");

    await expect(page.locator("#aviso-compra")).toContainText("Recusado no teste");
    expect(new URL(page.url()).pathname).toContain("pagamento-p");
});

// A caixa de confirmação é compartilhada pela compra e pela catraca, e recebe
// texto vindo de resposta de API e do armazenamento do navegador. Quem escrever
// a próxima chamada não deve precisar lembrar de escapar nada: o componente usa
// textContent, então marcação chega como texto e não vira elemento.
test("a caixa de confirmação trata o que recebe como texto, nunca como marcação", async ({ page }) => {
    await page.goto("/home.html");

    const r = await page.evaluate(() => {
        const veneno = '<img src=x onerror="document.title=\'invadido\'">';
        (window as any).mostrarConfirmacao({ titulo: veneno, detalhe: veneno });
        const caixa = document.querySelector(".dialogo-confirmacao")!;
        return {
            imagens: caixa.querySelectorAll("img").length,
            titulo: caixa.querySelector("h2")!.textContent,
            tituloDaPagina: document.title,
        };
    });

    expect(r.imagens).toBe(0);
    expect(r.titulo).toContain("<img");
    expect(r.tituloDaPagina).not.toBe("invadido");
});

// A ação principal não pode depender de rolagem. O botão morava dentro da área
// que rola e, em tela baixa, ficava atrás da barra de ajuda — escondido, e sem
// nada indicando que era preciso rolar para achá-lo.
test("o botão de comprar fica sempre à vista, em qualquer altura de tela", async ({ page }) => {
    for (const altura of [932, 745, 660, 568]) {
        await page.setViewportSize({ width: 393, height: altura });
        await page.goto("/pagamento-pós.html?metodo=boleto");
        await page.waitForTimeout(150);

        const m = await page.evaluate(() => {
            const b = document.getElementById("botao-comprar")!.getBoundingClientRect();
            return { topo: b.top, base: b.bottom, janela: window.innerHeight };
        });

        expect(m.topo, `em ${altura}px`).toBeGreaterThanOrEqual(0);
        expect(m.base, `em ${altura}px`).toBeLessThanOrEqual(m.janela + 1);
    }
});

// A barra fica ancorada embaixo, então a mensagem de erro cresce para cima e o
// botão não muda de lugar debaixo do dedo de quem já ia tocar nele.
test("o aviso de erro não empurra o botão de comprar", async ({ page }) => {
    await page.route("**/api/usuario/compra", (rota) =>
        rota.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ mensagem: "Recusado no teste" }) })
    );

    await page.goto("/pagamento-pós.html");
    await page.click("#incrementar-bilhetes");

    const antes = await page.locator("#botao-comprar").boundingBox();
    await page.click("#botao-comprar");
    await expect(page.locator("#aviso-compra")).toContainText("Recusado no teste");
    const depois = await page.locator("#botao-comprar").boundingBox();

    expect(Math.abs(depois!.y - antes!.y)).toBeLessThan(1);
});
