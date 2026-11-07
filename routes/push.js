const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const supabaseAdmin = require('./supabaseAdmin');
const verificarAutenticacao = require('./authMiddleware');

webpush.setVapidDetails(
  'mailto:contato@farmaciafacil.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Salva a inscrição do dispositivo, vinculada ao usuário logado
router.post('/subscribe', verificarAutenticacao, async (req, res) => {
  const subscription = req.body;

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      { endpoint: subscription.endpoint, subscription, usuario_id: req.usuario.id },
      { onConflict: 'endpoint' }
    );

  if (error) return res.status(400).json({ error });
  res.status(201).json({ sucesso: true });
});

// Verifica os horários e envia notificações (chamado pelo GitHub Actions)
router.post('/verificar', async (req, res) => {
  // Servidor roda em UTC: converte para horário de Brasília (UTC-3)
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);

  // Janela de tolerância: últimos 10 minutos
  const horariosValidos = [];
  for (let i = 0; i < 10; i++) {
    const t = new Date(agora.getTime() - i * 60000);
    const hh = String(t.getUTCHours()).padStart(2, '0');
    const mm = String(t.getUTCMinutes()).padStart(2, '0');
    horariosValidos.push(`${hh}:${mm}`);
  }

  const { data: medicamentos, error: erroMed } = await supabaseAdmin
    .from('medicamentos')
    .select('*');

  if (erroMed) return res.status(400).json({ error: erroMed });

  const noHorario = medicamentos.filter(m =>
    horariosValidos.some(h => m.horario.startsWith(h))
  );

  if (noHorario.length === 0) {
    return res.json({ enviados: 0, mensagem: 'Nenhum medicamento no horário agora.' });
  }

  const { data: inscricoes, error: erroSub } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*');

  if (erroSub) return res.status(400).json({ error: erroSub });

  let enviados = 0;

  for (const medicamento of noHorario) {
    // Cada medicamento só notifica os dispositivos do seu próprio dono
    const dispositivos = inscricoes.filter(i => i.usuario_id === medicamento.usuario_id);

    for (const dispositivo of dispositivos) {
      try {
        await webpush.sendNotification(
          dispositivo.subscription,
          JSON.stringify({
            titulo: 'Hora do remédio! 💊',
            corpo: `Tome: ${medicamento.nome}${medicamento.dosagem ? ' — ' + medicamento.dosagem : ''}`
          })
        );
        enviados++;
      } catch (erro) {
        // Inscrição inválida (app desinstalado etc.): remove do banco
        if (erro.statusCode === 410 || erro.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', dispositivo.endpoint);
        }
      }
    }
  }

  res.json({ enviados });
});

module.exports = router;