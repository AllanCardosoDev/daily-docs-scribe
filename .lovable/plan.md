# Plano de Implementação: Mapa Interativo do Amazonas

Este plano detalha a implementação de uma aba de visualização georreferenciada no painel principal, permitindo o acompanhamento espacial das ocorrências por município.

## Etapas de Implementação

1. **Refinamento do Componente de Mapa (`src/components/map/AmazonasMap.tsx`)**
   - Ajustar o SVG para uma representação mais fiel do contorno do estado do Amazonas.
   - Garantir que todos os municípios listados no `MUNICIPIOS_GEO` correspondam aos nomes canônicos usados nas planilhas.
   - Adicionar estados de carregamento e feedback visual para municípios sem dados.

2. **Integração na Interface de Abas (`src/routes/_authenticated/painel.tsx`)**
   - Organizar a interface em abas: "Tabelas e Indicadores" e "Mapa Georreferenciado".
   - Garantir que a troca de abas seja fluida e não cause recarregamentos desnecessários.

3. **Validação e UX**
   - Verificar a responsividade do mapa em dispositivos móveis (visualização simplificada).
   - Testar a interação de clique e o fechamento do popup de detalhes.

## Detalhes Técnicos

- **Tecnologia**: SVG nativo para o mapa, `framer-motion` para animações e popups.
- **Dados**: O mapa consome o objeto `SheetsData` já carregado pelo hook `useSheetsDashboard`, garantindo consistência com as tabelas.
- **Normalização**: Utilização de `canonicalMunicipio` para garantir que o clique no mapa encontre os dados corretos nas listas de Incêndios, Efetivo e Recursos.

```text
[ Tabs ]
  |-- [ Tabelas ] -> Exibe o DashboardSections original.
  |-- [ Mapa ]    -> Exibe o AmazonasMap (SVG interativo).
```
