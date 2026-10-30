// Sincroniza UMA janela de tempo do Argus -> Supabase (call_records).
// O navegador chama esta função várias vezes (janelas de 30 min) para cobrir o dia sem estourar o tempo limite.
import { json, requireRole, argusPost } from '../lib/shared.mjs';

const ALLOWED = ['director', 'quality'];
const MAX_WINDOW_MS = 60 * 60 * 1000;
const norm = (v) => String(v ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const pick = (o, keys) => { for (const k of keys) if (o?.[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return null; };

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' });
  const ctx = await requireRole(event, ALLOWED);
  if (ctx.error) return ctx.error;
  const { supabase, user } = ctx;

  let input;
  try { input = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Corpo inválido.' }); }
  const idCampanha = Number(input.idCampanha || 1);
  const start = new Date(input.periodoInicial);
  const end = new Date(input.periodoFinal);
  if (!Number.isInteger(idCampanha) || idCampanha <= 0) return json(400, { error: 'idCampanha inválido.' });
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return json(400, { error: 'Período inválido.' });
  if (end - start > MAX_WINDOW_MS) return json(400, { error: 'Use janelas de no máximo 60 minutos.' });

  const deadline = Date.now() + 7000;
  let ultimoId = input.ultimoId ? Number(input.ultimoId) : undefined;
  let fetched = 0, matched = 0, saved = 0, done = false, hitLimit = false;
  const byResult = {};

  try {
    // Mapa de operadores já cadastrados (id do Argus -> equipe) para preencher gerente/supervisor.
    const { data: ops } = await supabase.from('operators').select('argus_user_id, manager_id, supervisor_id');
    const opMap = new Map((ops || []).map((o) => [String(o.argus_user_id), o]));
    const newOps = new Map();

    while (Date.now() < deadline) {
      const payload = { idCampanha, periodoInicial: start.toISOString(), periodoFinal: end.toISOString() };
      if (ultimoId) payload.ultimoId = ultimoId;
      const data = await argusPost('/report/ligacoesdetalhadas', payload, Math.max(2000, deadline - Date.now() + 1000));
      if (data?.codStatus !== undefined && Number(data.codStatus) < 1) {
        return json(502, { error: data.descStatus || 'O Argus não conseguiu gerar o relatório.' });
      }
      const rows = data?.ligacoesDetalhadas ?? data?.data?.ligacoesDetalhadas ?? [];
      fetched += rows.length;
      if (rows.length >= 15000) hitLimit = true;

      const records = [];
      for (const r of rows) {
        const result = String(r.resultadoLigacao || 'SEM RESULTADO').trim();
        byResult[result] = (byResult[result] || 0) + 1;
        if (norm(result) !== 'ATENDIMENTO') continue;
        matched += 1;
        const userId = pick(r, ['idUsuario']);
        const op = userId != null ? opMap.get(String(userId)) : null;
        if (userId != null && !op) newOps.set(String(userId), { argus_user_id: String(userId), name: r.usuarioOperador || `Operador ${userId}` });
        records.push({
          argus_call_id: String(r.idLigacao),
          argus_user_id: userId != null ? String(userId) : null,
          operator_name: r.usuarioOperador || null,
          call_started_at: r.dataHoraLigacao ? new Date(r.dataHoraLigacao).toISOString() : null,
          duration_seconds: Number(r.tempoSegundos) || 0,
          call_result: result,
          tabulation: r.tabulacao || null,
          lead_number: pick(r, ['nrLead']) != null ? String(r.nrLead) : null,
          campaign_id: idCampanha,
          manager_id: op?.manager_id ?? null,
          supervisor_id: op?.supervisor_id ?? null,
          synced_at: new Date().toISOString(),
        });
      }
      for (let i = 0; i < records.length; i += 500) {
        const chunk = records.slice(i, i + 500);
        const { error } = await supabase.from('call_records').upsert(chunk, { onConflict: 'argus_call_id' });
        if (error) return json(500, { error: 'Falha ao gravar no Supabase: ' + error.message });
        saved += chunk.length;
      }
      if (newOps.size) {
        await supabase.from('operators').upsert([...newOps.values()], { onConflict: 'argus_user_id', ignoreDuplicates: true });
        newOps.clear();
      }
      const next = data?.idProxPagina;
      if (data?.endOfTable === true || !next) { done = true; break; }
      ultimoId = Number(next);
    }
    await supabase.from('audit_logs').insert({ actor_id: user.id, action: 'calls.sync', details: { fetched, saved, periodoInicial: start.toISOString(), periodoFinal: end.toISOString() } });
    return json(200, { done, nextUltimoId: done ? null : ultimoId ?? null, fetched, matched, saved, hitLimit, byResult });
  } catch (e) {
    console.error('argus-sync-calls', e?.message);
    return json(e?.status || 500, { error: e?.message || 'Falha na sincronização.', detail: e?.detail });
  }
}
