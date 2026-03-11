# Technical Specs — Modularización de componentes de estadísticas

## Arquitectura propuesta

```text
src/
├── components/
│   ├── stats/                          # NUEVO — componentes compartidos
│   │   ├── PieChartCard.tsx            # Movido desde admin/charts/
│   │   ├── TopList.tsx                 # Movido desde admin/
│   │   └── index.ts                    # Barrel export
│   ├── admin/
│   │   ├── DashboardOverview.tsx        # Refactorizado para usar stats/
│   │   ├── FirebaseUsage.tsx            # Actualizado import de PieChartCard
│   │   ├── UsersPanel.tsx               # Actualizado import de TopList
│   │   └── charts/
│   │       └── LineChartCard.tsx         # Sin cambios
│   └── menu/
│       └── StatsView.tsx                # NUEVO — vista pública de estadísticas
├── hooks/
│   └── usePublicMetrics.ts             # NUEVO — hook de métricas públicas
└── types/
    ├── admin.ts                         # DailyMetrics extiende PublicMetrics
    └── metrics.ts                       # NUEVO — tipos compartidos de métricas
```

## Tipos compartidos — `src/types/metrics.ts`

```typescript
export interface TopTagEntry {
  tagId: string;
  count: number;
}

export interface TopBusinessEntry {
  businessId: string;
  count: number;
}

export interface TopRatedEntry extends TopBusinessEntry {
  avgScore: number;
}

export interface PublicMetrics {
  date: string;
  ratingDistribution: Record<string, number>;
  topTags: TopTagEntry[];
  topFavorited: TopBusinessEntry[];
  topCommented: TopBusinessEntry[];
  topRated: TopRatedEntry[];
}
```

## Hook — `src/hooks/usePublicMetrics.ts`

```typescript
interface UsePublicMetricsReturn {
  metrics: PublicMetrics | null;
  loading: boolean;
  error: boolean;
}

export function usePublicMetrics(): UsePublicMetricsReturn
```

**Implementación:**

- Lee `dailyMetrics/{YYYY-MM-DD}` con `dailyMetricsConverter`
- Retorna solo los campos relevantes a métricas públicas (excluye reads/writes/deletes)
- Maneja cleanup con `ignore` flag en useEffect

## Componentes — `src/components/stats/`

### PieChartCard

Sin cambios en la interfaz. Se mueve de `admin/charts/` a `stats/`.

```typescript
interface PieChartCardProps {
  title: string;
  data: Array<{ name: string; value: number }>;
}
```

### TopList

Sin cambios en la interfaz. Se mueve de `admin/` a `stats/`.

```typescript
interface TopListItem {
  label: string;
  value: number;
  secondary?: string;
}

interface TopListProps {
  title: string;
  items: TopListItem[];
}
```

### Barrel export — `index.ts`

```typescript
export { default as PieChartCard } from './PieChartCard';
export { default as TopList } from './TopList';
```

## StatsView — `src/components/menu/StatsView.tsx`

Componente que consume `usePublicMetrics()` y renderiza los gráficos públicos en el
menú lateral. Muestra:

- Distribución de ratings (PieChartCard)
- Tags más usados (PieChartCard)
- Top favoriteados, comentados y calificados (TopList)

## Refactor de DashboardOverview

- Reemplaza imports de `TopList` y `PieChartCard` por imports desde `../stats`
- Reemplaza el fetch manual de `dailyMetrics` por `usePublicMetrics()`
- Mantiene fetch de `counters` y `customTags` (admin-only)
- Mantiene helpers `getBusinessName()` y `getTagLabel()`

## Reglas de seguridad Firestore

La colección `dailyMetrics` actualmente solo permite lectura a admins (`isAdmin()`).
Para que el hook funcione en la app pública, se necesita cambiar la regla a
`isAuthenticated()`. **Este cambio de reglas se hará en un paso separado** ya que
requiere deploy de las reglas de Firestore.

## Dependencias

- `recharts` — ya instalado, usado por `PieChartCard`
- `@mui/material` — ya instalado, usado por ambos componentes
- Sin dependencias nuevas
