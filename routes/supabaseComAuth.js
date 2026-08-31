const { createClient } = require('@supabase/supabase-js');

// Cria um cliente Supabase autenticado com o token do usuário,
// para que as regras de RLS sejam aplicadas corretamente
function criarClienteAutenticado(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });
}

module.exports = criarClienteAutenticado;