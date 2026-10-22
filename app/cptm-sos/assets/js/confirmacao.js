// Caixa de confirmação compartilhada. Usa <dialog> nativo: o foco fica preso
// dentro dela, Esc fecha e o resto da página vira inerte sem nenhuma linha nossa
// para isso — o que uma div com position:fixed não daria de graça.
//
// Inclua esta folha e este script na tela que precisa fechar um fluxo.

function mostrarConfirmacao({ titulo, detalhe, rotulo = "FECHAR", aoFechar }) {
  const dialogo = document.createElement("dialog");
  dialogo.className = "dialogo-confirmacao";

  const idTitulo = "confirmacao-titulo";
  dialogo.setAttribute("aria-labelledby", idTitulo);
  dialogo.innerHTML = `
    <div class="confirmacao-cartao">
      <h2 id="${idTitulo}"></h2>
      <p class="confirmacao-detalhe"></p>
    </div>
    <button type="button" class="confirmacao-botao"></button>
  `;

  // textContent, e não innerHTML: os valores vêm de resposta de API ou do
  // armazenamento do navegador, e nada deles pode virar marcação na tela.
  dialogo.querySelector("h2").textContent = titulo;
  dialogo.querySelector(".confirmacao-detalhe").textContent = detalhe;
  dialogo.querySelector(".confirmacao-botao").textContent = rotulo;

  document.body.appendChild(dialogo);

  dialogo.querySelector(".confirmacao-botao").addEventListener("click", () => dialogo.close());
  // clique fora do conteúdo fecha: o alvo do clique no backdrop é o próprio dialog
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo) dialogo.close();
  });
  dialogo.addEventListener("close", () => {
    dialogo.remove();
    if (typeof aoFechar === "function") aoFechar();
  });

  if (typeof dialogo.showModal === "function") dialogo.showModal();
  else dialogo.setAttribute("open", "");

  return dialogo;
}
