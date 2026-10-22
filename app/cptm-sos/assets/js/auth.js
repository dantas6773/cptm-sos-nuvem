// Helper compartilhado de autenticação.
// Inclua este script ANTES do script da tela em qualquer HTML que precise
// chamar uma rota protegida da API (saldo, apelido, alerta, etc.).

// Vazio de propósito: o próprio servidor que expõe a API serve as telas, então
// as chamadas são same-origin e o app funciona em qualquer host/porta sem editar
// nada. Só defina window.API_BASE_OVERRIDE se abrir o front por outro servidor.
const API_BASE = window.API_BASE_OVERRIDE || "";

function formatBRL(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function salvarSessao({ token, usuario }) {
  if (token) localStorage.setItem("authToken", token);
  if (usuario) {
    localStorage.setItem("userEmail", usuario.email);
    localStorage.setItem("idLogado", usuario.id);
    if (usuario.nome) localStorage.setItem("apelido", usuario.nome);
  }
}

function limparSessao() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("idLogado");
  localStorage.removeItem("cpfLogado");
  localStorage.removeItem("apelido");
}

// fetch autenticado: injeta o Bearer token automaticamente.
// Se não houver token, redireciona pro login em vez de deixar a chamada falhar sem explicação.
async function authFetch(path, options = {}) {
  const token = localStorage.getItem("authToken");

  if (!token) {
    window.location.href = "/login.html";
    throw new Error("Sem token de autenticação, redirecionando para login.");
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Só 401 significa "não autenticado". Um 403 é recusa por regra de negócio
  // (ex.: CPF que não confere) e deve chegar a quem chamou, não derrubar a sessão.
  if (resp.status === 401) {
    limparSessao();
    window.location.href = "/login.html";
    throw new Error("Sessão expirada, redirecionando para login.");
  }

  return resp;
}

// Dados de quem está logado. Buscados uma vez por página e reaproveitados: antes
// cada tela fazia a sua própria chamada a /api/usuario, e as que mostram saudação
// e saldo chegavam a pedir a mesma coisa duas vezes.
let promessaUsuario = null;

function carregarUsuario() {
  if (!promessaUsuario) {
    promessaUsuario = authFetch("/api/usuario")
      .then((resp) => {
        if (!resp.ok) throw new Error("Erro ao buscar usuário no servidor");
        return resp.json();
      })
      .then((data) => data.usuario || {});
  }
  return promessaUsuario;
}

// Saudação do cabeçalho. Só age nas telas que têm o elemento, então este script
// continua seguro em login e cadastro, onde ainda não há sessão.
document.addEventListener("DOMContentLoaded", () => {
  const alvo = document.getElementById("boas-vindas");
  if (!alvo) return;

  carregarUsuario()
    .then((usuario) => {
      const nome = usuario.nome || "";
      alvo.textContent = "Olá, " + (nome.split(" ")[0] || "Usuário");
    })
    .catch(() => {
      // authFetch já redireciona quando a sessão caiu; aqui só evita deixar
      // "Carregando..." congelado se a rede falhar.
      alvo.textContent = "Olá";
    });
});

// Aviso de ambiente errado. Se a página for aberta pelo Live Server (ou por
// qualquer servidor que só entregue arquivos estáticos), as chamadas de API caem
// num lugar que não tem API e tudo falha com mensagens genéricas do tipo "erro ao
// cadastrar". Aqui a causa fica explícita, em vez de virar meia hora de caça.
(async () => {
  try {
    const resp = await fetch(`${API_BASE}/api/config`);
    const tipo = resp.headers.get("content-type") || "";
    if (resp.ok && tipo.includes("application/json")) return;
  } catch {
    // sem resposta: cai no aviso abaixo
  }

  const aviso = document.createElement("div");
  aviso.setAttribute("role", "alert");
  aviso.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:9999;background:#B3151B;color:#fff;" +
    "padding:12px 16px;font:14px/1.4 Inter,sans-serif;text-align:center";
  aviso.innerHTML =
    "Este app precisa ser aberto pelo servidor do projeto, não pelo Live Server.<br>" +
    "Rode <strong>npm run dev</strong> e acesse <strong>http://localhost:5001</strong>";
  document.body.prepend(aviso);
})();
