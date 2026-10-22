// Compra de bilhetes. O saldo é pré-pago: comprar bilhete credita a carteira, e
// o débito de uma tarifa acontece na catraca (QR.html).

const incrementarBilhetes = document.getElementById("incrementar-bilhetes");
const decrementarBilhetes = document.getElementById("decrecimo-bilhetes");
const quantidadeBilhetes = document.getElementById("quantidade-bilhetes");
const valorBilhetes = document.getElementById("valor-bilhetes");
const comprarBotao = document.getElementById("botao-comprar");
const saldoEl = document.getElementById("dinheiro");
const voltarEl = document.getElementById("divvoltar");
const avisoEl = document.getElementById("aviso-compra");

let quantidade = 0;

// Valores de referência até /api/config responder. A tarifa e o teto de bilhetes
// são do servidor: repetir os números aqui já significaria mostrar um total que
// ele não cobraria se a tarifa mudasse.
let precoBilhete = 5.20;
let maxBilhetes = 20;

// Só estes três existem na tela anterior. A validação evita que a query string
// vire um jeito de escrever qualquer texto na página.
const METODOS = {
  pix: "Pix",
  cartao: "Cartão de Crédito",
  boleto: "Boleto Bancário",
};

function mostrarMetodo() {
  const escolhido = new URLSearchParams(window.location.search).get("metodo");
  const nome = METODOS[escolhido];
  if (!nome) return; // chegou direto na tela: a linha continua escondida

  document.getElementById("metodo-nome").textContent = nome;
  document.getElementById("metodo-escolhido").hidden = false;
}

function mostrarAviso(texto, tipo) {
  if (!avisoEl) return;
  avisoEl.textContent = texto;
  avisoEl.className = "aviso" + (tipo ? " " + tipo : "");
}

function atualizarTela() {
  const valor = quantidade * precoBilhete;
  quantidadeBilhetes.textContent = quantidade;
  valorBilhetes.textContent = valor.toFixed(2).replace(".", ",");

  // Os limites ficam visíveis no próprio botão, em vez de virarem uma recusa do
  // servidor depois que a pessoa já apertou COMPRAR.
  decrementarBilhetes.disabled = quantidade === 0;
  incrementarBilhetes.disabled = quantidade >= maxBilhetes;
  comprarBotao.disabled = quantidade === 0;
}

incrementarBilhetes.addEventListener("click", () => {
  if (quantidade >= maxBilhetes) {
    mostrarAviso(`Máximo de ${maxBilhetes} bilhetes por compra.`, "erro");
    return;
  }
  quantidade++;
  mostrarAviso("", null);
  atualizarTela();
});

decrementarBilhetes.addEventListener("click", () => {
  if (quantidade === 0) return;
  quantidade--;
  mostrarAviso("", null);
  atualizarTela();
});

async function carregarConfig() {
  try {
    const resp = await fetch("/api/config");
    if (!resp.ok) return;
    const config = await resp.json();
    if (typeof config.precoBilhete === "number") precoBilhete = config.precoBilhete;
    if (typeof config.maxBilhetes === "number") maxBilhetes = config.maxBilhetes;
  } catch {
    // sem config: seguem os valores de referência acima
  }
}

// O usuário vem de carregarUsuario() (auth.js), que também preenche a saudação.
async function carregarSaldo() {
  try {
    const usuario = await carregarUsuario();
    const saldo = usuario.saldo ?? 0;
    saldoEl.textContent = formatBRL(saldo);
    return saldo;
  } catch (error) {
    console.error("Erro ao carregar saldo:", error);
    saldoEl.textContent = formatBRL(0);
    return 0;
  }
}

async function comprar() {
  if (quantidade <= 0) return;

  comprarBotao.disabled = true;
  const rotulo = comprarBotao.textContent;
  comprarBotao.textContent = "COMPRANDO...";
  mostrarAviso("", null);

  try {
    // O servidor calcula o total e credita; aqui só se informa a quantidade.
    const response = await authFetch("/api/usuario/compra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantidade }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarAviso(data.mensagem || "Não foi possível concluir a compra.", "erro");
      return;
    }

    // A confirmação aparece na home, não aqui: a compra termina o fluxo e a
    // pessoa volta para a tela onde o saldo novo está à vista. Guardamos só os
    // dois números — a frase é montada lá, para nada que veio do armazenamento
    // do navegador virar texto na tela.
    localStorage.setItem(
      "compraConcluida",
      JSON.stringify({ quantidade: data.quantidade, total: data.total })
    );
    window.location.href = "home.html";
    return;
  } catch (error) {
    console.error("Erro na compra:", error);
    mostrarAviso("Erro de conexão. Tente novamente.", "erro");
  } finally {
    comprarBotao.textContent = rotulo;
    atualizarTela();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  mostrarMetodo();
  await carregarConfig();
  atualizarTela();
  await carregarSaldo();

  comprarBotao.addEventListener("click", comprar);

  if (voltarEl) {
    voltarEl.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "pagamento.html";
    });
  }
});
