# Plan: Métricas por funcionalidad + Panel orquestador

**Feature:** metricas-panel
**Issue:** #159

---

## Fase 1: PerformancePanel decomposition

### Paso 1: Crear subcomponentes en src/components/admin/perf/

Extraer del PerformancePanel actual:
- VitalsSemaphore.tsx
- VitalsTrend.tsx
- QueryLatencyTable.tsx
- FunctionTimingTable.tsx
- StorageCard.tsx
- PerfFilters.tsx

### Paso 2: Refactorizar PerformancePanel

Reemplazar el contenido por imports de los subcomponentes. Mantener el estado y filtros en el parent.

## Fase 2: Feature metrics backend

### Paso 3: Tipos

Agregar `FeatureMetrics` type a admin.ts.

### Paso 4: dailyMetrics Cloud Function

Agregar cálculo de featureMetrics y writesByCollection al scheduled job.

## Fase 3: Features panel

### Paso 5: FeaturesPanel component

Tab nuevo con cards por feature y sección de adopción.

### Paso 6: Integrar en AdminLayout

Agregar tab "Features" al admin dashboard.

### Paso 7: Service layer

Función para leer featureMetrics de dailyMetrics.

## Fase 4: Tests y merge

### Paso 8: Tests, lint, build, merge

---

## Criterios de merge

- [ ] PerformancePanel descompuesto (<200 líneas cada sub)
- [ ] Tab Features visible en admin
- [ ] featureMetrics calculado en dailyMetrics
- [ ] writesByCollection populado
- [ ] Lint y tests pasan
- [ ] Docs actualizados
