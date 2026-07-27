const express = require('express');
const router = express.Router();
const supabase = require('./supabaseClient');

// Listar medicamentos do usuário
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('medicamentos').select('*');
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Cadastrar novo medicamento
router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('medicamentos').insert([req.body]);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

module.exports = router;