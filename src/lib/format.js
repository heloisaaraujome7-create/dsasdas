const TZ = 'America/Sao_Paulo';
export const ROLE_LABELS = {
  director: 'Diretoria', manager: 'Gerente', supervisor: 'Supervisor', quality: 'Monitoria/Qualidade',
  backoffice: 'Backoffice', aftersales: 'Pós-venda', hr: 'RH', admin: 'ADM',
};
export const todaySP = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
export function fmtDuration(sec) {
  const s = Number(sec) || 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const evalOf = (row) => {
  const e = row.call_evaluations;
  return Array.isArray(e) ? e[0] || null : e || null;
};
export const RESULT_LABELS = { approved: 'Aprovada', attention: 'Atenção', failed: 'Reprovada' };
export const CRITERIA = [
  ['identidade', 'Confirmou a identidade do cliente'],
  ['clareza', 'Explicou a oferta com clareza'],
  ['consentimento', 'Obteve o consentimento do cliente'],
  ['sem_promessas', 'Não fez promessas indevidas'],
  ['regras_comerciais', 'Respeitou as regras comerciais'],
  ['encerramento', 'Encerrou a conversa corretamente'],
];
