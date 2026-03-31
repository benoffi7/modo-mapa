# Specs: Account deletion & cleanup audit log

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

### Coleccion `deletionAuditLogs`

Nueva coleccion append-only para registrar el resultado de cada operacion de eliminacion/limpieza.

```typescript
// functions/src/utils/deleteUserData.ts
export interface DeletionResult {
  collectionsProcessed: number;
  collectionsFailed: string[];
  storageFilesDeleted: number;
  storageFilesFailed: number;
  aggregatesCorrected: boolean;
  durationMs: number;
}

// functions/src/utils/deleteUserData.ts (junto a DeletionResult)
export type DeletionType = 'account_delete' | 'anonymous_clean';
export type DeletionStatus = 'success' | 'partial_failure' | 'failure';

export interface DeletionAuditLog {
  uidHash: string;           // SHA-256 truncado 12 chars, nunca UID raw
  type: DeletionType;
  status: DeletionStatus;
  collectionsProcessed: number;
  collectionsFailed: string[];
  storageFilesDeleted: number;
  storageFilesFailed: number;
  aggregatesCorrected: boolean;
  durationMs: number;
  triggeredBy: 'user';       // siempre self-service por ahora
  timestamp: Timestamp;      // FieldValue.serverTimestamp()
}
```

```typescript
// src/types/admin.ts (frontend — para el panel admin)
export interface DeletionAuditLogEntry {
  id: string;
  uidHash: string;
  type: 'account_delete' | 'anonymous_clean';
  status: 'success' | 'partial_failure' | 'failure';
  collectionsProcessed: number;
  collectionsFailed: string[];
  storageFilesDeleted: number;
  storageFilesFailed: number;
  aggregatesCorrected: boolean;
  durationMs: number;
  triggeredBy: 'user';
  timestamp: Date;
}
```

### Tipo `deletion_failure` en `AbuseLogEntry`

Agregar `'deletion_failure'` al union type de `AbuseLogEntry.type` y al `SEVERITY_MAP` con severity `'high'`.

```typescript
// functions/src/utils/abuseLogger.ts
export interface AbuseLogEntry {
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers' | 'recipient_flood' | 'anon_flood' | 'ip_rate_limit' | 'deletion_failure';
  // ...
}

const SEVERITY_MAP = {
  // ... existing entries ...
  deletion_failure: 'high',
};
```

Nota: el tipo `AbuseLog` del frontend (`src/types/admin.ts`) tambien necesita el nuevo tipo para que el tab Alertas lo muestre correctamente. Hay divergencia actual entre server y frontend (server tiene 6 tipos, frontend tiene 3). Este feature agrega `'deletion_failure'` a ambos.

## Firestore Rules

### Nueva regla para `deletionAuditLogs`

```
// firestore.rules — agregar despues de la regla de abuseLogs
// Audit logs de eliminacion — solo admin puede leer.
// Cloud Functions escribe con admin SDK.
match /deletionAuditLogs/{docId} {
  allow read: if isAdmin();
  allow create, update, delete: if false;
}
```

Patron identico a `abuseLogs`: admin-only read, Cloud Functions-only write via admin SDK.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `fetchDeletionAuditLogs` callable (functions) | `deletionAuditLogs` | Admin SDK (bypasses rules) | N/A — admin SDK | No |
| Persist audit log in `deleteUserAccount` | `deletionAuditLogs` | Admin SDK (Cloud Function) | N/A — admin SDK | No |
| Persist audit log in `cleanAnonymousData` | `deletionAuditLogs` | Admin SDK (Cloud Function) | N/A — admin SDK | No |
| Persist abuse log on failure | `abuseLogs` | Admin SDK (Cloud Function) | N/A — admin SDK | No |

No hay queries desde el cliente directo a `deletionAuditLogs` — todo pasa por el callable admin que usa admin SDK.

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| `deletionAuditLogs` | (todos) | N/A — `allow create: if false` | N/A — `allow update: if false` | No — solo admin SDK escribe |

No se necesita whitelist porque el cliente nunca escribe a esta coleccion.

## Cloud Functions

### Refactorear `deleteAllUserData` (S2)

**Archivo:** `functions/src/utils/deleteUserData.ts`

Cambios:

1. Retornar `DeletionResult` en lugar de `void`.
2. Envolver `processCollection` individual en try/catch, acumulando `collectionsFailed`.
3. Envolver `correctAggregates` en try/catch, reportando en `aggregatesCorrected`.
4. Contabilizar Storage files eliminados vs fallidos (reemplazar `.catch(() => {})`).
5. Medir duracion con `Date.now()`.

### Nuevo callable `fetchDeletionAuditLogs` (S4)

**Archivo:** `functions/src/admin/deletionAuditLogs.ts`

- Valida admin con `assertAdmin`.
- `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`.
- Paginado: `pageSize` (default 50, max 200), `startAfter` (timestamp string ISO).
- Filtros: `type` ('account_delete' | 'anonymous_clean' | undefined), `status` ('success' | 'partial_failure' | 'failure' | undefined).
- Orden: `timestamp` desc.
- Retorna `{ logs: DeletionAuditLog[], hasMore: boolean }`.

### Actualizar `deleteUserAccount` y `cleanAnonymousData`

Ambos callables:

1. Reciben `DeletionResult` de `deleteAllUserData`.
2. Determinan `status` segun resultado.
3. Persisten audit log en `deletionAuditLogs` con admin SDK.
4. Si `status !== 'success'`, llaman `logAbuse` con tipo `'deletion_failure'`.

## Componentes

### `DeletionAuditPanel` (nuevo)

**Ruta:** `src/components/admin/audit/DeletionAuditPanel.tsx`
**Props:** ninguna (componente raiz de tab).
**Renderiza en:** Tab 16 de `AdminLayout` (index 16, despues de "Logros").
**Patron:** `useAsyncData` + `AdminPanelWrapper`.

Comportamiento:

- KPI cards: total eliminaciones, tasa de exito (%), ultima eliminacion (fecha relativa).
- Filtros: tipo (Chip toggles), status (Chip toggles).
- Tabla: fecha, tipo, status (chip coloreado), colecciones procesadas, duracion.
- Fila expandible: colecciones fallidas, detalles Storage, aggregates corregidos.
- Paginacion: boton "Cargar mas" (50 por pagina).

### `AuditKpiCards` (nuevo)

**Ruta:** `src/components/admin/audit/AuditKpiCards.tsx`
**Props:** `{ logs: DeletionAuditLogEntry[] }`
**Renderiza en:** arriba de la tabla en `DeletionAuditPanel`.

3 tarjetas: Total, Tasa exito, Ultima eliminacion.

### `auditHelpers.ts` (nuevo)

**Ruta:** `src/components/admin/audit/auditHelpers.ts`
**Contenido:** constantes (STATUS_COLORS, TYPE_LABELS, PAGE_SIZE) y funciones helper (computeKpis, formatDuration).

### Mutable prop audit

No aplica. `DeletionAuditPanel` es read-only (no modifica datos). No hay props mutables.

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Auditorias" | Tab label en AdminLayout | sin tilde en i (correcto) |
| "Eliminacion de cuenta" | TYPE_LABELS en auditHelpers | sin tilde en o (decision: helpers admin no son user-facing) |
| "Limpieza anonimo" | TYPE_LABELS en auditHelpers | sin tilde en o |
| "Exito" | STATUS chip label | sin tilde en E |
| "Fallo parcial" | STATUS chip label | |
| "Fallo total" | STATUS chip label | |
| "Total eliminaciones" | KPI card title | |
| "Tasa de exito" | KPI card title | sin tilde en e |
| "Ultima eliminacion" | KPI card title | sin tilde en u y o |
| "No se pudieron cargar los datos." | AdminPanelWrapper default | ya existe |
| "Cargar mas" | Boton paginacion | sin tilde en a |

Nota: Panel admin no es user-facing (solo admin). Los textos siguen la convencion de los otros paneles admin que no usan tildes consistentemente.

## Hooks

No se crean hooks nuevos. El panel usa `useAsyncData` existente con un `useCallback` wrapping el callable.

## Servicios

### `src/services/admin/audit.ts` (nuevo)

```typescript
export interface FetchAuditLogsParams {
  pageSize?: number;
  startAfter?: string;  // ISO timestamp
  type?: 'account_delete' | 'anonymous_clean';
  status?: 'success' | 'partial_failure' | 'failure';
}

export interface FetchAuditLogsResponse {
  logs: DeletionAuditLogEntry[];
  hasMore: boolean;
}

export async function fetchDeletionAuditLogs(
  params?: FetchAuditLogsParams,
): Promise<FetchAuditLogsResponse>
```

Usa `httpsCallable` para llamar al callable `fetchDeletionAuditLogs`.

## Integracion

### Archivos existentes a modificar

| Archivo | Cambio |
|---------|--------|
| `functions/src/utils/deleteUserData.ts` | Refactorear `deleteAllUserData` para retornar `DeletionResult` |
| `functions/src/utils/abuseLogger.ts` | Agregar `'deletion_failure'` al type union y SEVERITY_MAP |
| `functions/src/callable/deleteUserAccount.ts` | Persistir audit log, manejar DeletionResult |
| `functions/src/callable/cleanAnonymousData.ts` | Persistir audit log, manejar DeletionResult |
| `functions/src/index.ts` | Exportar `fetchDeletionAuditLogs` |
| `src/components/admin/AdminLayout.tsx` | Agregar tab 16 "Auditorias" + import |
| `src/types/admin.ts` | Agregar `DeletionAuditLogEntry` y actualizar `AbuseLog.type` |
| `src/constants/admin.ts` | Agregar `'deletion_failure'` a `ABUSE_TYPE_LABELS` y `ABUSE_TYPE_COLORS` |
| `src/config/collections.ts` | Agregar `DELETION_AUDIT_LOGS: 'deletionAuditLogs'` |

### Preventive checklist

- [x] **Service layer**: `DeletionAuditPanel` usara `src/services/admin/audit.ts`, no importa `firebase/firestore`
- [x] **Duplicated constants**: STATUS_COLORS y TYPE_LABELS iran en `auditHelpers.ts` (patron de `alertsHelpers.ts`)
- [x] **Context-first data**: No aplica — datos no estan en ningun context
- [x] **Silent .catch**: Los `.catch(() => {})` existentes en `deleteAllUserData` seran reemplazados por conteo de errores
- [x] **Stale props**: Panel es read-only, no hay props mutables

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/utils/deleteUserData.test.ts` | `DeletionResult` con exito total, fallo parcial (coleccion falla), fallo Storage, fallo aggregates. Conteos correctos. | Service |
| `functions/src/admin/deletionAuditLogs.test.ts` | Validacion admin, paginacion, filtros por type/status, orden timestamp desc | Callable |
| `functions/src/callable/deleteUserAccount.test.ts` | Persistencia audit log post-eliminacion, status derivado del result, abuse log en fallo | Callable |
| `functions/src/callable/cleanAnonymousData.test.ts` | Persistencia audit log post-limpieza, status derivado del result | Callable |
| `functions/src/utils/abuseLogger.test.ts` | Actualizar test existente para incluir `deletion_failure` con severity `high` | Service |

### Casos a cubrir

- [x] `deleteAllUserData` retorna exito total (0 collectionsFailed, aggregatesCorrected true)
- [x] `deleteAllUserData` fallo parcial (1+ coleccion falla, resto exitoso)
- [x] `deleteAllUserData` fallo de Storage (storageFilesFailed > 0)
- [x] `deleteAllUserData` fallo de aggregates (aggregatesCorrected false)
- [x] `deleteUserAccount` persiste audit log con status correcto
- [x] `deleteUserAccount` crea abuse log cuando status != success
- [x] `fetchDeletionAuditLogs` rechaza no-admin
- [x] `fetchDeletionAuditLogs` pagina correctamente
- [x] `fetchDeletionAuditLogs` filtra por type y status

### Mock strategy

- Firestore: mock `db.collection().add()`, `db.collection().where().orderBy().limit().get()`
- Auth: mock `assertAdmin` para admin/no-admin
- Storage: mock `getStorage().bucket()` con `.deleteFiles()` y `.file().delete()`
- `deleteAllUserData`: mock para tests de callables (solo testear integracion)

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos (exito/parcial/fallo)
- Side effects verificados (escritura a `deletionAuditLogs`, escritura a `abuseLogs` en fallo)

## Analytics

No aplica. Panel admin no emite eventos de analytics GA4.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Audit logs (admin) | Sin cache | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Persistir audit log | Server-side (Cloud Function) | N/A |

### Fallback UI

`AdminPanelWrapper` ya maneja estados de error de red. No se necesita UI adicional.

---

## Decisiones tecnicas

1. **Audit log persiste via admin SDK en la misma Cloud Function** (no trigger separado). Razon: el callable ya tiene el contexto completo (uidHash, tipo, resultado). Un trigger separado agregaria latencia y complejidad sin beneficio.

2. **Callable admin para consultar logs** (no lectura directa de Firestore). Razon: sigue el patron existente de admin callables (`getAuthStats`, `getStorageStats`). Permite filtros server-side y paginacion controlada.

3. **`DeletionResult` vive en `deleteUserData.ts`** (no en archivo de tipos separado). Razon: es el tipo de retorno de la funcion en ese archivo. Los callables lo importan de ahi.

4. **Status derivado del `DeletionResult`**: `collectionsFailed.length === 0 && aggregatesCorrected ? 'success' : collectionsFailed.length === USER_OWNED_COLLECTIONS.length ? 'failure' : 'partial_failure'`.

5. **No agregar `deletionAuditLogs` al `USER_OWNED_COLLECTIONS` registry**. Razon: los audit logs no son datos del usuario — son registros de compliance que deben persistir post-eliminacion. El `uidHash` es irreversible.

6. **Actualizar `AbuseLog.type` en frontend** para incluir los 4 tipos que el servidor ya genera pero el frontend no tipea (`recipient_flood`, `anon_flood`, `ip_rate_limit`, `deletion_failure`). Esto es deuda tecnica preexistente que se corrige como parte de este feature.

---

## Hardening de seguridad

### Firestore rules requeridas

```
// Despues de abuseLogs en firestore.rules
match /deletionAuditLogs/{docId} {
  allow read: if isAdmin();
  allow create, update, delete: if false;
}
```

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| `deletionAuditLogs` | N/A — solo admin SDK escribe | No requiere rate limit (no hay escritura de usuario) |
| Callable `fetchDeletionAuditLogs` | Heredado de admin callables | `assertAdmin()` + App Check (solo admin puede llamar) |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Lectura directa de audit logs | `isAdmin()` en rules | `firestore.rules` |
| Scraping via callable | `assertAdmin()` + App Check | `functions/src/admin/deletionAuditLogs.ts` |
| Inyeccion de audit logs falsos | `allow create: if false` en rules + solo admin SDK | `firestore.rules` |
| Deducir UIDs desde uidHash | SHA-256 truncado 12 chars — collision-resistant pero no reversible | `functions/src/callable/deleteUserAccount.ts` |

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| `.catch(() => {})` en `deleteAllUserData` Storage cleanup | Reemplazar con conteo explicito de errores en `DeletionResult` | Fase 1, paso 1 |
| `.catch(() => {})` en likeCount/follower count corrections | Envolver en try/catch con reporte en `aggregatesCorrected` | Fase 1, paso 1 |
| `deleteUserAccount.test.ts` pendiente | Escribir tests como parte de este feature | Fase 3, paso 3 |
| `AbuseLog.type` divergencia frontend/server (3 vs 6 tipos) | Sincronizar agregando los 4 tipos faltantes | Fase 2, paso 5 |
