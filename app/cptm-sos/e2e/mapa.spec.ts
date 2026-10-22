import { test, expect } from "@playwright/test";
import { autenticar, resetarBanco } from "./helpers.ts";

// A tela pedia ao servidor que rodasse um script Python e abria o resultado em
// outra aba. O script quebrava com ModuleNotFoundError em qualquer máquina sem o
// ambiente virtual montado e, quando rodava, desenhava as estações em
// coordenadas que ele mesmo inventava. Agora o trajeto é calculado no servidor e
// mostrado na própria tela.
test.beforeEach(async ({ context, request }) => {
    resetarBanco();
    await autenticar(context, request, "ana.souza@example.com");
});

test("as 176 estações chegam aos dois seletores", async ({ page }) => {
    await page.goto("/mapa.html");

    // 176 estações mais a opção "Selecionar"
    await expect(page.locator("#origem option")).toHaveCount(177);
    await expect(page.locator("#destino option")).toHaveCount(177);
});

test("o trajeto aparece na própria tela, com linha, paradas e tempo", async ({ page }) => {
    await page.goto("/mapa.html");

    await page.selectOption("#origem", "Butantã");
    await page.selectOption("#destino", "Ana Rosa");
    await page.click("#gerar-mapa-btn");

    const pernas = page.locator(".trajeto-perna");
    await expect(pernas).toHaveCount(2);
    await expect(pernas.nth(0)).toContainText("Linha 4 - Amarela");
    await expect(pernas.nth(0)).toContainText("Paulista");
    await expect(pernas.nth(1)).toContainText("Linha 2 - Verde");
    await expect(pernas.nth(1)).toContainText("Consolação");

    await expect(page.locator(".trajeto-resumo")).toContainText("22 minutos");
    await expect(page.locator(".trajeto-resumo")).toContainText("1 baldeação");
});

// O tempo sai de uma taxa fixa por parada, não de tabela de horários. A tela diz
// isso: prometer precisão que os dados não têm seria o mesmo erro do mapa antigo.
test("a tela declara que o tempo é estimado", async ({ page }) => {
    await page.goto("/mapa.html");
    await page.selectOption("#origem", "Sé");
    await page.selectOption("#destino", "Luz");
    await page.click("#gerar-mapa-btn");

    await expect(page.locator(".trajeto-nota")).toContainText("Estimativa");
    await expect(page.locator(".trajeto-nota")).toContainText("não usa tabela de horários");
});

test("nada é pedido enquanto faltar uma das pontas", async ({ page }) => {
    await page.goto("/mapa.html");
    await expect(page.locator("#gerar-mapa-btn")).toBeDisabled();

    await page.selectOption("#origem", "Luz");
    await expect(page.locator("#gerar-mapa-btn")).toBeDisabled();

    await page.selectOption("#destino", "Brás");
    await expect(page.locator("#gerar-mapa-btn")).toBeEnabled();
});

test("origem igual ao destino avisa antes de deixar pedir", async ({ page }) => {
    await page.goto("/mapa.html");
    await page.selectOption("#origem", "Luz");
    await page.selectOption("#destino", "Luz");

    await expect(page.locator("#gerar-mapa-btn")).toBeDisabled();
    await expect(page.locator("#trajeto-info")).toContainText("duas estações diferentes");
});

// Os seletores eram <div role="button"> com uma lista de 176 <li>: o teclado
// alcançava o botão, mas Enter não abria nada.
test("dá para montar o trajeto inteiro pelo teclado", async ({ page }) => {
    await page.goto("/mapa.html");

    await page.locator("#origem").focus();
    await page.locator("#origem").selectOption("Jabaquara");
    await page.keyboard.press("Tab");
    await expect(page.locator("#destino")).toBeFocused();
    await page.locator("#destino").selectOption("Tucuruvi");

    await page.keyboard.press("Tab");
    await expect(page.locator("#gerar-mapa-btn")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.locator(".trajeto-resumo")).toContainText("22 paradas");
});

test("nenhuma chamada abre outra aba nem chama o servidor de Python", async ({ page, context }) => {
    const abas: string[] = [];
    context.on("page", (nova) => abas.push(nova.url()));

    const chamadas: string[] = [];
    page.on("request", (r) => chamadas.push(new URL(r.url()).pathname));

    await page.goto("/mapa.html");
    await page.selectOption("#origem", "Luz");
    await page.selectOption("#destino", "Brás");
    await page.click("#gerar-mapa-btn");
    await expect(page.locator(".trajeto-resumo")).toBeVisible();

    expect(abas).toEqual([]);
    expect(chamadas.filter((c) => c.includes("gera-mapa"))).toEqual([]);
});

test("o mapa da tela é arrastável, inclusive por toque", async ({ page }) => {
    await page.goto("/mapa.html");
    await page.waitForTimeout(300);

    const antes = await page.locator(".map").evaluate((el) => (el as HTMLElement).style.left);

    const caixa = (await page.locator(".map-container").boundingBox())!;
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.down();
    await page.mouse.move(caixa.x + caixa.width / 2 - 80, caixa.y + caixa.height / 2, { steps: 10 });
    await page.mouse.up();

    const depois = await page.locator(".map").evaluate((el) => (el as HTMLElement).style.left);
    expect(depois).not.toBe(antes);

    // o gesto pertence ao mapa: sem isto o navegador rola a página em vez de mover
    const toque = await page.locator(".map-container").evaluate((el) => getComputedStyle(el).touchAction);
    expect(toque).toBe("none");
});

// Sobrava um vão de 173px entre o cartão e a barra de baixo: o mapa e o bloco de
// conteúdo tinham flex: 1 e dividiam a sobra. Agora só o mapa cresce.
test("o cartão encosta na barra de baixo, sem vão", async ({ page }) => {
    for (const altura of [800, 660, 568]) {
        await page.setViewportSize({ width: 393, height: altura });
        await page.goto("/mapa.html");
        await page.waitForTimeout(200);

        const m = await page.evaluate(() => {
            // mede o cartão, não a caixa que o contém: o vão que se enxergava
            // ficava dentro do bloco, com o cartão no topo e o resto vazio
            const cartao = document.querySelector(".container-pesquisa")!.getBoundingClientRect();
            const barra = document.querySelector(".barra-navegacao")!.getBoundingClientRect();
            return {
                vao: Math.round(barra.top - cartao.bottom),
                alturaMapa: Math.round(document.querySelector(".map-container")!.getBoundingClientRect().height),
                paginaRola: document.documentElement.scrollHeight > window.innerHeight + 1,
            };
        });

        // só o respiro do bloco, não um vazio
        expect(m.vao, `em ${altura}px`).toBeLessThanOrEqual(32);
        // e a altura que sobra vai para o mapa
        expect(m.alturaMapa, `em ${altura}px`).toBeGreaterThan(200);
        expect(m.paginaRola, `em ${altura}px`).toBe(false);
    }
});

// Com trajeto na tela o mapa sai de cena, e o resultado usa a altura inteira:
// rola por dentro, sem a página rolar e sem empurrar as barras para fora.
test("trajeto longo rola por dentro, com as barras paradas", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/mapa.html");

    await page.selectOption("#origem", "Jundiaí");
    await page.selectOption("#destino", "Jabaquara");
    await page.click("#gerar-mapa-btn");
    await expect(page.locator(".trajeto-resumo")).toBeVisible();

    const m = await page.evaluate(() => {
        const conteudo = document.querySelector(".conteudo-mapa") as HTMLElement;
        const barra = document.querySelector(".barra-navegacao")!.getBoundingClientRect();
        return {
            mioloRola: conteudo.scrollHeight > conteudo.clientHeight + 1,
            paginaRola: document.documentElement.scrollHeight > window.innerHeight + 1,
            barraNaTela: barra.bottom <= window.innerHeight + 1,
        };
    });

    expect(m.mioloRola).toBe(true);
    expect(m.paginaRola).toBe(false);
    expect(m.barraNaTela).toBe(true);
});

// A borda de baixo cortava o mapa em seco, no meio de linhas e nomes de estação.
// A máscara faz o mapa se dissolver no fundo da página nos últimos pixels.
test("a base do mapa se dissolve, em vez de terminar numa régua", async ({ page }) => {
    await page.goto("/mapa.html");

    const mascara = await page
        .locator(".map-container")
        .evaluate((el) => getComputedStyle(el).maskImage || (getComputedStyle(el) as any).webkitMaskImage);

    expect(mascara).toContain("linear-gradient");
    expect(mascara).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);

    // A área esmaecida continua respondendo ao gesto: a máscara é só visual.
    // O ponto de teste é a faixa lateral ao cartão — a base do mapa passa por trás
    // dele, então lá o toque pertence ao cartão, não ao mapa.
    const mapa = (await page.locator(".map-container").boundingBox())!;
    const cartao = (await page.locator(".container-pesquisa").boundingBox())!;
    const y = (cartao.y + mapa.y + mapa.height) / 2; // dentro do esfumaçado
    const x = cartao.x / 2; // à esquerda do cartão

    const antes = await page.locator(".map").evaluate((el) => (el as HTMLElement).style.left);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 8 });
    await page.mouse.up();
    expect(await page.locator(".map").evaluate((el) => (el as HTMLElement).style.left)).not.toBe(antes);
});

// O mapa passa por trás do cartão e some no esfumaçado, em vez de terminar acima
// dele. A margem negativa não move o cartão: devolve a altura ao mapa.
test("o mapa continua por trás do cartão, até a altura dos seletores", async ({ page }) => {
    await page.goto("/mapa.html");
    await page.waitForTimeout(200);

    const m = await page.evaluate(() => {
        const caixa = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        return {
            baseMapa: Math.round(caixa(".map-container").bottom),
            topoCartao: Math.round(caixa(".container-pesquisa").top),
            baseSeletor: Math.round(caixa("#origem").bottom),
            camadaCartao: getComputedStyle(document.querySelector(".conteudo-mapa")!).zIndex,
        };
    });

    // a borda do mapa desce além do topo do cartão
    expect(m.baseMapa).toBeGreaterThan(m.topoCartao);
    // e chega perto da base dos seletores
    expect(Math.abs(m.baseMapa - m.baseSeletor)).toBeLessThan(24);
    // com o cartão pintado por cima
    expect(Number(m.camadaCartao)).toBeGreaterThan(0);
});

// O bloco do cartão cobre o mapa de ponta a ponta. Sem deixar o toque passar, a
// faixa vazia ao lado do cartão vira uma área morta: o mapa aparece ali e não
// responde ao arrasto.
test("a faixa ao lado do cartão continua sendo do mapa", async ({ page }) => {
    await page.goto("/mapa.html");
    await page.waitForTimeout(200);

    const bloco = await page
        .locator(".conteudo-mapa")
        .evaluate((el) => getComputedStyle(el).pointerEvents);
    const cartao = await page
        .locator(".container-pesquisa")
        .evaluate((el) => getComputedStyle(el).pointerEvents);

    expect(bloco).toBe("none");
    expect(cartao).toBe("auto");

    // e o cartão segue funcionando por cima
    await page.selectOption("#origem", "Luz");
    await expect(page.locator("#origem")).toHaveValue("Luz");
});

// Depois de pesquisar, metade da tela ficava com o resultado e não havia como
// desfazer: o mapa continuava lá atrás, encolhido, sem caminho de volta.
test("dá para voltar ao mapa depois de pesquisar", async ({ page }) => {
    await page.goto("/mapa.html");

    // só aparece quando há o que desfazer, e fora do cartão de trajeto: dentro
    // dele, azul sobre azul, passava por mais uma etiqueta de linha
    await expect(page.locator(".trajeto-voltar")).toBeHidden();
    await expect(page.locator("#trajeto-info .trajeto-voltar")).toHaveCount(0);

    await page.selectOption("#origem", "Alto da Boa Vista");
    await page.selectOption("#destino", "Água Branca");
    await page.click("#gerar-mapa-btn");
    await expect(page.locator(".trajeto-resumo")).toBeVisible();

    const mapaComRota = await page.locator(".map-container").evaluate((el) => el.getBoundingClientRect().height);

    await expect(page.locator(".trajeto-voltar")).toBeVisible();
    await expect(page.locator("#trajeto-info .trajeto-voltar")).toHaveCount(0);
    await page.click(".trajeto-voltar");

    await expect(page.locator(".trajeto-pernas")).toHaveCount(0);
    await expect(page.locator(".trajeto-voltar")).toBeHidden();
    const mapaDepois = await page.locator(".map-container").evaluate((el) => el.getBoundingClientRect().height);
    expect(mapaDepois).toBeGreaterThan(mapaComRota);

    // e o foco não se perde ao desfazer
    await expect(page.locator("#gerar-mapa-btn")).toBeFocused();
});

// O resultado escondia o topo do cartão de busca: eu rolava o bloco para o
// trajeto ficar à vista, e os rótulos ORIGEM e DESTINO saíam por cima do corte.
test("o cartão de busca continua inteiro depois da pesquisa", async ({ page }) => {
    for (const altura of [745, 700, 660]) {
        await page.setViewportSize({ width: 393, height: altura });
        await page.goto("/mapa.html");
        await page.selectOption("#origem", "Alto da Boa Vista");
        await page.selectOption("#destino", "Água Branca");
        await page.click("#gerar-mapa-btn");
        await expect(page.locator(".trajeto-resumo")).toBeVisible();

        const m = await page.evaluate(() => {
            const bloco = document.querySelector(".conteudo-mapa")!;
            const rotulo = document.querySelector(".dropdown-label")!.getBoundingClientRect();
            return { rolagem: bloco.scrollTop, cortado: rotulo.top < bloco.getBoundingClientRect().top };
        });

        expect(m.rolagem, `em ${altura}px`).toBe(0);
        expect(m.cortado, `em ${altura}px`).toBe(false);
    }
});

// Com dois cartões empilhados e o mapa já no mínimo, a sobreposição deixa de
// parecer intencional e vira o mapa espiando por trás deles.
test("a sobreposição some quando há trajeto e volta quando ele sai", async ({ page }) => {
    await page.goto("/mapa.html");
    const sobreposicao = () =>
        page.evaluate(() =>
            getComputedStyle(document.querySelector(".pagina")!).getPropertyValue("--sobreposicao-mapa").trim()
        );

    expect(await sobreposicao()).not.toBe("0px");

    await page.selectOption("#origem", "Luz");
    await page.selectOption("#destino", "Brás");
    await page.click("#gerar-mapa-btn");
    await expect(page.locator(".trajeto-resumo")).toBeVisible();
    expect(await sobreposicao()).toBe("0px");

    await page.click(".trajeto-voltar");
    expect(await sobreposicao()).not.toBe("0px");
});

// A regra que importa, e não a propriedade que a implementa: se o bloco precisa
// rolar, ele tem de receber o toque. No WebKit um container que rola com
// pointer-events: none simplesmente não rola, e o trajeto ficava preso no que
// coubesse na tela — o Chromium rola assim mesmo, então só o invariante pega.
test("todo bloco que precisa rolar recebe o toque", async ({ page }) => {
    for (const altura of [800, 745, 700, 660, 568]) {
        await page.setViewportSize({ width: 393, height: altura });
        await page.goto("/mapa.html");
        await page.selectOption("#origem", "AACD-Servidor");
        await page.selectOption("#destino", "Calmon Viana");
        await page.click("#gerar-mapa-btn");
        await expect(page.locator(".trajeto-resumo")).toBeVisible();

        const m = await page.evaluate(() => {
            const bloco = document.querySelector(".conteudo-mapa") as HTMLElement;
            return {
                precisaRolar: bloco.scrollHeight > bloco.clientHeight + 1,
                recebeToque: getComputedStyle(bloco).pointerEvents !== "none",
            };
        });

        if (m.precisaRolar) {
            expect(m.recebeToque, `em ${altura}px o bloco rola mas não recebe toque`).toBe(true);
        }
    }
});

test("o trajeto longo rola até o fim", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 700 });
    await page.goto("/mapa.html");
    await page.selectOption("#origem", "AACD-Servidor");
    await page.selectOption("#destino", "Calmon Viana");
    await page.click("#gerar-mapa-btn");
    await expect(page.locator(".trajeto-resumo")).toBeVisible();

    // a nota do rodapé do cartão só aparece rolando até o fim
    await page.locator(".trajeto-nota").scrollIntoViewIfNeeded();
    await expect(page.locator(".trajeto-nota")).toBeInViewport();
});

// O meio-termo — mapa encolhido aparecendo atrás de dois cartões — não servia
// para se localizar nem deixava o resultado respirar. A tela tem dois estados.
test("com trajeto na tela, o mapa sai de cena e a busca sobe", async ({ page }) => {
    await page.goto("/mapa.html");
    const cabecalho = (await page.locator("header").boundingBox())!;

    await page.selectOption("#origem", "Adolfo Pinheiro");
    await page.selectOption("#destino", "Brás");
    await page.click("#gerar-mapa-btn");
    await expect(page.locator(".trajeto-resumo")).toBeVisible();

    await expect(page.locator(".map-container")).toBeHidden();

    // o cartão de busca encosta logo abaixo do cabeçalho
    const cartao = (await page.locator(".container-pesquisa").boundingBox())!;
    expect(cartao.y - (cabecalho.y + cabecalho.height)).toBeLessThan(32);
});

// Enquanto escondido, a moldura não tem medida: sem recentrar ao voltar, o mapa
// reaparecia deslocado para fora da área visível.
test("o mapa volta centrado depois de desfazer a busca", async ({ page }) => {
    const LARGURA_MAPA = 1313; // a mesma de assets/js/mapa.js
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/mapa.html");
    await page.waitForTimeout(200);

    await page.selectOption("#origem", "Luz");
    await page.selectOption("#destino", "Brás");
    await page.click("#gerar-mapa-btn");
    await expect(page.locator(".map-container")).toBeHidden();

    // muda a altura enquanto o mapa está escondido — é quando a moldura mede
    // zero, e o mapa fica deslocado se ninguém recalcular ao trazê-lo de volta
    await page.setViewportSize({ width: 390, height: 700 });
    await page.waitForTimeout(150);

    await page.click(".trajeto-voltar");
    await expect(page.locator(".map-container")).toBeVisible();
    await page.waitForTimeout(150);

    const m = await page.evaluate(() => ({
        esquerda: parseFloat((document.querySelector(".map") as HTMLElement).style.left),
        moldura: document.querySelector(".map-container")!.getBoundingClientRect().width,
    }));

    // centrado é a moldura menos a largura do mapa, dividido por dois
    expect(m.esquerda).toBeCloseTo((m.moldura - LARGURA_MAPA) / 2, 0);
});

// A moldura declara touch-action: none para o arrasto não virar rolagem da
// página — e isso desliga junto o zoom que o navegador faria sozinho. Sem tratar
// os dois dedos, não havia como aproximar o mapa no celular.
test("dois dedos aproximam e afastam o mapa", async ({ page }) => {
    await page.goto("/mapa.html");
    await page.waitForTimeout(300);

    const escala = () =>
        page.evaluate(() => {
            const t = (document.querySelector(".map") as HTMLElement).style.transform;
            return Number(t.replace(/[^\d.]/g, "")) || 1;
        });

    const cdp = await page.context().newCDPSession(page);
    const caixa = (await page.locator(".map-container").boundingBox())!;
    const cx = caixa.x + caixa.width / 2;
    const cy = caixa.y + caixa.height / 2;

    const pinçar = async (de: number, ate: number) => {
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: cx - de, y: cy }, { x: cx + de, y: cy }],
        });
        for (let i = 1; i <= 10; i++) {
            const d = de + ((ate - de) * i) / 10;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: cx - d, y: cy }, { x: cx + d, y: cy }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(150);
    };

    const inicial = await escala();
    await pinçar(40, 120);
    const ampliado = await escala();
    expect(ampliado).toBeGreaterThan(inicial);

    await pinçar(120, 30);
    expect(await escala()).toBeLessThan(ampliado);
});

// Focar um botão por código faz o WebKit desenhar o anel de foco mesmo quando a
// abertura veio de um toque: aparecia uma caixa azul em volta do "Voltar" que
// não existe no resto do app. O foco vai para a camada, que não é um controle.
test("abrir o mapa expandido não desenha caixa em volta do voltar", async ({ page }) => {
    await page.goto("/mapa.html");
    await page.click("#expandir");

    await expect(page.locator("#overlay")).toBeVisible();
    const focado = await page.evaluate(() => document.activeElement?.id);
    expect(focado).toBe("overlay");

    // e o teclado continua entrando na camada e alcançando o botão
    await page.keyboard.press("Tab");
    await expect(page.locator("#btn-voltar")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#overlay")).toBeHidden();
});

// A moldura captura o ponteiro para o arrasto seguir o dedo fora dela. Feito sem
// exceção, isso redireciona os eventos e o clique nunca chega ao botão de
// expandir, que mora dentro do mapa.
test("o botão de expandir funciona por toque e por clique", async ({ page }) => {
    await page.goto("/mapa.html");
    await page.waitForTimeout(200);

    await page.click("#expandir");
    await expect(page.locator("#overlay")).toBeVisible();
    await page.click("#btn-voltar");
    await expect(page.locator("#overlay")).toBeHidden();

    await page.tap("#expandir");
    await expect(page.locator("#overlay")).toBeVisible();
});
