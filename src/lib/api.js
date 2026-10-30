// Chama uma Netlify Function com o token da sessão atual.
export async function callFn(name, session, body, method = 'POST') {
  let res;
  try {
    res = await fetch('/.netlify/functions/' + name, {
      method,
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  let data;
  try { data = await res.json(); }
  catch { throw new Error(`O servidor não respondeu como esperado (HTTP ${res.status}). Confira se o deploy no Netlify terminou.`); }
  if (!res.ok) throw new Error(data?.error || `Erro HTTP ${res.status}`);
  return data;
}
