document.addEventListener("DOMContentLoaded", async function () {
  const botaoVoltar = document.getElementById("btn-voltar");
  const botaoCatraca = document.getElementById("btn-catraca");
  const saldoEl = document.querySelector(".saldo");
  const avisoEl = document.getElementById("aviso-catraca");
  const precoEl = document.getElementById("preco-passagem");

  // Valor de referência até /api/config responder. A tarifa é do servidor: se
  // ela mudasse, a tela prometeria um desconto diferente do que seria cobrado.
  let precoPassagem = 5.20;

  botaoVoltar.addEventListener("click", function () {
    window.location.href = "home.html";
  });

  function mostrarSaldo(valor) {
    if (saldoEl) saldoEl.textContent = `Seu saldo: ${formatBRL(valor)}`;

    // Saldo que não cobre a tarifa desliga o botão e diz por quê, em vez de
    // deixar a pessoa apertar para receber a recusa do servidor.
    const cobre = Number(valor) >= precoPassagem;
    botaoCatraca.disabled = !cobre;
    if (!cobre) avisar(`Saldo insuficiente. A passagem custa ${formatBRL(precoPassagem)}.`, "erro");
  }

  function avisar(texto, tipo) {
    if (!avisoEl) return;
    avisoEl.textContent = texto;
    avisoEl.className = tipo ? `aviso ${tipo}` : "aviso";
  }

  async function carregarSaldoBackend() {
    try {
      // A rota é protegida e tira a identidade do token — passar ?email= não autentica.
      const resp = await authFetch("/api/usuario");
      if (!resp.ok) throw new Error("Erro ao buscar saldo no servidor");

      const data = await resp.json();
      mostrarSaldo(data.usuario?.saldo ?? 0);
    } catch (error) {
      console.error("Erro ao carregar saldo do backend:", error);
      if (saldoEl) saldoEl.textContent = "Saldo indisponível";
      // Sem saber o saldo não dá para prometer a passagem.
      botaoCatraca.disabled = true;
      avisar("Não foi possível consultar o seu saldo. Tente novamente.", "erro");
    }
  }

  // Passar na catraca desconta uma passagem do saldo. A compra de bilhetes credita;
  // é aqui que o valor sai.
  async function passarNaCatraca() {
    botaoCatraca.disabled = true;
    avisar("");

    try {
      const resp = await authFetch("/api/usuario/passagem", { method: "POST" });
      const data = await resp.json();

      if (!resp.ok) {
        mostrarSaldo(data.saldo ?? 0);
        avisar(data.mensagem || "Não foi possível liberar a passagem.", "erro");
        return;
      }

      const novoSaldo = data.usuario?.saldo ?? 0;
      mostrarSaldo(novoSaldo);

      // A confirmação aparece na home, como a da compra e a do alarme: o bilhete
      // foi usado, então esta tela não tem mais função, e a home mostra o saldo
      // já descontado por trás da caixa.
      localStorage.setItem(
        "passagemLiberada",
        JSON.stringify({ preco: data.preco, saldo: novoSaldo })
      );
      window.location.href = "home.html";
      return;
    } catch (error) {
      console.error("Erro ao passar na catraca:", error);
      avisar("Erro de conexão com o servidor.", "erro");
    } finally {
      botaoCatraca.disabled = false;
    }
  }

  if (botaoCatraca) {
    botaoCatraca.addEventListener("click", passarNaCatraca);
  }

  async function carregarPreco() {
    try {
      const resp = await fetch("/api/config");
      if (!resp.ok) return;
      const config = await resp.json();
      if (typeof config.precoBilhete === "number") precoPassagem = config.precoBilhete;
    } catch {
      // sem config: segue o valor de referência acima
    }
    if (precoEl) precoEl.textContent = formatBRL(precoPassagem);
  }

  await carregarPreco();
  await carregarSaldoBackend();
});
