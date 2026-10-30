import React, { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { PageTitle, EmptyState } from '../components.jsx';
import { useCalls } from '../lib/useCalls';
import { callFn } from '../lib/api';
import { supabase } from '../supabase';
import { todaySP, evalOf, fmtDuration } from '../lib/format';

export default function Operators({ session, role }) {
  const [date, setDate] = useState(todaySP());
  const { rows, loading } = useCalls(date);
  const isDirector = role === 'director';
  const [supervisors, setSupervisors] = useState([]);
  const [links, setLinks] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!isDirector || !supabase) return;
    (async () => {
      const [sup, ops] = await Promise.all([
        supabase.from('profiles').select('id, display_name').eq('role', 'supervisor').eq('active', true),
        supabase.from('operators').select('argus_user_id, supervisor_id'),
      ]);
      setSupervisors(sup.data || []);
      setLinks(Object.fromEntries((ops.data || []).map((o) => [o.argus_user_id, o.supervisor_id || ''])));
    })();
  }, [isDirector]);

  const list = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.argus_user_id || r.operator_name || '—';
      const o = map.get(key) || { key, name: r.operator_name || '—', calls: 0, seconds: 0, reviewed: 0, scores: 0 };
      o.calls += 1; o.seconds += r.duration_seconds || 0;
      const e = evalOf(r); if (e) { o.reviewed += 1; o.scores += Number(e.score); }
      map.set(key, o);
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls);
  }, [rows]);

  async function assign(key, supervisorId) {
    setMsg('');
    try {
      await callFn('operator-assign', session, { argus_user_id: key, supervisor_id: supervisorId || null });
      setLinks((l) => ({ ...l, [key]: supervisorId }));
      setMsg('Vínculo salvo. As ligações desse operador já aparecem para o supervisor.');
    } catch (e) { setMsg(e.message); }
  }

  return <>
    <PageTitle title="Operadores" subtitle="Atendimentos por operador no dia selecionado.">
      <label className="filter-select"><span>Dia</span><input type="date" value={date} max={todaySP()} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
    </PageTitle>
    {msg && <div className="notice info"><div>{msg}</div></div>}
    <section className="panel">
      {!loading && list.length === 0 ? <EmptyState icon={Users} title="Nenhum operador com atendimento" text="Sincronize as ligações em Chamadas para ver os operadores." /> :
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Operador</th><th>Atendimentos</th><th>Tempo total</th><th>Avaliadas</th><th>Nota média</th>{isDirector && <th>Supervisor</th>}</tr></thead>
          <tbody>{list.map((o) => <tr key={o.key}>
            <td>{o.name}</td><td>{o.calls}</td><td>{fmtDuration(o.seconds)}</td><td>{o.reviewed}/{o.calls}</td>
            <td>{o.reviewed ? (o.scores / o.reviewed).toFixed(1) : '—'}</td>
            {isDirector && <td><select className="plain-select" value={links[o.key] || ''} onChange={(e) => assign(o.key, e.target.value)}>
              <option value="">Sem supervisor</option>{supervisors.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}</select></td>}
          </tr>)}</tbody>
        </table></div>}
    </section>
  </>;
}
