const seta_voltar = document.getElementById('divvoltar');


seta_voltar.addEventListener('click', function () {
  window.location.href = 'home.html';
});



// A saudação do cabeçalho é preenchida por auth.js, que já busca o usuário.
async function mostrarSaldo() {
  const dinheiroEl = document.getElementById('dinheiro');

  try {
    const usuario = await carregarUsuario();
    if (dinheiroEl) dinheiroEl.textContent = formatBRL(usuario.saldo ?? 0);
  } catch (err) {
    console.error('Erro ao carregar usuário:', err);
    if (dinheiroEl) dinheiroEl.textContent = formatBRL(0);
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  await mostrarSaldo();

  // O método escolhido segue para a tela de compra. Antes os três botões levavam
  // ao mesmo lugar e a escolha se perdia: quem clicava em Boleto via exatamente a
  // mesma tela de quem clicou em Pix, sem nada confirmando o que foi selecionado.
  const metodoBtns = document.querySelectorAll('.mets');
  metodoBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const metodo = btn.dataset.metodo;
      window.location.href = 'pagamento-pós.html' + (metodo ? '?metodo=' + metodo : '');
    });
  });
});
