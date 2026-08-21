const VAPID_PUBLIC_KEY = 'BIr5e8o3bd7apUb8SvzzFbSOQ3-Jfm7RUv5lY9bhI9M53YtFkLXDtydeUDq6-G9JTumPpXsh7SjcfTZvSqb_19w';
const form = document.getElementById('form-medicamento');
const lista = document.getElementById('lista-medicamentos');

let idEmEdicao = null; // Guarda o ID do medicamento sendo editado (null = modo cadastro)

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nomeInput = document.getElementById('nome');
  const horarioInput = document.getElementById('horario');
  const erroNome = document.getElementById('erro-nome');
  const erroHorario = document.getElementById('erro-horario');

  erroNome.textContent = '';
  erroHorario.textContent = '';
  nomeInput.classList.remove('is-invalid');
  horarioInput.classList.remove('is-invalid');

  let temErro = false;

  if (!nomeInput.value.trim()) {
    erroNome.textContent = 'Digite o nome do medicamento.';
    nomeInput.classList.add('is-invalid');
    temErro = true;
  }

  if (!horarioInput.value) {
    erroHorario.textContent = 'Escolha um horário.';
    horarioInput.classList.add('is-invalid');
    temErro = true;
  }

  if (temErro) {
    (nomeInput.classList.contains('is-invalid') ? nomeInput : horarioInput).focus();
    return;
  }

  const dados = {
  nome: nomeInput.value,
  dosagem: document.getElementById('dosagem').value,
  horario: horarioInput.value,
  data_inicio: document.getElementById('data-inicio').value || null
};

  let resposta;

  if (idEmEdicao) {
    // Modo edição: atualiza o medicamento existente
    resposta = await fetch(`/api/medicamentos/${idEmEdicao}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
  } else {
    // Modo cadastro: cria um novo medicamento
    resposta = await fetch('/api/medicamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
  }

  if (resposta.ok) {
    sairDoModoEdicao();
    form.reset();
    carregarMedicamentos();
  } else {
    erroNome.textContent = 'Erro ao salvar. Tente novamente.';
  }
});

function entrarNoModoEdicao(medicamento) {
  idEmEdicao = medicamento.id;
  document.getElementById('nome').value = medicamento.nome;
  document.getElementById('dosagem').value = medicamento.dosagem || '';
  document.getElementById('data-inicio').value = medicamento.data_inicio || '';
  document.getElementById('horario').value = medicamento.horario.slice(0, 5);

  const botao = form.querySelector('button[type="submit"]');
  botao.textContent = 'Salvar alterações';

  document.getElementById('nome').focus();
}

function sairDoModoEdicao() {
  idEmEdicao = null;
  const botao = form.querySelector('button[type="submit"]');
  botao.textContent = 'Cadastrar medicamento';
}

async function excluirMedicamento(id, nome) {
  const confirmar = confirm(`Tem certeza que deseja excluir "${nome}"?`);
  if (!confirmar) return;

  const resposta = await fetch(`/api/medicamentos/${id}`, { method: 'DELETE' });

  if (resposta.ok) {
    carregarMedicamentos();
  } else {
    alert('Erro ao excluir. Tente novamente.');
  }
}

async function carregarMedicamentos() {
  const resposta = await fetch('/api/medicamentos');
  const medicamentos = await resposta.json();

  atualizarGrafico(medicamentos);

  if (medicamentos.length === 0) {
    lista.innerHTML = '<p>Nenhum medicamento cadastrado ainda.</p>';
    return;
  }

  lista.innerHTML = '';

  medicamentos.forEach(m => {
  const card = document.createElement('div');
  card.className = 'card mb-2 p-3';

  let infoInicio = '';
  if (m.data_inicio) {
    const inicio = new Date(m.data_inicio + 'T00:00:00');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dias = Math.floor((hoje - inicio) / (1000 * 60 * 60 * 24));
    const dataFormatada = inicio.toLocaleDateString('pt-BR');

    if (dias === 0) {
      infoInicio = `<br><span class="text-muted">Em uso desde hoje (${dataFormatada})</span>`;
    } else if (dias > 0) {
      infoInicio = `<br><span class="text-muted">Em uso há ${dias} dia${dias > 1 ? 's' : ''} (desde ${dataFormatada})</span>`;
    } else {
      infoInicio = `<br><span class="text-muted">Início previsto: ${dataFormatada}</span>`;
    }
  }

  card.innerHTML = `
    <strong>${m.nome}</strong> ${m.dosagem ? `— ${m.dosagem}` : ''}<br>
    <span>Horário: ${m.horario.slice(0, 5)}</span>
    ${infoInicio}
    <div class="mt-2">
      <button type="button" class="btn btn-outline-primary btn-sm me-2" aria-label="Editar ${m.nome}">Editar</button>
      <button type="button" class="btn btn-outline-danger btn-sm" aria-label="Excluir ${m.nome}">Excluir</button>
    </div>
  `;

    const botaoEditar = card.querySelector('.btn-outline-primary');
    const botaoExcluir = card.querySelector('.btn-outline-danger');

    botaoEditar.addEventListener('click', () => entrarNoModoEdicao(m));
    botaoExcluir.addEventListener('click', () => excluirMedicamento(m.id, m.nome));

    lista.appendChild(card);
  });
}

carregarMedicamentos();

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function inscreverParaNotificacoes() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications não são suportadas neste navegador.');
    return;
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    console.log('Permissão de notificação negada.');
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  });

  console.log('Inscrito para notificações push com sucesso.');
}

// Registrar o Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => {
        console.log('Service Worker registrado com sucesso');
        inscreverParaNotificacoes();
      })
      .catch((erro) => console.log('Erro ao registrar Service Worker:', erro));
  });
}
// Análise de dados: distribuição de medicamentos por período do dia
let graficoHorarios = null;

function classificarPeriodo(horario) {
  const hora = parseInt(horario.split(':')[0], 10);
  if (hora >= 5 && hora < 12) return 'Manhã';
  if (hora >= 12 && hora < 18) return 'Tarde';
  return 'Noite';
}

function atualizarGrafico(medicamentos) {
  const contagem = { 'Manhã': 0, 'Tarde': 0, 'Noite': 0 };

  medicamentos.forEach(m => {
    const periodo = classificarPeriodo(m.horario);
    contagem[periodo]++;
  });

  const ctx = document.getElementById('grafico-horarios');

  // Atualiza o resumo em texto para leitores de tela
  const resumo = document.getElementById('resumo-grafico');
  resumo.textContent = `Manhã: ${contagem['Manhã']} medicamento(s). Tarde: ${contagem['Tarde']} medicamento(s). Noite: ${contagem['Noite']} medicamento(s).`;

  // Se já existe um gráfico, destrói antes de criar outro (evita duplicar)
  if (graficoHorarios) {
    graficoHorarios.destroy();
  }

  graficoHorarios = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Manhã', 'Tarde', 'Noite'],
      datasets: [{
        label: 'Quantidade de medicamentos',
        data: [contagem['Manhã'], contagem['Tarde'], contagem['Noite']],
        backgroundColor: ['#0d6efd', '#fd7e14', '#6610f2']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}