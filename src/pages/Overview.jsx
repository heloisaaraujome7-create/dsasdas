import React, { useState } from 'react';
import { PhoneCall, Users, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { PageTitle, EmptyState } from '../components.jsx';
import { useCalls } from '../lib/useCalls';
import { todaySP, fmtTime, fmtDuration, evalOf } from '../lib/format';

export default function Overview({ setPage }) {
  const [date] = useState(todaySP());
  const { rows, loading, error } = useCalls(date);
  const evals = rows.map(evalOf).filter(Boolean);
  const avg = evals.length ? (evals.reduce((s, e) => s + Number(e.score), 0) / evals.length).toFixed(1) : '—';
  const cards = [
    ['Atendimentos de hoje', rows.length, PhoneCall, 'red'],
    ['Operadores com atendimento', new Set(rows.map((r) => r.argus_user_id || r.operator_name)).size, Users, 'purple'],
    ['Aguardando avaliação', rows.length - evals.length, TriangleAlert, 'amber'],
    ['Nota média (avaliadas)', avg, CheckCircle2, 'green'],
  ];
  return <>
    <PageTitle title="Visão geral" subtitle="Resumo de hoje (horário de Brasília)." />
    {error && <div className="notice error"><div><b>Não foi possível carregar os dados.</b><p>{error}</p></div></div>}
    <div className="metrics-grid">
      {cards.map(([label, value, Icon, color]) => <div className="metric-card" key={label}>
        <div className="metric-top"><span>{label}</span><span className={`metric-icon ${color}`}><Icon size={18} /></span></div>
        <div className="metric-value">{loading ? '…' : value}</div>
      </div>)}
    </div>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><h3>Últimos atendimentos</h3><p>As 8 ligações atendidas mais recentes</p></div><button className="text-button" onClick={() => setPage('calls')}>Abrir chamadas →</button></div>
      {rows.length === 0 ? <EmptyState title="Nenhuma ligação importada hoje" text="Vá em Chamadas e use “Sincronizar com o Argus”." /> :
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Horário</th><th>Operador</th><th>Duração</th></tr></thead>
          <tbody>{rows.slice(0, 8).map((r) => <tr key={r.id}><td>{fmtTime(r.call_started_at)}</td><td>{r.operator_name}</td><td>{fmtDuration(r.duration_seconds)}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
