import { test, expect } from "@playwright/test";
import { autenticar, resetarBanco } from "./helpers.ts";

// A tipografia era resolvida tela a tela: sete pediam a Inter ao Google Fonts,
// cinco não pediam nada apesar de declararem font-family "Inter", e das sete uma
// pedia a versão estática em vez da variável. Davam três desenhos diferentes no
// mesmo app — ir de pagamento para pós-pagamento trocava o formato dos números.
// Agora a fonte é servida pelo próprio projeto, declarada uma vez em base.css.
const TELAS = [
    "login.html",
    "cadastro.html",
    "apelido.html",
    "carregamento.html",
    "home.html",
    "QR.html",
    "mapa.html",
    "pagamento.html",
    "pagamento-pós.html",
    "pré-denucia.html",
    "denuncia.html",
    "formularioDenuncia.html",
];

test.beforeEach(async ({ context, request }) => {
    resetarBanco();
    await autenticar(context, request, "ana.souza@example.com");
});

/** Largura de uma régua de dígitos na fonte pedida. Se a Inter não carregou, o
 *  navegador usa a do sistema e a medida bate com a do fallback genérico. */
async function medir(page: import("@playwright/test").Page) {
    return page.evaluate(async () => {
        await document.fonts.ready;
        const largura = (familia: string) => {
            const s = document.createElement("span");
            s.textContent = "0123456789";
            s.style.cssText = `position:absolute;visibility:hidden;font:40px ${familia}`;
            document.body.appendChild(s);
            const w = s.getBoundingClientRect().width;
            s.remove();
            return Math.round(w * 100) / 100;
        };
        return { inter: largura("Inter, sans-serif"), sistema: largura("sans-serif") };
    });
}

test("todas as telas desenham com a mesma fonte", async ({ page }) => {
    const larguras: { tela: string; largura: number }[] = [];

    for (const tela of TELAS) {
        await page.goto(`/${encodeURIComponent(tela)}`);
        const m = await medir(page);

        // a Inter carregou de fato, em vez de cair na fonte do sistema
        expect(m.inter, `${tela} caiu no fallback`).not.toBe(m.sistema);
        larguras.push({ tela, largura: m.inter });
    }

    // e é a mesma Inter em todas: uma variante diferente mediria diferente
    const referencia = larguras[0].largura;
    for (const { tela, largura } of larguras) {
        expect(largura, tela).toBe(referencia);
    }
});

// O resto do app já funcionava sem internet; a tipografia era a única parte que
// dependia de um servidor de fora. Num celular ligado só ao Wi-Fi da máquina,
// todas as telas caíam no fallback.
test("nenhuma tela busca recurso fora do próprio servidor", async ({ page, baseURL }) => {
    const externos: string[] = [];
    page.on("request", (r) => {
        const url = new URL(r.url());
        if (url.origin !== new URL(baseURL!).origin && url.protocol !== "data:") {
            externos.push(`${url.origin}${url.pathname}`);
        }
    });

    for (const tela of TELAS) {
        await page.goto(`/${encodeURIComponent(tela)}`);
        await page.evaluate(() => document.fonts.ready);
    }

    expect(externos).toEqual([]);
});

test("a fonte continua correta com a internet indisponível", async ({ page, context }) => {
    await context.route("**fonts.googleapis.com/**", (r) => r.abort());
    await context.route("**fonts.gstatic.com/**", (r) => r.abort());

    await page.goto("/pagamento.html");
    const m = await medir(page);
    expect(m.inter).not.toBe(m.sistema);
});

// Quatro folhas usam font-style: italic, entre elas a marca "CPTM" da tela de
// login. Sem o arquivo próprio o navegador inclina a versão reta por conta.
test("o itálico é o da fonte, não uma inclinação inventada pelo navegador", async ({ page }) => {
    await page.goto("/login.html");
    const temItalico = await page.evaluate(async () => {
        await document.fonts.ready;
        return document.fonts.check("italic 700 32px Inter");
    });
    expect(temItalico).toBe(true);
});

// Campos e botões não herdam a fonte da página: o padrão deles vem do sistema.
// Era por isso que o "VER TRAJETO" do mapa saía em Arial enquanto todo o resto
// estava em Inter — e cada folha vinha declarando a fonte um controle por vez, o
// que só funciona enquanto ninguém esquece.
test("nenhum elemento de texto usa fonte fora da Inter", async ({ page }) => {
    for (const tela of TELAS) {
        await page.goto(`/${encodeURIComponent(tela)}`);
        await page.evaluate(() => document.fonts.ready);

        const fora = await page.evaluate(() => {
            const achados: string[] = [];
            for (const el of Array.from(document.querySelectorAll("body *"))) {
                const visivel = (el as HTMLElement).offsetParent !== null;
                if (!visivel) continue;
                const temTexto = Array.from(el.childNodes).some(
                    (n) => n.nodeType === 3 && (n.textContent || "").trim()
                );
                if (!temTexto) continue;

                const familia = getComputedStyle(el).fontFamily;
                if (!/inter/i.test(familia)) {
                    const nome = el.id || (el.className || "").toString().split(" ")[0] || el.tagName;
                    achados.push(`${nome} → ${familia}`);
                }
            }
            return achados;
        });

        expect(fora, tela).toEqual([]);
    }
});
