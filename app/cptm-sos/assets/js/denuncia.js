const slider = document.getElementById('slider');
const button = document.getElementById('slider-button');
const text = document.querySelector('.slider-text');
const botoes = document.getElementById('botoes');
const cpfContainer = document.getElementById('cpf-container');
const voltarBtn = document.getElementById('voltar');
const cadeado = document.getElementById('cadeado');
const avisoAlarme = document.getElementById('aviso-alarme');

/**
 * Retorno do alarme na própria tela. As caixas do sistema travavam tudo —
 * inclusive o "Ligar 190" — e no celular ainda anunciam o endereço do servidor
 * no topo. A mensagem fica até ser substituída: numa emergência ninguém deve
 * precisar reagir a tempo de ler.
 */
function avisarAlarme(texto, tipo) {
  if (!avisoAlarme) return;
  avisoAlarme.textContent = texto;
  avisoAlarme.className = 'aviso-alarme' + (tipo ? ' ' + tipo : '');
}

const inputCpf = document.getElementById('cpf-input');
// mesma máscara do cadastro: o campo passa a guiar o formato em vez de recusar
if (inputCpf) aplicarMascaraCPF(inputCpf);
const setaCircular = document.getElementById('cpf-button');
const videoCamera = document.getElementById('camera-video');
let streamCamera = null;

let isDragging = false;
let startX;
let currentX = 0;

const sliderPadding = 3;
let maxMove = 0;

// calcula o quanto o botão pode se mover
function calcularMaxMove() {
  if (!slider || !button) return;
  maxMove = slider.clientWidth - button.clientWidth - sliderPadding * 2;
}
window.addEventListener('load', calcularMaxMove);
window.addEventListener('resize', calcularMaxMove);

// ========================= SLIDER =========================
function startDrag(x) {
  if (!button) return;
  isDragging = true;
  startX = x - currentX;
}

function duringDrag(x) {
  if (!isDragging || !button) return;
  currentX = x - startX;
  if (currentX < 0) currentX = 0;
  if (currentX > maxMove) currentX = maxMove;

  button.style.transform = `translateX(${currentX}px)`;

  if (text && maxMove > 0) {
    const opacity = 0.7 - (currentX / maxMove);
    text.style.opacity = opacity;
  }
}

function endDrag() {
  if (!isDragging) return;
  isDragging = false;

  if (currentX >= maxMove) {
    ativarTelaCpf();
  } else {
    currentX = 0;
    if (button) button.style.transform = `translateX(0px)`;
    if (text) text.style.opacity = 0.7;
  }
}

if (button) {
  button.addEventListener('mousedown', e => startDrag(e.clientX));
  document.addEventListener('mousemove', e => duringDrag(e.clientX));
  document.addEventListener('mouseup', endDrag);

  button.addEventListener('touchstart', e => {
    if (e.touches.length > 0) startDrag(e.touches[0].clientX);
  });
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 0) duringDrag(e.touches[0].clientX);
  }, { passive: true });
  document.addEventListener('touchend', endDrag);
}

// ========================= SIRENE =========================
const sirene = document.getElementById('sirene');
const iconeSirene = document.getElementById('icone-sirene');
const textoSirene = document.getElementById('texto-sirene');
// Trecho em loop, no lugar do arquivo de 55s e 10 MB: numa emergência o som
// precisa sair na hora, não depois de baixar 10 MB no 4G. Continua em WAV de
// propósito — o mp3 acrescenta padding de encoder no início e no fim, e isso
// produz um clique audível a cada volta do loop.
//
// O trecho tem 8 ciclos inteiros da sirene (o ciclo mede 239ms) e começa e
// termina em cruzamentos por zero subindo, com uma fusão cruzada de 12ms na
// emenda. O corte anterior tinha 1s e emendava fora de fase, o que se ouvia como
// o som cortando a cada volta.
const CAMINHO_SIRENE = 'assets/sons/sirene-loop.wav';

// O loop do <audio> não é contínuo: o Safari insere uma pausa a cada volta.
// A Web Audio repete o buffer com precisão de amostra, sem emenda audível.
let contextoAudio = null;
let bufferSirene = null;
let fonteSirene = null;
let audioReserva = null;

async function prepararSirene() {
  if (bufferSirene || !window.AudioContext) return;
  contextoAudio = contextoAudio || new AudioContext();
  const resp = await fetch(CAMINHO_SIRENE);
  bufferSirene = await contextoAudio.decodeAudioData(await resp.arrayBuffer());
}

async function tocarSirene() {
  try {
    await prepararSirene();
    if (!bufferSirene) throw new Error('sem Web Audio');
    // o navegador só libera o áudio a partir de um gesto; este é o clique
    if (contextoAudio.state === 'suspended') await contextoAudio.resume();

    pararSirene();
    fonteSirene = contextoAudio.createBufferSource();
    fonteSirene.buffer = bufferSirene;
    fonteSirene.loop = true;
    fonteSirene.connect(contextoAudio.destination);
    fonteSirene.start();
  } catch (err) {
    console.error('Web Audio indisponível, tocando pelo <audio>:', err);
    audioReserva = audioReserva || Object.assign(new Audio(CAMINHO_SIRENE), { loop: true });
    audioReserva.play().catch((e) => console.error('Não foi possível tocar a sirene:', e));
  }
}

function pararSirene() {
  if (fonteSirene) {
    try { fonteSirene.stop(); } catch { /* já parada */ }
    fonteSirene.disconnect();
    fonteSirene = null;
  }
  if (audioReserva) {
    audioReserva.pause();
    audioReserva.currentTime = 0;
  }
}

let sireneAtiva = false;

if (sirene) {
  sirene.addEventListener('click', () => {
    sireneAtiva = !sireneAtiva;

    if (sireneAtiva) {
      sirene.style.backgroundColor = '#ED1C24';
      if (textoSirene) textoSirene.style.color = '#F4F4F4';
      if (iconeSirene) iconeSirene.src = 'assets/imagem/sireneBranca.png';
      tocarSirene();
    } else {
      sirene.style.backgroundColor = '';
      if (textoSirene) textoSirene.style.color = '';
      if (iconeSirene) iconeSirene.src = 'assets/imagem/sirene.png';
      pararSirene();
    }
  });
}

// ========================= ME ENCONTRE =========================
const meEncontre = document.getElementById('meEncontre');
const iconeMeEncontre = meEncontre ? meEncontre.querySelector('img#escudo') : null;
const textoMeEncontre = meEncontre ? meEncontre.querySelector('h4#texto-meEncontre') : null;

let encontreAtivo = false;
let watchId = null;

// Envia a posição ao servidor enquanto o botão estiver ligado. Antes esta função
// não existia: o botão só trocava de cor e exibia um alerta, sem compartilhar nada.
async function enviarLocalizacao(posicao) {
  try {
    const resposta = await authFetch('/api/alerta/localizacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: posicao.coords.latitude,
        lng: posicao.coords.longitude,
        precisao: posicao.coords.accuracy,
      }),
    });

    // 409 = o alerta foi desligado em outro lugar (outra aba, outro aparelho).
    // Sem tratar isso, o botão continuaria vermelho e a pessoa acreditaria estar
    // sendo localizada enquanto o servidor descarta cada envio.
    if (resposta.status === 409) {
      desligarMeEncontre();
      avisarAlarme('O alerta foi desligado, então a sua localização não está mais sendo compartilhada.');
      return;
    }

    if (!resposta.ok) {
      console.error('Servidor recusou a localização:', resposta.status);
    }
  } catch (err) {
    console.error('Falha ao enviar localização:', err);
  }
}

function pararCompartilhamento() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function desligarMeEncontre() {
  encontreAtivo = false;
  meEncontre.style.backgroundColor = '';
  if (textoMeEncontre) textoMeEncontre.style.color = '';
  if (iconeMeEncontre) iconeMeEncontre.src = 'assets/imagem/escudo.png';
  pararCompartilhamento();
}

if (meEncontre) {
  meEncontre.addEventListener('click', () => {
    encontreAtivo = !encontreAtivo;

    if (!encontreAtivo) {
      desligarMeEncontre();
      avisarAlarme('Você parou de compartilhar a sua localização.');
      return;
    }

    meEncontre.style.backgroundColor = '#ED1C24';
    if (textoMeEncontre) textoMeEncontre.style.color = '#F4F4F4';
    if (iconeMeEncontre) iconeMeEncontre.src = 'assets/imagem/escudoBranco.png';

    if (!navigator.geolocation) {
      avisarAlarme('Seu aparelho não permite compartilhar a localização.', 'erro');
      desligarMeEncontre();
      return;
    }

    // A confirmação só aparece quando existe posição de verdade. Antes ela era
    // exibida logo depois de pedir a localização, sem esperar resposta: com a
    // permissão negada, a mensagem de erro era escrita e em seguida sobrescrita
    // pela de que as autoridades estavam a caminho. Prometer socorro a quem o app
    // não consegue localizar é o pior erro possível nesta tela.
    let jaConfirmou = false;

    // A provisória vem ANTES de pedir a posição. Escrita depois, ela sobrescreve
    // o que o retorno já tiver escrito quando ele chega na mesma volta do laço —
    // foi assim que a negativa de permissão sumia da tela.
    avisarAlarme('Procurando a sua localização...');

    // watchPosition (e não getCurrentPosition): a posição continua sendo enviada
    // enquanto a pessoa se move, que é o ponto de "me encontre".
    watchId = navigator.geolocation.watchPosition(
      (posicao) => {
        enviarLocalizacao(posicao);
        if (!jaConfirmou) {
          jaConfirmou = true;
          avisarAlarme('🚓 As autoridades locais já estão indo até você.\nMantenha o botão ligado para continuar compartilhando a sua localização.', 'destaque');
        }
      },
      (erro) => {
        console.error('Erro de geolocalização:', erro);

        // Só a negativa de permissão é definitiva. Timeout e posição indisponível
        // são passageiros — acontecem o tempo todo em túnel e estação coberta, que
        // é metade de uma viagem de trem. Desligar o watch aí obrigaria a pessoa a
        // reativar o botão no meio de uma emergência; o watchPosition se recupera
        // sozinho quando o sinal volta.
        if (erro.code === erro.PERMISSION_DENIED) {
          avisarAlarme('Permissão de localização negada. Autorize o acesso para que possam te encontrar.', 'erro');
          desligarMeEncontre();
          return;
        }

        // ainda sem posição nenhuma: não dá para dizer que estão a caminho
        if (!jaConfirmou) {
          avisarAlarme('Procurando a sua localização...');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  });
}

// ========================= LIGAR 190 =========================
const ligar190 = document.getElementById('ligar190');
const iconeLigar = ligar190 ? ligar190.querySelector('img') : null;
const textoLigar = ligar190 ? ligar190.querySelector('h4') : null;

if (ligar190) {
  ligar190.addEventListener('mousedown', () => {
    ligar190.style.backgroundColor = '#ED1C24';
    if (textoLigar) textoLigar.style.color = '#F4F4F4';
    if (iconeLigar) iconeLigar.src = 'assets/imagem/telefoneBranco.png';
  });

  ligar190.addEventListener('mouseup', () => {
    ligar190.style.backgroundColor = '';
    if (textoLigar) textoLigar.style.color = '';
    if (iconeLigar) iconeLigar.src = 'assets/imagem/telefone.png';
  });
}

// ========================= TELA DO CPF =========================
function ativarTelaCpf() {
  currentX = maxMove;
  if (button) {
    button.style.transform = `translateX(${maxMove}px)`;
    button.style.pointerEvents = 'none';
  }
  if (cadeado) cadeado.src = 'assets/imagem/setaCircular.png';
  if (botoes) botoes.classList.add('hidden');
  if (slider) slider.classList.add('hidden');
  if (cpfContainer) cpfContainer.classList.remove('hidden');
}

function voltarTelaInicial(e) {
  if (e) e.preventDefault();
  currentX = 0;
  if (button) {
    button.style.transform = 'translateX(0px)';
    button.style.pointerEvents = 'auto';
  }
  if (cadeado) cadeado.src = 'assets/imagem/cadeado.png';
  if (botoes) botoes.classList.remove('hidden');
  if (slider) slider.classList.remove('hidden');
  if (cpfContainer) cpfContainer.classList.add('hidden');
  if (text) text.style.opacity = 0.7;
  if (inputCpf) inputCpf.value = '';
}

if (voltarBtn) {
  voltarBtn.addEventListener('click', voltarTelaInicial);
}

// ========================= CONFIRMAR ALERTA PELO CPF =========================
async function confirmarAlertaCpf(e) {
  e.preventDefault();

  if (!inputCpf) return;

  const cpfDigitado = inputCpf.value.trim();

  if (!cpfDigitado) return;

  try {
    const resp = await authFetch("/api/alerta/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // só os dígitos, como o cadastro já enviava
      body: JSON.stringify({ cpf: apenasDigitos(cpfDigitado) }),
    });

    // Sem esta checagem o app sairia da tela dizendo que desativou o alarme
    // mesmo quando o servidor recusou — perigoso justamente num fluxo de emergência.
    if (resp.status === 403) {
      avisarAlarme('CPF não confere com o do seu cadastro.', 'erro');
      return;
    }

    if (!resp.ok) {
      console.error("Falha ao confirmar alerta:", resp.status);
      avisarAlarme('Não foi possível desativar o alarme. Tente novamente.', 'erro');
      return;
    }

    // Desliga tudo explicitamente, e não como efeito colateral de a página sair
    // do ar. Antes só a câmera era encerrada: a sirene e o GPS paravam porque a
    // navegação destruía a página — se ela falhasse ou demorasse, a sirene
    // seguiria tocando e o aparelho seguiria enviando posição.
    pararSirene();
    pararCompartilhamento();
    pararCamera();

    localStorage.setItem("alarmeDesativado", "1");
    window.location.href = "home.html";
  } catch (err) {
    console.error("Erro ao confirmar alerta:", err);
  }
}

if (setaCircular) {
  setaCircular.addEventListener("click", confirmarAlertaCpf);
}

// ========================= CÂMERA =========================
async function iniciarCamera() {
  if (!videoCamera || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return;
  }

  try {
    streamCamera = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // câmera traseira no celular, se tiver
      },
      audio: false,
    });

    videoCamera.srcObject = streamCamera;
  } catch (err) {
    console.error("Erro ao acessar a câmera:", err);
    avisarAlarme('Não foi possível acessar a câmera. Verifique as permissões do navegador.', 'erro');
  }
}

function pararCamera() {
  if (streamCamera) {
    streamCamera.getTracks().forEach(track => track.stop());
    streamCamera = null;
  }
}

window.addEventListener('load', () => {
  calcularMaxMove();
  iniciarCamera();
});