// Vincula um operador do Argus a gerente/supervisor e atualiza as ligações já importadas.
import { json, requireRole } from '../lib/shared.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' });
  const ctx = await requireRole(event, ['director']);
  if (ctx.error) return ctx.error;
  const { supabase, user } = ctx;
  let input;
  try { input = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Corpo inválido.' }); }
  const argusUserId = String(input.argus_user_id || '');
  const supervisorId = input.supervisor_id || null;
  if (!argusUserId) return json(400, { error: 'Operador não informado.' });

  let managerId = null;
  if (supervisorId) {
    const { data: sup } = await supabase.from('profiles').select('id, role, active, manager_id').eq('id', supervisorId).single();
    if (!sup || sup.role !== 'supervisor' || !sup.active) return json(400, { error: 'Supervisor inválido.' });
    managerId = sup.manager_id || null;
  }
  const { error } = await supabase.from('operators').update({ supervisor_id: supervisorId, manager_id: managerId }).eq('argus_user_id', argusUserId);
  if (error) return json(500, { error: error.message });
  await supabase.from('call_records').update({ supervisor_id: supervisorId, manager_id: managerId }).eq('argus_user_id', argusUserId);
  await supabase.from('audit_logs').insert({ actor_id: user.id, action: 'operator.assigned', details: { argus_user_id: argusUserId, supervisor_id: supervisorId } });
  return json(200, { success: true });
}
