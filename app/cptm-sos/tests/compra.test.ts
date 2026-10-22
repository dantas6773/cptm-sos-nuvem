// POST /api/usuario/compra CREDITA o saldo em quantidade * 5.20 (preço fixo,
// calculado no servidor). Esse é o comportamento correto do domínio: o
// usuário paga por fora (Pix/cartão/boleto) e o valor vira saldo na carteira.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, usuarioFixture, apiFetch, type TestApp } from "./helpers/testApp.ts";

const PRECO_BILHETE = 5.2;
const USUARIO = usuarioFixture({ id: 1, email: "a@teste.com", saldo: 10 });

let app: TestApp;
let token: string;

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

test("compra credita quantidade * 5.20 no saldo", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario/compra", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantidade: 3 }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.total, Number((3 * PRECO_BILHETE).toFixed(2)));
    assert.equal(res.body.usuario.saldo, Number((USUARIO.saldo + 3 * PRECO_BILHETE).toFixed(2)));

    const db = app.readDb();
    assert.equal(db.usuarios[0].saldo, Number((USUARIO.saldo + 3 * PRECO_BILHETE).toFixed(2)));
});

test("o preço é calculado no servidor: mandar amount/total no corpo não muda o valor creditado", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario/compra", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // quantidade real é 1 (=> 5.20), mas o corpo tenta forjar um total maior.
        body: JSON.stringify({ quantidade: 1, amount: 9999, total: 9999 }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.total, PRECO_BILHETE);
    assert.equal(res.body.usuario.saldo, Number((USUARIO.saldo + PRECO_BILHETE).toFixed(2)));
});

test("quantidade no teto máximo (20) é aceita", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario/compra", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantidade: 20 }),
    });
    assert.equal(res.status, 200);
});

for (const quantidade of [0, -1, 1.5, 21]) {
    test(`quantidade inválida (${quantidade}) devolve 400 e não altera o saldo`, async () => {
        const res = await apiFetch(app.baseUrl, "/api/usuario/compra", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ quantidade }),
        });

        assert.equal(res.status, 400);

        const db = app.readDb();
        assert.equal(db.usuarios[0].saldo, USUARIO.saldo, "saldo não pode mudar numa compra rejeitada");
    });
}

// A tarifa e o teto de bilhetes ficavam repetidos no JavaScript da tela. Mudar a
// tarifa aqui deixava a tela mostrando um total que o servidor não cobraria.
test("GET /api/config publica a tarifa e o teto usados pela tela de compra", async () => {
    const config = await apiFetch(app.baseUrl, "/api/config");

    assert.equal(config.status, 200);
    assert.equal(config.body.precoBilhete, PRECO_BILHETE);
    assert.equal(typeof config.body.maxBilhetes, "number");

    // e o teto publicado é de fato o que a rota de compra aplica
    const acimaDoTeto = await apiFetch(app.baseUrl, "/api/usuario/compra", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade: config.body.maxBilhetes + 1 }),
    });
    assert.equal(acimaDoTeto.status, 400);

    const noTeto = await apiFetch(app.baseUrl, "/api/usuario/compra", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade: config.body.maxBilhetes }),
    });
    assert.equal(noTeto.status, 200);
});
