// Helper compartilhado pela suíte: sobe uma instância real do app Express
// (não um mock) em porta efêmera, apontando para um banco JSON isolado em
// diretório temporário. Nunca toca em data/usuario.json do desenvolvedor.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";

// Segredo só para a suíte. Definido aqui como rede de segurança, mas o
// script `npm test` já exporta JWT_SECRET e NODE_ENV=test antes de o
// runner sequer importar este arquivo (ver package.json).
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "segredo-de-teste-nao-usar-em-producao";

export const SENHA_PADRAO = "SenhaForte123!";
export const SENHA_HASH = bcrypt.hashSync(SENHA_PADRAO, 10);

export interface UsuarioFixture {
    id: number;
    nome: string;
    cpf: string;
    email: string;
    senha: string;
    saldo: number;
    alerta: boolean;
    // gravada só enquanto o alerta está ativo, pelo botão "Me encontre"
    localizacao?: { lat: number; lng: number; precisao: number | null; em: string };
}

export function usuarioFixture(overrides: Partial<UsuarioFixture> = {}): UsuarioFixture {
    return {
        id: 1,
        nome: "Usuário Teste",
        cpf: "11122233344",
        email: "usuario@teste.com",
        senha: SENHA_HASH,
        saldo: 100,
        alerta: false,
        ...overrides,
    };
}

export interface TestApp {
    baseUrl: string;
    dbPath: string;
    readDb: () => { usuarios: UsuarioFixture[] };
    writeDb: (data: { usuarios: UsuarioFixture[] }) => void;
    readDenuncias: () => { denuncias: any[] };
    close: () => Promise<void>;
}

/**
 * Sobe o servidor real (assets/src/server.ts) em uma porta efêmera, com um
 * banco isolado num diretório temporário. `usuarios` vira o conteúdo inicial
 * de usuario.json — como o arquivo já existe quando o server.ts é importado,
 * a lógica de "copiar do seed" nem entra em ação.
 */
export async function startTestApp(usuarios: UsuarioFixture[]): Promise<TestApp> {
    const dir = mkdtempSync(path.join(tmpdir(), "cptm-test-"));
    const dbPath = path.join(dir, "usuario.json");
    writeFileSync(dbPath, JSON.stringify({ usuarios }, null, 2));

    const denunciasPath = path.join(dir, "denuncias.json");

    process.env.DB_PATH = dbPath;
    process.env.DENUNCIAS_PATH = denunciasPath;

    // Import dinâmico: cada arquivo de teste roda em processo próprio (node:test
    // isola por arquivo), então cada um importa server.ts do zero com o
    // DB_PATH que acabou de configurar.
    const mod = await import("../../assets/src/server.ts");
    const app = mod.server;

    const httpServer: Server = app.listen(0);
    await new Promise<void>((resolve, reject) => {
        httpServer.once("listening", () => resolve());
        httpServer.once("error", reject);
    });

    const { port } = httpServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    return {
        baseUrl,
        dbPath,
        readDb: () => JSON.parse(readFileSync(dbPath, "utf-8")),
        readDenuncias: () =>
            existsSync(denunciasPath)
                ? JSON.parse(readFileSync(denunciasPath, "utf-8"))
                : { denuncias: [] },
        writeDb: (data) => writeFileSync(dbPath, JSON.stringify(data, null, 2)),
        close: async () => {
            await new Promise<void>((resolve, reject) => {
                httpServer.close((err) => (err ? reject(err) : resolve()));
            });
            rmSync(dir, { recursive: true, force: true });
        },
    };
}

/** Atalho para bater na API de teste com fetch e já devolver o corpo em JSON. */
export async function apiFetch(
    baseUrl: string,
    path: string,
    init?: RequestInit
): Promise<{ status: number; headers: Headers; body: any }> {
    const res = await fetch(`${baseUrl}${path}`, init);
    const contentType = res.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text();
    return { status: res.status, headers: res.headers, body };
}
