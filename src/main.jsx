
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase';

import './styles.css';
import './app.css';

import { PageTitle, EmptyState } from './components.jsx';
import Overview from './pages/Overview.jsx';
import Calls from './pages/Calls.jsx';
import Operators from './pages/Operators.jsx';
import UserManagement from './pages/Users.jsx';
import { ROLE_LABELS } from './lib/format';

import {
  ChevronDown, ShieldCheck, Settings, CircleHelp, Menu, Bell, LogOut,
  CircleAlert, LockKeyhole, LayoutDashboard, PhoneCall, Users, TriangleAlert,
  FileBarChart, Search, RefreshCw, Wifi, WifiOff, X, Clock, CheckCircle2,
  AlertTriangle, Headphones, UserCog, Eye, EyeOff
} from 'lucide-react';
import {
const nav = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'calls', label: 'Chamadas', icon: PhoneCall },
  { id: 'operators', label: 'Operadores', icon: Users },
  { id: 'alerts', label: 'Alertas', icon: TriangleAlert, badge: null },
  { id: 'reports', label: 'Relatórios', icon: FileBarChart },
];

function BrandMark({ large = false }) {
  return <div className={`brand-mark${large ? ' large' : ''}`}>S</div>;
}

function Login({ login, setLogin, password, setPassword, onSubmit, error, loading, configured }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="login-page">
      <section className="login-left">
        <div className="login-brand">
          <BrandMark />
          <div><div className="brand-name">SEVENPRO</div><div className="brand-sub">MONITORIA INTELIGENTE</div></div>
        </div>
        <div className="login-pitch">
          <div className="eyebrow"><span /> PLATAFORMA CORPORATIVA</div>
          <h1>Qualidade em cada <span>conversa.</span></h1>
          <p>Centralize a monitoria, acompanhe indicadores e transforme cada atendimento em uma oportunidade de evolução.</p>
          <div className="login-feature-list">
            <div><span><Headphones size={19} /></span><div><b>Monitoria organizada</b><small>Chamadas e avaliações em um só lugar.</small></div></div>
            <div><span><ShieldCheck size={19} /></span><div><b>Acesso protegido</b><small>Permissões conforme o perfil de cada usuário.</small></div></div>
          </div>
        </div>
        <div className="login-left-footer">SEVENPRO <span>•</span> ME7 PROMOTORA</div>
        <div className="login-decoration" /><div className="login-decoration decor-two" />
      </section>
      <section className="login-right">
        <div className="mobile-login-brand"><BrandMark /><div><div className="brand-name">SEVENPRO</div><div className="brand-sub">MONITORIA INTELIGENTE</div></div></div>
        <div className="login-form-wrap">
          <div className="form-heading"><div className="form-kicker">BEM-VINDO DE VOLTA</div><h2>Acesse sua conta</h2><p>Entre com suas credenciais corporativas.</p></div>
          {!configured && <div className="notice warning"><AlertTriangle size={17} /><div><b>Configuração pendente</b><p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente do Netlify.</p></div></div>}
          {error && <div className="login-error"><CircleAlert size={16} />{error}</div>}
          <form onSubmit={onSubmit}>
            <label htmlFor="email">E-mail corporativo</label>
            <div className="input-wrap"><Users size={16} /><input id="email" type="email" autoComplete="username" placeholder="seu.email@empresa.com" value={login} onChange={e => setLogin(e.target.value)} required /></div>
            <label htmlFor="password">Senha</label>
            <div className="input-wrap"><LockKeyhole size={16} /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" className="icon-button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            <div className="form-options"><span><ShieldCheck size={12} /> Conexão protegida</span><span>Use seu acesso cadastrado</span></div>
            <button className="primary-button login-submit" type="submit" disabled={loading || !configured}>{loading ? 'Entrando...' : 'Entrar na plataforma'} <ChevronDown size={15} style={{ transform: 'rotate(-90deg)' }} /></button>
          </form>
          <div className="login-divider"><span /><small>ACESSO CORPORATIVO</small><span /></div>
          <div className="login-help"><CircleHelp size={19} /><div><b>Precisa de acesso?</b><p>Entre em contato com a Diretoria da ME7 para cadastrar ou liberar sua conta.</p></div></div>
          <p className="login-legal">O acesso é monitorado e depende das permissões vinculadas ao seu perfil.</p>
        </div>
        <div className="login-right-footer">© 2026 SEVENPRO MONITORIA</div>
      </section>
    </div>
  );
}

function Alerts() {
  return <><PageTitle title="Alertas" subtitle="Ocorrências e itens que precisam de acompanhamento." /><section className="panel"><EmptyState icon={TriangleAlert} title="Nenhum alerta carregado" text="Não há registros disponíveis para mostrar neste momento." /></section></>;
}
function Reports() {
  return <><PageTitle title="Relatórios" subtitle="Consulte os indicadores e resultados da monitoria." /><section className="panel report-placeholder"><div className="report-icon"><FileBarChart size={24}/></div><h3>Relatórios aguardando dados</h3><p>Os relatórios serão habilitados quando a base de chamadas e avaliações estiver conectada. Nenhum resultado fictício será apresentado.</p></section></>;
}
function Restricted() {
  return <div className="panel restricted"><div className="restricted-icon"><LockKeyhole size={24}/></div><h3>Acesso restrito</h3><p>Seu perfil não tem permissão para acessar esta área. Se precisar de acesso, solicite à Diretoria.</p></div>;
}
function SettingsPage({ argusStatus, onTestArgus, session }) {
  return <>
    <PageTitle title="Configurações" subtitle="Estado das integrações e do ambiente." />
    <div className="settings-grid">
      <div className="panel setting-card"><div className="setting-icon"><ShieldCheck size={20}/></div><h3>Supabase</h3><p>Autenticação e consulta do perfil conectado.</p><div className="setup-status"><i/> Autenticação utilizada nesta sessão</div></div>
      <div className="panel setting-card"><div className="setting-icon"><Headphones size={20}/></div><h3>Argus</h3><p>Teste a função de consulta de campanhas configurada no Netlify.</p><button className="secondary-button" onClick={onTestArgus} disabled={argusStatus.loading}>{argusStatus.loading ? <RefreshCw size={14}/> : <Wifi size={14}/>} {argusStatus.loading ? 'Testando...' : 'Testar conexão'}</button><div className="setup-status"><i style={{background:argusStatus.connected ? '#3bc98b' : '#e8ad50'}}/> {argusStatus.message}</div></div>
      <div className="panel setting-card"><div className="setting-icon"><LockKeyhole size={20}/></div><h3>Permissões</h3><p>O acesso administrativo é concedido conforme o perfil registrado no Supabase.</p><div className="setup-status"><i/> Perfil: Diretoria</div></div>
    </div>
    <div className="notice warning"><AlertTriangle size={18}/><div><b>Integração de gravações</b><p>A consulta de campanhas é testada por esta tela. A listagem de gravações ainda requer a função e o formato de resposta confirmados do Argus.</p></div></div>
  </>;
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState('overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [mobileNav, setMobileNav] = useState(false);
  const [realData, setRealData] = useState(null);
  const [dataError, setDataError] = useState('');
  const [argusStatus, setArgusStatus] = useState({loading:false, connected:false, message:'Conexão ainda não testada.'});
  const [argusCampaigns, setArgusCampaigns] = useState([]);

  useEffect(() => {
    let mounted = true;
    if (!supabase) { setAuthReady(true); return undefined; }
    supabase.auth.getSession().then(({data,error}) => {
      if (!mounted) return;
      if (error) setLoginError('Não foi possível recuperar a sessão.');
      setSession(data?.session ?? null);
      setAuthReady(true);
    }).catch(() => {
      if (mounted) { setLoginError('Falha ao verificar a sessão. Confira a configuração do Supabase.'); setAuthReady(true); }
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setRealData(null);
      setDataError('');
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setRealData(null); setDataError('');
      if (!session || !supabase) return;
      try {
        const {data,error} = await supabase.from('profiles').select('display_name, role, manager_id, supervisor_id, active').eq('id',session.user.id).single();
        if (cancelled) return;
        if (error || !data) { setDataError('Não foi possível carregar seu perfil. Confira o cadastro na tabela profiles e as permissões (RLS) do Supabase.'); return; }
        if (!data.active) { setLoginError('Conta desativada. Entre em contato com a Diretoria.'); await supabase.auth.signOut(); return; }
        setRealData(data);
      } catch {
        if (!cancelled) setDataError('Falha ao consultar o perfil. Tente novamente.');
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [session]);

  async function checkArgus() {
    if (!session || !realData || realData.role !== 'director' || !realData.active) {
      setArgusStatus({loading:false,connected:false,message:'A consulta está disponível somente para a Diretoria.'});
      setArgusCampaigns([]);
      return;
    }
    setArgusStatus({loading:true,connected:false,message:'Testando a conexão com o Argus...'});
    try {
      const response = await fetch('/.netlify/functions/argus-list-campaigns',{method:'GET',headers:{Authorization:'Bearer '+session.access_token}});
      let result;
      try { result = await response.json(); } catch { throw new Error('O servidor retornou uma resposta inválida.'); }
      if (!response.ok) throw new Error(result?.error || `Falha na consulta ao Argus. Código HTTP: ${response.status}`);
      const payload = result?.data ?? result;
      const campaigns = Array.isArray(payload?.campanhas) ? payload.campanhas : Array.isArray(payload?.data?.campanhas) ? payload.data.campanhas : [];
      setArgusCampaigns(campaigns);
      setArgusStatus({loading:false,connected:true,message:campaigns.length ? `Conexão validada. ${campaigns.length} campanha(s) retornada(s).` : 'O servidor respondeu, mas nenhuma campanha foi retornada.'});
    } catch(error) {
      setArgusStatus({loading:false,connected:false,message:error?.message || 'Não foi possível consultar o servidor do Argus.'});
      setArgusCampaigns([]);
    }
  }

  async function handleLogin(event) {
    event.preventDefault(); setLoginError('');
    if (!supabase) { setLoginError('O sistema ainda não foi configurado. Confira VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify.'); return; }
    setLoading(true);
    try {
      const {error} = await supabase.auth.signInWithPassword({email:login.trim(),password});
      if (error) setLoginError('Não foi possível entrar. Confira suas credenciais ou procure a Diretoria.');
    } catch { setLoginError('Falha de conexão durante o login.'); }
    finally { setLoading(false); }
  }
  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setRealData(null); setArgusCampaigns([]); setDataError('');
  }

  if (!authReady) return <div className="loading-screen"><BrandMark/><span>Preparando ambiente seguro...</span></div>;
  if (!session) return <Login login={login} setLogin={setLogin} password={password} setPassword={setPassword} onSubmit={handleLogin} error={loginError} loading={loading} configured={!!supabase}/>;

  const role = realData?.role || 'pending';
  const roleLabel = ROLE_LABELS[role] || 'Acesso pendente';
  const visibleNav = nav;
  const pageLabel = visibleNav.find(item => item.id === page)?.label || ({users:'Gestão de usuários',settings:'Configurações'})[page] || 'Visão geral';

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><BrandMark/><div><div className="brand-name">SEVENPRO</div><div className="brand-sub">MONITORIA INTELIGENTE</div></div><button className="close-nav" aria-label="Fechar menu" onClick={() => setMobileNav(false)}><X size={20}/></button></div>
      <div className="workspace"><span className="workspace-dot"/><div><b>ME7 Promotora</b><small>Ambiente corporativo</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">MENU PRINCIPAL</div>
      <nav>{visibleNav.map(item => <button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={() => {setPage(item.id);setMobileNav(false);}}><item.icon size={18}/><span>{item.label}</span></button>)}</nav>
      {role === 'director' && <><div className="nav-label management-label">ADMINISTRAÇÃO</div><button className={`nav-item ${page==='users'?'active':''}`} onClick={() => {setPage('users');setMobileNav(false);}}><ShieldCheck size={18}/><span>Gestão de usuários</span></button><button className={`nav-item ${page==='settings'?'active':''}`} onClick={() => {setPage('settings');setMobileNav(false);}}><Settings size={18}/><span>Configurações</span></button></>}
      <div className="sidebar-bottom"><div className="secure-card"><div className="secure-icon"><ShieldCheck size={17}/></div><div><b>Ambiente protegido</b><small>Acesso monitorado</small></div><span className="online-dot"/></div><button className="nav-item help-item" onClick={() => alert('Para suporte, procure a Diretoria da ME7.')}><CircleHelp size={18}/><span>Central de ajuda</span></button><div className="sidebar-version">SEVENPRO MONITORIA <span>v0.2 • MVP</span></div></div>
    </aside>
    {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)}/>}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" aria-label="Abrir menu" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumbs"><span>SEVENPRO</span><b>/</b><strong>{pageLabel}</strong></div><div className="top-actions"><div className="system-status"><span/>Sistema operacional</div><button className="icon-button" aria-label="Notificações" title="Notificações"><Bell size={18}/><i/></button><div className="top-divider"/><div className="user-chip"><div className="user-avatar">{(realData?.display_name || session.user.email || 'U').slice(0,1).toUpperCase()}</div><div className="user-meta"><b>{realData?.display_name || session.user.email}</b><small>{roleLabel}</small></div><button className="logout-button" onClick={logout} title="Sair" aria-label="Sair"><LogOut size={16}/></button></div></div></header>
      <section className="content-area">
        {dataError && <div className="notice error"><CircleAlert size={17}/><div>{dataError}</div></div>}
        {role==='pending' && <div className="notice error"><LockKeyhole size={18}/><div><b>Seu perfil ainda não está autorizado.</b><p>Peça à Diretoria para concluir seu cadastro e definir sua hierarquia. Nenhum dado de monitoria será exibido até a validação do perfil.</p></div></div>}
        {page==='overview' && <Overview setPage={setPage}/>}
        {page==='calls' && <Calls session={session} role={role}/>}
        {page==='operators' && <Operators session={session} role={role}/>}
        {page==='alerts' && <Alerts/>}
        {page==='reports' && <Reports/>}
        {page==='users' && (role==='director' ? <UserManagement session={session}/> : <Restricted/>)}
        {page==='settings' && (role==='director' ? <SettingsPage argusStatus={argusStatus} onTestArgus={checkArgus} session={session}/> : <Restricted/>)}
        <footer className="page-footer"><span>© 2026 SEVENPRO MONITORIA</span><span><ShieldCheck size={13}/>Dados protegidos • Acesso conforme permissões</span></footer>
      </section>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

const NAV=[['overview','Visão geral',LayoutDashboard],['calls','Ligações',PhoneCall],['operators','Operadores',Users],['alerts','Alertas',TriangleAlert],['reports','Relatórios',FileBarChart]];
const localDate=d=>{const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
function dateWindow(){const now=new Date(), start=new Date(now);start.setHours(8,0,0,0);const end=new Date(now);end.setHours(Math.min(18,now.getHours()),now.getHours()>=18?0:now.getMinutes(),0,0);if(now.getHours()<8)end.setHours(8,0,0,0);return {from:localDate(start),to:localDate(end)}}
function toIso(date,hour,minute=0){return `${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00-03:00`}
function getCallId(c){return String(c.idLigacao??c.argus_call_id??c.id??'')}
function getOperator(c){return c.usuarioOperador??c.nomeUsuario??c.operator_name??'Não identificado'}
function getStart(c){return c.dataHoraLigacao??c.call_started_at??c.dataHora??null}
function getDuration(c){return Number(c.tempoSegundos??c.duration_seconds??0)}
function getResult(c){return String(c.resultadoLigacao??c.call_result??c.tabulacao??'Sem resultado')}
function isAttended(c){return /ATENDIMENTO|ATENDIDA|ATENDIDO|CONCLU[IÍ]D/i.test(getResult(c))}
function fmtDate(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(+d)?String(v):d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}
function fmtDuration(n){n=Math.max(0,Number(n)||0);return `${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`}
function App(){
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[authReady,setAuthReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[loginError,setLoginError]=useState(''),[busy,setBusy]=useState(false);
 const [page,setPage]=useState('overview'),[mobile,setMobile]=useState(false),[calls,setCalls]=useState([]),[reviews,setReviews]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[meta,setMeta]=useState(null),[campaign,setCampaign]=useState('1');
 const win=dateWindow();const [from,setFrom]=useState(win.from),[to,setTo]=useState(win.to),[operator,setOperator]=useState('Todos'),[resultFilter,setResultFilter]=useState('Todos'),[reviewFilter,setReviewFilter]=useState('Todos'),[severityFilter,setSeverityFilter]=useState('Todas'),[search,setSearch]=useState('');
 const [selected,setSelected]=useState(null),[audio,setAudio]=useState(''),[audioBusy,setAudioBusy]=useState(false),[reviewBusy,setReviewBusy]=useState(false),[reviewForm,setReviewForm]=useState({outcome:'approved',score:100,notes:'',identity:true,clear:true,consent:true,noMisleading:true,respect:true,closure:true});
 const [argusStatus,setArgusStatus]=useState('');
 useEffect(()=>{if(!supabase){setAuthReady(true);return}let mounted=true;supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setAuthReady(true)}}).catch(()=>setAuthReady(true));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);setProfile(null);setCalls([]);setReviews([])});return()=>{mounted=false;subscription.unsubscribe()}},[]);
 useEffect(()=>{if(!session||!supabase)return;let live=true;(async()=>{const {data,error}=await supabase.from('profiles').select('display_name,role,active').eq('id',session.user.id).single();if(!live)return;if(error||!data){setError('Perfil não localizado. Confira profiles e as políticas RLS do Supabase.');return}if(!data.active){await supabase.auth.signOut();setLoginError('Conta desativada.');return}setProfile(data);})().catch(()=>setError('Não foi possível carregar o perfil.'));return()=>{live=false}},[session]);
 const api=useCallback(async(path,params={})=>{if(!session)throw new Error('Sua sessão expirou. Entre novamente.');const u=new URL(path,window.location.origin);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});const r = await fetch(u.pathname + u.search, {
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});

const raw = await r.text();
let d = {};

try {
  d = raw ? JSON.parse(raw) : {};
} catch {
  d = { error: raw || 'Resposta vazia do servidor' };
}

if (!r.ok) {
  const message =
    typeof d.error === 'string'
      ? d.error
      : typeof d.message === 'string'
        ? d.message
        : `Erro HTTP ${r.status}`;

  throw new Error(`${message} (HTTP ${r.status})`);
}
return d;
}, [session]);
const loadReviews = useCallback(async () => {
  if (!supabase || !session) return;

  const { data, error } = await supabase
    .from('monitoring_reviews')
    .select('*')
    .order('reviewed_at', { ascending: false })
    .limit(3000);

  if (error) {
    console.error('Erro ao carregar avaliações:', error.message);
    setError(`Não foi possível carregar as avaliações: ${error.message}`);
    return;
  }

  setReviews(data || []);
}, [session]);

const loadCalls = useCallback(async () => {
  if (!session || profile?.role !== 'director') return;

  setLoading(true);
  setError('');
  setAudio('');

  try {
    const start = toIso(from, 8, 0);
    const now = new Date();

    let endHour = 18;
    let endMinute = 0;

    if (to === localDate(now) && now.getHours() < 18) {
      endHour = Math.max(8, now.getHours());
      endMinute = now.getHours() < 8 ? 0 : now.getMinutes();
    }

    const end = toIso(to, endHour, endMinute);

    const data = await api(
      '/.netlify/functions/argus-list-detailed-calls',
      {
        idCampanha: campaign,
        periodoInicial: start,
        periodoFinal: end
      }
    );

    if (!data || !Array.isArray(data.data)) {
      throw new Error(
        data?.error ||
        'O Argus respondeu, mas não retornou uma lista válida de ligações.'
      );
    }

    const rows = data.data;

    setCalls(rows);
    setMeta(data.meta || null);
    setArgusStatus(
      `Consulta concluída · ${rows.length} ligação(ões) retornada(s)`
    );

    await loadReviews();
  } catch (e) {
    console.error('Erro ao consultar ligações:', e);

    setError(
      e?.message ||
      'Não foi possível consultar as ligações. Tente novamente.'
    );

    setArgusStatus('Falha na consulta');
  } finally {
    setLoading(false);
  }
}, [session, profile, from, to, campaign, api, loadReviews]);

useEffect(() => {
  if (profile?.role === 'director') {
    loadCalls();
  }
}, [profile?.role, loadCalls]);
 const filtered = useMemo(() => {
  return calls.filter(c => {
    const op = getOperator(c);
    const res = getResult(c);
    const id = getCallId(c);

    const rev = reviews.find(
      r =>
        String(r.argus_call_id) === id &&
        Number(r.campaign_id) === Number(campaign)
    );

    const status = rev?.outcome || 'pending';

    const text = normalizeText(
      [id, op, res, c.nrLead, c.tabulacao].join(' ')
    );

    const matchesOperator =
      operator === 'Todos' || op === operator;

    const matchesResult =
      resultFilter === 'Todos' ||
      (resultFilter === 'Atendidas'
        ? isAttended(c)
        : normalizeText(res).includes(normalizeText(resultFilter)));

    const matchesReview =
      reviewFilter === 'Todos' ||
      (reviewFilter === 'Pendentes'
        ? status === 'pending'
        : reviewFilter === 'Avaliadas'
          ? status !== 'pending'
          : status === reviewFilter);

    const matchesSearch =
      text.includes(normalizeText(search));

    return (
      matchesOperator &&
      matchesResult &&
      matchesReview &&
      matchesSearch
    );
  });
}, [
  calls,
  reviews,
  campaign,
  operator,
  resultFilter,
  reviewFilter,
  search
]);

const alerts = useMemo(
  () => calls.flatMap(scanCall),
  [calls]
);
 const operators=useMemo(()=>[...new Set(calls.map(getOperator))].sort(),[calls]);
 const stats=useMemo(()=>({total:calls.length,attended:calls.filter(isAttended).length,reviewed:reviews.filter(r=>Number(r.campaign_id)===Number(campaign)&&calls.some(c=>getCallId(c)===r.argus_call_id)).length,operators:operators.length}),[calls,reviews,campaign,operators]);
 async function login(e){e.preventDefault();setLoginError('');if(!supabase){setLoginError('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');return}setBusy(true);const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)setLoginError('Não foi possível entrar. Confira e-mail e senha.');setBusy(false)}
 async function logout(){await supabase?.auth.signOut();setSession(null);setProfile(null)}
 async function openCall(c){setSelected(c);setAudio('');const id=getCallId(c);const old=reviews.find(r=>r.argus_call_id===id&&Number(r.campaign_id)===Number(campaign));setReviewForm(old?{outcome:old.outcome,score:old.score??100,notes:old.notes||'',...(old.criteria||{})}:{outcome:'approved',score:100,notes:'',identity:true,clear:true,consent:true,noMisleading:true,respect:true,closure:true})}
 async function playAudio(c){setAudioBusy(true);setAudio('');try{const d=await api('/.netlify/functions/argus-download-recording',{idCampanha:campaign,idLigacao:getCallId(c),formato:'MP3'});const mime=(d.formato||'MP3').toUpperCase()==='WAV'?'audio/wav':'audio/mpeg';setAudio(`data:${mime};base64,${d.arquivoBase64}`)}catch(e){setError(e.message)}finally{setAudioBusy(false)}}


async function saveReview() {
  if (!selected || !supabase || !session) return;

  setReviewBusy(true);
  setError('');

  try {
    const id = getCallId(selected);

    const payload = {
      argus_call_id: id,
      campaign_id: Number(campaign),
      call_started_at: getStart(selected)
        ? new Date(getStart(selected)).toISOString()
        : null,
      operator_name: getOperator(selected),
      outcome: reviewForm.outcome,
      score: Number(reviewForm.score),
      criteria: {
        identity: !!reviewForm.identity,
        clear: !!reviewForm.clear,
        consent: !!reviewForm.consent,
        noMisleading: !!reviewForm.noMisleading,
        respect: !!reviewForm.respect,
        closure: !!reviewForm.closure
      },
      notes: reviewForm.notes,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('monitoring_reviews')
      .upsert(payload, {
        onConflict: 'campaign_id,argus_call_id'
      });

    if (error) {
      setError(
        `Não foi possível salvar a avaliação: ${error.message}. Verifique as permissões e a restrição única no banco.`
      );
      return;
    }

    await loadReviews();
    setSelected(null);
  } catch (err) {
    setError(
      `Erro ao salvar avaliação: ${err.message || 'erro inesperado'}.`
    );
  } finally {
    setReviewBusy(false);
  }
}

 async function testArgus(){try{setArgusStatus('Testando…');const d=await api('/.netlify/functions/argus-list-campaigns');const list=d.data?.campanhas||[];setArgusStatus(`Conexão OK · ${list.length} campanha(s)`)}catch(e){setArgusStatus(e.message)}}
 if(!authReady)return <div className="loading-screen"><div className="brand-mark">S</div>Preparando ambiente seguro…</div>;
 if(!session)return <div className="login-page"><section className="login-left"><div className="login-brand"><div className="brand-mark">S</div><div><div className="brand-name">SEVENPRO</div><div className="brand-sub">MONITORIA INTELIGENTE</div></div></div><div className="login-pitch"><div className="eyebrow">PLATAFORMA CORPORATIVA</div><h1>Qualidade em cada <span>conversa.</span></h1><p>Central de ligações, avaliação de atendimento e acompanhamento de qualidade da ME7.</p></div><div className="login-left-footer">SEVENPRO • ME7 PROMOTORA</div></section><section className="login-right"><div className="login-form-wrap"><div className="form-heading"><div className="form-kicker">ACESSO CORPORATIVO</div><h2>Acesse sua conta</h2><p>Entre com seu usuário cadastrado no Supabase.</p></div>{(!supabase||loginError)&&<div className="notice warning">{loginError||'Configure as variáveis públicas do Supabase para habilitar o login.'}</div>}<form onSubmit={login}><label>E-mail</label><div className="input-wrap"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="seu.email@empresa.com"/></div><label>Senha</label><div className="input-wrap"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Sua senha"/></div><button className="primary-button login-submit" disabled={busy||!supabase}>{busy?'Entrando…':'Entrar na plataforma'} <ChevronRight size={16}/></button></form><p className="login-legal">Acesso conforme perfil e permissões configuradas pela Diretoria.</p></div></section></div>;
 const role=profile?.role||'pending';const navPage=NAV.find(n=>n[0]===page)?.[1]||'Configurações';
 const callRows=(rows)=>rows.map(c=>{const id=getCallId(c),rev=reviews.find(r=>r.argus_call_id===id&&Number(r.campaign_id)===Number(campaign));return <tr key={id||`${getStart(c)}-${getOperator(c)}`}><td className="call-id">#{id||'—'}</td><td><b>{getOperator(c)}</b><small>{c.idUsuario?`Operador ${c.idUsuario}`:''}</small></td><td>{fmtDate(getStart(c))}</td><td>{fmtDuration(getDuration(c))}</td><td><span className={`pill ${isAttended(c)?'green':'neutral'}`}>{getResult(c)}</span></td><td><span className={`pill ${rev?'green':'amber'}`}>{rev?({approved:'Aprovada',coaching:'Orientação',critical:'Crítica'}[rev.outcome]||rev.outcome):'Pendente'}</span></td><td><button className="icon-action" onClick={()=>openCall(c)} title="Abrir ligação"><Eye size={16}/></button></td></tr>});
 const title=(heading,sub,actions)=><div className="page-title-row"><div><div className="section-eyebrow">SEVENPRO MONITORIA · ME7</div><h1>{heading}</h1><p>{sub}</p></div><div className="title-actions">{actions}</div></div>;
 const filters=<div className="filter-toolbar"><div className="filter-field"><CalendarDays size={14}/><label>De <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label></div><div className="filter-field"><label>Até <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div><label className="filter-field">Campanha <select value={campaign} onChange={e=>setCampaign(e.target.value)}><option value="1">ME7 MATRIZ (1)</option></select></label><button className="primary-button small" onClick={loadCalls} disabled={loading}><RefreshCw size={14}/>{loading?'Consultando…':'Consultar Argus'}</button></div>;
 const table=<div className="table-scroll"><table className="calls-table"><thead><tr><th>ID LIGAÇÃO</th><th>OPERADOR</th><th>DATA / HORA</th><th>DURAÇÃO</th><th>RESULTADO ARGUS</th><th>MONITORIA</th><th>AÇÃO</th></tr></thead><tbody>{filtered.length?callRows(filtered):<tr><td colSpan="7"><div className="empty-state"><PhoneCall size={25}/><b>{loading?'Carregando ligações reais…':'Nenhuma ligação encontrada'}</b><span>{loading?'Aguardando resposta do Argus.':'Altere os filtros ou consulte o Argus. Nenhum dado fictício é exibido.'}</span></div></td></tr>}</tbody></table></div>;
 if(role!=='director'&&profile)return <div className="restricted"><ShieldCheck size={32}/><h2>Acesso restrito</h2><p>Este módulo de integração está liberado para Diretoria. Solicite a configuração de permissões para seu perfil.</p><button className="secondary-button" onClick={logout}>Sair</button></div>;
 return (
  <div className="app-shell"><aside className={`sidebar ${mobile?'open':''}`}><div className="brand"><div className="brand-mark">S</div><div><div className="brand-name">SEVENPRO</div><div className="brand-sub">MONITORIA INTELIGENTE</div></div><button className="close-nav" onClick={()=>setMobile(false)}><X/></button></div><div className="workspace"><span className="workspace-dot"/><div><b>ME7 Promotora</b><small>Ambiente corporativo</small></div></div><div className="nav-label">MENU PRINCIPAL</div><nav>{NAV.map(([id,label,Icon])=><button key={id} className={`nav-item ${page===id?'active':''}`} onClick={()=>{setPage(id);setMobile(false)}}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="nav-label management-label">ADMINISTRAÇÃO</div><button className={`nav-item ${page==='settings'?'active':''}`} onClick={()=>setPage('settings')}><Settings size={18}/><span>Configurações</span></button><div className="sidebar-bottom"><div className="secure-card"><ShieldCheck size={18}/><div><b>Ambiente protegido</b><small>Dados reais · sem demonstração</small></div></div><div className="sidebar-version">SEVENPRO MONITORIA <span>v1.0 · Argus + Supabase</span></div></div></aside>{mobile&&<div className="nav-scrim" onClick={()=>setMobile(false)}/>}<main className="main-area"><header className="topbar"><button className="mobile-menu" onClick={()=>setMobile(true)}><Menu/></button><div className="breadcrumbs">SEVENPRO <b>/</b> <strong>{navPage}</strong></div><div className="top-actions"><div className="system-status"><span/>{argusStatus||'Integração pronta para consulta'}</div><div className="top-divider"/><div className="user-chip"><div className="user-avatar">{(profile?.display_name||session.user.email||'U')[0].toUpperCase()}</div><div className="user-meta"><b>{profile?.display_name||session.user.email}</b><small>Diretoria</small></div><button className="logout-button" onClick={logout} title="Sair"><LogOut size={16}/></button></div></div></header><section className="content-area">
 {error&&<div className="notice error"><AlertCircle size={17}/><div>{error}</div><button className="text-button" onClick={()=>setError('')}>Fechar</button></div>}
 {page==='overview'&&<>{title('Visão geral','Indicadores calculados a partir das ligações reais retornadas pelo Argus.',<button className="primary-button small" onClick={loadCalls} disabled={loading}><RefreshCw size={14}/>{loading?'Atualizando…':'Atualizar dados'}</button>)}{filters}<div className="metrics-grid">{[['Ligações no período',stats.total,PhoneCall,'red'],['Atendimentos',stats.attended,Headphones,'green'],['Operadores',stats.operators,Users,'purple'],['Avaliações registradas',stats.reviewed,CheckCircle2,'amber']].map(([label,val,Icon,color])=><div className="metric-card" key={label}><div className="metric-top"><span>{label}</span><span className={`metric-icon ${color}`}><Icon size={18}/></span></div><div className="metric-value">{val}</div><div className="metric-bottom">Fonte: Argus / Supabase</div></div>)}</div><div className="dashboard-grid"><section className="panel quality-panel"><div className="panel-heading"><div><h3>Ligações recentes</h3><p>Últimos registros retornados pela API</p></div><button className="text-button" onClick={()=>setPage('calls')}>Ver todas →</button></div><div className="table-scroll"><table className="calls-table"><thead><tr><th>ID</th><th>OPERADOR</th><th>DATA</th><th>RESULTADO</th><th></th></tr></thead><tbody>{calls.slice(0,6).map(c=><tr key={getCallId(c)}><td>#{getCallId(c)}</td><td>{getOperator(c)}</td><td>{fmtDate(getStart(c))}</td><td>{getResult(c)}</td><td><button className="icon-action" onClick={()=>openCall(c)}><Eye size={15}/></button></td></tr>)}</tbody></table>{!calls.length&&<div className="empty-state">Consulte o Argus para carregar ligações reais.</div>}</div></section><section className="panel alerts-panel"><div className="panel-heading"><div><h3>Alertas de transcrição</h3><p>Correspondências em texto disponível</p></div><button className="text-button" onClick={()=>setPage('alerts')}>Ver alertas</button></div><div className="metric-value">{alerts.length}</div><p className="muted">A análise por palavras-chave só ocorre quando a API fornece transcrição. Uma ocorrência exige revisão humana e não comprova irregularidade.</p></section></div></>}
 {page==='calls'&&<>{title('Central de ligações','Consulte registros do Argus, abra detalhes, reproduza gravações e avalie o atendimento.',<button className="secondary-button" onClick={testArgus}>Testar API</button>)}{filters}<div className="panel"><div className="filter-toolbar"><div className="search-box"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar ID, operador, tabulação…"/></div><label className="filter-field"><Filter size={14}/><select value={operator} onChange={e=>setOperator(e.target.value)}><option>Todos</option>{operators.map(o=><option key={o}>{o}</option>)}</select></label><label className="filter-field"><select value={resultFilter} onChange={e=>setResultFilter(e.target.value)}><option>Todos</option><option>Atendidas</option><option>Não ATENDE</option><option>OCUPADO</option><option>CAIXA POSTAL / MSG</option><option>NÃO COMPLETADA</option></select></label><label className="filter-field"><select value={reviewFilter} onChange={e=>setReviewFilter(e.target.value)}><option>Todos</option><option>Pendentes</option><option>Avaliadas</option><option value="critical">Crítica</option><option value="coaching">Orientação</option><option value="approved">Aprovada</option></select></label></div><div className="table-scroll">{table}</div><div className="panel-footer">{filtered.length} registro(s) exibido(s) {meta?.capped?'· Atenção: limite de páginas alcançado.':''}</div></div></>}
 {page==='operators'&&<>{title('Operadores','Volume de ligações por operador no período consultado.')}{filters}<div className="panel table-scroll"><table className="calls-table"><thead><tr><th>OPERADOR</th><th>LIGAÇÕES</th><th>ATENDIDAS</th><th>AVALIAÇÕES</th><th>NOTA MÉDIA</th></tr></thead><tbody>{operators.map(op=>{const cs=calls.filter(c=>getOperator(c)===op),rs=reviews.filter(r=>r.operator_name===op&&Number(r.campaign_id)===Number(campaign));return <tr key={op}><td><b>{op}</b></td><td>{cs.length}</td><td>{cs.filter(isAttended).length}</td><td>{rs.length}</td><td>{rs.length?Math.round(rs.reduce((a,r)=>a+(r.score||0),0)/rs.length):'—'}</td></tr>})}</tbody></table>{!operators.length&&<div className="empty-state">Consulte o Argus para visualizar operadores reais.</div>}</div></>}
 {page==='alerts'&&<>{title('Alertas de monitoria','Palavras-chave localizadas somente em transcrições disponíveis. Revise o contexto antes de classificar uma ocorrência.')}{filters}<div className="notice warning"><TriangleAlert size={17}/><div>Uma palavra pode aparecer em contexto legítimo, como negação, explicação ou relato do cliente. As correspondências abaixo são alertas preliminares, não conclusões automáticas.</div></div><div className="panel table-scroll"><table className="calls-table"><thead><tr><th>GRAVIDADE</th><th>CATEGORIA</th><th>EXPRESSÃO</th><th>OPERADOR</th><th>CONTEXTO</th><th>LIGAÇÃO</th></tr></thead><tbody>{alerts.filter(a=>(severityFilter==='Todas'||a.severity===severityFilter)&&(!search||normalizeText(`${a.word} ${a.operator} ${a.context}`).includes(normalizeText(search)))).map((a,i)=><tr key={`${a.callId}-${i}`}><td><span className={`pill ${a.severity==='Crítica'?'red':'amber'}`}>{a.severity}</span></td><td>{a.category}</td><td><b>{a.word}</b></td><td>{a.operator}</td><td className="context-cell">{a.context}</td><td>#{a.callId}</td></tr>)}</tbody></table>{!alerts.length&&<div className="empty-state"><TriangleAlert size={25}/><b>Nenhuma ocorrência em transcrições carregadas</b><span>O relatório de ligações nem sempre contém transcrição. Sem áudio transcrito, não é possível detectar o que foi dito.</span></div>}</div></>}
 {page==='reports'&&<>{title('Relatórios de qualidade','Indicadores calculados com os dados reais carregados e avaliações salvas.')}{filters}<div className="metrics-grid">{[['Ligações consultadas',stats.total],['Atendidas',stats.attended],['Taxa de atendimento',stats.total?`${Math.round(stats.attended/stats.total*100)}%`:'—'],['Avaliações',stats.reviewed]].map(([l,v])=><div className="metric-card" key={l}><div className="metric-top">{l}</div><div className="metric-value">{v}</div></div>)}</div><div className="panel table-scroll"><table className="calls-table"><thead><tr><th>OPERADOR</th><th>LIGAÇÕES</th><th>ATENDIDAS</th><th>AVALIADAS</th><th>NOTA MÉDIA</th><th>CRÍTICAS</th></tr></thead><tbody>{operators.map(op=>{const cs=calls.filter(c=>getOperator(c)===op),rs=reviews.filter(r=>r.operator_name===op&&Number(r.campaign_id)===Number(campaign));return <tr key={op}><td>{op}</td><td>{cs.length}</td><td>{cs.filter(isAttended).length}</td><td>{rs.length}</td><td>{rs.length?Math.round(rs.reduce((a,r)=>a+(r.score||0),0)/rs.length):'—'}</td><td>{rs.filter(r=>r.outcome==='critical').length}</td></tr>})}</tbody></table></div><button className="secondary-button" onClick={()=>{const rows=[['Operador','Ligações','Atendidas','Avaliações','Nota média','Críticas'],...operators.map(op=>{const cs=calls.filter(c=>getOperator(c)===op),rs=reviews.filter(r=>r.operator_name===op&&Number(r.campaign_id)===Number(campaign));return [op,cs.length,cs.filter(isAttended).length,rs.length,rs.length?Math.round(rs.reduce((a,r)=>a+(r.score||0),0)/rs.length):'',rs.filter(r=>r.outcome==='critical').length]})];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\\r\\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));a.download='relatorio-monitoria-me7.csv';a.click();URL.revokeObjectURL(a.href)}}><Download size={15}/> Exportar CSV</button></>}
 
{page === 'settings' && (
  <>
    {title(
      'Configurações',
      'Diagnóstico das integrações e variáveis do ambiente.'
    )}

    <div className="settings-grid">
      <div className="panel setting-card">
        <ShieldCheck />
        <h3>Supabase</h3>
        <p>Autenticação e persistência das avaliações.</p>
        <div className="setup-status">
          {supabase
            ? 'Cliente configurado'
            : 'Variáveis VITE_SUPABASE ausentes'}
        </div>
      </div>

      <div className="panel setting-card">
        <Headphones />
        <h3>Argus</h3>
        <p>Consulta de campanhas e relatórios detalhados.</p>
        <button className="secondary-button" onClick={testArgus}>
          Testar conexão
        </button>
        <div className="setup-status">
          {argusStatus || 'Ainda não testado'}
        </div>
      </div>

      <div className="panel setting-card">
        <DatabaseIcon />
        <h3>Persistência</h3>
        <p>As avaliações são salvas em monitoring_reviews.</p>
        <button className="secondary-button" onClick={loadReviews}>
          Recarregar avaliações
        </button>
        <div className="setup-status">
          {reviews.length} avaliação(ões) carregada(s)
        </div>
      </div>
    </div>

    <div className="notice warning">
      As avaliações são armazenadas no Supabase existente.
      Se houver falha ao salvar, verifique as permissões de acesso e a
      restrição única de campaign_id e argus_call_id.
      Faça backup antes de qualquer alteração no banco.
    </div>
  </>
)}
<footer className="page-footer">
  <span>© 2026 SEVENPRO MONITORIA</span>
  <span>
    <ShieldCheck size={13} />
    Dados reais · Acesso conforme permissões
  </span>
</footer>
</section>
</main>

{selected && (
  <div
    className="modal-backdrop"
    onClick={() => setSelected(null)}
  >
    {/* Mantenha aqui o conteúdo completo do modal existente */}
  </div>
)}
</div>
);
}

