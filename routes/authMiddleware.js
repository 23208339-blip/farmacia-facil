const supabase = require('./supabaseClient');

// Verifica o token enviado pelo frontend e identifica o usuário logado
async function verificarAutenticacao(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  const token = authHeader.replace('Bearer ', '');

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }

  req.usuario = data.user;
  req.tokenAcesso = token;
  next();
}

module.exports = verificarAutenticacao;