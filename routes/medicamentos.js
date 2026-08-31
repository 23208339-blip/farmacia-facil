const express = require('express');
const router = express.Router();
const verificarAutenticacao = require('./authMiddleware');
const criarClienteAutenticado = require('./supabaseComAuth');

// Todas as rotas abaixo exigem autenticação
router.use(verificarAutenticacao);

// Listar medicamentos do usuário logado
router.get('/', async (req, res) => {
  const supabase = criarClienteAutenticado(req.tokenAcesso);
  const { data, error } = await supabase.from('medicamentos').select('*');
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Cadastrar novo medicamento
router.post('/', async (req, res) => {
  const supabase = criarClienteAutenticado(req.tokenAcesso);
  const dados = { ...req.body, usuario_id: req.usuario.id };
  const { data, error } = await supabase.from('medicamentos').insert([dados]);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Atualizar um medicamento existente
router.put('/:id', async (req, res) => {
  const supabase = criarClienteAutenticado(req.tokenAcesso);
  const { id } = req.params;
  const { data, error } = await supabase
    .from('medicamentos')
    .update(req.body)
    .eq('id', id)
    .select();

  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Excluir um medicamento
router.delete('/:id', async (req, res) => {
  const supabase = criarClienteAutenticado(req.tokenAcesso);
  const { id } = req.params;
  const { error } = await supabase
    .from('medicamentos')
    .delete()
    .eq('id', id);

  if (error) return res.status(400).json({ error });
  res.status(204).send();
});

module.exports = router;