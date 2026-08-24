# Plano de Implementação: Modo Comparação no Dashboard

Adicionar a capacidade de comparar dois intervalos de datas distintos diretamente no dashboard para visualizar diferenças nas ocorrências.

## Alterações Propostas

### 1. Backend e Tipagem (`src/lib/sheets.functions.ts` e `src/lib/sheets-fallback.server.ts`)
- Criar `getComparisonData` server function que aceita dois intervalos (A e B).
- Implementar lógica de agregação para ambos os intervalos.
- Retornar um objeto contendo os dados de A, dados de B e o cálculo de diferença (delta).

### 2. Interface de Seleção (`src/components/dashboard/ComparisonToolbar.tsx`)
- Criar um novo componente de toolbar específico para o modo comparação.
- Adicionar seletores para o Período A e Período B.
- Incluir um toggle para ativar/desativar o modo comparação no dashboard principal.

### 3. Dashboard Analytics e Tabelas (`src/components/dashboard/DashboardAnalytics.tsx` e `src/components/dashboard/DataTable.tsx`)
- Adaptar o `DashboardAnalytics` para mostrar cartões KPI com indicadores de variação (setas verde/vermelho).
- Atualizar as tabelas de dados para suportar uma coluna opcional de "Variação" ou visualização lado a lado.

### 4. Integração no Painel (`src/routes/_authenticated/painel.tsx`)
- Gerenciar o estado `isComparisonMode`.
- Passar os dados comparativos para os componentes filhos quando ativo.

## Detalhes Técnicos
- **Lógica de Diferença**: `(Valor_B - Valor_A)` para totais absolutos e porcentagem de crescimento.
- **Persistência**: O estado do modo comparação será mantido localmente na sessão.
- **Performance**: Usar `useMemo` para evitar cálculos pesados de diff no render.

## Citando o Pedido
- "Adicionar um modo de comparação para eu visualizar diferenças de ocorrências entre duas datas/intervalos no mesmo dashboard." (instrucoes.md)
