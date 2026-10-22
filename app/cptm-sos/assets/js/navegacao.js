// Barra de seções, compartilhada pelas telas que a exibem. Existia duas vezes,
// com marcações diferentes: a home usava .botao-footer em <div>, o mapa usava
// .secoes/.home/.denuncia em <div> — nenhuma das duas alcançável por teclado, e
// só a denúncia da home tinha destino. Aqui é uma definição só, com botões de
// verdade e o item da seção atual aceso.

const ICONES_NAV = {
  avisos:
    '<path d="M6 10a6 6 0 1 1 12 0c0 3.2 1 5 2 6H4c1-1 2-2.8 2-6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  local:
    '<path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.4" stroke="currentColor" stroke-width="1.8"/>',
  home:
    '<path d="M4 11 12 4l8 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9.5V20h12V9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  denuncia:
    '<path d="M12 3 4 6v6c0 5 3.4 8.5 8 9.5 4.6-1 8-4.5 8-9.5V6l-8-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 8.5v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="15.5" r="0.9" fill="currentColor"/>',
  ajustes:
    '<circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 16l-1.7 1.7M17.7 17.7 16 16M8 8 6.3 6.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};

const ITENS_NAV = [
  { secao: "avisos", rotulo: "Avisos", destino: "home.html#avisos" },
  { secao: "local", rotulo: "Localização", destino: "mapa.html" },
  { secao: "home", rotulo: "Home", destino: "home.html" },
  { secao: "denuncia", rotulo: "Denúncia", destino: "pré-denucia.html" },
  // Ajustes está no projeto visual, mas a tela nunca foi construída. Fica
  // visivelmente indisponível em vez de parecer um botão que não faz nada.
  { secao: "ajustes", rotulo: "Ajustes", destino: null },
];

// De que seção é cada tela. A home é "home" e não "avisos": os avisos são um
// trecho dela, alcançado pela âncora.
const SECAO_DA_PAGINA = {
  "home.html": "home",
  "mapa.html": "local",
  "pré-denucia.html": "denuncia",
  "denuncia.html": "denuncia",
  "formularioDenuncia.html": "denuncia",
};

function montarNavegacao() {
  const barra = document.querySelector(".barra-navegacao");
  if (!barra) return;

  const paginaAtual = decodeURIComponent(window.location.pathname.split("/").pop() || "home.html");
  const secaoAtual = SECAO_DA_PAGINA[paginaAtual] || null;

  barra.innerHTML = "";
  for (const item of ITENS_NAV) {
    const atual = item.secao === secaoAtual;
    const elemento = document.createElement(item.destino ? "a" : "span");

    elemento.className = "item-nav";
    if (item.destino) elemento.href = item.destino;
    if (atual) elemento.setAttribute("aria-current", "page");
    if (!item.destino) {
      elemento.setAttribute("aria-disabled", "true");
      elemento.title = "Ainda não disponível";
    }

    elemento.innerHTML =
      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONES_NAV[item.secao]}</svg>` +
      `<span>${item.rotulo}</span>`;

    barra.appendChild(elemento);
  }
}

document.addEventListener("DOMContentLoaded", montarNavegacao);
