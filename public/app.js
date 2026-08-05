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
    horario: horarioInput.value
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
    card.innerHTML = `
      <strong>${m.nome}</strong> ${m.dosagem ? `— ${m.dosagem}` : ''}<br>
      <span>Horário: ${m.horario.slice(0, 5)}</span>
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

// Pedir permissão para mostrar notificações
function pedirPermissaoNotificacao() {
  if ('Notification' in window) {
    Notification.requestPermission();
  }
}

// Verificar se algum medicamento está no horário agora
function verificarHorarios(medicamentos) {
  const agora = new Date();
  const horaAtual = String(agora.getHours()).padStart(2, '0');
  const minutoAtual = String(agora.getMinutes()).padStart(2, '0');
  const agoraFormatado = `${horaAtual}:${minutoAtual}`;

  medicamentos.forEach(m => {
    if (m.horario.startsWith(agoraFormatado)) {
      new Notification('Hora do remédio! 💊', {
        body: `Tome: ${m.nome}${m.dosagem ? ' — ' + m.dosagem : ''}`
      });
    }
  });
}

pedirPermissaoNotificacao();

setInterval(async () => {
  const resposta = await fetch('/api/medicamentos');
  const medicamentos = await resposta.json();
  verificarHorarios(medicamentos);
}, 60000);

// Registrar o Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker registrado com sucesso'))
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