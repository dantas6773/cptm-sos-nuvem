import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, usuarioFixture, apiFetch, SENHA_PADRAO, type TestApp } from "./helpers/testApp.ts";

let app: TestApp;

before(async () => {
    app = await startTestApp([
        usuarioFixture({ id: 1, email: "ana@teste.com", cpf: "11111111111" }),
    ]);
});

after(async () => {
    await app.close();
});

test("login com credenciais corretas devolve token e usuário sem o campo senha", async () => {
    const res = await apiFetch(app.baseUrl, "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ana@teste.com", senha: SENHA_PADRAO }),
    });

    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, "string");
    assert.ok(res.body.token.length > 0);
    assert.equal(res.body.usuario.email, "ana@teste.com");
    assert.equal("senha" in res.body.usuario, false, "resposta não pode expor o campo senha");
});

test("login com senha errada devolve 401", async () => {
    const res = await apiFetch(app.baseUrl, "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ana@teste.com", senha: "senha-errada" }),
    });

    assert.equal(res.status, 401);
    assert.equal("token" in res.body, false);
});

test("login com usuário inexistente devolve 404", async () => {
    const res = await apiFetch(app.baseUrl, "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nao-existe@teste.com", senha: SENHA_PADRAO }),
    });

    assert.equal(res.status, 404);
});

test("login sem email ou senha devolve 400", async () => {
    const semSenha = await apiFetch(app.baseUrl, "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ana@teste.com" }),
    });
    assert.equal(semSenha.status, 400);

    const semEmail = await apiFetch(app.baseUrl, "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: SENHA_PADRAO }),
    });
    assert.equal(semEmail.status, 400);
});
