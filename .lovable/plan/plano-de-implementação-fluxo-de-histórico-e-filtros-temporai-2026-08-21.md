# Plano de Implementação: Fluxo de Histórico e Filtros Temporais

Este plano descreve a implementação de um fluxo automático para novos relatórios, sistema de histórico com reversão e filtros de período integrados ao mapa e dashboard.

## O que será construído

### 1. Fluxo Automático e Histórico de Relatórios
*   **Geração Automática**: O sistema garantirá que ao acessar um dia sem dados, ele tente carregar dados do Google Drive ou sugira a criação de um novo reporte.
*   **Histórico de Versões**: Implementação de visualização de versões anteriores na tabela `daily_reports_history` para o Admin, permitindo comparar e restaurar dados.
*   **Bloqueio de Concorrência**: Melhoria no `expectedVersion` para evitar que dois usuários sobrescrevam o mesmo relatório simultaneamente.

### 2. Filtros de Período Integrados
*   **Interface de Período**: Adição de seletor de data inicial e final na `PainelToolbar.tsx`.
*   **Mapa Reativo**: O `AmazonasMap.tsx` passará a consumir dados agregados do período selecionado em vez de apenas um dia.
*   **Indicadores Dinâmicos**: Os cartões de KPI e tabelas se ajustarão automaticamente ao intervalo de datas definido.

## Detalhes Técnicos

*   **Backend (Supabase)**:
    *   Utilização da tabela `daily_reports_history` (já existente no esquema) para auditoria.
    *   Ajuste na `listDailyReports` para suportar agregações eficientes.
*   **Frontend (React/TanStack)**:
    *   Estado global de `dateRange` no dashboard.
    *   Refatoração do `useSheetsDashboard` para lidar com intervalos.
    *   Novo diálogo `ReportHistoryDialog` (ou aprimoramento do existente) para restauração de versões.
*   **Mapa**:
    *   Agregação de ocorrências de incêndio e efetivo para o range selecionado usando `useMemo`.

## User Review Required

> [!IMPORTANT]
> A sincronização com o Google Sheets é baseada no Drive. Se você deseja que a geração seja 100% automática sem intervenção humana, precisaremos configurar um Cron Job externo (como o GitHub Actions ou EasyCron) chamando `/api/public/drive-sync`. Por enquanto, focaremos na interface de usuário.