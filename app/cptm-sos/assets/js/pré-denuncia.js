const voltar = document.getElementById('voltar');
const organizador = document.getElementById('organizador'); // botão vermelho
const facaUmaDenuncia = document.getElementById('faça-uma-denuncia'); // botão vermelho pequeno
const setaVoltar = document.getElementById('setavoltar');

// ========================= VOLTAR PARA A HOME =========================
voltar.addEventListener('click', function () {
  window.location.href = 'home.html';
});

// ========================= FUNÇÃO DE ATIVAR ALERTA =========================
async function ativarAlerta() {
  try {
    const response = await authFetch("/api/alerta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alerta: true, // altera o valor do campo alerta no JSON
      }),
    });

    if (response.ok) {
    } else {
      console.error("⚠️ Erro ao ativar alerta:", response.status);
    }
  } catch (err) {
    console.error("🌐 Erro de conexão ao ativar alerta:", err);
  }
}

// ========================= BOTÃO VERMELHO GRANDE =========================
organizador.addEventListener('click', async function (e) {
  e.preventDefault();
  await ativarAlerta(); // altera alerta para true no JSON
  window.location.href = 'denuncia.html'; // redireciona pra tela de denúncia
});

// ========================= BOTÃO "FAÇA UMA DENÚNCIA" =========================
facaUmaDenuncia.addEventListener('click', async function () {
  await ativarAlerta(); // também ativa o alerta
  window.location.href = 'formularioDenuncia.html'; // redireciona pro formulário
});

// ========================= SETA DE VOLTAR =========================
setaVoltar.addEventListener('click', function () {
  window.location.href = 'home.html';
});