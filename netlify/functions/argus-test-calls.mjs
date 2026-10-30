
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
    return json(401, {
      error: 'Autenticação necessária.'
    });
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
      {
        auth: {
          persistSession: false
        }
      }
    );

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(
      auth.slice(7)
    );

    if (authError || !user) {
      return json(401, {
        error: 'Sessão inválida.'
      });
    }

    const { data: profile, error: profileError } =
      await supabase
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
        error: 'Apenas a Diretoria pode executar este teste.'
      });
    }

    const params = event.queryStringParameters || {};

    const idCampanha = Number(
      params.idCampanha || 1
    );

    const horas = Number(
      params.horas || 1
    );

    if (
      !Number.isInteger(idCampanha) ||
      idCampanha <= 0
    ) {
      return json(400, {
        error: 'ID da campanha inválido.'
      });
    }

    if (
      !Number.isInteger(horas) ||
      horas < 1 ||
      horas > 168
    ) {
      return json(400, {
        error: 'Informe horas entre 1 e 168.'
      });
    }

   // Horário de São Paulo: consulta de hoje às 08h até agora,
// sem ultrapassar as 18h.
const agora = new Date();

const horarioSaoPaulo = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23'
});

const partes = Object.fromEntries(
  horarioSaoPaulo
    .formatToParts(agora)
    .filter(p => p.type !== 'literal')
    .map(p => [p.type, p.value])
);

const ano = Number(partes.year);
const mes = Number(partes.month);
const dia = Number(partes.day);
const hora = Number(partes.hour);

// Cria as referências de 08h e 18h em horário de São Paulo.
// O fuso de São Paulo é UTC-3.
const inicio = new Date(
  Date.UTC(ano, mes - 1, dia, 11, 0, 0)
);

const limiteFim = new Date(
  Date.UTC(ano, mes - 1, dia, 21, 0, 0)
);

const fim = new Date(
  Math.min(agora.getTime(), limiteFim.getTime())
);

if (hora < 8) {
  return json(200, {
    sucesso: true,
    mensagem: 'A consulta de ligações começa às 08h00.',
    periodo: {
      inicial: inicio.toISOString(),
      final: fim.toISOString()
    },
    quantidadeLigacoes: 0
  });
}

const payload = {
  idCampanha,
  periodoInicial: inicio.toISOString(),
  periodoFinal: fim.toISOString()
};
    
const baseUrl = String(ARGUS_API_URL).replace(/\/+$/, '');

const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, 25000);

let upstream;
let responseText;

try {
  upstream = await fetch(
    baseUrl + '/report/ligacoesdetalhadas',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token-Signature': ARGUS_TOKEN_SIGNATURE
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    }
  );

  responseText = await upstream.text();
} finally {
  clearTimeout(timeout);
}

if (!upstream.ok) {
  console.error(
    'Teste de ligações Argus:',
    upstream.status,
    responseText.slice(0, 1500)
  );

  return json(502, {
    error: 'O Argus recusou a consulta.',
    upstreamStatus: upstream.status,
    detalhe: responseText.slice(0, 1500)
  });
}

let data;

try {
  data = JSON.parse(responseText);
} catch {
  console.error(
    'Argus retornou resposta que não é JSON:',
    responseText.slice(0, 1000)
  );

  return json(502, {
    error: 'O Argus não retornou JSON válido.',
    detalhe: responseText.slice(0, 1000)
  });
}


    if (
      data?.codStatus !== undefined &&
      Number(data.codStatus) < 1
    ) {
      return json(200, {
        sucesso: false,
        mensagem:
          data.descStatus ||
          'O Argus não conseguiu gerar o relatório.',
        codStatus: data.codStatus
      });
    }

    const colecoes = {};

function inspecionar(valor, caminho = 'data', nivel = 0) {
  if (nivel > 4 || valor == null) {
    return;
  }

  if (Array.isArray(valor)) {
    colecoes[caminho] = {
      tipo: 'array',
      quantidade: valor.length,
      camposPrimeiroRegistro:
        valor.length > 0 &&
        typeof valor[0] === 'object' &&
        valor[0] !== null
          ? Object.keys(valor[0])
          : []
    };

    return;
  }

  if (typeof valor === 'object') {
    for (const [chave, item] of Object.entries(valor)) {
      if (item && typeof item === 'object') {
        inspecionar(
          item,
          caminho + '.' + chave,
          nivel + 1
        );
      }
    }
  }
}


    inspecionar(data);

const ligacoes =
  data?.ligacoesDetalhadas ??
  data?.data?.ligacoesDetalhadas ??
  [];
const resultados = {};

for (const ligacao of ligacoes) {
  const resultado =
    String(ligacao.resultadoLigacao || 'SEM RESULTADO').trim();

  resultados[resultado] = (resultados[resultado] || 0) + 1;
}

const rankingResultados = Object.entries(resultados)
  .map(([resultado, quantidade]) => ({
    resultado,
    quantidade
  }))
  .sort((a, b) => b.quantidade - a.quantidade);
    
return json(200, {
  sucesso: true,
  campanha: idCampanha,
  periodo: {
    inicial: payload.periodoInicial,
    final: payload.periodoFinal

  },
  statusArgus: data.codStatus ?? null,
  mensagemArgus: data.descStatus ?? null,
  fimDaTabela: data.endOfTable ?? null,
  quantidadeInformadaArgus: data.qtdeRegistros ?? null,
  contagemPorResultado: rankingResultados,
  idProximaPagina: data.idProxPagina ?? null,
  estrutura: {
    camposRaiz: Object.keys(data),
    colecoes
  },
  quantidadeLigacoes: Array.isArray(ligacoes)
    ? ligacoes.length
    : null,
  camposPrimeiraLigacao:
    Array.isArray(ligacoes) && ligacoes.length > 0
      ? Object.keys(ligacoes[0])
      : [],
  primeiraLigacao:
    Array.isArray(ligacoes) && ligacoes.length > 0
      ? ligacoes[0]
      : null
});

  } catch (error) {
    console.error(
      'argus-test-calls error:',
      error?.name || 'Erro desconhecido'
    );

    if (error?.name === 'AbortError') {
      return json(504, {
        error: 'O Argus demorou demais para responder.'
      });
    }

    return json(500, {
      error: 'Falha interna ao testar as ligações.'
    });
  }
}
