# Plano de Edição Visual

Aplicar a alteração de texto solicitada na tela de carregamento inicial.

## Alterações Propostas

### 1. Rota de Redirecionamento (`src/routes/index.tsx`)
- Localizar o texto de carregamento no componente `IndexRedirect`.
- Substituir "envie o commit para o github" por "em relação ao Banco de Dados...\nqual estamos usando?".

## Resposta à Pergunta do Usuário
O sistema utiliza o **Supabase** (Lovable Cloud) como backend, que é baseado em **PostgreSQL**. Toda a persistência de dados, autenticação e políticas de segurança (RLS) são gerenciadas através desta infraestrutura.