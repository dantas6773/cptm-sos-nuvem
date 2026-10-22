// Alterna a visibilidade do campo de senha. Sem isso a pessoa digita às cegas e
// não tem como conferir o que escreveu — motivo comum de erro no login.
// Compartilhado entre as telas de login e cadastro.
document.querySelectorAll(".revelar-senha").forEach((botao) => {
  const campo = document.getElementById(botao.getAttribute("aria-controls"));
  if (!campo) return;

  botao.addEventListener("click", () => {
    const revelada = campo.type === "text";

    campo.type = revelada ? "password" : "text";
    botao.setAttribute("aria-pressed", String(!revelada));
    botao.setAttribute("aria-label", revelada ? "Mostrar senha" : "Ocultar senha");
    botao.classList.toggle("revelada", !revelada);

    // devolve o cursor ao campo, para a pessoa continuar digitando
    campo.focus();
  });
});
