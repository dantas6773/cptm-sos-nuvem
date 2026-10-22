// O diferencial do projeto: alerta/SOS. O teste mais importante da suíte é a
// proteção contra IDOR em /api/alerta/confirmar — confirmar o alerta de
// OUTRO usuário usando o CPF dele não pode ser possível, mesmo com um token
// válido de terceiros.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, usuarioFixture, apiFetch, type TestApp } from "./helpers/testApp.ts";

let app: TestApp;
let tokenUsuarioA: string;
let tokenUsuarioB: string;

const USUARIO_A = usuarioFixture({ id: 1, email: "a@teste.com", cpf: "11111111111", alerta: false });
const USUARIO_B = usuarioFixture({ id: 2, email: "b@teste.com", cpf: "22222222222", alerta: false });

before(async () => {
    app = await startTestApp([USUARIO_A, USUARIO_B]);
    tokenUsuarioA = jwt.sign({ id: USUARIO_A.id, email: USUARIO_A.email }, process.env.JWT_SECRET!, {
        expiresIn: "2h",
        algorithm: "HS256",
    });
    tokenUsuarioB = jwt.sign({ id: USUARIO_B.id, email: USUARIO_B.email }, process.env.JWT_SECRET!, {
        expiresIn: "2h",
        algorithm: "HS256",
    });
});

after(async () => {
    await app.close();
});

beforeEach(() => {
    app.writeDb({ usuarios: [{ ...USUARIO_A }, { ...USUARIO_B }] });
});

test("PUT /api/alerta liga o alerta do usuário do token", async () => {
    const res = await apiFetch(app.baseUrl, "/api/alerta", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenUsuarioA}` },
        body: JSON.stringify({ alerta: true }),
    });

    assert.equal(res.status, 200);

    const db = app.readDb();
    assert.equal(db.usuarios.find((u) => u.id === USUARIO_A.id)!.alerta, true);
    assert.equal(db.usuarios.find((u) => u.id === USUARIO_B.id)!.alerta, false, "não pode afetar outro usuário");
});

test("POST /api/alerta/confirmar com o CPF correto desliga o alerta", async () => {
    app.writeDb({ usuarios: [{ ...USUARIO_A, alerta: true }, { ...USUARIO_B }] });

    const res = await apiFetch(app.baseUrl, "/api/alerta/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenUsuarioA}` },
        body: JSON.stringify({ cpf: USUARIO_A.cpf }),
    });

    assert.equal(res.status, 200);

    const db = app.readDb();
    assert.equal(db.usuarios.find((u) => u.id === USUARIO_A.id)!.alerta, false);
});

test("POST /api/alerta/confirmar com o CPF de OUTRO usuário devolve 403 e não desliga o alerta (IDOR)", async () => {
    app.writeDb({ usuarios: [{ ...USUARIO_A, alerta: true }, { ...USUARIO_B }] });

    // Usuário A está autenticado (token dele), mas manda o CPF do usuário B.
    const res = await apiFetch(app.baseUrl, "/api/alerta/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenUsuarioA}` },
        body: JSON.stringify({ cpf: USUARIO_B.cpf }),
    });

    assert.equal(res.status, 403);

    const db = app.readDb();
    assert.equal(
        db.usuarios.find((u) => u.id === USUARIO_A.id)!.alerta,
        true,
        "o alerta do próprio usuário autenticado não pode ter sido desligado"
    );
});

test("POST /api/alerta/confirmar sem CPF no corpo devolve 400", async () => {
    const res = await apiFetch(app.baseUrl, "/api/alerta/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenUsuarioA}` },
        body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
});

test("PUT /api/alerta com token de usuário que não existe mais no banco devolve 404", async () => {
    const tokenFantasma = jwt.sign({ id: 999, email: "fantasma@teste.com" }, process.env.JWT_SECRET!, {
        expiresIn: "2h",
        algorithm: "HS256",
    });
    const res = await apiFetch(app.baseUrl, "/api/alerta", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFantasma}` },
        body: JSON.stringify({ alerta: true }),
    });
    assert.equal(res.status, 404);
});

// A comparação era literal: um CPF digitado com ponto e traço — que é como a
// tela de cadastro ensina a escrever — era recusado com o alarme tocando.
test("confirmar o alerta aceita o CPF com ou sem pontuação", async () => {
    for (const digitado of ["11111111111", "111.111.111-11", "111 111 111 11", " 11111111111 "]) {
        await apiFetch(app.baseUrl, "/api/alerta", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenUsuarioA}` },
            body: JSON.stringify({ alerta: true }),
        });

        const res = await apiFetch(app.baseUrl, "/api/alerta/confirmar", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenUsuarioA}` },
            body: JSON.stringify({ cpf: digitado }),
        });

        assert.equal(res.status, 200, `recusou ${JSON.stringify(digitado)}`);
        assert.equal(app.readDb().usuarios[0].alerta, false);
    }
});

// Aceitar a pontuação não pode virar aceitar qualquer coisa.
test("confirmar o alerta continua recusando CPF de outra pessoa", async () => {
    await apiFetch(app.baseUrl, "/api/alerta", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenUsuarioA}` },
        body: JSON.stringify({ alerta: true }),
    });

    // inclui o CPF do outro usuário: normalizar não pode virar aceitar qualquer um
    for (const errado of ["222.222.222-22", "22222222222", "1111111111", "111111111111"]) {
        const res = await apiFetch(app.baseUrl, "/api/alerta/confirmar", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenUsuarioA}` },
            body: JSON.stringify({ cpf: errado }),
        });
        assert.equal(res.status, 403, `aceitou ${JSON.stringify(errado)}`);
    }

    // e o alarme continua ligado depois de todas as tentativas
    assert.equal(app.readDb().usuarios[0].alerta, true);
});
