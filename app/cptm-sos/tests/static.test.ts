// Trava de regressão: usuario.json é o "banco" e nunca pode ser servido como
// estático, nem por bypasses de path já corrigidos no passado (barra dupla,
// %2F codificado, "/./"). A defesa atual é allowlist (só assets/css, js,
// imagem, sons e as páginas .html na raiz), então esses caminhos nem deveriam
// bater em nenhuma rota que sirva arquivos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, usuarioFixture, type TestApp } from "./helpers/testApp.ts";

let app: TestApp;

before(async () => {
    app = await startTestApp([usuarioFixture()]);
});

after(async () => {
    await app.close();
});

const caminhosPerigosos = [
    "/data/usuario.json",
    "//data/usuario.json",
    "/data%2Fusuario.json",
    "/./data/usuario.json",
];

for (const caminho of caminhosPerigosos) {
    test(`${caminho} não é servido`, async () => {
        const res = await fetch(`${app.baseUrl}${caminho}`);
        const texto = await res.text();

        assert.notEqual(res.status, 200, `esperado != 200 para ${caminho}`);
        // Defesa em profundidade: mesmo que o status mudasse de comportamento
        // no futuro, o corpo da resposta nunca pode conter dado do banco
        // (hash de senha, cpf etc.).
        assert.doesNotMatch(texto, /"senha"\s*:/, "resposta não pode conter o conteúdo do banco");
    });
}

test("páginas .html da raiz continuam servidas normalmente", async () => {
    const res = await fetch(`${app.baseUrl}/login.html`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /html/);
});

test("assets/css/... continua servido normalmente", async () => {
    const res = await fetch(`${app.baseUrl}/assets/css/login.css`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /css/);
});

test("página .html inexistente devolve 404 (não vaza para outra rota)", async () => {
    const res = await fetch(`${app.baseUrl}/nao-existe.html`);
    assert.equal(res.status, 404);
});
