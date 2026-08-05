# Apontar o app para o SEU projeto Supabase

O sistema funciona em dois modos, escolhidos apenas por variáveis de ambiente —
nenhum código precisa ser alterado.

| Modo                    | Quando é usado                       | Variáveis                                                                                                                    |
| ----------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Gerenciado** (padrão) | Nenhuma variável `CUSTOM_*` definida | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`                             |
| **Projeto próprio**     | Variáveis `CUSTOM_*` definidas       | `VITE_CUSTOM_SUPABASE_URL`, `VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY`, `CUSTOM_SUPABASE_URL`, `CUSTOM_SUPABASE_PUBLISHABLE_KEY` |

Quando as quatro variáveis `CUSTOM_*` estão presentes, **todo** o app (login,
sessão, leitura/escrita de relatórios, escala, histórico e auditoria) passa a
usar o seu projeto.

---

## Passo 1 — Criar o projeto no Supabase

1. Acesse o painel da sua conta (ex.: organização `salacbmam`) → **New project**.
2. Escolha a região mais próxima (ex.: `South America (São Paulo)`).
3. Guarde a senha do banco.

## Passo 2 — Criar o esquema

1. No projeto novo, abra **SQL Editor → New query**.
2. Cole o conteúdo completo de [`supabase/self-hosted/schema.sql`](../supabase/self-hosted/schema.sql).
3. Execute. Isso cria:
   - tipos `app_role` (admin/editor/viewer) e `report_shift` (noturno/parcial);
   - tabelas `profiles`, `user_roles`, `municipios`, `daily_reports`,
     `daily_reports_history`, `report_data`, `report_data_history`,
     `escala_operators`, `escala_shifts`, `app_config`;
   - funções `has_role`, `is_user_scheduled_on`, gatilhos de versionamento,
     histórico e `updated_at`;
   - **GRANTs** e **políticas de RLS** de cada tabela.

> O script é idempotente na maior parte; se algum objeto já existir, rode apenas
> os blocos restantes.

## Passo 3 — Configurar a autenticação

Em **Authentication → Providers**:

- **Email**: habilitado.
- **Confirm email**: conforme a sua política (desligado acelera o cadastro interno).
- **Leaked password protection (HIBP)**: recomendado ligado.
- **URL Configuration → Redirect URLs**: adicione o domínio do app e
  `https://SEU-DOMINIO/reset-password` (necessário para "esqueci minha senha").

O gatilho `handle_new_user` já cria o `profiles` e atribui o papel:
**o primeiro usuário cadastrado vira `admin`**; os demais entram como `viewer`.
O admin promove os operadores para `editor` depois.

## Passo 4 — Copiar as chaves

Em **Project Settings → API**, copie:

- **Project URL** → `https://xxxx.supabase.co`
- **anon / publishable key**

## Passo 5 — Definir as variáveis

**Em execução local** (arquivo `.env.local` na raiz):

```bash
VITE_CUSTOM_SUPABASE_URL=https://xxxx.supabase.co
VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY=<sua_chave_publica>
CUSTOM_SUPABASE_URL=https://xxxx.supabase.co
CUSTOM_SUPABASE_PUBLISHABLE_KEY=<sua_chave_publica>
```

**Em hospedagem própria** (Vercel, Netlify, Cloudflare, Docker…): cadastre as
mesmas quatro variáveis no painel de variáveis de ambiente e refaça o build —
as variáveis `VITE_*` são embutidas no bundle em tempo de build.

> Observação: na hospedagem gerenciada padrão, as variáveis do servidor com
> prefixo `SUPABASE_` são reservadas; por isso este modo usa o prefixo
> `CUSTOM_SUPABASE_`, que pode ser definido livremente.

## Passo 6 — Migrar os dados existentes (opcional)

No projeto atual, exporte cada tabela em CSV (Cloud → Advanced settings →
Export data, ou `Table Editor → Export`) e importe no projeto novo, nesta ordem:

1. `profiles`
2. `user_roles`
3. `municipios`
4. `escala_operators` → `escala_shifts`
5. `daily_reports`
6. `report_data`
7. Históricos (`daily_reports_history`, `report_data_history`) — opcional

Os usuários de `auth.users` **não** são copiados por CSV: recadastre-os pela
tela de login (ou pela API Admin do Supabase) e reatribua os papéis em
`user_roles`.

## Passo 7 — Validar

1. Suba o app com as variáveis definidas.
2. Faça login (o primeiro cadastro vira admin).
3. Verifique: Registro (salvar um dia), Totais, Escala, Histórico/Auditoria e
   exportação PDF/XLSX.

Se algum dado não aparecer, quase sempre é RLS/GRANT: confirme que o usuário
tem uma linha em `user_roles` no projeto novo.

---

## Como voltar ao backend gerenciado

Remova as quatro variáveis `CUSTOM_*` e refaça o build. O app volta
automaticamente a usar `VITE_SUPABASE_*` / `SUPABASE_*`.
