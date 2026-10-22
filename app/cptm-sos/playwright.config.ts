import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// O servidor sobe antes do primeiro teste rodar, então o banco isolado precisa
// existir já aqui — senão o boot falha ao tentar criá-lo num diretório ausente.
fs.mkdirSync(".e2e-tmp", { recursive: true });
fs.copyFileSync(path.join("data", "usuario.seed.json"), path.join(".e2e-tmp", "usuario.json"));

// A suíte e2e sobe o app de verdade e o dirige num navegador. É a contraparte dos
// testes de `tests/`, que batem só na API: aqui o que se prova é que a TELA
// funciona — arrastar o slider do SOS, preencher a denúncia, passar na catraca.
const PORTA = 5099;

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false, // o app tem um banco em arquivo; testes em paralelo brigariam por ele
    workers: 1,
    retries: 0,
    reporter: [["list"]],

    use: {
        baseURL: `http://127.0.0.1:${PORTA}`,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",

        // Chromium com viewport de celular, e não o preset "iPhone 13": aquele roda
        // em WebKit, e a câmera falsa que a tela de SOS precisa para carregar é um
        // argumento exclusivo do Chromium. Fica registrado que o Safari do iOS —
        // provável navegador do público real — não está coberto por esta suíte.
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
    },

    webServer: {
        command: "npx tsx assets/src/server.ts",
        url: `http://127.0.0.1:${PORTA}/login.html`,
        reuseExistingServer: false,
        timeout: 30_000,
        env: {
            PORT: String(PORTA),
            JWT_SECRET: "segredo-de-teste-e2e-nao-usar-em-producao",
            // a suíte exercita as mesmas rotas dezenas de vezes em segundos; os tetos
            // padrão a bloqueariam no meio, com falha intermitente e enganosa
            RATE_LIMIT_LOGIN: "1000",
            RATE_LIMIT_CADASTRO: "1000",
            RATE_LIMIT_SALDO: "1000",
            RATE_LIMIT_DENUNCIA: "1000",
            RATE_LIMIT_LOCALIZACAO: "1000",
            // banco isolado: a suíte nunca toca no data/usuario.json de quem desenvolve
            DB_PATH: path.join(".e2e-tmp", "usuario.json"),
            DENUNCIAS_PATH: path.join(".e2e-tmp", "denuncias.json"),
        },
    },
});
