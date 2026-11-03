// ===== AUTENTICAÇÃO =====

const telaLogin = document.getElementById('tela-login');
const appPrincipal = document.getElementById('app-principal');
const formLogin = document.getElementById('form-login');
const abaEntrar = document.getElementById('aba-entrar');
const abaCadastrar = document.getElementById('aba-cadastrar');
const botaoLogin = document.getElementById('botao-login');
const mensagemLogin = document.getElementById('mensagem-login');
const botaoSair = document.getElementById('botao-sair');

let modoLogin = 'entrar';
let appJaIniciado = false; // Evita registrar os eventos do app mais de uma vez

// Impede que texto digitado pelo usuário seja interpretado como HTML
function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Diferencia falta de internet de erro de senha
function erroDeRede(error) {
  return !navigator.onLine ||
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    /fetch|network/i.test(error.message || '');
}

const MSG_SEM_CONEXAO = 'Não foi possível conectar. Verifique sua internet e tente de novo.';

abaEntrar.addEventListener('click', () => {
  modoLogin = 'entrar';
  abaEntrar.classList.replace('btn-outline-primary', 'btn-primary');
  abaCadastrar.classList.replace('btn-primary', 'btn-outline-primary');
  abaEntrar.setAttribute('aria-selected', 'true');
  abaCadastrar.setAttribute('aria-selected', 'false');
  botaoLogin.textContent = 'Entrar';
  mensagemLogin.textContent = '';
});

abaCadastrar.addEventListener('click', () => {
  modoLogin = 'cadastrar';
  abaCadastrar.classList.replace('btn-outline-primary', 'btn-primary');
  abaEntrar.classList.replace('btn-primary', 'btn-outline-primary');
  abaCadastrar.setAttribute('aria-selected', 'true');
  abaEntrar.setAttribute('aria-selected', 'false');
  botaoLogin.textContent = 'Criar conta';
  mensagemLogin.textContent = '';
});

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  mensagemLogin.textContent = '';
  mensagemLogin.className = 'mb-3';

  if (!navigator.onLine) {
    mensagemLogin.textContent = 'Sem conexão com a internet. Conecte-se para entrar ou criar conta.';
    mensagemLogin.classList.add('text-danger');
    return;
  }

  if (modoLogin === 'entrar') {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
    if (error) {
      mensagemLogin.textContent = erroDeRede(error) ? MSG_SEM_CONEXAO : 'E-mail ou senha incorretos.';
      mensagemLogin.classList.add('text-danger');
    }
  } else {
    const { error } = await supabaseClient.auth.signUp({ email, password: senha });
    if (error) {
      mensagemLogin.textContent = erroDeRede(error) ? MSG_SEM_CONEXAO : 'Erro ao criar conta: ' + error.message;
      mensagemLogin.classList.add('text-danger');
    } else {
      mensagemLogin.textContent = 'Conta criada! Você já pode usar o app.';
      mensagemLogin.classList.add('text-success');
    }
  }
});

botaoSair.addEventListener('click', async () => {
  // Remove os dados guardados no aparelho (são dados de saúde)
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) localStorage.removeItem(`medicamentos_${data.session.user.id}`);
  await supabaseClient.auth.signOut();
});

supabaseClient.auth.onAuthStateChange((evento, sessao) => {
  if (sessao) {
    telaLogin.style.display = 'none';
    appPrincipal.style.display = 'block';
    iniciarApp();
  } else if (evento === 'SIGNED_OUT') {
    // Recarrega a página para limpar os eventos e evitar cadastros duplicados no próximo login
    window.location.reload();
  } else {
    telaLogin.style.display = 'block';
    appPrincipal.style.display = 'none';
    appJaIniciado = false;
  }
});

// Quando a internet volta, atualiza a lista
window.addEventListener('online', () => {
  if (window.recarregarMedicamentos) window.recarregarMedicamentos();
});

async function obterTokenAcesso() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.access_token : null;
}

async function obterUsuarioId() {
  const { data } = await supabaseClient.auth.getUser();
  return data.user ? data.user.id : null;
}

// Monta os headers padrão (incluindo autenticação) para as chamadas à API
async function headersAutenticados() {
  const token = await obterTokenAcesso();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// ===== APP PRINCIPAL (só roda depois do login) =====

function iniciarApp() {
  if (appJaIniciado) return; // Evita duplicar os eventos se o login disparar de novo
  appJaIniciado = true;

  const VAPID_PUBLIC_KEY = 'BIr5e8o3bd7apUb8SvzzFbSOQ3-Jfm7RUv5lY9bhI9M53YtFkLXDtydeUDq6-G9JTumPpXsh7SjcfTZvSqb_19w';
  const form = document.getElementById('form-medicamento');
  const lista = document.getElementById('lista-medicamentos');
  const avisoOfflineEl = document.getElementById('aviso-offline');

  let idEmEdicao = null;

  function mostrarAvisoOffline(ativo) {
    if (avisoOfflineEl) avisoOfflineEl.classList.toggle('d-none', !ativo);
  }

  async function chaveCache() {
    const { data } = await supabaseClient.auth.getSession(); // lê do aparelho, sem usar a rede
    return data.session ? `medicamentos_${data.session.user.id}` : null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!navigator.onLine) {
      alert('Sem conexão. Cadastrar e editar exigem internet. Tente de novo quando a conexão voltar.');
      return;
    }

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

    const usuarioId = await obterUsuarioId();

    const dados = {
      nome: nomeInput.value,
      dosagem: document.getElementById('dosagem').value,
      horario: horarioInput.value,
      data_inicio: document.getElementById('data-inicio').value || null,
      usuario_id: usuarioId
    };

    const headers = await headersAutenticados();
    let resposta;

    try {
      if (idEmEdicao) {
        resposta = await fetch(`/api/medicamentos/${idEmEdicao}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(dados)
        });
      } else {
        resposta = await fetch('/api/medicamentos', {
          method: 'POST',
          headers,
          body: JSON.stringify(dados)
        });
      }
    } catch (erro) {
      erroNome.textContent = 'Sem conexão. Tente novamente quando a internet voltar.';
      return;
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
    if (!navigator.onLine) {
      alert('Sem conexão. Excluir exige internet. Tente de novo quando a conexão voltar.');
      return;
    }

    const confirmar = confirm(`Tem certeza que deseja excluir "${nome}"?`);
    if (!confirmar) return;

    const headers = await headersAutenticados();

    try {
      const resposta = await fetch(`/api/medicamentos/${id}`, { method: 'DELETE', headers });
      if (resposta.ok) {
        carregarMedicamentos();
      } else {
        alert('Erro ao excluir. Tente novamente.');
      }
    } catch (erro) {
      alert('Sem conexão. Tente novamente quando a internet voltar.');
    }
  }

  async function carregarMedicamentos() {
    let medicamentos;
    const chave = await chaveCache();

    try {
      const headers = await headersAutenticados();
      const resposta = await fetch('/api/medicamentos', { headers });
      if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
      medicamentos = await resposta.json();
      if (chave) localStorage.setItem(chave, JSON.stringify(medicamentos));
      mostrarAvisoOffline(false);
    } catch (erro) {
      // Sem internet ou servidor indisponível: usa os últimos dados salvos neste aparelho
      const guardado = chave && localStorage.getItem(chave);
      if (!guardado) {
        lista.innerHTML = '<p role="alert">Não foi possível carregar os medicamentos. Verifique sua internet.</p>';
        return;
      }
      medicamentos = JSON.parse(guardado);
      mostrarAvisoOffline(true);
    }

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

      const nomeSeguro = escaparHtml(m.nome);
      const dosagemSegura = escaparHtml(m.dosagem);

      card.innerHTML = `
        <strong>${nomeSeguro}</strong> ${m.dosagem ? `— ${dosagemSegura}` : ''}<br>
        <span>Horário: ${escaparHtml(m.horario.slice(0, 5))}</span>
        ${infoInicio}
        <div class="mt-2">
          <button type="button" class="btn btn-outline-primary btn-sm me-2" aria-label="Editar ${nomeSeguro}">Editar</button>
          <button type="button" class="btn btn-outline-danger btn-sm" aria-label="Excluir ${nomeSeguro}">Excluir</button>
        </div>
      `;

      const botaoEditar = card.querySelector('.btn-outline-primary');
      const botaoExcluir = card.querySelector('.btn-outline-danger');

      botaoEditar.addEventListener('click', () => entrarNoModoEdicao(m));
      botaoExcluir.addEventListener('click', () => excluirMedicamento(m.id, m.nome));

      lista.appendChild(card);
    });
  }

  window.recarregarMedicamentos = carregarMedicamentos;
  carregarMedicamentos();

  // ===== NOTIFICAÇÕES PUSH =====

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

    const headers = await headersAutenticados();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify(subscription)
    });

    console.log('Inscrito para notificações push com sucesso.');
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => {
        console.log('Service Worker registrado com sucesso');
        inscreverParaNotificacoes();
      })
      .catch((erro) => console.log('Erro ao registrar Service Worker:', erro));
  }

  // ===== ANÁLISE DE DADOS (GRÁFICO) =====

  let graficoHorarios = null;

  function classificarPeriodo(horario) {
    const hora = parseInt(horario.split(':')[0], 10);
    if (hora >= 5 && hora < 12) return 'Manhã';
    if (hora >= 12 && hora < 18) return 'Tarde';
    return 'Noite';
  }

  window.atualizarGrafico = function (medicamentos) {
    const contagem = { 'Manhã': 0, 'Tarde': 0, 'Noite': 0 };

    medicamentos.forEach(m => {
      const periodo = classificarPeriodo(m.horario);
      contagem[periodo]++;
    });

    const ctx = document.getElementById('grafico-horarios');
    const resumo = document.getElementById('resumo-grafico');
    resumo.textContent = `Manhã: ${contagem['Manhã']} medicamento(s). Tarde: ${contagem['Tarde']} medicamento(s). Noite: ${contagem['Noite']} medicamento(s).`;

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
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  };
}