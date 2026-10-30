// Utilitários compartilhados pelas Netlify Functions da SEVENPRO MONITORIA.
import { createClient } from '@supabase/supabase-js';

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

// Aceita os dois nomes de variável usados nas versões anteriores do projeto.
export function argusConfig() {
  const token = process.env.ARGUS_TOKEN_SIGNATURE || process.env.ARGUS_API_TOKEN;
  const baseUrl = String(process.env.ARGUS_API_URL || 'https://argus.app.br/apiargus').replace(/\/+$/, '');
  return { token, baseUrl };
}

export function adminClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// Valida o token do usuário e devolve { supabase, user, profile } ou { error: resposta }.
export async function requireRole(event, allowedRoles) {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return { error: json(401, { error: 'Autenticação necessária.' }) };
  const supabase = adminClient();
  if (!supabase) return { error: json(503, { error: 'Servidor sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY configurados.' }) };
  const { data: { user } = {}, error: authError } = await supabase.auth.getUser(auth.slice(7));
  if (authError || !user) return { error: json(401, { error: 'Sessão inválida. Entre novamente.' }) };
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('id, role, active, display_name').eq('id', user.id).single();
  if (profileError || !profile?.active || !allowedRoles.includes(profile.role)) {
    return { error: json(403, { error: 'Seu perfil não tem permissão para esta ação.' }) };
  }
  return { supabase, user, profile };
}

export async function argusPost(path, payload, timeoutMs = 9000) {
  const { token, baseUrl } = argusConfig();
  if (!token) throw Object.assign(new Error('Token do Argus não configurado (ARGUS_TOKEN_SIGNATURE).'), { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(baseUrl + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Token-Signature': token },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw Object.assign(new Error(`Argus respondeu HTTP ${res.status}.`), { status: 502, detail: text.slice(0, 300) });
    try { return JSON.parse(text); }
    catch { throw Object.assign(new Error('O Argus não retornou JSON válido.'), { status: 502, detail: text.slice(0, 300) }); }
  } catch (e) {
    if (e?.name === 'AbortError') throw Object.assign(new Error('O Argus demorou demais para responder.'), { status: 504 });
    throw e;
  } finally { clearTimeout(timer); }
}
