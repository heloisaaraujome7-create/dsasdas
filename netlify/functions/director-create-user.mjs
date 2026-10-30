// Cria usuário (conta de acesso + perfil). Somente Diretoria.
// Modo "password": cria direto com senha temporária (não depende de e-mail/SMTP).
// Modo "invite": envia convite por e-mail.
import { json, requireRole } from '../lib/shared.mjs';

const ROLES = new Set(['director', 'manager', 'supervisor', 'quality', 'backoffice', 'aftersales', 'hr', 'admin']);

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' });
  const ctx = await requireRole(event, ['director']);
  if (ctx.error) return ctx.error;
  const { supabase, user: actor } = ctx;

  let input;
  try { input = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Corpo inválido.' }); }
  const email = String(input.email || '').trim().toLowerCase();
  const displayName = String(input.display_name || '').trim().slice(0, 100);
  const role = String(input.role || '');
  const managerId = input.manager_id || null;
  const supervisorId = input.supervisor_id || null;
  const mode = input.mode === 'invite' ? 'invite' : 'password';
  const password = String(input.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || !ROLES.has(role)) return json(400, { error: 'Informe nome, e-mail válido e cargo.' });
  if (mode === 'password' && password.length < 8) return json(400, { error: 'A senha temporária deve ter pelo menos 8 caracteres.' });
  if (role === 'director' && input.confirm_create_director !== true) return json(400, { error: 'Confirme que deseja criar outra conta de Diretoria.' });
  if (role === 'supervisor' && !managerId) return json(400, { error: 'Vincule o supervisor a um gerente.' });
  if (managerId) {
    const { data: m } = await supabase.from('profiles').select('id, role, active').eq('id', managerId).single();
    if (!m || m.role !== 'manager' || !m.active) return json(400, { error: 'Gerente vinculado inválido.' });
  }

  const created = mode === 'invite'
    ? await supabase.auth.admin.inviteUserByEmail(email, { data: { display_name: displayName } })
    : await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
  if (created.error || !created.data?.user) {
    return json(400, { error: 'Não foi possível criar a conta: ' + (created.error?.message || 'erro desconhecido') });
  }
  const newId = created.data.user.id;

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: newId, display_name: displayName, role,
    manager_id: role === 'supervisor' ? managerId : null,
    supervisor_id: supervisorId, active: true, created_by: actor.id,
  }, { onConflict: 'id' });
  if (profileError) {
    await supabase.auth.admin.deleteUser(newId);
    console.error('profile upsert failed', profileError.message);
    return json(500, { error: 'Não foi possível salvar o perfil: ' + profileError.message + ' (rode o supabase/schema.sql atualizado).' });
  }
  await supabase.from('audit_logs').insert({ actor_id: actor.id, action: 'user.created', target_user_id: newId, details: { role, mode } });
  return json(201, {
    success: true,
    message: mode === 'invite'
      ? 'Convite enviado por e-mail.'
      : 'Usuário criado. Passe o e-mail e a senha temporária para a pessoa e peça para trocá-la.',
  });
}
