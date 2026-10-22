// PUT /api/usuario/saldo — recarga simulada, mas com validação de servidor:
// sem teto e sem checagem de tipo, o valor viria livre do cliente.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, usuarioFixture, apiFetch, type TestApp } from "./helpers/testApp.ts";

const RECARGA_MAXIMA = 500;
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

test("saldo é creditado corretamente com um amount válido", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario/saldo", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 50 }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.usuario.saldo, 60);
});

test("amount no teto máximo (500) é aceito", async () => {
    const res = await apiFetch(app.baseUrl, "/api/usuario/saldo", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: RECARGA_MAXIMA }),
    });
    assert.equal(res.status, 200);
});

const casosInvalidos: Array<[string, unknown]> = [
    ["amount não numérico (string)", "100"],
    ["amount negativo", -10],
    ["amount zero", 0],
    ["amount acima do teto", RECARGA_MAXIMA + 0.01],
    ["amount ausente", undefined],
];

for (const [descricao, amount] of casosInvalidos) {
    test(`saldo com ${descricao} devolve 400 e não altera o saldo`, async () => {
        const body: Record<string, unknown> = {};
        if (amount !== undefined) body.amount = amount;

        const res = await apiFetch(app.baseUrl, "/api/usuario/saldo", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });

        assert.equal(res.status, 400);

        const db = app.readDb();
        assert.equal(db.usuarios[0].saldo, USUARIO.saldo);
    });
}
