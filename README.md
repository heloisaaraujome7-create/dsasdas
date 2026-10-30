# SEVENPRO MONITORIA

Plataforma da ME7 Promotora para monitorar a qualidade das ligações. Fluxo: **Argus → Netlify Functions → Supabase → tela**.

## Como colocar para rodar (resumo)

1. **Supabase → SQL Editor:** cole e rode o arquivo `supabase/schema.sql` inteiro. Ele é seguro para rodar de novo: cria o que falta (perfis, operadores, `call_records`, avaliações, políticas RLS) sem apagar dados.
2. **Seu usuário Diretor:** em *Authentication → Users* crie seu e-mail/senha, copie o UUID e rode o `insert into public.profiles ...` que está no final do `schema.sql` (com `role = 'director'`).
3. **Netlify → Environment variables** (todas obrigatórias):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (usadas no navegador)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (só no servidor)
   - `ARGUS_TOKEN_SIGNATURE` e `ARGUS_API_URL` (a função também aceita o nome antigo `ARGUS_API_TOKEN`; se `ARGUS_API_URL` faltar, usa `https://argus.app.br/apiargus`)
4. Suba estes arquivos no GitHub; o Netlify publica sozinho.
5. Entre no sistema → **Chamadas** → **Sincronizar com o Argus**. O sistema consulta 08h até agora (máximo 18h, horário de Brasília) em janelas de 15 minutos, guarda só ligações com resultado `ATENDIMENTO` e mostra quantos registros o Argus devolveu por resultado.
6. Clique em **Avaliar** numa ligação: 6 critérios + nota + observações. A avaliação fica salva no Supabase.
7. **Operadores** (Diretoria): vincule cada operador a um supervisor para que gerentes e supervisores enxerguem as ligações da própria equipe.
8. **Gestão de usuários**: crie usuários com senha temporária (não depende de e-mail/SMTP) ou por convite.

Cargos: Diretoria e Monitoria/Qualidade veem tudo; Gerente e Supervisor só a própria equipe; os demais cargos ficam cadastrados, sem acesso a ligações.

## Funções (Netlify)

- `argus-sync-calls` — POST (Diretoria/Qualidade): importa UMA janela de até 60 min para `call_records` (upsert por `argus_call_id`, sem duplicar).
- `call-evaluate` — POST: grava a avaliação respeitando o escopo da equipe.
- `operator-assign` — POST (Diretoria): vincula operador ↔ supervisor e atualiza as ligações já importadas.
- `director-create-user` — POST (Diretoria): cria conta + perfil.
- `argus-list-campaigns`, `argus-list-recordings`, `argus-list-calls`, `argus-list-detailed-calls`, `argus-test-calls` — consultas e diagnóstico do Argus.

## Ainda não implementado

Download/armazenamento do áudio, transcrição, avaliação automática por IA e alertas automáticos. Áudios e transcrições têm dados pessoais: defina retenção, acesso e base legal antes de ativar.

---

# Documentação original do MVP

# SEVENPRO MONITORIA — MVP inicial

Projeto inicial da plataforma independente de monitoria de qualidade da ME7 Promotora. A interface foi montada com React/Vite para publicar no Netlify e manter o código no GitHub. Esta entrega é um **scaffold de implantação e protótipo de interface**, não um sistema de produção já conectado: os números e chamadas exibidos na interface são dados demonstrativos, e a análise de IA ainda não está conectada.

## O que já existe neste pacote

- Interface responsiva com identidade preta/vermelha.
- Tela de login integrada ao Supabase Auth quando configurado; sem cadastro público.
- Áreas de painel executivo, ligações, operadores, alertas, relatórios, gestão de usuários e configurações.
- Esquema inicial Supabase com RLS para separar acesso por Diretoria, Gerente e Supervisor.
- Função de servidor para criar/invitar usuários apenas se o perfil autenticado for Diretoria.
- Funções de servidor de exemplo para consultar campanhas e gravações no Argus usando `Token-Signature` guardado em segredo no servidor.
- Hierarquia preparada para Diretoria → dois gerentes → supervisores; o vínculo real dos operadores deve ser mapeado e validado.

## Antes de publicar para uso real

1. Crie um projeto Supabase dedicado e configure o Auth para permitir somente convites administrativos. Desative cadastro público.
2. Execute `supabase/schema.sql` no SQL Editor do Supabase, depois crie o primeiro usuário em Auth e insira manualmente seu perfil `director` usando o UUID desse usuário (instruções comentadas no fim do SQL). Não publique a chave `service_role`.
3. Configure SMTP confiável no Supabase para envio de convites e recuperação de senha. Exija MFA para Diretoria e revise os limites de sessão/login.
4. Configure variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no build do Netlify. A chave anon pode estar no frontend somente porque as tabelas usam RLS; nunca coloque `service_role` no frontend.
5. Em variáveis de ambiente das Netlify Functions, configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ARGUS_TOKEN_SIGNATURE` e `ARGUS_API_URL`. A chave do Argus deve ficar apenas no servidor.
6. Configure o repositório GitHub e conecte-o ao Netlify. Build command: `npm run build`; publish directory: `dist`.
7. Teste permissões com contas distintas: Diretoria, gerente 1, gerente 2, supervisores de cada equipe. Verifique acesso direto por API, não apenas a interface.
8. Integre o mapeamento entre `usuarioOperador`/login/ramal do Argus e as equipes internas. Não suponha que nomes de operadores sejam únicos.
9. Implemente ingestão idempotente das ligações, armazenamento privado de áudio, transcrição, avaliação por IA, revisão humana, retenção e exclusão segura. Esses componentes não estão ativados neste MVP.

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem as variáveis do Supabase, o login real fica desativado e a interface informa que a configuração inicial está pendente. Não use contas ou dados fictícios para tomar decisões de RH.

## Funções disponíveis

- `/.netlify/functions/argus-list-campaigns` — GET; exige sessão válida e perfil ativo `director`.
- `/.netlify/functions/argus-list-recordings` — GET/POST; exige sessão válida e perfil ativo `director`; requer `idCampanha` e aceita no máximo um filtro opcional (`nrLead`, `idSkill`, `codCliente`, `cpfCnpj`, `telefone`).
- `/.netlify/functions/argus-list-calls` — GET/POST; exige sessão válida e perfil ativo `director`; consulta o relatório detalhado por período (máximo de 7 dias) ou últimos minutos, com paginação via `ultimoId`.
- `/.netlify/functions/director-create-user` — POST; exige sessão válida e perfil ativo `director`; envia convite de usuário e grava perfil.

As funções precisam ser testadas contra a conta Argus real e os limites/configurações do ambiente. A consulta de gravações lista metadados e o relatório detalhado consulta ligações. O download seguro de áudio, armazenamento privado, transcrição e processamento de IA ainda precisam ser implementados e testados antes de habilitar monitoria automática.

## Observações de segurança e privacidade

- A Diretoria pode consultar todas as ligações; gerentes e supervisores devem ver apenas o escopo associado ao perfil e às chamadas vinculadas.
- O SQL não concede escrita direta às tabelas de perfil, chamadas ou auditoria a usuários do navegador.
- A hierarquia de equipes e a associação de operadores devem ser validadas no servidor durante a importação.
- Áudios e transcrições contêm dados pessoais. Defina finalidade, acesso, retenção, auditoria e base legal antes de produção.
- Indicadores vocais são inferências probabilísticas, não prova do estado emocional ou de desinteresse. Alertas devem passar por revisão humana.
- Não há garantia de “zero falhas”; é necessária revisão de segurança, testes, backups e monitoramento antes de uso com dados reais.
