const form = document.getElementById('form-medicamento');
const lista = document.getElementById('lista-medicamentos');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const dados = {
    nome: document.getElementById('nome').value,
    dosagem: document.getElementById('dosagem').value,
    horario: document.getElementById('horario').value
  };

  const resposta = await fetch('/api/medicamentos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });

  if (resposta.ok) {
    form.reset();
    carregarMedicamentos();
  } else {
    alert('Erro ao cadastrar medicamento. Tente novamente.');
  }
});

async function carregarMedicamentos() {
  const resposta = await fetch('/api/medicamentos');
  const medicamentos = await resposta.json();

  if (medicamentos.length === 0) {
    lista.innerHTML = '<p>Nenhum medicamento cadastrado ainda.</p>';
    return;
  }

  lista.innerHTML = medicamentos.map(m => `
    <div class="card mb-2 p-3">
      <strong>${m.nome}</strong> ${m.dosagem ? `— ${m.dosagem}` : ''}<br>
      <span>Horário: ${m.horario}</span>
    </div>
  `).join('');
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

// Verificar os horários a cada 1 minuto (60000 ms)
setInterval(async () => {
  const resposta = await fetch('/api/medicamentos');
  const medicamentos = await resposta.json();
  verificarHorarios(medicamentos);
}, 60000);