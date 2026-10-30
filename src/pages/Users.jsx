import React, { useEffect, useState } from 'react';
import { PageTitle, Pill } from '../components.jsx';
import { supabase } from '../supabase';
import { callFn } from '../lib/api';
import { ROLE_LABELS } from '../lib/format';

const empty = { display_name: '', email: '', role: 'supervisor', password: '', manager_id: '', mode: 'password', confirm_create_director: false };

export default function UserManagement({ session }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function load() {
    const { data } = await supabase.from('profiles').select('id, display_name, role, active, manager_id').order('display_name');
    setUsers(data || []);
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await callFn('director-create-user', session, { ...form, manager_id: form.manager_id || null });
      setMsg({ ok: true, text: r.message }); setForm(empty); load();
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  }
  const managers = users.filter((u) => u.role === 'manager' && u.active);

  return <>
    <PageTitle title="Gestão de usuários" subtitle="Crie acessos e defina o cargo de cada pessoa." />
    {msg && <div className={`notice ${msg.ok ? 'success' : 'error'}`}><div>{msg.text}</div></div>}
    <section className="panel form-panel">
      <div className="panel-heading"><div><h3>Novo usuário</h3><p>Com senha temporária, a conta já nasce pronta — não depende de e-mail.</p></div></div>
      <form onSubmit={submit} className="user-form">
        <label>Nome<input required value={form.display_name} onChange={(e) => set('display_name', e.target.value)} /></label>
        <label>E-mail<input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label>Cargo<select value={form.role} onChange={(e) => set('role', e.target.value)}>{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Como criar<select value={form.mode} onChange={(e) => set('mode', e.target.value)}><option value="password">Senha temporária</option><option value="invite">Convite por e-mail</option></select></label>
        {form.mode === 'password' && <label>Senha temporária<input required minLength={8} type="text" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="mínimo 8 caracteres" /></label>}
        {form.role === 'supervisor' && <label>Gerente<select required value={form.manager_id} onChange={(e) => set('manager_id', e.target.value)}><option value="">Selecione…</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></label>}
        {form.role === 'director' && <label className="check"><input type="checkbox" checked={form.confirm_create_director} onChange={(e) => set('confirm_create_director', e.target.checked)} />Confirmo criar outra conta de Diretoria</label>}
        <div><button className="primary-button" disabled={busy}>{busy ? 'Criando…' : 'Criar usuário'}</button></div>
      </form>
    </section>
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Nome</th><th>Cargo</th><th>Situação</th></tr></thead>
        <tbody>{users.map((u) => <tr key={u.id}><td>{u.display_name || '—'}</td><td>{ROLE_LABELS[u.role] || u.role}</td><td><Pill tone={u.active ? 'green' : 'red'}>{u.active ? 'Ativo' : 'Inativo'}</Pill></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
