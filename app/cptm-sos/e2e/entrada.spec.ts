// Telas de entrada: login e cadastro. Cobre o que a pessoa faz antes de ter conta
// ou sessão — inclusive os dois recursos que existiam por falta: conferir a senha
// digitada e voltar do cadastro para o login.
import { test, expect } from "@playwright/test";
import { resetarBanco } from "./helpers.ts";

test.beforeEach(() => {
    resetarBanco();
});

test("o botão de revelar mostra e esconde a senha", async ({ page }) => {
    await page.goto("/login.html");

    const senha = page.locator("#senha");
    const botao = page.locator(".revelar-senha");

    await senha.fill("MinhaSenha123");
    await expect(senha).toHaveAttribute("type", "password");
    await expect(botao).toHaveAttribute("aria-label", "Mostrar senha");

    await botao.click();
    await expect(senha).toHaveAttribute("type", "text");
    await expect(botao).toHaveAttribute("aria-pressed", "true");
    await expect(botao).toHaveAttribute("aria-label", "Ocultar senha");
    // o valor não pode se perder na troca
    await expect(senha).toHaveValue("MinhaSenha123");

    await botao.click();
    await expect(senha).toHaveAttribute("type", "password");
    await expect(botao).toHaveAttribute("aria-pressed", "false");
});

test("revelar a senha devolve o foco ao campo", async ({ page }) => {
    await page.goto("/login.html");
    await page.fill("#senha", "abc");
    await page.click(".revelar-senha");

    const focado = await page.evaluate(() => document.activeElement?.id);
    expect(focado).toBe("senha");
});

test("o cadastro oferece o caminho de volta ao login", async ({ page }) => {
    await page.goto("/cadastro.html");

    await page.click("#voltar-login");

    await page.waitForURL(/login\.html/);
    expect(page.url()).toContain("login.html");
});

test("o cadastro também permite conferir a senha digitada", async ({ page }) => {
    await page.goto("/cadastro.html");

    await page.fill("#senha", "SenhaNova123");
    await page.click(".revelar-senha");

    await expect(page.locator("#senha")).toHaveAttribute("type", "text");
});

test("login pelo formulário leva à home com sessão", async ({ page }) => {
    await page.goto("/login.html");

    await page.fill("#email", "ana.souza@example.com");
    await page.fill("#senha", "demo1234");
    await page.click("#botao");

    await page.waitForURL(/home\.html/);

    const sessao = await page.evaluate(() => ({
        token: !!localStorage.getItem("authToken"),
        email: localStorage.getItem("userEmail"),
        // o CPF não deve ser guardado no navegador
        cpf: localStorage.getItem("cpfLogado"),
    }));

    expect(sessao.token).toBe(true);
    expect(sessao.email).toBe("ana.souza@example.com");
    expect(sessao.cpf).toBeNull();
});

// ===== Preenchimento: teclado, validação e retorno visual =====

test("os campos pedem o teclado certo no celular", async ({ page }) => {
    await page.goto("/cadastro.html");

    const cpf = page.locator("#cpf");
    const email = page.locator("#email");

    // teclado numérico para CPF; sem isso abre o alfabético
    await expect(cpf).toHaveAttribute("inputmode", "numeric");
    // sem autocapitalize o celular envia "Ana@..." e o login falha
    await expect(email).toHaveAttribute("autocapitalize", "none");
    await expect(email).toHaveAttribute("type", "email");
    // habilita o preenchimento do navegador e o gerenciador de senhas
    await expect(email).toHaveAttribute("autocomplete", "email");
    await expect(page.locator("#senha")).toHaveAttribute("autocomplete", "new-password");
});

test("o CPF é formatado enquanto se digita", async ({ page }) => {
    await page.goto("/cadastro.html");

    await page.locator("#cpf").type("12345678901");

    await expect(page.locator("#cpf")).toHaveValue("123.456.789-01");
});

test("enviar o login vazio aponta cada campo, sem caixa do sistema", async ({ page }) => {
    const caixasDoSistema: string[] = [];
    page.on("dialog", async (d) => {
        caixasDoSistema.push(d.message());
        await d.dismiss();
    });

    await page.goto("/login.html");
    await page.click("#botao");

    await expect(page.locator("#erro-email")).toHaveText(/informe o seu e-mail/i);
    await expect(page.locator("#erro-senha")).toHaveText(/informe a sua senha/i);
    expect(caixasDoSistema).toEqual([]);
});

test("corrigir o campo apaga a mensagem de erro", async ({ page }) => {
    await page.goto("/login.html");

    await page.fill("#email", "isso-nao-e-email");
    await page.click("#botao");
    await expect(page.locator("#erro-email")).toHaveText(/não parece válido/i);

    await page.fill("#email", "ana.souza@example.com");
    await expect(page.locator("#erro-email")).toHaveText("");
});

test("campo válido recebe marca visual ao sair dele", async ({ page }) => {
    await page.goto("/login.html");

    await page.fill("#email", "ana.souza@example.com");
    await page.locator("#senha").focus();

    await expect(page.locator("#email")).toHaveClass(/valido/);
});

test("credencial errada não revela se o e-mail existe", async ({ page }) => {
    await page.goto("/login.html");

    await page.fill("#email", "ana.souza@example.com");
    await page.fill("#senha", "senhaerrada");
    await page.click("#botao");

    await expect(page.locator(".erro-geral")).toHaveText(/e-mail ou senha incorretos/i);
    // a senha é limpa para a próxima tentativa
    await expect(page.locator("#senha")).toHaveValue("");
});

test("a senha do cadastro exige tamanho mínimo", async ({ page }) => {
    await page.goto("/cadastro.html");

    await page.fill("#email", "novo@example.com");
    await page.locator("#cpf").type("11122233344");
    await page.fill("#senha", "123");
    await page.click("#botao");

    await expect(page.locator("#erro-senha")).toHaveText(/pelo menos 8 caracteres/i);
});
