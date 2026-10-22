// O apelido aparece na saudação da home. Sem limite no servidor, o campo aceitava
// dezenas de milhares de caracteres — o maxlength do formulário é só da interface,
// e qualquer requisição direta passava por cima dele. Na tela, isso empurrava a
// foto de perfil para fora da área visível.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, usuarioFixture, apiFetch, type TestApp } from "./helpers/testApp.ts";

let app: TestApp;
let token: string;

const USUARIO = usuarioFixture({ id: 1, email: "a@teste.com", nome: "Nome Original" });

function trocarApelido(apelido: unknown) {
    return apiFetch(app.baseUrl, "/api/usuario/apelido", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apelido }),
    });
}

before(async () => {
    app = await startTestApp([USUARIO]);
    token = jwt.sign({ id: USUARIO.id, email: USUARIO.email }, process.env.JWT_SECRET!, {
        expiresIn: "2h",
        algorithm: "HS256",
    });
});

after(async () => {
    await app.close();
});

beforeEach(() => {
    app.writeDb({ usuarios: [{ ...USUARIO }] });
});

test("apelido dentro do limite é aceito", async () => {
    const res = await trocarApelido("Ana");

    assert.equal(res.status, 200);
    assert.equal(app.readDb().usuarios[0].nome, "Ana");
});

test("apelido no limite exato (40) é aceito", async () => {
    const res = await trocarApelido("A".repeat(40));

    assert.equal(res.status, 200);
    assert.equal(app.readDb().usuarios[0].nome.length, 40);
});

test("apelido acima do limite é recusado e não altera o cadastro", async () => {
    const res = await trocarApelido("A".repeat(41));

    assert.equal(res.status, 400);
    assert.equal(app.readDb().usuarios[0].nome, "Nome Original");
});

test("apelido gigante é recusado", async () => {
    const res = await trocarApelido("A".repeat(50_000));

    assert.equal(res.status, 400);
    assert.equal(app.readDb().usuarios[0].nome, "Nome Original");
});

test("apelido só com espaços é recusado", async () => {
    const res = await trocarApelido("   ");

    assert.equal(res.status, 400);
    assert.equal(app.readDb().usuarios[0].nome, "Nome Original");
});

test("apelido não numérico: valor que não é texto é recusado", async () => {
    const res = await trocarApelido(12345);

    assert.equal(res.status, 400);
    assert.equal(app.readDb().usuarios[0].nome, "Nome Original");
});

test("espaços em volta são removidos antes de gravar", async () => {
    const res = await trocarApelido("  Ana  ");

    assert.equal(res.status, 200);
    assert.equal(app.readDb().usuarios[0].nome, "Ana");
});
