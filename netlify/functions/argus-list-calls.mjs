import { createClient } from '@supabase/supabase-js';
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
function validDate(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }
export async function handler(event) {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Método não permitido.' });
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return json(401, { error: 'Autenticação necessária.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !(process.env.ARGUS_TOKEN_SIGNATURE || process.env.ARGUS_API_TOKEN)) return json(503, { error: 'Integração não configurada no servidor.' });
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await supabase.auth.getUser(auth.slice(7));
    if (authError || !user) return json(401, { error: 'Sessão inválida.' });
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role, active').eq('id', user.id).single();
    if (profileError || profile?.role !== 'director' || !profile.active) return json(403, { error: 'Somente a Diretoria pode consultar o relatório global do Argus.' });
    const input = event.httpMethod === 'GET' ? event.queryStringParameters || {} : JSON.parse(event.body || '{}');
    const idCampanha = Number(input.idCampanha);
    if (!Number.isInteger(idCampanha) || idCampanha <= 0) return json(400, { error: 'Informe idCampanha válido.' });
    const hasPeriod = input.periodoInicial && input.periodoFinal;
    const hasRecent = input.ultimosMinutos !== undefined && input.ultimosMinutos !== '';
    if (Boolean(hasPeriod) === Boolean(hasRecent)) return json(400, { error: 'Informe periodoInicial + periodoFinal, ou ultimosMinutos.' });
    const payload = { idCampanha };
    if (hasPeriod) {
      if (!validDate(input.periodoInicial) || !validDate(input.periodoFinal)) return json(400, { error: 'Datas inválidas. Use ISO 8601.' });
      const start = new Date(input.periodoInicial); const end = new Date(input.periodoFinal);
      if (end <= start) return json(400, { error: 'periodoFinal deve ser posterior ao periodoInicial.' });
      if (end - start > 7 * 24 * 60 * 60 * 1000) return json(400, { error: 'O Argus aceita intervalo máximo de 7 dias por consulta.' });
      payload.periodoInicial = input.periodoInicial;
      payload.periodoFinal = input.periodoFinal;
    } else {
      const minutes = Number(input.ultimosMinutos);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) return json(400, { error: 'ultimosMinutos deve ser um inteiro entre 1 e 10080.' });
      payload.ultimosMinutos = minutes;
    }
    for (const key of ['idGrupoUsuario','idLote','nrLead','idUsuario','idStatusLigacao','idTabulacao','ultimoId']) {
      if (input[key] !== undefined && input[key] !== '') {
        const n = Number(input[key]);
        if (!Number.isInteger(n) || n < 0) return json(400, { error: `Filtro ${key} inválido.` });
        payload[key] = n;
      }
    }
    if (input.somenteInsucesso !== undefined && input.somenteInsucesso !== '') payload.somenteInsucesso = input.somenteInsucesso === true || input.somenteInsucesso === 'true';
    const upstream = await fetch(String(process.env.ARGUS_API_URL || 'https://argus.app.br/apiargus').replace(/\/+$/, '') + '/report/ligacoesdetalhadas', { method: 'POST', headers: { 'content-type': 'application/json', 'Token-Signature': process.env.ARGUS_TOKEN_SIGNATURE || process.env.ARGUS_API_TOKEN }, body: JSON.stringify(payload) });
    if (!upstream.ok) return json(502, { error: 'Falha na consulta ao Argus.', upstreamStatus: upstream.status });
    const textBody = await upstream.text(); let parsed;
    try { parsed = JSON.parse(textBody); } catch { return json(502, { error: 'Resposta inválida recebida do Argus.' }); }
    return json(200, { data: parsed });
  } catch (error) {
    console.error('argus-list-calls error', error?.message || 'unknown');
    return json(500, { error: 'Falha interna ao consultar ligações.' });
  }
}
