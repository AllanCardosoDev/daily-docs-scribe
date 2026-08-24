# Plan - Dashboards and Comparative Analysis

Implement a comprehensive data science dashboard and comparative analysis tools for CBMAM operations.

## User Review Required

> [!IMPORTANT]
> - The new "Dashboard" tab in the main panel will now include a time-series chart showing the evolution of fires over time.
> - The Comparison Mode will be extended to Excel and PDF exports, adding variance columns (absolute and percentage) to tabular data.
> - A new "Annual Comparison" view will be added to the Totais page to compare data across years (e.g., 2024 vs 2025 vs 2026).

## Proposed Changes

### Dashboard & Analytics
- **New Visualization**: Add a `Recharts` area chart to `DashboardAnalytics.tsx` showing fires per day across the selected range.
- **Enhanced KPIs**: Add "Area Burned" to the comparison logic in `comparison.ts` so it shows deltas like other metrics.
- **Search Integration**: Ensure the municipality search in `MapDetailsPanel` correctly filters and focuses the map view.

### Comparison Mode Extensions
- **Excel Export**: Update `exportSheetsToXlsx` in `export-xlsx.ts` to include "Variance" columns when `comparisonData` is provided.
- **PDF Export**: Update `exportSheetsToPdf` in `export-pdf.ts` to add small trend indicators (arrows + percentages) next to numeric values when comparing periods.
- **Totais Page**: Add a "Yearly Comparison" toggle to `totais.tsx` that uses `getAnnualIncendios` to show side-by-side yearly stats.

### Data Management
- **Aggregation Logic**: Refine `loadReportRange` in `sheets-fallback.server.ts` to ensure "Area Burned" is correctly summed from cumulative rows within the specific timeframe.

## Technical Details
- **Comparison Engine**: Update `ComparisonResult` interface in `comparison.ts` to include `area_afetada`.
- **Export Logic**: The Excel export will dynamically inject columns `Variacao Abs.` and `Variacao %` after the base metrics.
- **Performance**: Use `useMemo` for heavy delta calculations in the `Totais` page to avoid UI lag during date range switches.
