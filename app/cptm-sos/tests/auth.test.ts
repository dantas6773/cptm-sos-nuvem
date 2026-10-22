// Testa o middleware `autenticar` usando GET /api/usuario como rota protegida
// representativa (mesmo middleware de todas as outras rotas privadas).
// Token ausente ou inválido é 401 (não autenticado). O 403 fica reservado para
// recusa por regra de negócio com identidade conhecida — ver alerta.test.ts.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, usuarioFixture, apiFetch, type TestApp } from "./helpers/testApp.ts";

let app: TestApp;

before(async () => {
    app = await startTestApp([usuarioFixture({ id: 1, email: "ana@teste.com" })]);
});

after(async () => {
    await app.close();
});

test("rota protegida sem token devolve 401", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario");
    assert.equal(res.status, 401);
});

test("rota protegida com token malformado devolve 401", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario", {
        headers: { Authorization: "Bearer token-invalido-nao-e-jwt" },
    });
    assert.equal(res.status, 401);
});

test("rota protegida com token assinado com segredo errado devolve 401", async () => {
    const tokenForjado = jwt.sign({ id: 1, email: "ana@teste.com" }, "segredo-errado", {
        expiresIn: "2h",
        algorithm: "HS256",
    });
    const res = await apiFetch(app.baseUrl, "/api/usuario", {
        headers: { Authorization: `Bearer ${tokenForjado}` },
    });
    assert.equal(res.status, 401);
});

test("rota protegida com token expirado devolve 401", async () => {
    const tokenExpirado = jwt.sign({ id: 1, email: "ana@teste.com" }, process.env.JWT_SECRET!, {
        expiresIn: "-10s",
        algorithm: "HS256",
    });
    const res = await apiFetch(app.baseUrl, "/api/usuario", {
        headers: { Authorization: `Bearer ${tokenExpirado}` },
    });
    assert.equal(res.status, 401);
});

test("rota protegida com token válido devolve 200", async () => {
    const tokenValido = jwt.sign({ id: 1, email: "ana@teste.com" }, process.env.JWT_SECRET!, {
        expiresIn: "2h",
        algorithm: "HS256",
    });
    const res = await apiFetch(app.baseUrl, "/api/usuario", {
        headers: { Authorization: `Bearer ${tokenValido}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.usuario.email, "ana@teste.com");
});
