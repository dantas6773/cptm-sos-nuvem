// Utilidades de formulário compartilhadas pelas telas de entrada.
// Substituem os alert() do sistema: a mensagem aparece embaixo do campo que a
// causou, some quando a pessoa corrige, e não interrompe o preenchimento.

/** Mostra a mensagem abaixo do campo e marca o campo como inválido. */
function mostrarErro(campo, mensagem) {
  const alvo = document.getElementById(`erro-${campo.id}`);
  campo.classList.add("invalido");
  campo.setAttribute("aria-invalid", "true");

  if (alvo) {
    alvo.textContent = mensagem;
    campo.setAttribute("aria-describedby", alvo.id);
  }
}

/** Limpa o erro de um campo. */
function limparErro(campo) {
  const alvo = document.getElementById(`erro-${campo.id}`);
  campo.classList.remove("invalido");
  campo.removeAttribute("aria-invalid");
  if (alvo) alvo.textContent = "";
}

/** Erro que não pertence a um campo específico (falha de rede, recusa do servidor). */
function mostrarErroGeral(form, mensagem) {
  const alvo = form.querySelector(".erro-geral");
  if (alvo) alvo.textContent = mensagem;
}

function limparErros(form) {
  form.querySelectorAll("input").forEach(limparErro);
  mostrarErroGeral(form, "");
}

/**
 * Enquanto a requisição está em andamento o botão fica desabilitado: sem isso,
 * cada clique repetido dispara um envio novo.
 */
function comBotaoOcupado(botao, textoOcupado, tarefa) {
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoOcupado;

  return tarefa().finally(() => {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  });
}

/** Só os dígitos, que é o formato que o servidor espera. */
function apenasDigitos(valor) {
  return valor.replace(/\D/g, "");
}

/** Formata como 000.000.000-00 conforme a pessoa digita. */
function formatarCPF(valor) {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Liga a máscara e o limite de tamanho ao campo de CPF. */
function aplicarMascaraCPF(campo) {
  campo.addEventListener("input", () => {
    const antes = campo.value;
    const formatado = formatarCPF(antes);
    if (formatado !== antes) campo.value = formatado;
  });
}

/**
 * Marca o campo como preenchido corretamente assim que ele perde o foco com um
 * valor válido — retorno visual de que aquele campo já está resolvido.
 */
function validarAoSair(campo, validador) {
  campo.addEventListener("blur", () => {
    if (!campo.value.trim()) {
      campo.classList.remove("valido");
      return;
    }
    const ok = validador(campo.value);
    campo.classList.toggle("valido", ok);
    if (ok) limparErro(campo);
  });

  // corrigiu enquanto digitava: o erro sai na hora
  campo.addEventListener("input", () => {
    if (campo.classList.contains("invalido")) limparErro(campo);
  });
}

const ehEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const ehCPF = (v) => apenasDigitos(v).length === 11;
const temTamanhoMinimo = (min) => (v) => v.trim().length >= min;
