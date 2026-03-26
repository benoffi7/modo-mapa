# Technical Plan — Modularización de componentes de estadísticas

## Paso 1: Crear tipos compartidos

**Archivo:** `src/types/metrics.ts`

- Definir `PublicMetrics`, `TopTagEntry`, `TopBusinessEntry`, `TopRatedEntry`

**Archivo:** `src/types/admin.ts`

- Hacer que `DailyMetrics` extienda `PublicMetrics` (agrega campos de usage)
- Esto evita duplicación de tipos

---

## Paso 2: Mover componentes a `src/components/stats/`

### 2a. Mover PieChartCard

- Copiar `src/components/admin/charts/PieChartCard.tsx` a `src/components/stats/PieChartCard.tsx`
- Eliminar el original
- Sin cambios en el componente

### 2b. Mover TopList

- Copiar `src/components/admin/TopList.tsx` a `src/components/stats/TopList.tsx`
- Eliminar el original
- Sin cambios en el componente

### 2c. Crear barrel export

- Crear `src/components/stats/index.ts` con re-exports de ambos componentes

---

## Paso 3: Crear hook usePublicMetrics

**Archivo:** `src/hooks/usePublicMetrics.ts`

- Implementar fetch de `dailyMetrics/{hoy}` usando `dailyMetricsConverter`
- Retornar `{ metrics, loading, error }` con tipo `PublicMetrics | null`
- Manejar cleanup con `ignore` flag
- Solo exponer campos públicos

---

## Paso 4: Refactorizar DashboardOverview

**Archivo:** `src/components/admin/DashboardOverview.tsx`

- Reemplazar imports de `TopList` y `PieChartCard` por imports desde `../stats`
- Reemplazar el fetch manual de `dailyMetrics` por `usePublicMetrics()`
- Mantener fetch de `counters` y `customTags` (admin-only)
- Mantener helpers `getBusinessName()` y `getTagLabel()`

---

## Paso 5: Actualizar imports en otros archivos

- `FirebaseUsage.tsx`: actualizar import de `PieChartCard`
- `UsersPanel.tsx`: actualizar import de `TopList`

---

## Paso 6: Crear StatsView para la app pública

**Archivo:** `src/components/menu/StatsView.tsx`

- Consumir `usePublicMetrics()` para obtener datos
- Renderizar los 5 componentes de estadísticas
- Manejar estados de loading, error y sin datos

**Archivo:** `src/components/layout/SideMenu.tsx`

- Agregar sección "Estadísticas" al tipo `Section`
- Agregar botón de navegación con icono `BarChart`
- Renderizar `StatsView` cuando la sección está activa

---

## Paso 7: Verificar reglas Firestore

- Documentar que `dailyMetrics` necesita cambiar de `isAdmin()` a `isAuthenticated()`
- No modificar reglas en este PR (requiere deploy separado)

---

## Paso 8: Testing y validación

- `npm run build` sin errores
- `npm run lint` sin errores
- Verificar visualmente el dashboard admin (debe verse idéntico)
- Verificar que `usePublicMetrics` es importable desde fuera de admin

---

## Orden de ejecución

```text
Paso 1 → Paso 2 → Paso 3 → Paso 4 → Paso 5 → Paso 6 → Paso 7 → Paso 8
```

Todos los pasos son secuenciales ya que cada uno depende del anterior.

## Estimación de archivos afectados

| Acción | Archivo |
|--------|---------|
| Crear | `src/types/metrics.ts` |
| Modificar | `src/types/admin.ts` |
| Crear | `src/components/stats/PieChartCard.tsx` |
| Crear | `src/components/stats/TopList.tsx` |
| Crear | `src/components/stats/index.ts` |
| Eliminar | `src/components/admin/charts/PieChartCard.tsx` |
| Eliminar | `src/components/admin/TopList.tsx` |
| Crear | `src/hooks/usePublicMetrics.ts` |
| Modificar | `src/components/admin/DashboardOverview.tsx` |
| Modificar | `src/components/admin/FirebaseUsage.tsx` |
| Modificar | `src/components/admin/UsersPanel.tsx` |
| Crear | `src/components/menu/StatsView.tsx` |
| Modificar | `src/components/layout/SideMenu.tsx` |

**Total:** 6 archivos nuevos, 5 modificados, 2 eliminados
