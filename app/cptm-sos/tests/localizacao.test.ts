// Localização compartilhada pelo botão "Me encontre". É dado sensível: só pode
// ser aceita com um alerta ativo, e precisa desaparecer quando a emergência termina.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { startTestApp, usuarioFixture, apiFetch, type TestApp } from "./helpers/testApp.ts";

let app: TestApp;
let token: string;

const USUARIO = usuarioFixture({ id: 1, email: "a@teste.com", cpf: "11111111111", alerta: false });
const LUZ = { lat: -23.5354, lng: -46.6329, precisao: 18 };

function enviar(body: unknown) {
    return apiFetch(app.baseUrl, "/api/alerta/localizacao", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    });
}

async function ligarAlerta() {
    await apiFetch(app.baseUrl, "/api/alerta", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alerta: true }),
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

test("recusa localização quando não há alerta ativo", async () => {
    const res = await enviar(LUZ);

    assert.equal(res.status, 409);
    assert.equal(app.readDb().usuarios[0].localizacao, undefined);
});

test("aceita e grava a localização com alerta ativo", async () => {
    await ligarAlerta();

    const res = await enviar(LUZ);
    assert.equal(res.status, 200);

    const gravada = app.readDb().usuarios[0].localizacao;
    assert.ok(gravada, "localização deveria ter sido gravada");
    assert.equal(gravada.lat, LUZ.lat);
    assert.equal(gravada.lng, LUZ.lng);
    assert.equal(gravada.precisao, 18);
    assert.ok(gravada.em, "deve registrar o instante");
});

test("desligar o alerta apaga a localização", async () => {
    await ligarAlerta();
    await enviar(LUZ);
    assert.ok(app.readDb().usuarios[0].localizacao, "pré-condição: localização gravada");

    const res = await apiFetch(app.baseUrl, "/api/alerta/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cpf: USUARIO.cpf }),
    });

    assert.equal(res.status, 200);
    assert.equal(app.readDb().usuarios[0].localizacao, undefined,
        "localização não pode sobreviver ao fim da emergência");
});

// Havia uma lacuna aqui: só o caminho com CPF apagava a localização, então
// desligar o alerta por PUT /api/alerta deixava a última posição gravada para sempre.
test("desligar o alerta por PUT /api/alerta também apaga a localização", async () => {
    await ligarAlerta();
    await enviar(LUZ);
    assert.ok(app.readDb().usuarios[0].localizacao, "pré-condição: localização gravada");

    const res = await apiFetch(app.baseUrl, "/api/alerta", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alerta: false }),
    });

    assert.equal(res.status, 200);
    assert.equal(app.readDb().usuarios[0].alerta, false);
    assert.equal(app.readDb().usuarios[0].localizacao, undefined);
});

// "false" como string é truthy em JS: sem normalizar, o alerta continuaria ligado.
test("alerta enviado como string 'false' não mantém o alerta ligado", async () => {
    await ligarAlerta();

    await apiFetch(app.baseUrl, "/api/alerta", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alerta: "false" }),
    });

    assert.equal(app.readDb().usuarios[0].alerta, false);
});

test("rejeita coordenadas fora do intervalo válido", async () => {
    await ligarAlerta();

    for (const invalida of [
        { lat: 999, lng: 0 },
        { lat: 0, lng: 999 },
        { lat: -91, lng: 0 },
    ]) {
        const res = await enviar({ ...invalida, precisao: 10 });
        assert.equal(res.status, 400, `deveria rejeitar ${JSON.stringify(invalida)}`);
    }
});

test("rejeita coordenadas não numéricas", async () => {
    await ligarAlerta();

    const res = await enviar({ lat: "aqui", lng: "ali" });
    assert.equal(res.status, 400);
});

test("localização sem token é rejeitada", async () => {
    const res = await apiFetch(app.baseUrl, "/api/alerta/localizacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(LUZ),
    });

    assert.equal(res.status, 401);
});

// Quem liga o alerta e nunca desliga deixaria a posição gravada indefinidamente.
test("localização com mais de 6h é descartada na leitura", async () => {
    await ligarAlerta();
    await enviar(LUZ);

    // envelhece o registro direto no banco
    const db = app.readDb();
    db.usuarios[0].localizacao!.em = new Date(Date.now() - 7 * 3_600_000).toISOString();
    app.writeDb(db);

    // qualquer leitura seguinte deve limpar
    await apiFetch(app.baseUrl, "/api/usuario", {
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(app.readDb().usuarios[0].localizacao, undefined,
        "posição vencida não pode sobreviver no arquivo");
});

test("localização recente NÃO é descartada", async () => {
    await ligarAlerta();
    await enviar(LUZ);

    const db = app.readDb();
    db.usuarios[0].localizacao!.em = new Date(Date.now() - 1 * 3_600_000).toISOString();
    app.writeDb(db);

    await apiFetch(app.baseUrl, "/api/usuario", {
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.ok(app.readDb().usuarios[0].localizacao, "1h de idade ainda é válida");
});
