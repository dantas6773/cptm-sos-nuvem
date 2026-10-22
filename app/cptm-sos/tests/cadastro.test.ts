import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, usuarioFixture, apiFetch, type TestApp } from "./helpers/testApp.ts";

let app: TestApp;

before(async () => {
    app = await startTestApp([
        usuarioFixture({ id: 1, email: "existente@teste.com", cpf: "10000000001" }),
        usuarioFixture({ id: 2, email: "outro@teste.com", cpf: "10000000002" }),
        // id 3 foi removido de propósito: expõe qualquer implementação de
        // "próximo id" baseada em length() em vez de max(id).
        usuarioFixture({ id: 4, email: "quarto@teste.com", cpf: "10000000004" }),
    ]);
});

after(async () => {
    await app.close();
});

beforeEach(() => {
    // Restaura o estado inicial do banco antes de cada teste, já que
    // /api/cadastro escreve no arquivo.
    app.writeDb({
        usuarios: [
            usuarioFixture({ id: 1, email: "existente@teste.com", cpf: "10000000001" }),
            usuarioFixture({ id: 2, email: "outro@teste.com", cpf: "10000000002" }),
            usuarioFixture({ id: 4, email: "quarto@teste.com", cpf: "10000000004" }),
        ],
    });
});

test("cadastro cria usuário com a senha hasheada, nunca em texto puro", async () => {
    const res = await apiFetch(app.baseUrl, "/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "novo@teste.com", cpf: "20000000000", senha: "MinhaSenha123!" }),
    });

    assert.equal(res.status, 201);
    assert.equal("senha" in res.body.usuario, false);
    assert.equal(typeof res.body.token, "string");

    const db = app.readDb();
    const salvo = db.usuarios.find((u) => u.email === "novo@teste.com")!;
    assert.ok(salvo, "usuário deveria ter sido persistido no banco");
    assert.notEqual(salvo.senha, "MinhaSenha123!", "a senha nunca pode ser gravada em texto puro");
    assert.match(salvo.senha, /^\$2[aby]\$/, "a senha gravada deve ser um hash bcrypt");
});

test("cadastro com e-mail já cadastrado devolve 400", async () => {
    const res = await apiFetch(app.baseUrl, "/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "existente@teste.com", cpf: "99999999999", senha: "MinhaSenha123!" }),
    });
    assert.equal(res.status, 400);

    const db = app.readDb();
    assert.equal(db.usuarios.length, 3, "nenhum usuário novo deveria ter sido criado");
});

test("cadastro com CPF já cadastrado devolve 400", async () => {
    const res = await apiFetch(app.baseUrl, "/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "email-novo@teste.com", cpf: "10000000001", senha: "MinhaSenha123!" }),
    });
    assert.equal(res.status, 400);

    const db = app.readDb();
    assert.equal(db.usuarios.length, 3);
});

test("cadastro com campos faltando devolve 400", async () => {
    const res = await apiFetch(app.baseUrl, "/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "sememsenha@teste.com" }),
    });
    assert.equal(res.status, 400);
});

test("id do novo usuário usa max(id)+1 e não colide quando um id do meio foi removido", async () => {
    // Banco atual tem ids [1, 2, 4] (o 3 foi removido). Um cálculo por
    // length()+1 daria 3+1=4, que JÁ EXISTE — colisão. O correto é 5.
    const res = await apiFetch(app.baseUrl, "/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "quinto@teste.com", cpf: "10000000005", senha: "MinhaSenha123!" }),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.usuario.id, 5);

    const db = app.readDb();
    const ids = db.usuarios.map((u) => u.id);
    assert.equal(new Set(ids).size, ids.length, "não pode haver ids duplicados no banco");
});
