# Specs: Enhanced Abuse Alerts — Fase 3

**Feature:** enhanced-abuse-alerts (Fase 3)
**Issue:** [#162](https://github.com/benoffi7/modo-mapa/issues/162)
**PRD:** [prd-fase3.md](./prd-fase3.md)
**Fecha:** 2026-03-17

---

## Cambios respecto a fases anteriores

Fase 1 (implementada): KPI cards, filtro de fechas, CSV export.
Fase 2 (implementada): Acciones revisar/descartar, filtro de estado, detalle de usuario con badge reincidente.
Fase 3: Notificaciones realtime (onSnapshot), vista de reincidentes, campo severity.

---

## 1. Migrar fetchAbuseLogs a onSnapshot (S1)

### 1.1 Nuevo hook: `useAbuseLogsRealtime`

Crear un hook custom que reemplace el patrón `useAsyncData(fetchAbuseLogs)` con una suscripción `onSnapshot`.

```typescript
// src/hooks/useAbuseLogsRealtime.ts
import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { abuseLogConverter } from '../config/adminConverters';
import type { AbuseLog } from '../types/admin';

interface UseAbuseLogsRealtimeReturn {
  logs: AbuseLog[] | null;
  loading: boolean;
  error: boolean;
  newCount: number;         // docs nuevos desde la primera carga
  resetNewCount: () => void;
}

export function useAbuseLogsRealtime(maxDocs = 200): UseAbuseLogsRealtimeReturn
```

**Lógica interna:**

1. Estado: `logs`, `loading` (init `true`), `error`, `newCount`, `initialIds` (Set de IDs del primer snapshot).
2. `useEffect` crea la query: `query(collection(...).withConverter(abuseLogConverter), orderBy('timestamp', 'desc'), limit(maxDocs))`.
3. `onSnapshot(q, snapshot => { ... }, error => { ... })`.
4. En el callback de snapshot:
   - Si `initialIds.current` es null (primer snapshot): guardar todos los IDs en el Set, `newCount = 0`.
   - En snapshots posteriores: contar docs cuyo ID no esta en `initialIds` y que fueron `type === 'added'` en `snapshot.docChanges()`. Sumar al `newCount` existente.
   - Actualizar `logs` con `snapshot.docs.map(d => d.data())`.
   - `loading = false`.
5. `resetNewCount`: pone `newCount = 0` y agrega los IDs actuales al Set de `initialIds`.
6. Cleanup: `useEffect` retorna el `unsubscribe` de onSnapshot.

**Dedup de newCount:** Se usa `docChanges()` con filtro `type === 'added'` para evitar contar modificaciones (review/dismiss) como alertas nuevas.

### 1.2 Reemplazar useAsyncData en AbuseAlerts

```typescript
// Antes (AbuseAlerts.tsx línea 42-43):
const fetcher = useCallback(() => fetchAbuseLogs(200), []);
const { data: logs, loading, error } = useAsyncData(fetcher);

// Después:
const { logs, loading, error, newCount, resetNewCount } = useAbuseLogsRealtime(200);
```

Se elimina el import de `fetchAbuseLogs` y `useAsyncData`. Se elimina `localUpdates` ya que onSnapshot refleja los cambios de review/dismiss en tiempo real.

### 1.3 Eliminar localUpdates

Con onSnapshot, cuando el admin marca una alerta como revisada/descartada, el snapshot se actualiza automáticamente con el cambio. Se elimina:
- Estado `localUpdates` y su `setLocalUpdates`.
- El memo `effectiveLogs` (se usa `logs` directamente).
- Las llamadas a `setLocalUpdates` en `handleReview` y `handleDismiss`.

---

## 2. Toast de nuevas alertas (S1)

### 2.1 Integración con useToast

En `AbuseAlerts.tsx`, agregar efecto que muestra toast cuando `newCount` cambia:

```typescript
const toast = useToast();
const prevNewCount = useRef(0);

useEffect(() => {
  if (newCount > 0 && newCount !== prevNewCount.current) {
    toast.warning(
      newCount === 1
        ? '1 alerta nueva de abuso'
        : `${newCount} alertas nuevas de abuso`
    );
    prevNewCount.current = newCount;
  }
}, [newCount, toast]);
```

**Severity del toast:** `warning` (amarillo) para mantener la urgencia sin alarmar con `error`.

**Dedup:** El ref `prevNewCount` evita mostrar el mismo toast si el componente re-renderiza sin que cambie `newCount`. Cada nuevo batch de docs incrementa `newCount`, disparando un nuevo toast solo cuando el valor cambia.

**Condición:** Solo se muestra si el componente esta montado (tab activo). Si el admin esta en otro tab, vera el badge al volver (sección 3).

---

## 3. Badge de pendientes en tab de Alertas (S1)

### 3.1 Problema de arquitectura

El tab "Alertas" se renderiza en `AdminLayout.tsx` (línea 46), pero el conteo de pendientes se calcula dentro de `AbuseAlerts.tsx`. El componente `AbuseAlerts` solo se monta cuando `tab === 6`.

### 3.2 Solución: pendingCount como prop callback

Agregar prop `onPendingCount` a `AbuseAlerts` para comunicar el conteo al layout:

```typescript
// AbuseAlerts.tsx
interface AbuseAlertsProps {
  onPendingCount?: (count: number) => void;
}

export default function AbuseAlerts({ onPendingCount }: AbuseAlertsProps) {
  // ... existente

  // Comunicar pendientes al parent
  const pendingCount = useMemo(() => {
    if (!logs) return 0;
    return logs.filter(l => !l.reviewed && !l.dismissed).length;
  }, [logs]);

  useEffect(() => {
    onPendingCount?.(pendingCount);
  }, [pendingCount, onPendingCount]);
}
```

En `AdminLayout.tsx`:

```typescript
const [alertsPendingCount, setAlertsPendingCount] = useState(0);

// En el Tab:
<Tab label={
  <Badge badgeContent={alertsPendingCount} color="error" max={99}>
    Alertas
  </Badge>
} />

// En el render:
{tab === 6 && <AbuseAlerts onPendingCount={setAlertsPendingCount} />}
```

**Limitación:** El badge solo se actualiza cuando el tab de Alertas esta montado (ha sido visitado al menos una vez). Esto es aceptable para Fase 3: el admin vera el badge con el conteo de la ultima vez que visito el tab. Para actualización continua sin montar el componente, se requeriría un context global (out of scope).

**Alternativa evaluada y descartada:** Mover la suscripción onSnapshot a un context global. Rechazada porque:
- Solo un admin usa el panel, no justifica complejidad adicional.
- La suscripción activa consume reads de Firestore incluso en otros tabs.
- El badge con dato de la ultima visita es suficiente para el caso de uso.

---

## 4. Vista de reincidentes (S2)

### 4.1 Nuevo componente: `ReincidentesView`

```typescript
// src/components/admin/alerts/ReincidentesView.tsx
interface ReincidenteRow {
  userId: string;
  totalAlerts: number;
  topType: AbuseLog['type'];
  lastAlertDate: Date;
  pendingCount: number;
  alerts: AbuseLog[];  // historial completo del usuario
}

interface Props {
  logs: AbuseLog[];
}

export default function ReincidentesView({ logs }: Props)
```

### 4.2 Cálculo de datos (useMemo)

```typescript
const reincidentes = useMemo(() => {
  const byUser = new Map<string, AbuseLog[]>();
  for (const log of logs) {
    const arr = byUser.get(log.userId) ?? [];
    arr.push(log);
    byUser.set(log.userId, arr);
  }

  const rows: ReincidenteRow[] = [];
  for (const [userId, userLogs] of byUser) {
    if (userLogs.length <= minAlerts) continue; // filtro dinámico

    // Tipo más frecuente
    const typeCounts: Record<string, number> = {};
    for (const l of userLogs) typeCounts[l.type] = (typeCounts[l.type] ?? 0) + 1;
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0] as AbuseLog['type'];

    // Última alerta
    const lastAlertDate = userLogs.reduce((max, l) => l.timestamp > max ? l.timestamp : max, userLogs[0].timestamp);

    // Pendientes
    const pendingCount = userLogs.filter(l => !l.reviewed && !l.dismissed).length;

    rows.push({ userId, totalAlerts: userLogs.length, topType, lastAlertDate, pendingCount, alerts: userLogs });
  }

  return rows.sort((a, b) => b.totalAlerts - a.totalAlerts);
}, [logs, minAlerts]);
```

### 4.3 Columnas de la tabla

| Columna | Contenido | Ordenable |
|---------|-----------|-----------|
| Usuario | userId truncado a 12 chars, monospace | No |
| Total alertas | Número con Badge | Si (default DESC) |
| Tipo frecuente | Chip con color del tipo | No |
| Última alerta | Fecha formateada con `formatDateShort` | Si |
| Pendientes | Número (rojo si > 0) | Si |
| Expandir | IconButton arrow | No |

### 4.4 Filtro por cantidad mínima de alertas

Chips toggle con opciones:

```typescript
const MIN_ALERTS_OPTIONS = [
  { key: 3, label: '> 3 alertas' },
  { key: 5, label: '> 5 alertas' },
  { key: 10, label: '> 10 alertas' },
];
```

Estado: `minAlerts` (default: `3`). Se usa en el `useMemo` de `reincidentes` con filtro `userLogs.length > minAlerts`.

### 4.5 Expandir historial de usuario

Click en una fila expande un panel colapsable (mismo patrón que la tabla principal) con:
- Lista de alertas del usuario, ordenadas por fecha DESC.
- Cada alerta muestra: tipo (chip), colección, detalle (truncado), fecha, estado (revisada/descartada/pendiente).
- Botones Revisar/Descartar en alertas pendientes (reutiliza los handlers existentes).

Estado: `expandedUserId: string | null`.

### 4.6 Integración con AbuseAlerts (tabs internos)

Agregar tabs internos dentro de `AbuseAlerts`:

```typescript
const [innerTab, setInnerTab] = useState<'alerts' | 'reincidentes'>('alerts');

// Debajo de los KPI cards:
<Tabs value={innerTab} onChange={(_, v) => setInnerTab(v)} sx={{ mb: 2 }}>
  <Tab value="alerts" label="Alertas" />
  <Tab value="reincidentes" label={
    <Badge badgeContent={reincidentesCount} color="error" max={99}>
      Reincidentes
    </Badge>
  } />
</Tabs>

{innerTab === 'alerts' && (
  // ... contenido actual (filtros + tabla)
)}
{innerTab === 'reincidentes' && (
  <ReincidentesView logs={logs ?? []} />
)}
```

`reincidentesCount`: cantidad de usuarios con > 3 alertas, calculado en `useMemo` sobre `logs`.

Los KPI cards se muestran siempre (fuera de los tabs internos), ya que aplican a todo el dataset.

---

## 5. Campo severity en AbuseLog (S3)

### 5.1 Tipo

```typescript
// src/types/admin.ts — agregar a AbuseLog
export type AbuseSeverity = 'low' | 'medium' | 'high';

export interface AbuseLog {
  // ... existentes
  severity?: AbuseSeverity;  // opcional para backwards compat
}
```

### 5.2 Mapeo por defecto

Función pura en `alertsHelpers.ts`:

```typescript
export const SEVERITY_MAP: Record<AbuseLog['type'], AbuseSeverity> = {
  rate_limit: 'low',
  top_writers: 'medium',
  flagged: 'high',
};

export function getSeverity(log: AbuseLog): AbuseSeverity {
  return log.severity ?? SEVERITY_MAP[log.type];
}
```

Se usa `getSeverity()` en vez de acceder directamente a `log.severity`, garantizando fallback para docs existentes sin el campo.

### 5.3 Converter update

En `adminConverters.ts`, leer el nuevo campo:

```typescript
// abuseLogConverter.fromFirestore:
severity: (d.severity === 'low' || d.severity === 'medium' || d.severity === 'high')
  ? d.severity
  : undefined,
```

### 5.4 Indicador visual

Chip de severidad en cada fila de la tabla, junto al chip de tipo:

| Severity | Color | Label |
|----------|-------|-------|
| `low` | `default` (gris) | Baja |
| `medium` | `warning` (amarillo) | Media |
| `high` | `error` (rojo) | Alta |

```typescript
export const SEVERITY_CONFIG: Record<AbuseSeverity, { label: string; color: 'default' | 'warning' | 'error' }> = {
  low: { label: 'Baja', color: 'default' },
  medium: { label: 'Media', color: 'warning' },
  high: { label: 'Alta', color: 'error' },
};
```

En la tabla, agregar columna "Severidad" entre "Tipo" y "Usuario":

```tsx
<TableCell>
  <Chip
    label={SEVERITY_CONFIG[getSeverity(log)].label}
    color={SEVERITY_CONFIG[getSeverity(log)].color}
    size="small"
    variant="outlined"
  />
</TableCell>
```

### 5.5 Filtro por severidad

Chips toggle en la fila de filtros (después de los filtros de estado):

```typescript
type SeverityFilter = AbuseSeverity | 'all';

const SEVERITY_FILTER_OPTIONS: { key: SeverityFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'high', label: 'Alta' },
  { key: 'medium', label: 'Media' },
  { key: 'low', label: 'Baja' },
];
```

Estado: `severityFilter: SeverityFilter` (default: `'all'`).

Agregar al `useMemo` de `filtered`:

```typescript
if (severityFilter !== 'all') {
  result = result.filter(l => getSeverity(l) === severityFilter);
}
```

Incluir en `hasActiveFilters` y `clearFilters`.

### 5.6 Exportar severidad en CSV

Agregar columna "Severidad" al export CSV:

```typescript
// alertsHelpers.ts — exportToCsv
const header = 'Tipo,Severidad,Usuario,Colección,Detalle,Fecha';
// En el map de rows:
const severity = SEVERITY_CONFIG[getSeverity(log)].label;
return `${type},${severity},${log.userId},...`;
```

---

## 6. Firestore Rules

### 6.1 Permitir severity en update por admin

El campo `severity` se escribe desde Cloud Functions (admin SDK, bypasea rules) al crear el doc. Sin embargo, si en el futuro un admin pudiera cambiar la severidad desde el panel, se necesita actualizar las rules.

**Para Fase 3:** No se cambian las rules. Cloud Functions escribe `severity` al crear el abuseLog con admin SDK (bypasea rules). El admin solo lee y actualiza `reviewed/dismissed/reviewedAt` (ya permitido).

**Si se necesita override manual de severity (futuro):**

```
allow update: if isAdmin()
  && request.resource.data.diff(resource.data).affectedKeys()
    .hasOnly(['reviewed', 'dismissed', 'reviewedAt', 'severity'])
  && (
    !('severity' in request.resource.data.diff(resource.data).affectedKeys())
    || request.resource.data.severity in ['low', 'medium', 'high']
  );
```

### 6.2 Cloud Function: agregar severity al crear abuseLogs

En la Cloud Function que crea abuseLogs, agregar el campo `severity` basado en el tipo:

```typescript
// En la Cloud Function existente que escribe abuseLogs
const SEVERITY_MAP = { rate_limit: 'low', top_writers: 'medium', flagged: 'high' };

await db.collection('abuseLogs').add({
  // ... campos existentes
  severity: SEVERITY_MAP[type] ?? 'low',
});
```

**Nota:** Los docs existentes no tendrán el campo `severity`. El frontend usa `getSeverity()` con fallback al mapeo por tipo, por lo que es backwards compatible sin migración.

---

## 7. Archivos a modificar/crear

| Archivo | Acción | Detalle |
|---------|--------|---------|
| `src/hooks/useAbuseLogsRealtime.ts` | **Crear** | Hook con onSnapshot para abuse logs |
| `src/components/admin/AbuseAlerts.tsx` | Modificar | Reemplazar useAsyncData con useAbuseLogsRealtime, agregar toast, tabs internos, severity filter, eliminar localUpdates |
| `src/components/admin/alerts/ReincidentesView.tsx` | **Crear** | Componente de tabla de reincidentes |
| `src/components/admin/alerts/alertsHelpers.ts` | Modificar | Agregar SEVERITY_MAP, getSeverity, SEVERITY_CONFIG, SeverityFilter type, actualizar exportToCsv |
| `src/components/admin/AdminLayout.tsx` | Modificar | Badge en tab Alertas, prop onPendingCount |
| `src/types/admin.ts` | Modificar | Agregar AbuseSeverity type y campo severity a AbuseLog |
| `src/config/adminConverters.ts` | Modificar | Leer campo severity en abuseLogConverter |
| Cloud Function (abuse detection) | Modificar | Agregar severity al crear abuseLog |

---

## 8. Performance

### 8.1 onSnapshot con limit(200)

- La query usa `limit(200)` igual que el fetch actual. onSnapshot con limit no escucha toda la colección, solo mantiene los 200 docs más recientes por timestamp DESC.
- Costo: 200 reads iniciales + 1 read por cada doc que cambia. Comparable al fetch actual que hace 200 reads cada vez que se monta el componente.
- La suscripción se cancela en el cleanup del useEffect (unmount del componente cuando el admin cambia de tab).

### 8.2 Cálculos client-side

- `reincidentes` useMemo: O(N) donde N = logs.length (max 200). Iteración única + sort. Negligible.
- `getSeverity`: lookup O(1). Sin impacto.
- `pendingCount`: filtro sobre 200 docs. Negligible.

### 8.3 Re-renders por onSnapshot

Cada cambio en la query (doc añadido, modificado, eliminado) dispara un re-render del componente. Con el limit de 200 docs y la frecuencia baja de abuse logs (estimado < 10/día), esto no es un problema.

---

## 9. Dependencias nuevas

**Firebase imports adicionales:**
- `onSnapshot` de `firebase/firestore` (ya disponible, no usado en el proyecto actualmente)

**MUI imports adicionales en AbuseAlerts:**
- `Tabs`, `Tab` (para tabs internos alerts/reincidentes)

**No se agregan dependencias npm nuevas.**

---

## 10. Tests

No se agregan tests nuevos. Las funciones puras nuevas (`getSeverity`, `SEVERITY_MAP`) son triviales y se validan visualmente. Si el módulo `alertsHelpers.ts` crece significativamente, se extraen tests en una fase futura.

---

## 11. Migración de datos existentes

No se requiere migración. Los docs existentes sin campo `severity` usan el fallback `getSeverity()` que mapea por tipo. Los nuevos docs creados por Cloud Functions incluirán `severity` desde el deploy.
