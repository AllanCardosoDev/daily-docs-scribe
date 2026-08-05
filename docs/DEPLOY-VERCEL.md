# Deploy na Vercel (a partir do GitHub)

## 1. Sincronizar o código com o GitHub

O envio automático de commits é feito pela integração de Git do editor:
menu **+** (canto inferior esquerdo do chat) → **GitHub** → _Connect project_.

Depois de conectar, **cada alteração feita no projeto vira um commit
automático** no repositório — não é necessário rodar `git` manualmente.

## 2. Importar na Vercel

1. Vercel → **Add New… → Project → Import Git Repository**.
2. Framework preset: **Vite** (o build roda `vite build`).
3. Build command: `npm run build` — Output: `.output/public` (gerado pelo Nitro).

> O build usa o preset Cloudflare por padrão. Para gerar a saída da Vercel,
> defina a variável de build `NITRO_PRESET=vercel` nas _Environment Variables_
> do projeto na Vercel (Production, Preview e Development).

## 3. Variáveis de ambiente

O app já aponta, por padrão, para o projeto Supabase oficial do CBMAM (URL e
chave publicável embutidas no código), então **o deploy funciona sem nenhuma
variável**. Defina as variáveis abaixo apenas para apontar para outro projeto
ou habilitar o cron de sincronização:

| Variável                               | Onde usar          | Descrição                                   |
| -------------------------------------- | ------------------ | ------------------------------------------- |
| `VITE_CUSTOM_SUPABASE_URL`             | build + runtime    | URL do seu projeto Supabase                 |
| `VITE_CUSTOM_SUPABASE_PUBLISHABLE_KEY` | build + runtime    | chave publicável (anon)                     |
| `CUSTOM_SUPABASE_URL`                  | runtime (servidor) | mesma URL                                   |
| `CUSTOM_SUPABASE_PUBLISHABLE_KEY`      | runtime (servidor) | mesma chave publicável                      |
| `CUSTOM_SUPABASE_SERVICE_ROLE_KEY`     | runtime (servidor) | chave service role (nunca expor no cliente) |
| `DRIVE_SYNC_SECRET`                    | runtime (servidor) | segredo do cron `/api/public/drive-sync`    |
| `NITRO_PRESET=vercel`                  | build              | alvo de deploy                              |

## 4. Depois do primeiro deploy

No painel do Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://SEU-APP.vercel.app`
- **Redirect URLs**: `https://SEU-APP.vercel.app/**` (inclua também o domínio
  próprio, se houver, e `https://SEU-APP.vercel.app/reset-password`)

Sem isso, login com Google e recuperação de senha voltam para o domínio errado.

## 5. Checklist de funcionalidades em produção

- [x] Login e-mail/senha + Google (Supabase Auth)
- [x] RBAC (`viewer` / `editor` / `admin`) via RLS
- [x] Registro diário por turno (noturno 24h e parcial 07:00–18:30)
- [x] Totais, histórico, auditoria e escala de serviços na sala
- [x] Exportação PDF/Excel (diário, completo e resumo anual)
- [x] Sincronização automática com a pasta do Google Drive
