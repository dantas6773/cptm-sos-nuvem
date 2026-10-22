const form = document.getElementById("forme");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const botao = document.getElementById("botao");

validarAoSair(email, ehEmail);
validarAoSair(senha, temTamanhoMinimo(1));

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  limparErros(form);

  // A validação aponta o campo que está errado, em vez de uma caixa do sistema
  // dizendo "todos os campos são obrigatórios" sem indicar qual falta.
  let valido = true;

  if (!email.value.trim()) {
    mostrarErro(email, "Informe o seu e-mail.");
    valido = false;
  } else if (!ehEmail(email.value)) {
    mostrarErro(email, "Esse e-mail não parece válido.");
    valido = false;
  }

  if (!senha.value) {
    mostrarErro(senha, "Informe a sua senha.");
    valido = false;
  }

  if (!valido) {
    form.querySelector("input.invalido")?.focus();
    return;
  }

  await comBotaoOcupado(botao, "Entrando...", async () => {
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value.trim(), senha: senha.value }),
      });

      const data = await response.json();

      if (response.status === 200) {
        salvarSessao({ token: data.token, usuario: data.usuario });
        // Passa pela tela de carregamento, como o cadastro já fazia: a animação
        // da marca marca a entrada no app, e não só a criação da conta.
        window.location.href = "carregamento.html";
        return;
      }

      // 401 e 404 são o mesmo caso para quem está entrando: as credenciais não
      // conferem. Distinguir os dois revelaria quais e-mails existem no sistema.
      if (response.status === 401 || response.status === 404) {
        mostrarErroGeral(form, "E-mail ou senha incorretos.");
        senha.value = "";
        senha.focus();
        return;
      }

      mostrarErroGeral(form, data.mensagem || "Não foi possível entrar. Tente novamente.");
    } catch (error) {
      console.error("Erro ao entrar:", error);
      mostrarErroGeral(form, "Sem conexão com o servidor. Verifique se ele está rodando.");
    }
  });
});

// Atalho de desenvolvimento. O botão só aparece quando o servidor roda com
// LOGIN_DEMO=1; em qualquer outro caso a tela é a de sempre. A autenticação não
// muda — o atalho apenas envia as credenciais de demonstração, que são públicas.
(async () => {
  const botaoDemo = document.getElementById("botao-demo");
  if (!botaoDemo) return;

  try {
    const resp = await fetch("/api/config");
    const config = await resp.json();
    if (!config.loginDemo) return;

    botaoDemo.classList.remove("hidden");
    botaoDemo.addEventListener("click", () => {
      email.value = config.emailDemo;
      senha.value = "demo1234";
      form.requestSubmit();
    });
  } catch {
    // sem config, a tela segue normal
  }
})();
