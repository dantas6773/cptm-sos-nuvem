// Registro de denúncias. O ponto mais delicado é o anonimato: uma denúncia
// marcada como anônima não pode guardar quem a enviou — nem no arquivo, nem
// na listagem "minhas denúncias". Se guardasse, de anônima não teria nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, usuarioFixture, apiFetch, type TestApp } from "./helpers/testApp.ts";

let app: TestApp;
let token: string;

const USUARIO = usuarioFixture({ id: 1, email: "a@teste.com", cpf: "11111111111" });

const DESCRICAO = "Homem me seguiu do vagão até a saída da estação insistindo em falar comigo.";

function comToken(body: unknown) {
    return {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    };
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

test("registra denúncia identificada e devolve protocolo", async () => {
    const res = await apiFetch(
        app.baseUrl,
        "/api/denuncias",
        comToken({ categoria: "assedio", descricao: DESCRICAO, local: "Estação Luz" })
    );

    assert.equal(res.status, 201);
    assert.match(res.body.protocolo, /^CPTM-\d{6}$/);

    const salva = app.readDenuncias().denuncias.at(-1);
    assert.equal(salva.categoria, "assedio");
    assert.equal(salva.local, "Estação Luz");
    assert.equal(salva.anonima, false);
    assert.equal(salva.usuarioId, USUARIO.id);
});

test("denúncia anônima NÃO grava quem enviou", async () => {
    const res = await apiFetch(
        app.baseUrl,
        "/api/denuncias",
        comToken({ categoria: "roubo", descricao: DESCRICAO, anonima: true })
    );

    assert.equal(res.status, 201);

    const salva = app.readDenuncias().denuncias.at(-1);
    assert.equal(salva.anonima, true);
    assert.equal(salva.usuarioId, null);

    // nenhum vestígio do autor no registro inteiro
    const serializada = JSON.stringify(salva);
    assert.ok(!serializada.includes(USUARIO.email), "e-mail do autor vazou na denúncia anônima");
    assert.ok(!serializada.includes(USUARIO.cpf), "CPF do autor vazou na denúncia anônima");
});

test("GET /api/denuncias lista as próprias e omite as anônimas", async () => {
    const res = await apiFetch(app.baseUrl, "/api/denuncias", {
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.denuncias.every((d: any) => d.anonima === false));
    // a listagem não deve expor o vínculo interno
    assert.ok(res.body.denuncias.every((d: any) => d.usuarioId === undefined));
});

test("categoria fora da lista é rejeitada", async () => {
    const res = await apiFetch(
        app.baseUrl,
        "/api/denuncias",
        comToken({ categoria: "qualquer", descricao: DESCRICAO })
    );

    assert.equal(res.status, 400);
});

test("descrição curta demais é rejeitada", async () => {
    const antes = app.readDenuncias().denuncias.length;

    const res = await apiFetch(
        app.baseUrl,
        "/api/denuncias",
        comToken({ categoria: "outros", descricao: "curto" })
    );

    assert.equal(res.status, 400);
    assert.equal(app.readDenuncias().denuncias.length, antes, "não deve registrar nada");
});

test("descrição acima do limite é rejeitada", async () => {
    const res = await apiFetch(
        app.baseUrl,
        "/api/denuncias",
        comToken({ categoria: "outros", descricao: "a".repeat(1001) })
    );

    assert.equal(res.status, 400);
});

test("denúncia sem token é rejeitada", async () => {
    const res = await apiFetch(app.baseUrl, "/api/denuncias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria: "outros", descricao: DESCRICAO }),
    });

    assert.equal(res.status, 401);
});

test("protocolos são únicos entre denúncias", async () => {
    await apiFetch(app.baseUrl, "/api/denuncias", comToken({ categoria: "outros", descricao: DESCRICAO }));
    await apiFetch(app.baseUrl, "/api/denuncias", comToken({ categoria: "outros", descricao: DESCRICAO }));

    const protocolos = app.readDenuncias().denuncias.map((d: any) => d.protocolo);
    assert.equal(new Set(protocolos).size, protocolos.length, "protocolo repetido");
});
