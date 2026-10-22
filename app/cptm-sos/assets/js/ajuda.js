// Folha de ajuda do rodapé, compartilhada pelas telas que têm "Central de Ajuda".
// O rótulo existia em três telas sem fazer nada — e escrito de três formas
// diferentes, uma delas sequer alcançável por teclado. Aqui ele abre um painel
// com o que o app realmente oferece, sem prometer canal que não existe.

(() => {
  const gatilho = document.getElementById("Ajuda");
  if (!gatilho) return;

  const ICONE_FECHAR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICONE_TELEFONE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 21a13.5 13.5 0 0 1-12.5-12.5A2.5 2.5 0 0 1 5.5 6h1.8a1 1 0 0 1 1 .8l.6 2.6a1 1 0 0 1-.4 1L7.2 11.6a11 11 0 0 0 5.2 5.2l1.2-1.3a1 1 0 0 1 1-.3l2.6.6a1 1 0 0 1 .8 1v1.8A2.5 2.5 0 0 1 15.5 21z"/></svg>';
  const ICONE_ESCUDO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7.5 3v5.2c0 4.6-3.1 8.4-7.5 9.8-4.4-1.4-7.5-5.2-7.5-9.8V6z"/><path d="M12 8.5v4"/><path d="M12 15.6v.1"/></svg>';

  const dialogo = document.createElement("dialog");
  dialogo.className = "dialogo-ajuda";
  dialogo.setAttribute("aria-labelledby", "ajuda-titulo");
  dialogo.innerHTML = `
    <div class="ajuda-topo">
      <h2 id="ajuda-titulo">Central de Ajuda</h2>
      <button type="button" class="ajuda-fechar" aria-label="Fechar">${ICONE_FECHAR}</button>
    </div>
    <div class="ajuda-corpo">
      <section class="ajuda-item">
        <h3>Emergência</h3>
        <p>Se você está em risco agora, ligue para a polícia. A chamada sai do seu telefone, sem passar pelo app.</p>
        <a class="ajuda-acao emergencia" href="tel:190">${ICONE_TELEFONE} Ligar 190</a>
      </section>

      <section class="ajuda-item">
        <h3>Denunciar</h3>
        <p>Assédio, roubo ou outra ocorrência na estação ou no trem. O registro é anônimo: seu nome não fica ligado à denúncia.</p>
        <a class="ajuda-acao denuncia" href="formularioDenuncia.html">${ICONE_ESCUDO} Fazer uma denúncia</a>
      </section>

      <section class="ajuda-item">
        <h3>Pagamentos</h3>
        <p class="ajuda-nota">Recarga e compra de bilhetes são simuladas neste protótipo acadêmico: o saldo muda no app, mas nenhum valor real é cobrado.</p>
      </section>
    </div>
  `;
  document.body.appendChild(dialogo);

  const fechar = dialogo.querySelector(".ajuda-fechar");

  gatilho.addEventListener("click", () => {
    // showModal() prende o foco e torna o resto da página inerte; show() e a
    // propriedade open não fazem nada disso.
    if (typeof dialogo.showModal === "function") dialogo.showModal();
    else dialogo.setAttribute("open", "");
  });

  fechar.addEventListener("click", () => dialogo.close());

  // clique fora do conteúdo fecha: o alvo do clique no backdrop é o próprio dialog
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo) dialogo.close();
  });
})();
