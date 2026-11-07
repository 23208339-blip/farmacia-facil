const { createClient } = require('@supabase/supabase-js');

// Cliente com acesso total (ignora RLS). Usar SOMENTE no servidor.
module.exports = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);