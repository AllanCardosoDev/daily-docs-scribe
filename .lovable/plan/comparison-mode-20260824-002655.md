# Plano de Implementação: Modo de Comparação de Relatórios

Adicionar uma funcionalidade de comparação na página de Totais para visualizar diferenças entre dois períodos ou datas.

## User Review Required

> [!IMPORTANT]
> A comparação será baseada na agregação de dados. Se o usuário escolher o turno "Ambos", o sistema priorizará o relatório de 24h (noturno) de cada dia, conforme a lógica atual da página de Totais.

## Proposed Changes

### 1. Refatoração de Dados (`src/routes/_authenticated/totais.tsx`)
- Implementar estado para `isComparisonMode` (booleano).
- Adicionar estados de data para o Período B (`fromB`, `toB`).
- Criar uma nova consulta (`useQuery`) para os dados do Período B.
- Implementar lógica de "Diff" para calcular a variação absoluta e percentual entre Período A e Período B.

### 2. Interface de Usuário (`src/routes/_authenticated/totais.tsx`)
- Adicionar um switch/toggle "Modo Comparação" na barra de filtros.
- Quando ativo, exibir dois seletores de intervalo (A e B).
- Criar um novo componente de tabela ou estender o `AggTable` para exibir colunas duplas (A | B | Diferença).

### 3. Visualização e Feedback
- Utilizar cores semânticas (verde para redução de ocorrências, vermelho para aumento) nas variações.
- Adicionar tooltips explicativos sobre o cálculo da diferença.

### 4. Exportação
- Atualizar a lógica de exportação (XLSX) para incluir as colunas de comparação quando o modo estiver ativo.

## Technical Details

- **Zustand/State**: Utilizaremos o estado local do componente `TotaisPage` para controlar os períodos, já que a página já segue esse padrão.
- **Data Fetching**: Duas chamadas paralelas à `listDailyReports` via TanStack Query.
- **Cálculo de Diferença**:
  ```typescript
  const diff = valueB - valueA;
  const percent = valueA === 0 ? 100 : (diff / valueA) * 100;
  ```
- **Municípios**: Garantir que o alinhamento das linhas na tabela de comparação trate municípios presentes em apenas um dos períodos (vazio = 0).
