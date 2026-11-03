
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
  if (event.httpMethod !== 'POST') {
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
  const bucket = process.env.ARGUS_RECORDINGS_BUCKET || 'recordings';

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

    // Validar sessão
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(auth.slice(7));

    if (userError || !user) {
      return json(401, { error: 'Sessão inválida.' });
    }

    // Somente Diretoria
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
        error: 'Somente a Diretoria pode baixar gravações.'
      });
    }

    // Validar parâmetros
    let input;

    try {
      input = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Corpo da solicitação inválido.' });
    }

    const idCampanha = Number(input.idCampanha);
    const idLigacao = Number(input.idLigacao);

    if (
      !Number.isSafeInteger(idCampanha) ||
      idCampanha <= 0 ||
      !Number.isSafeInteger(idLigacao) ||
      idLigacao <= 0
    ) {
      return json(400, {
        error: 'Informe idCampanha e idLigacao válidos.'
      });
    }

    const formato = String(input.formato || 'MP3').toUpperCase();

    if (!['MP3', 'WAV'].includes(formato)) {
      return json(400, {
        error: 'Formato deve ser MP3 ou WAV.'
      });
    }

    const opcaoCanais = Number(input.opcaoCanais || 1);

    if (![1, 2, 3].includes(opcaoCanais)) {
      return json(400, {
        error: 'opcaoCanais deve ser 1, 2 ou 3.'
      });
    }

    // Confirmar que a ligação existe no SevenPro
    const { data: call, error: callError } = await supabase
      .from('call_records')
      .select('id, audio_storage_path')
      .eq('argus_campaign_id', idCampanha)
      .eq('argus_call_id', String(idLigacao))
      .maybeSingle();

    if (callError) {
      return json(500, {
        error: 'Falha ao localizar a ligação no Supabase.',
        detail: callError.message
      });
    }

    if (!call) {
      return json(404, {
        error: 'Ligação não encontrada em call_records. Sincronize primeiro.'
      });
    }

    // Solicitar áudio ao Argus
    const baseUrl = argusBaseUrl.replace(/\/+$/, '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let upstream;

    try {
      upstream = await fetch(
        `${baseUrl}/cmd/downloadgravacao`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'Token-Signature': argusToken
          },
          body: JSON.stringify({
            idCampanha,
            idLigacao,
            formato,
            preAtendimento: 'N',
            opcaoCanais,
            base64: 'S'
          }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      const detail = await upstream.text();

      console.error('Erro no download Argus:', upstream.status, detail);

      return json(502, {
        error: 'O Argus não conseguiu fornecer a gravação.',
        upstreamStatus: upstream.status
      });
    }

    let result;

    try {
      result = await upstream.json();
    } catch {
      return json(502, {
        error: 'O Argus retornou uma resposta que não é JSON.'
      });
    }

    if (
      result?.codStatus !== undefined &&
      Number(result.codStatus) < 1
    ) {
      return json(502, {
        error: result.descStatus || 'Gravação indisponível no Argus.'
      });
    }

    const audioBase64 = result?.arquivoBase64;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return json(502, {
        error: 'O Argus não retornou o arquivo de áudio em Base64.'
      });
    }

    // Converter Base64 para arquivo binário
    const cleanBase64 = audioBase64.replace(
      /^data:audio\/[^;]+;base64,/i,
      ''
    );

    const audioBuffer = Buffer.from(cleanBase64, 'base64');

    if (!audioBuffer.length) {
      return json(502, {
        error: 'O arquivo de áudio recebido está vazio.'
      });
    }

    const extension = formato.toLowerCase();

    const contentType = formato === 'MP3'
      ? 'audio/mpeg'
      : 'audio/wav';

    const storagePath =
      `${idCampanha}/${idLigacao}.${extension}`;

    // Salvar no Supabase Storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, audioBuffer, {
        contentType,
        upsert: true
      });

    if (storageError) {
      console.error('Erro no Supabase Storage:', storageError.message);

      return json(500, {
        error: 'Falha ao armazenar a gravação.',
        detail: storageError.message,
        bucket
      });
    }

    // Atualizar ligação
// Atualizar ligação pelo ID único do registro
const { data: updatedCall, error: updateError } = await supabase
  .from('call_records')
  .update({
    audio_storage_path: storagePath,
    audio_format: extension,
    updated_at: new Date().toISOString()
  })
  .eq('id', call.id)
  .select('id, audio_storage_path, audio_format')
  .maybeSingle();

if (updateError) {
  console.error('Erro ao atualizar call_records:', updateError);

  return json(500, {
    error: 'Áudio armazenado, mas não foi possível atualizar a ligação.',
    detail: updateError.message,
    code: updateError.code,
    storagePath
  });
}

if (!updatedCall) {
  return json(500, {
    error: 'O áudio foi armazenado, mas o registro da ligação não foi atualizado.',
    storagePath
  });
}

    return json(200, {
      success: true,
      message: 'Gravação baixada e armazenada com sucesso.',
      idCampanha,
      idLigacao,
      formato: extension,
      storagePath,
      bytes: audioBuffer.length
    });

  } catch (error) {
    console.error(
      'argus-download-recording:',
      error?.message || 'Erro desconhecido'
    );

    return json(error?.name === 'AbortError' ? 504 : 500, {
      error: error?.name === 'AbortError'
        ? 'Tempo limite ao solicitar gravação ao Argus.'
        : 'Falha interna ao baixar gravação.'
    });
  }
}
