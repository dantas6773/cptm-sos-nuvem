// A localização é gravada no próprio registro do usuário, e várias rotas devolvem
// esse registro. Antes elas faziam "tudo menos a senha", então a posição GPS de
// alguém em emergência passou a sair em respostas de saldo, compra e login.
// Estes testes travam a regra: nenhuma resposta de API pode conter localizacao,
// cpf ou senha.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, usuarioFixture, apiFetch, SENHA_PADRAO, type TestApp } from "./helpers/testApp.ts";

let app: TestApp;
let token: string;

const USUARIO = usuarioFixture({
    id: 1,
    email: "a@teste.com",
    cpf: "11122233344",
    saldo: 200,
    alerta: false,
});

const CAMPOS_PROIBIDOS = ["localizacao", "cpf", "senha"];

function conferir(nome: string, usuario: any) {
    for (const campo of CAMPOS_PROIBIDOS) {
        assert.equal(
            usuario?.[campo],
            undefined,
            `${nome} não pode devolver "${campo}" na resposta`
        );
    }
}

before(async () => {
    app = await startTestApp([USUARIO]);
    token = jwt.sign({ id: USUARIO.id, email: USUARIO.email }, process.env.JWT_SECRET!, {
        expiresIn: "2h",
        algorithm: "HS256",
    });

    // liga o alerta e grava uma posição, para haver o que vazar
    const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    await apiFetch(app.baseUrl, "/api/alerta", {
        method: "PUT", headers: auth, body: JSON.stringify({ alerta: true }),
    });
    await apiFetch(app.baseUrl, "/api/alerta/localizacao", {
        method: "POST", headers: auth,
        body: JSON.stringify({ lat: -23.5354, lng: -46.6329, precisao: 12 }),
    });
});

after(async () => {
    await app.close();
});

test("pré-condição: a localização está mesmo gravada no banco", () => {
    assert.ok(app.readDb().usuarios[0].localizacao, "sem isso os testes abaixo não provam nada");
});

test("POST /api/login não devolve localização, cpf nem senha", async () => {
    const res = await apiFetch(app.baseUrl, "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: USUARIO.email, senha: SENHA_PADRAO }),
    });

    assert.equal(res.status, 200);
    conferir("login", res.body.usuario);
});

test("GET /api/usuario não devolve localização, cpf nem senha", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario", {
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 200);
    conferir("GET /api/usuario", res.body.usuario);
});

test("PUT /api/usuario/saldo não devolve localização, cpf nem senha", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario/saldo", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 10 }),
    });

    assert.equal(res.status, 200);
    conferir("saldo", res.body.usuario);
});

test("POST /api/usuario/compra não devolve localização, cpf nem senha", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario/compra", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantidade: 1 }),
    });

    assert.equal(res.status, 200);
    conferir("compra", res.body.usuario);
});

test("POST /api/usuario/passagem não devolve localização, cpf nem senha", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario/passagem", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 200);
    conferir("passagem", res.body.usuario);
});

test("POST /api/cadastro não devolve localização, cpf nem senha", async () => {
    const res = await apiFetch(app.baseUrl, "/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "novo@teste.com", cpf: "99988877766", senha: "SenhaForte123!" }),
    });

    assert.equal(res.status, 201);
    conferir("cadastro", res.body.usuario);
});
