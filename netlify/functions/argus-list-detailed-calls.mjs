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

  const auth =
    event.headers.authorization ||
    event.headers.Authorization;

  if (!auth?.startsWith('Bearer ')) {
    return json(401, { error: 'Autenticação necessária.' });
  }

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    ARGUS_TOKEN_SIGNATURE,
    ARGUS_API_URL
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !ARGUS_TOKEN_SIGNATURE ||
    !ARGUS_API_URL
  ) {
    return json(503, {
      error: 'Integração não configurada no servidor.'
    });
  }

  try {
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(auth.slice(7));

    if (authError || !user) {
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
        error: 'Apenas a Diretoria pode consultar este relatório.'
      });
    }

    const params = event.queryStringParameters || {};
    const idCampanha = Number(params.idCampanha);
    const periodoInicial = params.periodoInicial;
    const periodoFinal = params.periodoFinal;

    if (!Number.isInteger(idCampanha) || idCampanha <= 0) {
      return json(400, {
        error: 'Informe um idCampanha válido.'
      });
    }

    if (!periodoInicial || !periodoFinal) {
      return json(400, {
        error: 'Informe o período inicial e o período final.'
      });
    }

    const inicio = new Date(periodoInicial);
    const fim = new Date(periodoFinal);

    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fim.getTime()) ||
      fim <= inicio
    ) {
      return json(400, {
        error: 'O período informado é inválido.'
      });
    }

    const intervalo = fim.getTime() - inicio.getTime();
    const seteDias = 7 * 24 * 60 * 60 * 1000;

    if (intervalo > seteDias) {
      return json(400, {
        error: 'O período máximo por consulta é de sete dias.'
      });
    }

    const payload = {
      idCampanha,
      periodoInicial,
      periodoFinal
    };

    const numericFilters = [
      'idLigacao',
      'idGrupoUsuario',
      'idLote',
      'nrLead',
      'idUsuario',
      'idStatusLigacao',
      'idTabulacao',
      'ultimoId'
    ];

    for (const key of numericFilters) {
      if (params[key] !== undefined && params[key] !== '') {
        const value = Number(params[key]);

        if (!Number.isInteger(value) || value < 0) {
          return json(400, {
            error: `O filtro ${key} precisa ser um inteiro válido.`
          });
        }

        payload[key] = value;
      }
    }

    if (params.dddTelefone) {
      payload.dddTelefone = params.dddTelefone.slice(0, 30);
    }

    if (params.somenteInsucesso !== undefined) {
      payload.somenteInsucesso =
        params.somenteInsucesso === 'true';
    }

    const baseUrl = ARGUS_API_URL.replace(/\/+$/, '');

    const upstream = await fetch(
      `${baseUrl}/report/ligacoesdetalhadas`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Token-Signature': ARGUS_TOKEN_SIGNATURE
        },
        body: JSON.stringify(payload)
      }
    );

    const responseText = await upstream.text();

    if (!upstream.ok) {
      console.error(
        'Erro no relatório detalhado do Argus:',
        upstream.status
      );

      return json(502, {
        error: 'O Argus recusou a consulta do relatório.',
        upstreamStatus: upstream.status
      });
    }

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return json(502, {
        error: 'O Argus retornou uma resposta que não é JSON.'
      });
    }

    if (data.codStatus !== undefined && Number(data.codStatus) < 1) {
      return json(502, {
        error: data.descStatus || 'O Argus não conseguiu gerar o relatório.'
      });
    }

    return json(200, { data });
  } catch (error) {
    console.error(
      'Falha no relatório detalhado:',
      error?.message || 'Erro desconhecido'
    );

    return json(500, {
      error: 'Erro interno ao consultar o relatório do Argus.'
    });
  }
}
