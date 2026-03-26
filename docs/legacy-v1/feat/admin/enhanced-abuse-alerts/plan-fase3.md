# Plan: Enhanced Abuse Alerts — Fase 3

**Feature:** enhanced-abuse-alerts (Fase 3)
**Specs:** [specs-fase3.md](./specs-fase3.md)
**Issue:** [#162](https://github.com/benoffi7/modo-mapa/issues/162)
**Branch:** `feat/abuse-alerts-fase3`

---

## Paso 1: Tipos y converter — severity

1. Agregar `AbuseSeverity` type y campo `severity?` a `AbuseLog` en `src/types/admin.ts`.
2. Actualizar `abuseLogConverter` en `src/config/adminConverters.ts` para leer el campo `severity` con validación.
3. Agregar `SEVERITY_MAP`, `getSeverity()`, `SEVERITY_CONFIG` y `SeverityFilter` type en `src/components/admin/alerts/alertsHelpers.ts`.
4. Actualizar `exportToCsv` en `alertsHelpers.ts` para incluir columna "Severidad".

**Verificar:**
```bash
npx tsc --noEmit && npm run lint
```

---

## Paso 2: Hook useAbuseLogsRealtime

1. Crear `src/hooks/useAbuseLogsRealtime.ts` con suscripción `onSnapshot`.
   - Query: `orderBy('timestamp', 'desc'), limit(maxDocs)` con `abuseLogConverter`.
   - Tracking de IDs iniciales para calcular `newCount` via `docChanges()`.
   - Retorna `{ logs, loading, error, newCount, resetNewCount }`.
2. Cleanup: retornar `unsubscribe` en el efecto.

**Verificar:**
```bash
npx tsc --noEmit && npm run lint
```

---

## Paso 3: Migrar AbuseAlerts a realtime + toast

1. En `AbuseAlerts.tsx`: reemplazar `useAsyncData(fetchAbuseLogs)` por `useAbuseLogsRealtime(200)`.
2. Eliminar `localUpdates`, `setLocalUpdates`, `effectiveLogs` — usar `logs` directo de onSnapshot.
3. Eliminar imports de `fetchAbuseLogs`, `useAsyncData`, `useCallback`.
4. Agregar toast de nuevas alertas: efecto con `useToast` + `prevNewCount` ref para dedup.
5. Agregar filtro por severidad: estado `severityFilter`, chips toggle, integrar en `useMemo` de `filtered`, agregar a `hasActiveFilters`/`clearFilters`.
6. Agregar columna "Severidad" (chip con color) en la tabla, entre "Tipo" y "Usuario".

**Verificar:**
```bash
npx tsc --noEmit && npm run lint
```

---

## Paso 4: Badge de pendientes en AdminLayout

1. En `AbuseAlerts.tsx`: agregar prop `onPendingCount?: (count: number) => void`, calcular `pendingCount` con `useMemo` y comunicarlo via `useEffect`.
2. En `AdminLayout.tsx`: estado `alertsPendingCount`, pasar `setAlertsPendingCount` como prop a `AbuseAlerts`, renderizar `Badge` en el tab de Alertas.

**Verificar:**
```bash
npx tsc --noEmit && npm run lint
```

---

## Paso 5: Vista de reincidentes

1. Crear `src/components/admin/alerts/ReincidentesView.tsx`:
   - Interface `ReincidenteRow` con userId, totalAlerts, topType, lastAlertDate, pendingCount, alerts.
   - `useMemo` para agrupar logs por userId, filtrar por `minAlerts`, calcular campos derivados.
   - Tabla con columnas: Usuario, Total alertas, Tipo frecuente, Ultima alerta, Pendientes, Expandir.
   - Chips toggle para filtro de cantidad minima (>3, >5, >10).
   - Panel colapsable con historial del usuario al expandir una fila.
2. En `AbuseAlerts.tsx`: agregar tabs internos (`alerts` / `reincidentes`) debajo de los KPI cards.
   - Calcular `reincidentesCount` (usuarios con >3 alertas) para badge en el tab.
   - KPI cards se mantienen fuera de los tabs internos.

**Verificar:**
```bash
npx tsc --noEmit && npm run lint
```

---

## Paso 6: Cloud Function — severity al crear abuseLog

1. En la Cloud Function de deteccion de abuso: agregar campo `severity` al crear docs en `abuseLogs`, usando el mapeo `{ rate_limit: 'low', top_writers: 'medium', flagged: 'high' }`.
2. No se requiere migracion de datos existentes (frontend usa `getSeverity()` con fallback).

**Verificar:**
```bash
npx tsc --noEmit && npm run lint && npm run test:run
```

---

## Paso 7: Verificacion final

1. `npx tsc --noEmit` — sin errores de tipos.
2. `npm run lint` — sin warnings nuevos.
3. `npm run test:run` — tests existentes pasan.
4. Test manual:
   - Verificar toast al recibir nueva alerta (onSnapshot).
   - Verificar badge de pendientes en tab Alertas.
   - Verificar vista Reincidentes con filtro de cantidad.
   - Verificar chip de severidad y filtro por severidad.
   - Verificar export CSV incluye columna Severidad.

---

## Criterios de completitud

- [ ] onSnapshot reemplaza fetch estatico en AbuseAlerts (no mas useAsyncData)
- [ ] localUpdates eliminado — cambios reflejados automaticamente via snapshot
- [ ] Toast se muestra cuando llegan nuevas alertas sin recargar
- [ ] Badge en tab Alertas muestra cantidad de pendientes
- [ ] Vista Reincidentes: tabla de usuarios con >3 alertas, ordenable
- [ ] Filtro de cantidad minima en Reincidentes funciona (>3, >5, >10)
- [ ] Expandir usuario muestra historial completo con acciones
- [ ] Campo severity en tipo AbuseLog, converter actualizado
- [ ] Chip de severidad visible en tabla con colores correctos
- [ ] Filtro por severidad funcional e integrado en limpiar filtros
- [ ] Export CSV incluye columna Severidad
- [ ] Cloud Function escribe severity al crear abuseLog
- [ ] Compilacion limpia (tsc + lint + tests)
