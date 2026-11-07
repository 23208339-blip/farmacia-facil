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

// Verifica os horários e envia notificações (chamado por agendador externo)
router.post('/verificar', async (req, res) => {
  // Servidor roda em UTC: converte para horário de Brasília (UTC-3)
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hoje = agora.toISOString().slice(0, 10); // AAAA-MM-DD
  const minutosAgora = agora.getUTCHours() * 60 + agora.getUTCMinutes();
  const TOLERANCIA = 30; // avisa até 30 minutos depois do horário

  const { data: medicamentos, error: erroMed } = await supabaseAdmin
    .from('medicamentos')
    .select('*');

  if (erroMed) return res.status(400).json({ error: erroMed });

  // Medicamentos no horário (ou até 30 min depois) que ainda não foram avisados hoje
  const pendentes = medicamentos.filter(m => {
    const [h, min] = m.horario.split(':').map(Number);
    const atraso = minutosAgora - (h * 60 + min);
    return atraso >= 0 && atraso < TOLERANCIA && m.ultimo_aviso !== hoje;
  });

  if (pendentes.length === 0) {
    return res.json({ enviados: 0, mensagem: 'Nenhum medicamento pendente agora.' });
  }

  const { data: inscricoes, error: erroSub } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*');

  if (erroSub) return res.status(400).json({ error: erroSub });

  let enviados = 0;

  for (const medicamento of pendentes) {
    const dispositivos = inscricoes.filter(i => i.usuario_id === medicamento.usuario_id);
    let enviouParaAlgum = false;

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
        enviouParaAlgum = true;
      } catch (erro) {
        // Inscrição inválida (app desinstalado etc.): remove do banco
        if (erro.statusCode === 410 || erro.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', dispositivo.endpoint);
        }
      }
    }

    // Marca como avisado hoje, para não repetir a notificação
    if (enviouParaAlgum) {
      await supabaseAdmin
        .from('medicamentos')
        .update({ ultimo_aviso: hoje })
        .eq('id', medicamento.id);
    }
  }

  res.json({ enviados });
});

module.exports = router;