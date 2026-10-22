// O fluxo de denúncia inteiro pela tela. Antes deste fluxo existir, as três
// categorias eram divs sem handler e o caminho morria ali.
import { test, expect } from "@playwright/test";
import { autenticar, resetarBanco, lerDenuncias } from "./helpers.ts";

test.beforeEach(async ({ context, request }) => {
    resetarBanco();
    await autenticar(context, request, "ana.souza@example.com");
});

test("escolher categoria, preencher e enviar gera protocolo", async ({ page }) => {
    await page.goto("/formularioDenuncia.html");

    await page.getByRole("button", { name: "Assédio/Violência" }).click();
    await expect(page.locator("#form-denuncia")).toBeVisible();
    await expect(page.locator("#categoria-escolhida")).toHaveText("Assédio/Violência");

    await page.fill("#descricao", "Homem me seguiu do vagão até a saída da estação.");
    await page.fill("#local", "Estação Luz");
    await page.click("#enviar");

    await expect(page.locator("#confirmacao")).toBeVisible();
    await expect(page.locator("#protocolo")).toHaveText(/^CPTM-\d{6}$/);

    const registrada = lerDenuncias().denuncias.at(-1);
    expect(registrada.categoria).toBe("assedio");
    expect(registrada.anonima).toBe(false);
});

test("descrição curta demais não envia e mostra o motivo", async ({ page }) => {
    await page.goto("/formularioDenuncia.html");
    await page.getByRole("button", { name: "Roubos/Furtos" }).click();

    await page.fill("#descricao", "curto");
    await page.click("#enviar");

    await expect(page.locator("#erro-denuncia")).toContainText("pelo menos 10 caracteres");
    await expect(page.locator("#confirmacao")).toBeHidden();
    expect(lerDenuncias().denuncias).toHaveLength(0);
});

test("denúncia anônima não guarda quem enviou", async ({ page }) => {
    await page.goto("/formularioDenuncia.html");
    await page.getByRole("button", { name: "Outras Ocorrências" }).click();

    await page.fill("#descricao", "Plataforma sem iluminação no acesso norte durante a noite.");
    await page.check("#anonima");
    await page.click("#enviar");

    await expect(page.locator("#confirmacao")).toBeVisible();

    const registrada = lerDenuncias().denuncias.at(-1);
    expect(registrada.anonima).toBe(true);
    expect(registrada.usuarioId).toBeNull();
});

test("dá para enviar uma segunda denúncia sem recarregar a página", async ({ page }) => {
    await page.goto("/formularioDenuncia.html");

    await page.getByRole("button", { name: "Roubos/Furtos" }).click();
    await page.fill("#descricao", "Furto de celular na plataforma durante o embarque.");
    await page.click("#enviar");
    await expect(page.locator("#confirmacao")).toBeVisible();

    await page.click("#nova-denuncia");
    await expect(page.locator("#pai-categorias")).toBeVisible();

    await page.getByRole("button", { name: "Assédio/Violência" }).click();
    // o formulário não pode vir com o texto da denúncia anterior
    await expect(page.locator("#descricao")).toHaveValue("");

    await page.fill("#descricao", "Segunda ocorrência, para conferir que o fluxo se repete.");
    await page.click("#enviar");
    await expect(page.locator("#confirmacao")).toBeVisible();

    expect(lerDenuncias().denuncias).toHaveLength(2);
});

test("as categorias são alcançáveis por teclado", async ({ page }) => {
    await page.goto("/formularioDenuncia.html");

    // Tabula até chegar numa categoria em vez de fixar a posição: o que importa
    // é que o teclado alcança, e a contagem exata muda a cada elemento novo no
    // topo da página — foi o que aconteceu quando o logo virou link.
    let categoriaFocada: string | undefined;
    for (let i = 0; i < 8 && !categoriaFocada; i++) {
        await page.keyboard.press("Tab");
        categoriaFocada = await page.evaluate(
            () => (document.activeElement as HTMLElement)?.dataset?.categoria
        );
    }

    expect(categoriaFocada).toBeTruthy();
});
