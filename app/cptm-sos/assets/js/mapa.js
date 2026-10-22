// Tela do mapa: escolher origem e destino e ver o trajeto.
//
// A versão anterior tinha dois menus feitos à mão com <div role="button"> e uma
// lista de 176 <li> — o teclado alcançava o botão mas Enter não abria nada, e a
// seta aparecia duas vezes (uma no texto, outra no ::after). Aqui são <select>
// nativos: no celular abrem o seletor do próprio sistema, funcionam com teclado
// e leitor de tela sem código nosso, e sumiram cerca de duzentas linhas.
//
// O botão também mudou de função. Antes pedia ao servidor que rodasse um script
// Python e abria o resultado em outra aba; agora o trajeto é calculado pelo
// servidor e mostrado aqui mesmo, como no projeto visual.

// ============================
// MAPA: arrastar e aproximar
// ============================
// A versão anterior escutava mousedown/mousemove/mouseup — num celular, que é o
// alvo do app, não dava para arrastar o mapa de jeito nenhum. Eventos de ponteiro
// cobrem mouse e toque com o mesmo código.
(function iniciarMapaArrastavel() {
  const mapa = document.querySelector(".map");
  const moldura = document.querySelector(".map-container");
  if (!mapa || !moldura) return;

  const LARGURA = 1313;
  const ALTURA = 875;
  const ESCALA_MIN = 0.5;
  const ESCALA_MAX = 3;

  let arrastando = false;
  let inicioX = 0;
  let inicioY = 0;
  let x = 0;
  let y = 0;
  let escala = 1;

  // Pinça de dois dedos. A moldura declara touch-action: none para o arrasto não
  // virar rolagem da página, e isso desliga junto o zoom que o navegador faria
  // sozinho — então ele é feito aqui.
  const pontos = new Map();
  let pinca = null;

  const meio = () => {
    const [a, b] = [...pontos.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const distancia = () => {
    const [a, b] = [...pontos.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function iniciarPinca() {
    const caixa = moldura.getBoundingClientRect();
    const m = meio();
    const local = { x: m.x - caixa.left, y: m.y - caixa.top };
    pinca = {
      distancia: distancia(),
      escala,
      // ponto do mapa que estava sob os dedos: é ele que fica parado
      alvo: { x: (local.x - x) / escala, y: (local.y - y) / escala },
    };
    arrastando = false;
    mapa.style.transition = "none";
  }

  function aplicarPinca() {
    if (!pinca || pontos.size < 2) return;
    const caixa = moldura.getBoundingClientRect();
    const m = meio();
    const local = { x: m.x - caixa.left, y: m.y - caixa.top };

    escala = limitar((distancia() / pinca.distancia) * pinca.escala, ESCALA_MIN, ESCALA_MAX);
    x = local.x - pinca.alvo.x * escala;
    y = local.y - pinca.alvo.y * escala;

    const [minX, minY, maxX, maxY] = limites();
    x = limitar(x, minX, maxX);
    y = limitar(y, minY, maxY);
    aplicar();
  }

  const limitar = (valor, min, max) => Math.min(max, Math.max(min, valor));

  function limites() {
    return [moldura.clientWidth - LARGURA * escala, moldura.clientHeight - ALTURA * escala, 0, 0];
  }

  function aplicar() {
    mapa.style.transform = `scale(${escala})`;
    mapa.style.left = `${x}px`;
    mapa.style.top = `${y}px`;
  }

  function centralizar() {
    escala = 1;
    x = (moldura.clientWidth - LARGURA) / 2;
    y = (moldura.clientHeight - ALTURA) / 2;
    aplicar();
  }

  moldura.addEventListener("pointerdown", (evento) => {
    // O botão de expandir mora dentro da moldura. Capturar o ponteiro aqui
    // redireciona os eventos seguintes para ela e o clique nunca chega ao botão —
    // então o que é controle não inicia arrasto.
    if (evento.target.closest("button, a")) return;

    pontos.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
    moldura.setPointerCapture(evento.pointerId);

    if (pontos.size === 2) {
      iniciarPinca();
      return;
    }

    arrastando = true;
    inicioX = evento.clientX - x;
    inicioY = evento.clientY - y;
    mapa.style.transition = "none";
  });

  const soltar = (evento) => {
    pontos.delete(evento.pointerId);
    if (moldura.hasPointerCapture?.(evento.pointerId)) {
      moldura.releasePointerCapture(evento.pointerId);
    }

    if (pontos.size < 2) pinca = null;

    if (pontos.size === 1) {
      // um dedo continua na tela: o arrasto recomeça a partir de onde ele está,
      // senão o mapa salta quando o outro dedo sai
      const [restante] = [...pontos.values()];
      arrastando = true;
      inicioX = restante.x - x;
      inicioY = restante.y - y;
    } else if (pontos.size === 0) {
      arrastando = false;
    }
  };
  moldura.addEventListener("pointerup", soltar);
  moldura.addEventListener("pointercancel", soltar);

  moldura.addEventListener("pointermove", (evento) => {
    if (!pontos.has(evento.pointerId)) return;
    pontos.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });

    if (pontos.size >= 2) {
      aplicarPinca();
      return;
    }

    if (!arrastando) return;
    const [minX, minY, maxX, maxY] = limites();
    x = limitar(evento.clientX - inicioX, minX, maxX);
    y = limitar(evento.clientY - inicioY, minY, maxY);
    aplicar();
  });

  moldura.addEventListener("wheel", (evento) => {
    evento.preventDefault();
    mapa.style.transition = "transform 0.2s ease, top 0.2s ease, left 0.2s ease";

    const nova = limitar(escala - evento.deltaY * 0.001, ESCALA_MIN, ESCALA_MAX);
    const caixa = moldura.getBoundingClientRect();
    const alvoX = evento.clientX - caixa.left - x;
    const alvoY = evento.clientY - caixa.top - y;
    const razao = nova / escala;

    x -= alvoX * (razao - 1);
    y -= alvoY * (razao - 1);
    escala = nova;

    const [minX, minY, maxX, maxY] = limites();
    x = limitar(x, minX, maxX);
    y = limitar(y, minY, maxY);
    aplicar();
  }, { passive: false });

  // dois toques rápidos voltam ao centro
  moldura.addEventListener("dblclick", () => {
    mapa.style.transition = "transform 0.3s ease, top 0.3s ease, left 0.3s ease";
    centralizar();
  });

  centralizar();
  window.addEventListener("resize", centralizar);
  // enquanto o mapa fica escondido a moldura não tem medida, então o centro é
  // recalculado quando ele volta à tela
  document.addEventListener("mapa:visivel", centralizar);
})();

const origemEl = document.getElementById("origem");
const destinoEl = document.getElementById("destino");
const gerarBtn = document.getElementById("gerar-mapa-btn");
const trajetoEl = document.getElementById("trajeto-info");
const overlay = document.getElementById("overlay");
const expandirBtn = document.getElementById("expandir");
const voltarBtn = document.getElementById("btn-voltar");
const voltarMapaBtn = document.querySelector(".trajeto-voltar");

function preencher(select, estacoes) {
  for (const estacao of estacoes) {
    const opcao = document.createElement("option");
    opcao.value = estacao;
    opcao.textContent = estacao;
    select.appendChild(opcao);
  }
}

async function carregarEstacoes() {
  try {
    const resp = await fetch("/api/estacoes");
    if (!resp.ok) throw new Error("Não foi possível carregar as estações");
    const estacoes = await resp.json();
    preencher(origemEl, estacoes);
    preencher(destinoEl, estacoes);
  } catch (err) {
    console.error("Erro ao carregar estações:", err);
    mostrarAviso("Não foi possível carregar a lista de estações.", "erro");
  }
}

function mostrarAviso(texto, tipo) {
  trajetoEl.className = "container-trajeto aviso-trajeto" + (tipo ? " " + tipo : "");
  trajetoEl.textContent = texto;
}

function atualizarBotao() {
  const ambas = origemEl.value && destinoEl.value;
  gerarBtn.disabled = !ambas;

  // origem igual a destino não é trajeto; avisa em vez de deixar pedir
  if (ambas && origemEl.value === destinoEl.value) {
    gerarBtn.disabled = true;
    mostrarAviso("Escolha duas estações diferentes.", "erro");
  } else if (trajetoEl.classList.contains("erro")) {
    limparTrajeto();
  }
}

function limparTrajeto() {
  trajetoEl.className = "container-trajeto hidden";
  trajetoEl.textContent = "";
  voltarMapaBtn.hidden = true;
  document.querySelector(".pagina").classList.remove("com-trajeto");
}

/** Volta à vista do mapa, desfazendo a busca. */
function voltarAoMapa() {
  limparTrajeto();
  document.dispatchEvent(new CustomEvent("mapa:visivel"));
  gerarBtn.focus();
}

/** Etiqueta colorida da linha, como os chips do projeto visual. */
function chipDaLinha(perna) {
  const chip = document.createElement("span");
  chip.className = "linha-chip";
  chip.style.backgroundColor = perna.cor;
  chip.textContent = perna.linha;
  // amarelo e prata não sustentam texto branco
  chip.style.color = corClara(perna.cor) ? "#141A2E" : "#FFFFFF";
  return chip;
}

function corClara(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  // luminância relativa aproximada, suficiente para escolher preto ou branco
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

function montarTrajeto(rota) {
  trajetoEl.className = "container-trajeto";
  trajetoEl.textContent = "";

  // Com o trajeto na tela o mapa encolhe até o mínimo, e aí a sobreposição
  // deixa de parecer intencional: vira o mapa espiando atrás de dois cartões.
  document.querySelector(".pagina").classList.add("com-trajeto");
  voltarMapaBtn.hidden = false;

  if (rota.mesmaBaldeacao) {
    mostrarAviso(
      `${rota.origem} e ${rota.destino} são a mesma baldeação: dá para ir a pé, sem pegar trem.`,
      null
    );
    document.querySelector(".pagina").classList.add("com-trajeto");
  voltarMapaBtn.hidden = false;
    return;
  }

  const lista = document.createElement("ol");
  lista.className = "trajeto-pernas";

  for (const perna of rota.pernas) {
    const item = document.createElement("li");
    item.className = "trajeto-perna";

    const de = document.createElement("strong");
    de.textContent = perna.embarque;

    const ate = document.createElement("strong");
    ate.textContent = perna.desembarque;

    const paradas = document.createElement("span");
    paradas.className = "trajeto-paradas";
    paradas.textContent = perna.paradas === 1 ? "1 parada" : `${perna.paradas} paradas`;

    item.append(chipDaLinha(perna), de, seta(), ate, paradas);
    lista.appendChild(item);
  }

  const resumo = document.createElement("p");
  resumo.className = "trajeto-resumo";
  const baldeacao =
    rota.baldeacoes === 0
      ? "sem baldeação"
      : rota.baldeacoes === 1
        ? "1 baldeação"
        : `${rota.baldeacoes} baldeações`;
  resumo.textContent = `Tempo de chegada estimado: ${rota.minutos} minutos — ${rota.paradas} paradas, ${baldeacao}.`;

  const nota = document.createElement("p");
  nota.className = "trajeto-nota";
  nota.textContent = "Estimativa por número de paradas; o projeto não usa tabela de horários.";

  trajetoEl.append(lista, resumo, nota);
}

function seta() {
  const s = document.createElement("span");
  s.className = "trajeto-seta";
  s.setAttribute("aria-hidden", "true");
  s.textContent = "→";
  return s;
}

async function verTrajeto() {
  const origem = origemEl.value;
  const destino = destinoEl.value;
  if (!origem || !destino) return;

  gerarBtn.disabled = true;
  const rotulo = gerarBtn.textContent;
  gerarBtn.textContent = "CALCULANDO...";

  try {
    const resp = await fetch(
      `/api/rota?origem=${encodeURIComponent(origem)}&destino=${encodeURIComponent(destino)}`
    );
    const dados = await resp.json();

    if (!resp.ok) {
      mostrarAviso(dados.mensagem || "Não foi possível calcular o trajeto.", "erro");
      return;
    }

    montarTrajeto(dados);
  } catch (err) {
    console.error("Erro ao calcular trajeto:", err);
    mostrarAviso("Erro de conexão. Tente novamente.", "erro");
  } finally {
    gerarBtn.textContent = rotulo;
    atualizarBotao();
  }
}

// --- mapa expandido ---

function abrirMapa() {
  overlay.classList.remove("hidden");
  // o foco vai para a camada, e não para o botão: no WebKit focar um botão por
  // código desenha o anel de foco mesmo quando a abertura veio de um toque, e
  // aparecia uma caixa azul em volta do "Voltar" que não existe no resto do app
  overlay.focus();
}

function fecharMapa() {
  overlay.classList.add("hidden");
  expandirBtn.focus();
}

document.addEventListener("DOMContentLoaded", async () => {
  await carregarEstacoes();

  origemEl.addEventListener("change", atualizarBotao);
  destinoEl.addEventListener("change", atualizarBotao);
  gerarBtn.addEventListener("click", verTrajeto);
  voltarMapaBtn.addEventListener("click", voltarAoMapa);

  if (expandirBtn) expandirBtn.addEventListener("click", abrirMapa);
  if (voltarBtn) voltarBtn.addEventListener("click", fecharMapa);

  // Esc fecha o mapa expandido, como qualquer camada sobre a tela
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !overlay.classList.contains("hidden")) fecharMapa();
  });
});
