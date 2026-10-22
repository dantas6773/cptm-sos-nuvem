import { type BrowserContext, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const SENHA_DEMO = "demo1234";
export const DB_E2E = path.join(".e2e-tmp", "usuario.json");
export const DENUNCIAS_E2E = path.join(".e2e-tmp", "denuncias.json");

/**
 * Restaura o banco da suíte a partir do seed versionado. Chamado antes de cada
 * teste para que um não dependa do estado deixado pelo outro.
 */
export function resetarBanco() {
    fs.mkdirSync(".e2e-tmp", { recursive: true });
    fs.copyFileSync(path.join("data", "usuario.seed.json"), DB_E2E);
    fs.rmSync(DENUNCIAS_E2E, { force: true });
}

export function lerBanco() {
    return JSON.parse(fs.readFileSync(DB_E2E, "utf-8"));
}

export function lerDenuncias() {
    if (!fs.existsSync(DENUNCIAS_E2E)) return { denuncias: [] as any[] };
    return JSON.parse(fs.readFileSync(DENUNCIAS_E2E, "utf-8"));
}

export function usuarioDoSeed(email: string) {
    return lerBanco().usuarios.find((u: any) => u.email === email);
}

/**
 * Faz login pela API e injeta a sessão, para o teste começar já autenticado sem
 * repetir o formulário de login em todo cenário. Quem testa o login em si é
 * `login.spec.ts`, que preenche o formulário de verdade.
 */
export async function autenticar(ctx: BrowserContext, request: APIRequestContext, email: string) {
    const resp = await request.post("/api/login", { data: { email, senha: SENHA_DEMO } });
    const { token, usuario } = await resp.json();

    await ctx.addInitScript(
        ([t, u]) => {
            localStorage.setItem("authToken", t as string);
            localStorage.setItem("userEmail", (u as any).email);
            localStorage.setItem("idLogado", String((u as any).id));
            if ((u as any).nome) localStorage.setItem("apelido", (u as any).nome);
        },
        [token, usuario]
    );

    return { token, usuario };
}
