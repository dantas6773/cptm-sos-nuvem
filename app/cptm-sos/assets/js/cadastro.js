const form = document.getElementById("forme");
const emailEl = document.getElementById("email");
const cpfEl = document.getElementById("cpf");
const senhaEl = document.getElementById("senha");
const botao = document.getElementById("botao");

const SENHA_MINIMA = 8;

aplicarMascaraCPF(cpfEl);

validarAoSair(emailEl, ehEmail);
validarAoSair(cpfEl, ehCPF);
validarAoSair(senhaEl, temTamanhoMinimo(SENHA_MINIMA));

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  limparErros(form);

  // A validação aponta qual campo está errado, em vez de uma caixa do sistema
  // dizendo "todos os campos são obrigatórios" sem indicar qual falta.
  let valido = true;

  if (!emailEl.value.trim()) {
    mostrarErro(emailEl, "Informe o seu e-mail.");
    valido = false;
  } else if (!ehEmail(emailEl.value)) {
    mostrarErro(emailEl, "Esse e-mail não parece válido.");
    valido = false;
  }

  if (!cpfEl.value.trim()) {
    mostrarErro(cpfEl, "Informe o seu CPF.");
    valido = false;
  } else if (!ehCPF(cpfEl.value)) {
    mostrarErro(cpfEl, "O CPF precisa ter 11 dígitos.");
    valido = false;
  }

  if (!senhaEl.value) {
    mostrarErro(senhaEl, "Crie uma senha.");
    valido = false;
  } else if (senhaEl.value.length < SENHA_MINIMA) {
    mostrarErro(senhaEl, `Use pelo menos ${SENHA_MINIMA} caracteres.`);
    valido = false;
  }

  if (!valido) {
    form.querySelector("input.invalido")?.focus();
    return;
  }

  await comBotaoOcupado(botao, "Cadastrando...", async () => {
    try {
      const response = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailEl.value.trim(),
          // o servidor guarda só os dígitos; a máscara é da tela
          cpf: apenasDigitos(cpfEl.value),
          senha: senhaEl.value,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        salvarSessao({ token: data.token, usuario: data.usuario });
        window.location.href = "apelido.html";
        return;
      }

      // "Usuário já cadastrado" é sobre um campo específico, então aponta o campo
      if (data.mensagem && data.mensagem.toLowerCase().includes("já cadastrado")) {
        mostrarErro(emailEl, "Já existe uma conta com este e-mail ou CPF.");
        return;
      }

      mostrarErroGeral(form, data.mensagem || "Não foi possível cadastrar. Tente novamente.");
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      mostrarErroGeral(form, "Sem conexão com o servidor. Verifique se ele está rodando.");
    }
  });
});
