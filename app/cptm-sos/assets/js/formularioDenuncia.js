const voltar = document.getElementById('voltar');
const categorias = document.getElementById('pai-categorias');
const form = document.getElementById('form-denuncia');
const confirmacao = document.getElementById('confirmacao');
const tituloCategoria = document.getElementById('categoria-escolhida');
const descricao = document.getElementById('descricao');
const contador = document.getElementById('contador');
const local = document.getElementById('local');
const anonima = document.getElementById('anonima');
const erroEl = document.getElementById('erro-denuncia');
const botaoEnviar = document.getElementById('enviar');

const NOMES = {
  assedio: 'Assédio/Violência',
  roubo: 'Roubos/Furtos',
  outros: 'Outras Ocorrências',
};

let categoriaSelecionada = null;

voltar.addEventListener('click', function () {
  window.location.href = 'pré-denucia.html';
});

const orientacao = document.getElementById('orientacao');

function mostrar(elemento) {
  [categorias, form, confirmacao].forEach((el) => el.classList.add('hidden'));
  elemento.classList.remove('hidden');
  // o texto "Selecione o que deseja denunciar" só faz sentido na lista
  orientacao.classList.toggle('hidden', elemento !== categorias);
}

function erro(mensagem) {
  erroEl.textContent = mensagem || '';
}

// Escolher a categoria abre o formulário. Antes as categorias eram divs sem
// nenhum handler: o fluxo de denúncia morria nesta tela.
categorias.addEventListener('click', (evento) => {
  const botao = evento.target.closest('.categoria');
  if (!botao) return;

  categoriaSelecionada = botao.dataset.categoria;
  tituloCategoria.textContent = NOMES[categoriaSelecionada] || 'Denúncia';
  erro('');
  form.reset();
  contador.textContent = '0/1000';
  mostrar(form);
  descricao.focus();
});

descricao.addEventListener('input', () => {
  contador.textContent = `${descricao.value.length}/1000`;
  if (descricao.value.trim().length >= 10) erro('');
});

document.getElementById('cancelar').addEventListener('click', () => {
  categoriaSelecionada = null;
  erro('');
  mostrar(categorias);
});

document.getElementById('nova-denuncia').addEventListener('click', () => {
  categoriaSelecionada = null;
  mostrar(categorias);
});

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  erro('');

  const texto = descricao.value.trim();

  if (texto.length < 10) {
    erro('Descreva o ocorrido com pelo menos 10 caracteres.');
    descricao.focus();
    return;
  }

  botaoEnviar.disabled = true;
  botaoEnviar.textContent = 'Enviando...';

  try {
    const resposta = await authFetch('/api/denuncias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoria: categoriaSelecionada,
        descricao: texto,
        local: local.value.trim() || null,
        anonima: anonima.checked,
      }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      erro(dados.mensagem || 'Não foi possível registrar a denúncia.');
      return;
    }

    document.getElementById('protocolo').textContent = dados.protocolo;
    mostrar(confirmacao);
  } catch (err) {
    console.error('Erro ao enviar denúncia:', err);
    erro('Erro de conexão. Tente novamente.');
  } finally {
    botaoEnviar.disabled = false;
    botaoEnviar.textContent = 'Enviar denúncia';
  }
});
