# Plan: Account deletion & cleanup audit log

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Backend — Refactorear `deleteAllUserData` + tipo `DeletionResult`

**Branch:** `feat/258-deletion-audit`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/utils/deleteUserData.ts` | Agregar interface `DeletionResult` y tipos `DeletionType`, `DeletionStatus`. Cambiar firma de `deleteAllUserData` para retornar `Promise<DeletionResult>`. Envolver cada `processCollection` en try/catch individual, acumulando `collectionsFailed`. Envolver `correctAggregates` en try/catch. Reemplazar `.catch(() => {})` en Storage por conteo de `storageFilesDeleted`/`storageFilesFailed`. Reemplazar `.catch(() => {})` en likeCount/follower corrections con try/catch que setea `aggregatesCorrected = false`. Medir duracion con `Date.now()` al inicio y fin. |
| 2 | `functions/src/utils/abuseLogger.ts` | Agregar `'deletion_failure'` al union type de `AbuseLogEntry.type` y al `SEVERITY_MAP` con valor `'high'`. |

### Fase 2: Backend — Callables + audit log persistence

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/callable/deleteUserAccount.ts` | Importar `DeletionResult`, `logAbuse`. Recibir resultado de `deleteAllUserData`. Calcular `status` segun `collectionsFailed.length` y `aggregatesCorrected`. Persistir doc en `deletionAuditLogs` con admin SDK (`db.collection('deletionAuditLogs').add({...})`). Si `status !== 'success'`, llamar `logAbuse` con tipo `'deletion_failure'`. El `uidHash` ya se calcula — reutilizar. |
| 2 | `functions/src/callable/cleanAnonymousData.ts` | Mismos cambios que paso 1. Tipo `'anonymous_clean'` en lugar de `'account_delete'`. |
| 3 | `functions/src/admin/deletionAuditLogs.ts` | Crear callable `fetchDeletionAuditLogs`. Validar admin con `assertAdmin`. Construir query con filtros opcionales (`type`, `status`). Ordenar por `timestamp` desc. Limitar a `pageSize` (default 50, max 200). Soportar `startAfter` para paginacion. Retornar `{ logs, hasMore }`. |
| 4 | `functions/src/index.ts` | Agregar `export { fetchDeletionAuditLogs } from './admin/deletionAuditLogs'`. |
| 5 | `src/types/admin.ts` | Agregar interface `DeletionAuditLogEntry`. Actualizar `AbuseLog.type` union para incluir `'deletion_failure'`, `'recipient_flood'`, `'anon_flood'`, `'ip_rate_limit'` (sincronizar con server). |
| 6 | `src/constants/admin.ts` | Agregar `'deletion_failure'`, `'recipient_flood'`, `'anon_flood'`, `'ip_rate_limit'` a `ABUSE_TYPE_LABELS` y `ABUSE_TYPE_COLORS`. |
| 7 | `src/config/collections.ts` | Agregar `DELETION_AUDIT_LOGS: 'deletionAuditLogs'` al objeto `COLLECTIONS`. |
| 8 | `firestore.rules` | Agregar regla para `deletionAuditLogs` (read admin, write false) despues del bloque de `abuseLogs`. |

### Fase 3: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/utils/deleteUserData.test.ts` | Crear test file. Mockear `db`, `getStorage`. Tests: exito total (retorna DeletionResult con 0 failed), fallo parcial (una coleccion falla, resto exitoso), fallo Storage (storageFilesFailed > 0 pero collectionsFailed.length = 0), fallo aggregates (aggregatesCorrected false). Verificar que conteos son correctos. |
| 2 | `functions/src/admin/deletionAuditLogs.test.ts` | Crear test file. Tests: rechaza no-admin (assertAdmin throws), retorna logs ordenados por timestamp desc, respeta pageSize, filtra por type, filtra por status, hasMore true cuando hay mas docs. |
| 3 | `functions/src/callable/deleteUserAccount.test.ts` | Crear test file. Mockear `deleteAllUserData`, `getAuth`, `logAbuse`. Tests: persiste audit log en `deletionAuditLogs` con campos correctos, status 'success' cuando DeletionResult exitoso, status 'partial_failure' cuando hay collectionsFailed, crea abuse log solo en fallo, rate limit funciona. |
| 4 | `functions/src/callable/cleanAnonymousData.test.ts` | Crear test file. Similar a paso 3 pero con tipo 'anonymous_clean' y sin deleteUser de Auth. |
| 5 | `functions/src/utils/abuseLogger.test.ts` | Actualizar test existente: agregar caso para `deletion_failure` con severity `high`. |

### Fase 4: Frontend — Panel admin

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/admin/audit.ts` | Crear service. Exportar `fetchDeletionAuditLogs(params?)` que usa `httpsCallable` para llamar al callable. Tipar request/response. |
| 2 | `src/components/admin/audit/auditHelpers.ts` | Crear helpers. Exportar: `STATUS_COLORS` (success=success, partial_failure=warning, failure=error), `TYPE_LABELS` (account_delete='Eliminacion de cuenta', anonymous_clean='Limpieza anonimo'), `STATUS_LABELS`, `PAGE_SIZE = 50`, `computeKpis(logs)` (total, successRate, lastDeletion), `formatDuration(ms)`. |
| 3 | `src/components/admin/audit/AuditKpiCards.tsx` | Crear componente. 3 StatCard (importar de `../StatCard`): total eliminaciones, tasa exito (%), ultima eliminacion. Recibe `logs: DeletionAuditLogEntry[]`. |
| 4 | `src/components/admin/audit/DeletionAuditPanel.tsx` | Crear componente raiz. `useAsyncData` + `AdminPanelWrapper`. Filtros con Chips (tipo, status). Tabla MUI con columnas: fecha, tipo, status (chip coloreado), colecciones, duracion. Filas expandibles con IconButton (KeyboardArrowDown/Up). Detalle expandible: colecciones fallidas (list), Storage stats, aggregates. Boton "Cargar mas" al final. |
| 5 | `src/components/admin/AdminLayout.tsx` | Importar `DeletionAuditPanel`. Agregar `<Tab label="Auditorias" />` despues de "Logros" (index 16). Agregar `{tab === 16 && <DeletionAuditPanel />}`. |

### Fase 5: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Agregar regla de `deletionAuditLogs` y nueva superficie del callable admin. |
| 2 | `docs/reference/firestore.md` | Agregar coleccion `deletionAuditLogs` a la tabla de colecciones. Agregar tipo `DeletionAuditLog` a la seccion de tipos. |
| 3 | `docs/reference/features.md` | Agregar tab 17 "Auditorias" a la seccion de admin panel. |
| 4 | `docs/reference/patterns.md` | Agregar `'deletion_failure'` al listado de abuse types si existe referencia. |
| 5 | `docs/reference/tests.md` | Agregar los 5 test files nuevos al inventario. |
| 6 | `docs/_sidebar.md` | Agregar entries de Specs y Plan bajo `#258 Deletion Audit Log`. |

---

## Orden de implementacion

1. `functions/src/utils/deleteUserData.ts` — tipo `DeletionResult` + refactoreo (base para todo lo demas)
2. `functions/src/utils/abuseLogger.ts` — nuevo tipo `deletion_failure`
3. `functions/src/callable/deleteUserAccount.ts` — consume `DeletionResult`, persiste audit log
4. `functions/src/callable/cleanAnonymousData.ts` — idem
5. `functions/src/admin/deletionAuditLogs.ts` — callable admin
6. `functions/src/index.ts` — export
7. `firestore.rules` — regla nueva
8. `src/types/admin.ts` — tipos frontend
9. `src/constants/admin.ts` — labels y colores
10. `src/config/collections.ts` — constante
11. `src/services/admin/audit.ts` — service layer
12. `src/components/admin/audit/auditHelpers.ts` — helpers
13. `src/components/admin/audit/AuditKpiCards.tsx` — KPI cards
14. `src/components/admin/audit/DeletionAuditPanel.tsx` — panel principal
15. `src/components/admin/AdminLayout.tsx` — integrar tab
16. Tests (pueden ir en paralelo desde paso 7)
17. Documentacion

---

## Estimacion de tamano de archivos

| Archivo | Lineas estimadas | Limite |
|---------|-----------------|--------|
| `functions/src/utils/deleteUserData.ts` (modificado) | ~250 | 400 |
| `functions/src/admin/deletionAuditLogs.ts` (nuevo) | ~80 | 400 |
| `functions/src/callable/deleteUserAccount.ts` (modificado) | ~80 | 400 |
| `functions/src/callable/cleanAnonymousData.ts` (modificado) | ~80 | 400 |
| `src/services/admin/audit.ts` (nuevo) | ~40 | 400 |
| `src/components/admin/audit/auditHelpers.ts` (nuevo) | ~60 | 400 |
| `src/components/admin/audit/AuditKpiCards.tsx` (nuevo) | ~50 | 400 |
| `src/components/admin/audit/DeletionAuditPanel.tsx` (nuevo) | ~200 | 400 |
| `functions/src/utils/deleteUserData.test.ts` (nuevo) | ~200 | 400 |
| `functions/src/admin/deletionAuditLogs.test.ts` (nuevo) | ~120 | 400 |
| `functions/src/callable/deleteUserAccount.test.ts` (nuevo) | ~150 | 400 |
| `functions/src/callable/cleanAnonymousData.test.ts` (nuevo) | ~120 | 400 |

Ningun archivo supera 400 lineas.

---

## Riesgos

1. **`deleteAllUserData` cambia de `void` a `DeletionResult`**: Los dos unicos consumidores (`deleteUserAccount`, `cleanAnonymousData`) se actualizan en la misma PR. No hay otros consumidores. Riesgo bajo.

2. **Audit log write falla en la Cloud Function**: Si `db.collection('deletionAuditLogs').add()` falla despues de que la eliminacion se completo, la eliminacion ya ocurrio pero no queda registro. Mitigacion: envolver en try/catch y loggear con `logger.error` — no bloquear el retorno exitoso al usuario.

3. **Tipo `AbuseLog` frontend divergente con server**: Agregar los 4 tipos faltantes puede impactar el tipado de `ABUSE_TYPE_LABELS` y `ABUSE_TYPE_COLORS`. Mitigacion: agregar todas las entradas en el mismo paso.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — usa `httpsCallable` via service
- [x] Archivos nuevos en `src/components/admin/audit/` — subdirectorio de dominio correcto
- [x] Logica de negocio en callable admin y helpers, no en componente
- [x] No se toca ningun archivo con deuda tecnica sin incluir el fix (`.catch(() => {})` se corrige)
- [x] Ningun archivo resultante supera 400 lineas

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Agregar regla de `deletionAuditLogs` y callable admin |
| 2 | `docs/reference/firestore.md` | Agregar coleccion `deletionAuditLogs` con campos y rules |
| 3 | `docs/reference/features.md` | Agregar tab "Auditorias" al admin panel |
| 4 | `docs/reference/tests.md` | Agregar 5 test files nuevos al inventario |
| 5 | `docs/_sidebar.md` | Agregar Specs y Plan entries |

---

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] `deleteAllUserData` retorna `DeletionResult` con conteos correctos
- [ ] `.catch(() => {})` silenciosos eliminados de `deleteAllUserData`
- [ ] Cada invocacion de delete/clean persiste audit log en `deletionAuditLogs`
- [ ] Fallos parciales/totales generan `abuseLog` tipo `deletion_failure`
- [ ] Callable `fetchDeletionAuditLogs` funciona con filtros y paginacion
- [ ] Tab "Auditorias" visible en admin panel con KPIs, filtros, tabla expandible
- [ ] Firestore rules bloquean lectura no-admin y escritura cliente
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds (frontend + functions)
- [ ] Reference docs updated (security.md, firestore.md, features.md, tests.md)
- [ ] `AbuseLog.type` sincronizado entre frontend y server
