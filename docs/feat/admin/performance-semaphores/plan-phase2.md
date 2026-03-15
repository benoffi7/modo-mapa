# Plan: Performance Semaphores — Fase 2

**Scope:** S3.1 (Semaphore cards) + S3.2 (Query latency table) + S3.6 (Storage photos card)
**Base branch:** `feat/performance-semaphores`

---

## Pasos

### Paso 1: Converter + servicio para perfMetrics

- Crear `perfMetricsConverter` en `src/config/adminConverters.ts`
- Agregar `fetchPerfMetrics(days)` en `src/services/admin.ts`
- Agregar tipo `StorageStats` en `src/types/admin.ts`

### Paso 2: Cloud Function `getStorageStats`

- Crear `functions/src/admin/storageStats.ts` — callable que lista archivos en `menuPhotos/` y suma tamaños
- Exportar desde `functions/src/index.ts`
- Agregar `fetchStorageStats()` en `src/services/admin.ts`

### Paso 3: Componente PerformancePanel

- Crear `src/components/admin/PerformancePanel.tsx`
- Sección 1: Grid de 4 semaphore cards (LCP, INP, CLS, TTFB) con color verde/amarillo/rojo
- Sección 2: Tabla de query latencies (p50, p95, samples, status)
- Sección 3: Card de storage de fotos (espacio usado, archivos, barra de progreso)
- Usa `useAsyncData` + `AdminPanelWrapper` como los demás panels

### Paso 4: Agregar tab en AdminLayout

- Importar `PerformancePanel`
- Agregar `<Tab label="Performance" />` (tab index 9)
- Agregar `{tab === 9 && <PerformancePanel />}`

### Paso 5: Seed data

- Actualizar `scripts/seed-admin-data.mjs` si es necesario para datos de prueba

### Paso 6: Verificación

- `npm run lint` — 0 errores
- `npm run test:run` — todos pasan
- `npm run build` — sin errores
- Verificar en emulador que el panel carga datos del seed

---

## Pre-merge checklist

- [ ] Build pasa
- [ ] Tests pasan
- [ ] Lint pasa (0 errores)
- [ ] Panel muestra semáforos con colores correctos
- [ ] Tabla de queries muestra datos del seed
- [ ] Card de storage muestra datos (o placeholder si no hay función)
