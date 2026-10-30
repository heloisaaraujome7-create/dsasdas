import { createClient } from '@supabase/supabase-js';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  },
  body: JSON.stringify(body)
});

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método não permitido.' });
  }

  const auth = event.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    return json(401, { error: 'Autenticação necessária.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const argusToken = process.env.ARGUS_TOKEN_SIGNATURE;
const argusBaseUrl = process.env.ARGUS_API_URL;
  if (!supabaseUrl || !serviceKey || !argusToken || !argusBaseUrl) {
  return json(503, {
    error: 'Integração não configurada. Confira as variáveis do servidor.'
  });
}

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    const token = auth.slice(7);

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json(401, { error: 'Sessão inválida.' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();

    if (
      profileError ||
      !profile?.active ||
      profile.role !== 'director'
    ) {
      return json(403, {
        error: 'Apenas a Diretoria pode consultar as campanhas.'
      });
    }

    const baseUrl = argusBaseUrl.replace(/\/+$/, '');
    const response = await fetch(
      `${baseUrl}/cmd/listarcampanhas`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Token-Signature': argusToken
        },
        body: JSON.stringify({ ativo: 'true' })
      }
    );

    const body = await response.text();

    if (!response.ok) {
      console.error('Argus respondeu com status:', response.status);
      return json(502, {
        error: 'O Argus não aceitou a solicitação.',
        upstreamStatus: response.status
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(body);
    } catch {
      return json(502, {
        error: 'A resposta do Argus não está em JSON.'
      });
    }

    return json(200, { data: parsed });
  } catch (error) {
    console.error(
      'Falha na consulta ao Argus:',
      error?.message || 'Erro desconhecido'
    );

    return json(500, {
      error: 'Falha interna ao consultar campanhas.'
    });
  }
}
