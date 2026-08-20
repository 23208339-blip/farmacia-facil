const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const supabase = require('./supabaseClient');

webpush.setVapidDetails(
  'mailto:contato@farmaciafacil.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Salva a inscrição de um dispositivo para receber notificações
router.post('/subscribe', async (req, res) => {
  const subscription = req.body;

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { endpoint: subscription.endpoint, subscription },
      { onConflict: 'endpoint' }
    );

  if (error) return res.status(400).json({ error });
  res.status(201).json({ sucesso: true });
});

// Verifica os horários e envia notificações (chamado pelo GitHub Actions)
router.post('/verificar', async (req, res) => {
  const agora = new Date();
  const horaAtual = String(agora.getHours()).padStart(2, '0');
  const minutoAtual = agora.getMinutes();

  // Janela de tolerância: considera "na hora" se estiver nos últimos 10 minutos
  const minutosValidos = [];
  for (let i = 0; i < 10; i++) {
    const m = minutoAtual - i;
    if (m >= 0) minutosValidos.push(String(m).padStart(2, '0'));
  }
  const horariosValidos = minutosValidos.map(m => `${horaAtual}:${m}`);

  const { data: medicamentos, error: erroMed } = await supabase
    .from('medicamentos')
    .select('*');

  if (erroMed) return res.status(400).json({ error: erroMed });

  const medicamentosNoHorario = medicamentos.filter(m =>
    horariosValidos.some(h => m.horario.startsWith(h))
  );

  if (medicamentosNoHorario.length === 0) {
    return res.json({ enviados: 0, mensagem: 'Nenhum medicamento no horário agora.' });
  }

  const { data: inscricoes, error: erroSub } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (erroSub) return res.status(400).json({ error: erroSub });

  let enviados = 0;

  for (const inscricao of inscricoes) {
    for (const medicamento of medicamentosNoHorario) {
      try {
        await webpush.sendNotification(
          inscricao.subscription,
          JSON.stringify({
            titulo: 'Hora do remédio! 💊',
            corpo: `Tome: ${medicamento.nome}${medicamento.dosagem ? ' — ' + medicamento.dosagem : ''}`
          })
        );
        enviados++;
      } catch (erro) {
        // Se a inscrição não é mais válida (usuário desinstalou, etc), remove do banco
        if (erro.statusCode === 410 || erro.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', inscricao.endpoint);
        }
      }
    }
  }

  res.json({ enviados });
});

module.exports = router;