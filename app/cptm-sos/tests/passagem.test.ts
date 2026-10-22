// POST /api/usuario/passagem DEBITA o valor de uma passagem (catraca). É a
// contraparte de /api/usuario/compra, que credita.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, usuarioFixture, apiFetch, type TestApp } from "./helpers/testApp.ts";

const PRECO_BILHETE = 5.2;

let app: TestApp;

async function tokenPara(usuario: { id: number; email: string }) {
    return jwt.sign({ id: usuario.id, email: usuario.email }, process.env.JWT_SECRET!, {
        expiresIn: "2h",
        algorithm: "HS256",
    });
}

before(async () => {
    app = await startTestApp([
        usuarioFixture({ id: 1, email: "saldo-suficiente@teste.com", saldo: 20 }),
        // saldo exatamente igual ao preço: caso de borda, deve ser aceito (não é "< preço").
        usuarioFixture({ id: 2, email: "saldo-exato@teste.com", saldo: PRECO_BILHETE }),
        usuarioFixture({ id: 3, email: "saldo-insuficiente@teste.com", saldo: 3 }),
        usuarioFixture({ id: 4, email: "sem-saldo@teste.com", saldo: 0 }),
    ]);
});

after(async () => {
    await app.close();
});

test("passagem debita o preço do bilhete do saldo", async () => {
    const token = await tokenPara({ id: 1, email: "saldo-suficiente@teste.com" });
    const res = await apiFetch(app.baseUrl, "/api/usuario/passagem", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.usuario.saldo, Number((20 - PRECO_BILHETE).toFixed(2)));
});

test("passagem com saldo exatamente igual ao preço é aceita e zera o saldo", async () => {
    const token = await tokenPara({ id: 2, email: "saldo-exato@teste.com" });
    const res = await apiFetch(app.baseUrl, "/api/usuario/passagem", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.usuario.saldo, 0);
});

test("passagem com saldo insuficiente devolve 400 e não deixa o saldo negativo", async () => {
    const token = await tokenPara({ id: 3, email: "saldo-insuficiente@teste.com" });
    const res = await apiFetch(app.baseUrl, "/api/usuario/passagem", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 400);

    const db = app.readDb();
    const usuario = db.usuarios.find((u) => u.id === 3)!;
    assert.equal(usuario.saldo, 3, "saldo não pode ter sido alterado numa passagem recusada");
    assert.ok(usuario.saldo >= 0, "saldo nunca pode ficar negativo");
});

test("passagem com saldo zero devolve 400", async () => {
    const token = await tokenPara({ id: 4, email: "sem-saldo@teste.com" });
    const res = await apiFetch(app.baseUrl, "/api/usuario/passagem", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 400);

    const db = app.readDb();
    assert.equal(db.usuarios.find((u) => u.id === 4)!.saldo, 0);
});
