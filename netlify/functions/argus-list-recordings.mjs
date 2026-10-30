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
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { error: 'Método não permitido.' });
  }

  const auth =
    event.headers.authorization ||
    event.headers.Authorization;

  if (!auth?.startsWith('Bearer ')) {
    return json(401, { error: 'Autenticação necessária.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const argusToken = process.env.ARGUS_TOKEN_SIGNATURE;
  const argusBaseUrl = process.env.ARGUS_API_URL;

  if (!supabaseUrl || !serviceKey || !argusToken || !argusBaseUrl) {
    return json(503, {
      error: 'Integração não configurada no servidor.'
    });
  }

  try {
    const supabase = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userError } =
      await supabase.auth.getUser(auth.slice(7));

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
        error: 'Somente a Diretoria pode consultar as gravações.'
      });
    }

    let input;

    try {
      input = event.httpMethod === 'GET'
        ? event.queryStringParameters || {}
        : JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Corpo da solicitação inválido.' });
    }

    const idCampanha = Number(input.idCampanha);

    if (!Number.isInteger(idCampanha) || idCampanha <= 0) {
      return json(400, {
        error: 'Informe um idCampanha válido.'
      });
    }

    const payload = { idCampanha };

    const allowedFilters = [
      'nrLead',
      'idSkill',
      'codCliente',
      'cpfCnpj',
      'telefone'
    ];

    const supplied = allowedFilters.filter(
      key =>
        input[key] !== undefined &&
        String(input[key]).trim() !== ''
    );

    if (supplied.length > 1) {
      return json(400, {
        error: 'Informe apenas um filtro por consulta.'
      });
    }

    if (supplied.length === 1) {
      const key = supplied[0];

      if (key === 'nrLead' || key === 'idSkill') {
        const value = Number(input[key]);

        if (!Number.isInteger(value) || value <= 0) {
          return json(400, {
            error: 'O filtro numérico deve ser um inteiro positivo.'
          });
        }

        payload[key] = value;
      } else {
        payload[key] = String(input[key]).trim().slice(0, 100);
      }
    }

    const baseUrl = argusBaseUrl.replace(/\/+$/, '');

    const upstream = await fetch(
      `${baseUrl}/cmd/listargravacoes`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Token-Signature': argusToken
        },
        body: JSON.stringify(payload)
      }
    );

    if (!upstream.ok) {
      console.error(
        'Argus respondeu com status:',
        upstream.status
      );

      return json(502, {
        error: 'Falha na consulta de gravações ao Argus.',
        upstreamStatus: upstream.status
      });
    }

    const responseText = await upstream.text();

    let parsed;

    try {
      parsed = JSON.parse(responseText);
    } catch {
      return json(502, {
        error: 'Resposta inválida recebida do Argus.'
      });
    }

    return json(200, { data: parsed });

  } catch (error) {
    console.error(
      'argus-list-recordings error:',
      error?.message || 'Erro desconhecido'
    );

    return json(500, {
      error: 'Falha interna ao consultar gravações.'
    });
  }
}
