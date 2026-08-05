# Painel Operacional CBMAM — Amazonas + Verde

Sistema web oficial do **Comando Integrado do Corpo de Bombeiros Militar do Amazonas**
para registro, consolidação e publicação do relatório diário da Operação Amazonas + Verde.

O sistema substitui o preenchimento manual de planilhas: os operadores da Sala de Situação
lançam as ocorrências do dia, os dados são consolidados automaticamente por município e por
tipo de ocorrência, e o relatório oficial é gerado em **PDF** (com pré-visualização fiel) e
**Excel**.

---

## Índice

- [Visão geral](#visão-geral)
- [Perfis de acesso](#perfis-de-acesso)
- [Módulos do sistema](#módulos-do-sistema)
- [Arquitetura](#arquitetura)
- [Modelo de dados](#modelo-de-dados)
- [Regras de negócio](#regras-de-negócio)
- [Geração de relatórios](#geração-de-relatórios)
- [Segurança](#segurança)
- [Executando localmente](#executando-localmente)
- [Estrutura de pastas](#estrutura-de-pastas)

---

## Visão geral

| Item          | Descrição                                                                             |
| ------------- | ------------------------------------------------------------------------------------- |
| Objetivo      | Centralizar o registro diário de ocorrências e emitir o relatório oficial da operação |
| Público       | Sala de Situação, coordenação da operação e comando                                   |
| Periodicidade | Diária (um registro por data), com acumulados por período                             |
| Saídas        | Relatório PDF institucional, planilha XLSX, painéis de totais                         |

Fluxo típico de um dia de operação:

1. O operador escalado abre **Registro Diário** e seleciona a data.
2. Preenche efetivo, recursos empregados, incêndios do dia e demais ocorrências.
3. Salva — os dados são gravados no banco com autoria e horário.
4. A aba **Totais** passa a refletir o acumulado do período.
5. A coordenação abre **Painel**, pré-visualiza o relatório e exporta o PDF oficial.

---

## Perfis de acesso

O controle de permissão é feito por papéis persistidos em tabela dedicada
(`user_roles`) e validado **no servidor** por políticas de linha (RLS).

| Papel                       | O que pode fazer                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `viewer`                    | Consulta o painel, os totais e exporta relatórios. Não edita nada.                                        |
| `editor` (Sala de Situação) | Tudo do `viewer` + lança e corrige os dados **do(s) dia(s) em que está escalado**.                        |
| `admin`                     | Acesso total: edita qualquer data, gerencia operadores e escala, configura o sistema e administra papéis. |

Usuários autenticados sem papel atribuído **não enxergam dados operacionais** —
a leitura das tabelas exige papel explícito.

---

## Módulos do sistema

### 1. Registro Diário (`/registro`)

Formulário do dia com todos os blocos da operação. Seleção de data, salvamento
explícito, edição posterior conforme permissão, e feedback de estado (salvando /
salvo / erro). Editores só alteram as datas da própria escala; administradores
alteram qualquer data.

### 2. Totais (`/totais`)

Consolidação acumulada do período, separada por **tipo de ocorrência** e por
**município**: incêndios urbanos, incêndios florestais, focos de calor, área
atingida, água utilizada, salvamentos, acidentes, APH, prevenção e serviços diversos.

### 3. Painel (`/painel`)

Visão executiva do relatório: indicadores-chave (KPIs), tabelas do dia, cabeçalho
institucional editável (identificação, cronograma e cadeia de comando), histórico de
versões e barra de ações com exportação.

### 4. Escala da Sala de Situação (`/escala`)

Cadastro de operadores e montagem da escala de serviços na sala (data + horário + operador).
A escala é a fonte da regra de permissão de edição por dia. Gerenciada por `admin`.

### 5. Pré-visualização de relatório

Diálogo WYSIWYG que gera o **mesmo arquivo** que será baixado e o renderiza página a
página em canvas, com navegação entre páginas, zoom de 50% a 300% e download direto do
documento já renderizado (sem regerar).

---

## Arquitetura

```
Navegador (React 19 + TanStack Router)
        │  chamadas tipadas (server functions)
        ▼
Camada de servidor (TanStack Start, runtime serverless)
        │  cliente autenticado — RLS aplicada como o usuário
        ▼
PostgreSQL gerenciado (auth + dados operacionais)
```

**Stack**

- **React 19** + **TanStack Start / Router** (roteamento por arquivos, SSR)
- **TanStack Query** para cache e sincronização de dados
- **Tailwind CSS v4** + componentes acessíveis baseados em Radix
- **Zod** para validação de entrada no servidor
- **jsPDF + jsPDF-AutoTable** para o relatório PDF; **pdfjs-dist** para a pré-visualização
- **SheetJS (xlsx)** para exportação em planilha
- **PostgreSQL** com Row Level Security para autorização
- **Vite 8** como build tool

**Princípios**

- Toda escrita passa por _server function_ autenticada — o navegador nunca fala
  diretamente com o banco em operações sensíveis.
- Autorização é decidida no banco (RLS), não na interface: esconder um botão nunca
  é a única barreira.
- Validação de payload com Zod antes de qualquer gravação.

---

## Modelo de dados

| Tabela                | Conteúdo                                                        |
| --------------------- | --------------------------------------------------------------- |
| `profiles`            | Dados do usuário (nome de exibição, e-mail)                     |
| `user_roles`          | Papel do usuário (`admin` \| `editor` \| `viewer`)              |
| `daily_reports`       | Registro operacional por data (ocorrências, efetivo, recursos)  |
| `report_data`         | Relatório consolidado corrente (documento JSONB, com `version`) |
| `report_data_history` | Snapshot de cada gravação — permite auditoria e rollback        |
| `escala_operators`    | Operadores da Sala de Situação                                  |
| `escala_shifts`       | Serviços na sala: data, horário e operador                      |
| `app_config`          | Configurações administrativas do sistema                        |

Funções de apoio (`SECURITY DEFINER`, usadas pelas políticas):

- `has_role(user_id, role)` — verifica papel sem recursão de RLS.
- `is_user_scheduled_on(user_id, date)` — indica se o usuário está escalado na data.

---

## Regras de negócio

- **Um registro por data.** A data é a chave operacional do relatório.
- **Edição por escala.** `editor` grava apenas nas datas em que consta na escala;
  `admin` grava em qualquer data.
- **Bloqueio otimista.** Cada gravação envia a `version` que o cliente leu. Se outra
  pessoa gravou nesse intervalo, a operação é rejeitada e o usuário é avisado para
  recarregar — evitando sobrescrita silenciosa.
- **Histórico.** Toda gravação gera um snapshot em `report_data_history` com autor,
  horário e versão.
- **Validação numérica.** Valores operacionais são inteiros não negativos; campos de
  texto têm limite de tamanho. Entradas vazias são normalizadas para zero.
- **Checagem antes do PDF.** Campos obrigatórios do cabeçalho são conferidos antes da
  emissão do relatório oficial; a exportação em Excel permanece livre para rascunho.

---

## Geração de relatórios

### PDF oficial

- Cabeçalho institucional (brasão, faixa e identificação da operação) repetido em
  todas as páginas.
- Seções numeradas em algarismos romanos, cada uma tratada como **bloco independente**:
  uma seção nunca começa no rodapé de uma página. Se a seção for maior que uma página,
  apenas ela pagina internamente e as páginas de continuação reimprimem o cabeçalho e a
  barra de título com o sufixo _(continuação)_.
- Linhas nunca são partidas ao meio; o cabeçalho da tabela se repete em cada página.
- Bloco de autenticação com assinaturas mantido íntegro em uma única página.
- Rodapé com paginação em todas as páginas.
- **Qualidade de exportação:** seletor _Padrão / Alta_ — a opção "Alta" amplia fontes,
  espaçamento de células e a barra de título, melhorando a legibilidade em impressão.

### Excel (XLSX)

Exportação das tabelas do dia no mesmo recorte do relatório, com nome de arquivo
carimbado pela data selecionada.

---

## Segurança

- Autenticação por e-mail/senha e Google, com sessão validada em cada requisição.
- RLS habilitada em todas as tabelas do domínio; leitura exige papel atribuído.
- `app_config` legível apenas por administradores.
- `profiles` só pode ser criado pelo próprio usuário.
- Funções privilegiadas isoladas fora do esquema exposto pela API de dados; no esquema
  público ficam apenas invólucros `SECURITY INVOKER`.
- Auditoria mínima em toda gravação: `updated_by` e `updated_at`.

---

## Executando localmente

Pré-requisitos: Node.js 20+ (ou Bun) e acesso ao banco do projeto.

```bash
# instalar dependências
bun install        # ou: npm install

# ambiente de desenvolvimento (http://localhost:8080)
bun run dev

# build de produção
bun run build

# servir o build
bun run preview

# qualidade
bun run lint
bun run format
```

Variáveis de ambiente necessárias (arquivo `.env`, não versionado):

| Variável                        | Uso                                           |
| ------------------------------- | --------------------------------------------- |
| `VITE_SUPABASE_URL`             | Endpoint da API de dados                      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública usada pelo cliente do navegador |
| `VITE_SUPABASE_PROJECT_ID`      | Identificador do projeto de banco             |

Chaves privilegiadas **nunca** são usadas no navegador nem versionadas.

---

## Estrutura de pastas

```
src/
  routes/
    __root.tsx                  Layout raiz, metadados e providers
    index.tsx                   Entrada (redireciona conforme sessão)
    auth.tsx                    Login (e-mail/senha + Google)
    _authenticated/
      route.tsx                 Gate de rotas protegidas
      painel.tsx                Painel executivo e exportações
      registro.tsx              Registro diário de ocorrências
      totais.tsx                Consolidado do período
      escala.tsx                Operadores e escala de serviços na sala
  components/
    dashboard/                  Cabeçalho, KPIs, tabelas, diálogos, rodapé
    auth/                       Tela e formulários de autenticação
    ui/                         Biblioteca de componentes base
  hooks/                        Sessão, autosave, exportadores, dados
  lib/
    daily-reports.functions.ts  Server functions do registro diário
    escala.functions.ts         Server functions de operadores e escala
    sheets.functions.ts         Consolidado, histórico e configuração
    export-pdf.ts               Motor do relatório PDF oficial
    export-xlsx.ts              Exportação em planilha
    report-validation.ts        Regras de validação pré-emissão
    kpis.ts / formatters.ts     Cálculos e formatação (pt-BR)
supabase/migrations/            Evolução versionada do banco
```

---

© Corpo de Bombeiros Militar do Amazonas — uso institucional.
