// Salva (ou atualiza) a avaliação humana de uma ligação.
import { json, requireRole } from '../lib/shared.mjs';

const CRITERIA = ['identidade', 'clareza', 'consentimento', 'sem_promessas', 'regras_comerciais', 'encerramento'];

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' });
  const ctx = await requireRole(event, ['director', 'quality', 'manager', 'supervisor']);
  if (ctx.error) return ctx.error;
  const { supabase, user, profile } = ctx;
  let input;
  try { input = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Corpo inválido.' }); }

  const callId = String(input.call_record_id || '');
  const score = Number(input.score);
  if (!callId) return json(400, { error: 'Ligação não informada.' });
  if (!Number.isFinite(score) || score < 0 || score > 10) return json(400, { error: 'A nota deve estar entre 0 e 10.' });

  // Garante que o usuário enxerga esta ligação (escopo por equipe).
  const { data: call } = await supabase.from('call_records').select('id, manager_id, supervisor_id').eq('id', callId).single();
  if (!call) return json(404, { error: 'Ligação não encontrada.' });
  if (profile.role === 'manager' && call.manager_id !== user.id) return json(403, { error: 'Ligação fora da sua equipe.' });
  if (profile.role === 'supervisor' && call.supervisor_id !== user.id) return json(403, { error: 'Ligação fora da sua equipe.' });

  const criteria = {};
  for (const k of CRITERIA) criteria[k] = input.criteria?.[k] === true;
  const result = score >= 8 ? 'approved' : score >= 6 ? 'attention' : 'failed';

  const { error } = await supabase.from('call_evaluations').upsert({
    call_record_id: callId,
    evaluator_id: user.id,
    score,
    result,
    criteria,
    notes: String(input.notes || '').slice(0, 2000),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'call_record_id' });
  if (error) return json(500, { error: 'Falha ao salvar avaliação: ' + error.message });
  await supabase.from('call_records').update({ human_review_status: 'reviewed' }).eq('id', callId);
  await supabase.from('audit_logs').insert({ actor_id: user.id, action: 'call.evaluated', details: { call_record_id: callId, score, result } });
  return json(200, { success: true, result });
}
