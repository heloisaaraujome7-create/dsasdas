-- SEVENPRO MONITORIA — esquema completo e idempotente.
-- Pode ser executado várias vezes no SQL Editor do Supabase sem apagar dados.
-- Se as tabelas profiles e call_records já existem, apenas as colunas/políticas que faltam são adicionadas.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────── Perfis de usuário ─────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'supervisor',
  manager_id uuid,
  supervisor_id uuid,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists manager_id uuid;
alter table public.profiles add column if not exists supervisor_id uuid;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists created_by uuid;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- Libera os novos cargos (remove restrições antigas sobre "role" e recria).
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%role%' loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role in ('director','manager','supervisor','quality','backoffice','aftersales','hr','admin')) not valid;

create or replace function public.current_profile_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

-- ───────── Auditoria ─────────
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_user_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;  -- sem políticas: só o servidor grava/lê

-- ───────── Operadores do Argus ─────────
create table if not exists public.operators (
  argus_user_id text primary key,
  name text not null,
  manager_id uuid,
  supervisor_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.operators enable row level security;

-- ───────── Ligações importadas do Argus ─────────
create table if not exists public.call_records (
  id uuid primary key default gen_random_uuid(),
  argus_call_id text not null,
  operator_name text,
  call_started_at timestamptz,
  duration_seconds integer,
  call_result text,
  transcript text,
  ai_score numeric,
  human_review_status text default 'pending'
);
alter table public.call_records add column if not exists argus_user_id text;
alter table public.call_records add column if not exists tabulation text;
alter table public.call_records add column if not exists lead_number text;
alter table public.call_records add column if not exists campaign_id integer;
alter table public.call_records add column if not exists manager_id uuid;
alter table public.call_records add column if not exists supervisor_id uuid;
alter table public.call_records add column if not exists synced_at timestamptz;

-- Remove restrições antigas de status e garante valor padrão.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.call_records'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%human_review_status%' loop
    execute format('alter table public.call_records drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.call_records alter column human_review_status set default 'pending';
update public.call_records set human_review_status = 'pending' where human_review_status is null;

-- Necessário para a importação idempotente (upsert por argus_call_id).
create unique index if not exists call_records_argus_call_id_key on public.call_records(argus_call_id);
create index if not exists call_records_started_idx on public.call_records(call_started_at desc);
create index if not exists call_records_operator_idx on public.call_records(argus_user_id);

-- ───────── Avaliações ─────────
create table if not exists public.call_evaluations (
  id uuid primary key default gen_random_uuid(),
  call_record_id uuid not null unique references public.call_records(id) on delete cascade,
  evaluator_id uuid references public.profiles(id) on delete set null,
  score numeric(3,1) not null check (score between 0 and 10),
  result text not null check (result in ('approved','attention','failed')),
  criteria jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────── Segurança (RLS) ─────────
alter table public.profiles enable row level security;
alter table public.call_records enable row level security;
alter table public.call_evaluations enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles
  for select to authenticated using (public.current_profile_role() in ('director','quality'));

drop policy if exists operators_select_staff on public.operators;
create policy operators_select_staff on public.operators
  for select to authenticated using (public.current_profile_role() in ('director','quality'));

drop policy if exists call_records_scoped_select on public.call_records;
create policy call_records_scoped_select on public.call_records
  for select to authenticated using (
    public.current_profile_role() in ('director','quality')
    or (public.current_profile_role() = 'manager' and manager_id = auth.uid())
    or (public.current_profile_role() = 'supervisor' and supervisor_id = auth.uid())
  );

drop policy if exists call_evaluations_scoped_select on public.call_evaluations;
create policy call_evaluations_scoped_select on public.call_evaluations
  for select to authenticated using (
    exists (select 1 from public.call_records c where c.id = call_evaluations.call_record_id)
  );  -- o RLS de call_records já restringe quais ligações são visíveis

drop trigger if exists call_evaluations_set_updated_at on public.call_evaluations;
create trigger call_evaluations_set_updated_at before update on public.call_evaluations
  for each row execute function public.set_updated_at();

-- Gravações em profiles, call_records e call_evaluations só pelo servidor (service_role).

-- ───────── Regras de monitoria (categorias, palavras-chave e ocorrências) ─────────
-- SEVENPRO MONITORIA
-- Regras configuráveis de monitoria e ocorrências identificadas.

create table if not exists public.monitoring_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  severity text not null
    check (severity in ('critical', 'high', 'medium', 'low')),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monitoring_rules (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null
    references public.monitoring_categories(id) on delete restrict,
  rule_type text not null
    check (rule_type in ('keyword', 'phrase', 'behavior')),
  expression text not null,
  normalized_expression text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, rule_type, normalized_expression)
);

create table if not exists public.monitoring_findings (
  id uuid primary key default gen_random_uuid(),
  call_record_id uuid not null
    references public.call_records(id) on delete cascade,
  rule_id uuid references public.monitoring_rules(id) on delete set null,
  category_id uuid
    references public.monitoring_categories(id) on delete set null,
  detected_text text not null,
  context_text text,
  timestamp_seconds integer
    check (timestamp_seconds is null or timestamp_seconds >= 0),
  severity text not null
    check (severity in ('critical', 'high', 'medium', 'low')),
  detection_method text not null default 'keyword'
    check (detection_method in ('keyword', 'ai', 'human')),
  review_status text not null default 'pending'
    check (review_status in (
      'pending',
      'confirmed',
      'dismissed'
    )),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);

create index if not exists monitoring_rules_category_idx
  on public.monitoring_rules(category_id, active);

create index if not exists monitoring_findings_call_idx
  on public.monitoring_findings(call_record_id);

create index if not exists monitoring_findings_status_idx
  on public.monitoring_findings(review_status, severity, created_at desc);

create index if not exists monitoring_findings_category_idx
  on public.monitoring_findings(category_id, created_at desc);

drop trigger if exists monitoring_categories_set_updated_at
  on public.monitoring_categories;

create trigger monitoring_categories_set_updated_at
before update on public.monitoring_categories
for each row execute function public.set_updated_at();

drop trigger if exists monitoring_rules_set_updated_at
  on public.monitoring_rules;

create trigger monitoring_rules_set_updated_at
before update on public.monitoring_rules
for each row execute function public.set_updated_at();

alter table public.monitoring_categories enable row level security;
alter table public.monitoring_rules enable row level security;
alter table public.monitoring_findings enable row level security;

-- Apenas a Diretoria pode consultar e administrar as regras.
drop policy if exists monitoring_categories_director
  on public.monitoring_categories;

create policy monitoring_categories_director
on public.monitoring_categories
for all to authenticated
using (public.current_profile_role() = 'director')
with check (public.current_profile_role() = 'director');

drop policy if exists monitoring_rules_director
  on public.monitoring_rules;

create policy monitoring_rules_director
on public.monitoring_rules
for all to authenticated
using (public.current_profile_role() = 'director')
with check (public.current_profile_role() = 'director');

-- A ocorrência só pode ser consultada por quem pode consultar
-- a ligação correspondente.
drop policy if exists monitoring_findings_scoped_select
  on public.monitoring_findings;

create policy monitoring_findings_scoped_select
on public.monitoring_findings
for select to authenticated
using (
  public.current_profile_role() = 'director'
  or exists (
    select 1
    from public.call_records c
    where c.id = monitoring_findings.call_record_id
      and (
        (
          public.current_profile_role() = 'manager'
          and c.manager_id = auth.uid()
        )
        or
        (
          public.current_profile_role() = 'supervisor'
          and c.supervisor_id = auth.uid()
        )
      )
  )
);

-- Não permitir gravação direta das ocorrências pelo navegador.
-- A detecção e a revisão devem passar por funções de servidor
-- que validem a identidade e as permissões.

-- Categorias iniciais da monitoria.

insert into public.monitoring_categories
  (name, severity, description)
values
  (
    'Ameaça ao beneficiário',
    'critical',
    'Ameaças de bloqueio, cancelamento ou perda de benefício.'
  ),
  (
    'Coação comercial',
    'high',
    'Pressão indevida para contratar ou aceitar uma proposta.'
  ),
  (
    'Falsa promessa',
    'high',
    'Promessas de aprovação, liberação ou dinheiro garantido.'
  ),
  (
    'Falta de consentimento',
    'critical',
    'Indícios de contratação ou confirmação sem autorização.'
  ),
  (
    'Abuso verbal',
    'high',
    'Ofensas, humilhações ou tratamento desrespeitoso.'
  ),
  (
    'Pressão por urgência',
    'medium',
    'Pressão comercial baseada em urgência excessiva.'
  ),
  (
    'Ocultação de condições',
    'high',
    'Indícios de omissão de informações ou desestímulo à leitura.'
  ),
  (
    'Interrupção e agressividade',
    'high',
    'Interrupções repetidas, gritos ou agressividade verbal.'
  )
on conflict (name) do nothing;

-- Palavras-chave e frases iniciais.
-- A expressão normalizada é usada para evitar duplicidade.

with initial_rules(category_name, rule_type, expression) as (
  values
    ('Ameaça ao beneficiário', 'phrase', 'Vou bloquear o benefício do senhor'),
    ('Ameaça ao beneficiário', 'phrase', 'O senhor vai perder seu benefício'),
    ('Ameaça ao beneficiário', 'phrase', 'Se não fechar, vou cancelar'),
    ('Ameaça ao beneficiário', 'phrase', 'O senhor ficará sem receber'),
    ('Ameaça ao beneficiário', 'keyword', 'bloquear benefício'),
    ('Ameaça ao beneficiário', 'keyword', 'cancelar benefício'),
    ('Ameaça ao beneficiário', 'keyword', 'suspender pagamento'),
    ('Ameaça ao beneficiário', 'keyword', 'vai perder o benefício'),
    ('Ameaça ao beneficiário', 'keyword', 'ficará sem receber'),

    ('Coação comercial', 'phrase', 'É obrigatório contratar'),
    ('Coação comercial', 'phrase', 'É obrigatório fazer esse contrato'),
    ('Coação comercial', 'phrase', 'Não vou resolver se não fechar comigo'),
    ('Coação comercial', 'keyword', 'tem que aceitar'),
    ('Coação comercial', 'keyword', 'obrigatório fechar'),
    ('Coação comercial', 'keyword', 'não tem escolha'),

    ('Falsa promessa', 'phrase', 'O dinheiro está garantido'),
    ('Falsa promessa', 'keyword', 'dinheiro garantido'),
    ('Falsa promessa', 'keyword', 'aprovação garantida'),
    ('Falsa promessa', 'keyword', 'liberação certa'),

    ('Falta de consentimento', 'phrase', 'Não precisa da sua autorização'),
    ('Falta de consentimento', 'keyword', 'fazer sem autorização'),
    ('Falta de consentimento', 'keyword', 'confirmar pelo senhor'),
    ('Falta de consentimento', 'keyword', 'não precisa autorizar'),

    ('Abuso verbal', 'keyword', 'incompetente'),
    ('Abuso verbal', 'keyword', 'não entende'),
    ('Abuso verbal', 'keyword', 'cala a boca'),

    ('Pressão por urgência', 'phrase', 'Confirma agora ou perde a oportunidade'),
    ('Pressão por urgência', 'keyword', 'só hoje'),
    ('Pressão por urgência', 'keyword', 'agora ou nunca'),
    ('Pressão por urgência', 'keyword', 'última chance'),

    ('Ocultação de condições', 'phrase', 'Não precisa ler o contrato'),
    ('Ocultação de condições', 'keyword', 'não precisa ler'),
    ('Ocultação de condições', 'keyword', 'não vou explicar'),
    ('Ocultação de condições', 'keyword', 'não tem necessidade de informar')
)
insert into public.monitoring_rules
  (category_id, rule_type, expression, normalized_expression)
select
  c.id,
  r.rule_type,
  r.expression,
  lower(trim(r.expression))
from initial_rules r
join public.monitoring_categories c
  on c.name = r.category_name
on conflict (category_id, rule_type, normalized_expression)
do nothing;

-- ───────── Primeiro acesso ─────────
-- 1) Crie seu usuário em Authentication > Users (e-mail + senha).
-- 2) Copie o UUID dele e rode (troque UUID e nome):
-- insert into public.profiles (id, display_name, role, active)
-- values ('COLE-O-UUID-AQUI', 'Seu Nome', 'director', true)
-- on conflict (id) do update set role = 'director', active = true;
