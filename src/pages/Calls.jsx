import React, { useMemo, useState } from 'react';
import { PhoneCall, Search, RefreshCw, X, Save } from 'lucide-react';
import { PageTitle, EmptyState, Pill } from '../components.jsx';
import { useCalls } from '../lib/useCalls';
import { callFn } from '../lib/api';
import { todaySP, fmtTime, fmtDuration, evalOf, RESULT_LABELS, CRITERIA } from '../lib/format';

const TONE = { approved: 'green', attention: 'amber', failed: 'red' };

// Janelas de 15 min entre 08h e min(agora, 18h), horário de São Paulo.
function buildWindows(date) {
  const start = new Date(`${date}T08:00:00-03:00`);
  const limit = new Date(`${date}T18:00:00-03:00`);
  const end = new Date(Math.min(Date.now(), limit.getTime()));
  if (end <= start) return [];
  const out = [];
  for (let t = start.getTime(); t < end.getTime(); t += 15 * 60000) {
    out.push([new Date(t), new Date(Math.min(t + 15 * 60000, end.getTime()))]);
  }
  return out;
}

function EvaluationModal({ row, session, onClose, onSaved }) {
  const prev = evalOf(row);
  const [criteria, setCriteria] = useState(prev?.criteria || {});
  const [score, setScore] = useState(prev ? Number(prev.score) : 0);
  const [touched, setTouched] = useState(!!prev);
  const [notes, setNotes] = useState(prev?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggle(key) {
    const next = { ...criteria, [key]: !criteria[key] };
    setCriteria(next);
    if (!touched) setScore(Math.round((Object.values(next).filter(Boolean).length / CRITERIA.length) * 100) / 10);
  }
  async function save() {
    setSaving(true); setError('');
    try {
      await callFn('call-evaluate', session, { call_record_id: row.id, score, criteria, notes });
      await onSaved();
      onClose();
    } catch (e) { setError(e.message); setSaving(false); }
  }
  return <div className="modal-scrim" onClick={onClose}>
    <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head">
        <div><h3>Avaliar ligação</h3><p>{row.operator_name || 'Operador'} · {fmtTime(row.call_started_at)} · {fmtDuration(row.duration_seconds)} · ID {row.argus_call_id}</p></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="criteria">
        {CRITERIA.map(([key, label]) => <label key={key} className="check"><input type="checkbox" checked={!!criteria[key]} onChange={() => toggle(key)} />{label}</label>)}
      </div>
      <div className="form-row">
        <label>Nota (0 a 10)<input type="number" min="0" max="10" step="0.1" value={score} onChange={(e) => { setScore(Number(e.target.value)); setTouched(true); }} /></label>
        <div className="score-hint">{score >= 8 ? <Pill tone="green">Aprovada</Pill> : score >= 6 ? <Pill tone="amber">Atenção</Pill> : <Pill tone="red">Reprovada</Pill>}</div>
      </div>
      <label className="form-col">Observações<textarea rows="4" maxLength="2000" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="O que foi bom, o que precisa melhorar..." /></label>
      {error && <div className="notice error"><div>{error}</div></div>}
      <div className="modal-actions">
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Salvando...' : 'Salvar avaliação'}</button>
      </div>
    </div>
  </div>;
}

export default function Calls({ session, role }) {
  const [date, setDate] = useState(todaySP());
  const { rows, loading, error, reload } = useCalls(date);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [operator, setOperator] = useState('all');
  const [selected, setSelected] = useState(null);
  const [sync, setSync] = useState(null);
  const canSync = role === 'director' || role === 'quality';
  const canEvaluate = ['director', 'quality', 'manager', 'supervisor'].includes(role);

  const operators = useMemo(() => [...new Set(rows.map((r) => r.operator_name).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter((r) => {
    const reviewed = !!evalOf(r);
    if (status === 'pending' && reviewed) return false;
    if (status === 'reviewed' && !reviewed) return false;
    if (operator !== 'all' && r.operator_name !== operator) return false;
    const q = search.trim().toLowerCase();
    return !q || `${r.argus_call_id} ${r.operator_name || ''} ${r.tabulation || ''}`.toLowerCase().includes(q);
  }), [rows, status, operator, search]);

  async function runSync() {
    const windows = buildWindows(date);
    if (!windows.length) { setSync({ error: 'Ainda não há período para sincronizar (a consulta começa às 08h).' }); return; }
    const total = { fetched: 0, matched: 0, saved: 0, byResult: {}, hitLimit: false };
    try {
      for (let i = 0; i < windows.length; i++) {
        let ultimoId;
        for (let guard = 0; guard < 40; guard++) {
          setSync({ running: true, text: `Janela ${i + 1} de ${windows.length}…`, ...total });
          const r = await callFn('argus-sync-calls', session, { idCampanha: 1, periodoInicial: windows[i][0].toISOString(), periodoFinal: windows[i][1].toISOString(), ultimoId });
          total.fetched += r.fetched; total.matched += r.matched; total.saved += r.saved; total.hitLimit ||= r.hitLimit;
          for (const [k, v] of Object.entries(r.byResult)) total.byResult[k] = (total.byResult[k] || 0) + v;
          if (r.done) break;
          ultimoId = r.nextUltimoId;
        }
      }
      setSync({ done: true, ...total });
      await reload();
    } catch (e) { setSync({ error: e.message, ...total }); }
  }

  const pending = rows.filter((r) => !evalOf(r)).length;
  return <>
    <PageTitle title="Chamadas" subtitle="Ligações atendidas importadas do Argus, prontas para avaliação.">
      {canSync && <button className="primary-button" onClick={runSync} disabled={sync?.running}><RefreshCw size={14} className={sync?.running ? 'spin' : ''} /> {sync?.running ? 'Sincronizando…' : 'Sincronizar com o Argus'}</button>}
    </PageTitle>

    {sync && <div className={`notice ${sync.error ? 'error' : sync.done ? 'success' : 'info'}`}><div>
      <b>{sync.error ? 'Falha na sincronização' : sync.done ? 'Sincronização concluída' : sync.text}</b>
      <p>{sync.error ? sync.error + ' ' : ''}O Argus retornou {sync.fetched ?? 0} registros; {sync.matched ?? 0} com resultado ATENDIMENTO (gravados: {sync.saved ?? 0}).
        {sync.byResult && Object.keys(sync.byResult).length > 0 && <> Por resultado: {Object.entries(sync.byResult).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}.</>}
        {sync.hitLimit && ' Atenção: uma janela atingiu o limite de 15.000 registros; avise o suporte para reduzir o intervalo.'}</p>
    </div></div>}
    {error && <div className="notice error"><div><b>Não foi possível carregar as ligações.</b><p>{error} — rode o supabase/schema.sql atualizado no Supabase.</p></div></div>}

    <section className="panel calls-panel">
      <div className="filter-toolbar wrap">
        <div className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por ID, operador ou tabulação..." /></div>
        <label className="filter-select"><span>Dia</span><input type="date" value={date} max={todaySP()} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
        <label className="filter-select"><span>Operador</span><select value={operator} onChange={(e) => setOperator(e.target.value)}><option value="all">Todos</option>{operators.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="filter-select"><span>Avaliação</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todas</option><option value="pending">Pendentes</option><option value="reviewed">Avaliadas</option></select></label>
      </div>
      <div className="table-meta">{loading ? 'Carregando…' : `${filtered.length} de ${rows.length} ligações · ${pending} aguardando avaliação`}</div>
      {!loading && rows.length === 0 && !error ? <EmptyState icon={PhoneCall} title="Nenhuma ligação neste dia" text={canSync ? 'Clique em “Sincronizar com o Argus” para importar as ligações atendidas.' : 'Peça à Diretoria ou à Qualidade para sincronizar, ou confira se sua equipe foi vinculada.'} /> :
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Horário</th><th>Operador</th><th>Duração</th><th>Resultado</th><th>Tabulação</th><th>Avaliação</th><th /></tr></thead>
          <tbody>{filtered.map((r) => { const ev = evalOf(r); return <tr key={r.id}>
            <td>{fmtTime(r.call_started_at)}</td><td>{r.operator_name || '—'}</td><td>{fmtDuration(r.duration_seconds)}</td>
            <td><Pill tone="green">{r.call_result}</Pill></td><td>{r.tabulation || '—'}</td>
            <td>{ev ? <Pill tone={TONE[ev.result]}>{Number(ev.score).toFixed(1)} · {RESULT_LABELS[ev.result]}</Pill> : <Pill>Pendente</Pill>}</td>
            <td className="right">{canEvaluate && <button className="secondary-button small" onClick={() => setSelected(r)}>{ev ? 'Editar' : 'Avaliar'}</button>}</td>
          </tr>; })}</tbody>
        </table></div>}
    </section>
    {selected && <EvaluationModal row={selected} session={session} onClose={() => setSelected(null)} onSaved={reload} />}
  </>;
}
