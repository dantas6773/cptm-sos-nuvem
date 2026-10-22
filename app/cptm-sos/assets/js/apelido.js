const form = document.getElementById("forme") || document.querySelector("form");
const botao = document.getElementById("botao");
const nome = document.getElementById("name");

validarAoSair(nome, temTamanhoMinimo(2));

async function enviarApelido(event) {
  event.preventDefault();
  if (form) limparErros(form);
  else limparErro(nome);

  const apelido = nome.value.trim();

  if (!apelido) {
    mostrarErro(nome, "Diga como devemos te chamar.");
    nome.focus();
    return;
  }

  if (apelido.length < 2) {
    mostrarErro(nome, "Use pelo menos 2 caracteres.");
    nome.focus();
    return;
  }

  await comBotaoOcupado(botao, "Salvando...", async () => {
    try {
      const response = await authFetch("/api/usuario/apelido", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apelido }),
      });

      if (!response.ok) {
        const mensagem = await response
          .json()
          .then((d) => d.mensagem)
          .catch(() => null);
        // A mensagem crua do servidor (que já chegou a ser um HTML de erro
        // inteiro) não ajuda quem está usando o app.
        mostrarErro(nome, mensagem || "Não foi possível salvar. Tente novamente.");
        return;
      }

      localStorage.setItem("apelido", apelido);
      window.location.href = "carregamento.html";
    } catch (error) {
      console.error("Erro ao salvar apelido:", error);
      mostrarErro(nome, "Sem conexão com o servidor. Tente novamente.");
    }
  });
}

botao.addEventListener("click", enviarApelido);
if (form) form.addEventListener("submit", enviarApelido);
