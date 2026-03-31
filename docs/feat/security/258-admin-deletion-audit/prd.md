# PRD: Account deletion & cleanup audit log

**Feature:** 258-admin-deletion-audit
**Categoria:** security
**Fecha:** 2026-03-30
**Issue:** #258
**Prioridad:** Alta

---

## Contexto

El proyecto tiene dos Cloud Functions callable para eliminacion de datos de usuario: `deleteUserAccount` (usuarios email) y `cleanAnonymousData` (usuarios anonimos). Ambas invocan `deleteAllUserData` que recorre las 19 colecciones del registry `USER_OWNED_COLLECTIONS`, corrige aggregates y limpia Storage. Actualmente estas operaciones solo emiten un `logger.info` con un hash del UID, sin persistir ningun registro auditable en Firestore ni exponer informacion al admin panel (16 tabs, ninguna dedicada a audit trail de eliminaciones).

## Problema

- **Sin visibilidad admin**: No hay forma de verificar desde el panel de admin si una eliminacion de cuenta se ejecuto correctamente. El admin debe buscar en Cloud Functions logs manualmente.
- **Sin audit trail persistente**: Los logs de `logger.info` no constituyen un registro auditable para cumplimiento de GDPR. No persisten en Firestore y no tienen estructura suficiente para determinar exito parcial vs total.
- **Sin deteccion de fallos parciales**: `deleteAllUserData` ejecuta eliminaciones en paralelo (batches de 5) y Storage cleanup es best-effort con `.catch(() => {})`. Si una coleccion falla, no hay registro de que colecciones se limpiaron y cuales no.

## Solucion

### S1. Coleccion Firestore `deletionAuditLogs`

Crear una nueva coleccion `deletionAuditLogs` para persistir el resultado de cada operacion de eliminacion/limpieza:

- **Campos**: `uidHash` (string, SHA-256 truncado 12 chars -- nunca UID raw), `type` ('account_delete' | 'anonymous_clean'), `status` ('success' | 'partial_failure' | 'failure'), `collectionsProcessed` (number), `collectionsFailed` (string[] -- nombres de colecciones que fallaron), `storageFilesDeleted` (number), `storageFilesFailed` (number), `aggregatesCorrected` (boolean), `duration` (number, ms), `timestamp` (server timestamp), `triggeredBy` ('user' -- siempre self-service por ahora).
- **No almacenar UID raw**: Solo el hash SHA-256 truncado para mantener la privacidad post-eliminacion.
- **Firestore rules**: Solo lectura admin. Escritura solo via admin SDK (Cloud Functions).

Referencia: sigue el patron de `abuseLogs` (admin-only read, Functions-only write, `FieldValue.serverTimestamp()`).

### S2. Refactorear `deleteAllUserData` para reportar resultado

Modificar `deleteAllUserData` en `functions/src/utils/deleteUserData.ts` para que retorne un resultado estructurado en lugar de `void`:

- Envolver cada `processCollection` en try/catch individual, registrando exitos y fallos.
- Contabilizar Storage files eliminados vs fallidos (actualmente best-effort silencioso).
- Contabilizar si `correctAggregates` fue exitoso.
- Retornar un objeto `DeletionResult` con toda la informacion necesaria para el audit log.

Las Cloud Functions `deleteUserAccount` y `cleanAnonymousData` recibiran este resultado y lo persistiran en `deletionAuditLogs` antes de retornar al cliente.

### S3. Panel admin: tab "Auditorias"

Crear un nuevo panel admin `DeletionAuditPanel` como tab 17 en `AdminLayout`:

- **Tabla**: lista de audit logs con columnas: fecha, tipo (cuenta/anonimo), status (chip coloreado), colecciones procesadas, duracion.
- **Detalle expandible**: al hacer click en una fila, mostrar colecciones fallidas, detalles de Storage, y si los aggregates se corrigieron.
- **Filtros**: por tipo (account_delete/anonymous_clean/todos) y por status (success/partial_failure/failure/todos).
- **KPI cards**: total eliminaciones, tasa de exito, ultima eliminacion.
- **Integracion con alertas**: si `status === 'partial_failure'` o `status === 'failure'`, crear un `abuseLog` de tipo nuevo `deletion_failure` con severity `high` para que aparezca en el tab de Alertas existente.

Patron: seguir `AdminPanelWrapper` + `useAsyncData` como todos los paneles admin existentes. Descomponer en subdirectorio `admin/audit/` con helpers y subcomponentes (patron de `admin/perf/` y `admin/alerts/`).

### S4. Admin callable para consultar audit logs

Crear un nuevo callable `fetchDeletionAuditLogs` en `functions/src/admin/` que:

- Valide admin con `assertAdmin`.
- Use `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`.
- Retorne los ultimos N registros (paginado, default 50) de `deletionAuditLogs` ordenados por timestamp desc.
- Soporte filtros por `type` y `status`.

Referencia: mismo patron que `authStats`, `storageStats` y otros admin callables.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Coleccion `deletionAuditLogs` + Firestore rules | Must | S |
| Tipo `DeletionResult` en `functions/src/utils/deleteUserData.ts` | Must | S |
| Refactorear `deleteAllUserData` para retornar `DeletionResult` | Must | M |
| Actualizar `deleteUserAccount` y `cleanAnonymousData` para persistir audit log | Must | S |
| Tipo `deletion_failure` en `abuseLogger.ts` + integracion | Must | S |
| Callable `fetchDeletionAuditLogs` en `functions/src/admin/` | Must | S |
| Componente `DeletionAuditPanel` + subdirectorio `admin/audit/` | Must | M |
| Tab 17 en `AdminLayout` | Must | S |
| Tests para `deleteAllUserData` refactoreado | Must | M |
| Tests para callable `fetchDeletionAuditLogs` | Must | S |
| Tests para `DeletionAuditPanel` (opcional -- panel visual) | Should | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Trigger de eliminacion automatica iniciada por admin (la eliminacion siempre es self-service por el usuario)
- Retencion automatica o TTL para audit logs (por ahora se mantienen indefinidamente para compliance)
- Notificacion push/email al admin cuando hay un fallo parcial (el admin revisa via tab Alertas)
- Retry automatico de colecciones fallidas (requeriria idempotencia garantizada en cada coleccion)
- Panel de admin para iniciar eliminaciones de cuenta de otros usuarios

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/utils/deleteUserData.ts` | Service | Retorno de `DeletionResult` con exito total, fallo parcial (coleccion falla), fallo de Storage, fallo de aggregates. Conteos correctos. |
| `functions/src/admin/deletionAuditLogs.ts` | Callable | Validacion admin, paginacion, filtros por type/status, orden por timestamp desc |
| `functions/src/utils/abuseLogger.ts` | Service | Nuevo tipo `deletion_failure` con severity `high` |
| `functions/src/callable/deleteUserAccount.ts` | Callable | Persistencia de audit log post-eliminacion, manejo de resultado parcial |
| `functions/src/callable/cleanAnonymousData.ts` | Callable | Persistencia de audit log post-limpieza |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (exito total, fallo parcial, fallo total)
- Side effects verificados (escritura a `deletionAuditLogs`, escritura a `abuseLogs` en caso de fallo)
- Mock de Firestore batch operations para simular fallos parciales

---

## Seguridad

- [x] `deletionAuditLogs` contiene `uidHash` (SHA-256 truncado), nunca UID raw -- privacidad post-eliminacion
- [ ] Firestore rules: solo lectura admin (`isAdmin()`), escritura solo admin SDK
- [ ] Callable `fetchDeletionAuditLogs` valida admin via `assertAdmin()`
- [ ] Callable usa `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`
- [ ] No se expone informacion del usuario eliminado mas alla del hash
- [ ] Rate limit en callable admin (heredar patron existente de admin callables: 5/min)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Callable `fetchDeletionAuditLogs` | Scraping de audit logs por bot con credenciales admin | `assertAdmin()` + App Check + rate limit 5/min |
| Coleccion `deletionAuditLogs` | Lectura directa via Firestore SDK | Rules `isAdmin()` only |

Si el feature escribe a Firestore:

- [ ] Create rule para `deletionAuditLogs`: no hay create rule cliente -- solo admin SDK
- [ ] No hay update/delete rules -- coleccion append-only via admin SDK
- [ ] Campos string (`uidHash`, `type`, `status`) validados en Cloud Function antes de escribir
- [ ] Sin campos de texto libre del usuario -- no requiere moderacion

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| `deleteUserAccount.ts` sin tests (marcado como pendiente en tests.md) | afecta | Escribir tests como parte de este feature, cubriendo el nuevo flujo de audit log |
| `.catch(() => {})` en `deleteAllUserData` Storage cleanup | afecta | Reemplazar con conteo de fallos en `DeletionResult` -- ya no silenciar errores |
| `.catch(() => {})` en likeCount/follower count corrections | afecta | Envolver en try/catch con reporte en `DeletionResult.aggregatesCorrected` |

### Mitigacion incorporada

- Escribir tests para `deleteUserAccount` y `cleanAnonymousData` que hoy no tienen (deuda de tests.md)
- Reemplazar `.catch(() => {})` silenciosos en `deleteAllUserData` por conteo explicito de fallos -- esto mejora la robustez general independientemente del audit log
- Agregar tipo `deletion_failure` a `abuseLogger.ts` para integracion con el sistema de alertas existente

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `useAsyncData` ya maneja cancelacion via `ignore` flag -- el nuevo panel lo reutiliza
- [ ] Callable admin tiene try/catch con error apropiado (`HttpsError`)
- [ ] No hay `setState` directo en el panel -- todo via `useAsyncData` que ya tiene guards
- [ ] Funciones helper en `admin/audit/auditHelpers.ts` no exportan hooks -- van en subdirectorio correcto

### Checklist de documentacion

- [ ] Nuevos analytics events: no aplica (panel admin, sin analytics GA4)
- [ ] Nuevos tipos en `functions/src/utils/deleteUserData.ts` (tipo `DeletionResult`)
- [ ] `docs/reference/features.md` actualizado con tab 17 "Auditorias"
- [ ] `docs/reference/firestore.md` actualizado con coleccion `deletionAuditLogs`
- [ ] `docs/reference/security.md` actualizado con rules de `deletionAuditLogs`
- [ ] `docs/reference/patterns.md` no requiere actualizacion (usa patrones existentes)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Consultar audit logs (admin) | read | Sin soporte offline -- admin panel requiere conexion | AdminPanelWrapper muestra error |
| Persistir audit log (Cloud Function) | write | N/A -- ejecuta server-side | N/A |
| Crear abuse log en fallo | write | N/A -- ejecuta server-side | N/A |

### Checklist offline

- [x] Reads de Firestore: no aplica -- admin callable, no lectura directa
- [x] Writes: server-side via admin SDK, no requiere queue offline
- [x] APIs externas: no hay
- [x] UI: AdminPanelWrapper ya maneja estados de error de red
- [x] Datos criticos: no -- panel admin no es critico offline

### Esfuerzo offline adicional: S (ninguno, todo server-side)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [ ] Logica de negocio en callable admin (`fetchDeletionAuditLogs`) y util (`deleteAllUserData`) -- no inline en componente
- [ ] `DeletionAuditPanel` reutilizable: recibe datos via `useAsyncData`, no acoplado a AdminLayout
- [ ] No se agregan useState de logica de negocio a AdminLayout (solo un tab mas en el array existente)
- [ ] Props explicitas en subcomponentes de `admin/audit/`
- [ ] Ningun componente nuevo importa directamente de `firebase/firestore` -- usa callable via `httpsCallable`
- [ ] Archivos nuevos en `src/components/admin/audit/` -- subdirectorio de dominio correcto
- [ ] Ningun archivo nuevo supera 400 lineas
- [ ] Tipo `DeletionResult` en `functions/src/utils/deleteUserData.ts` (junto a la logica que lo genera)
- [ ] Admin callable en `functions/src/admin/` (carpeta correcta)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Panel nuevo aislado, solo agrega una entrada a AdminLayout tabs |
| Estado global | = | Usa `useAsyncData` existente, no crea contexto nuevo |
| Firebase coupling | = | Queries en callable admin, componente solo usa `httpsCallable` via service |
| Organizacion por dominio | + | Archivos en subdirectorio `admin/audit/` siguiendo patron de `admin/perf/` |

---

## Success Criteria

1. Cada invocacion de `deleteUserAccount` o `cleanAnonymousData` persiste un registro en `deletionAuditLogs` con status, duracion, y detalle de colecciones procesadas/fallidas.
2. El admin panel tiene un tab "Auditorias" que muestra el historial de eliminaciones con filtros por tipo y status.
3. Si una eliminacion tiene fallo parcial o total, se genera un `abuseLog` de tipo `deletion_failure` que aparece en el tab de Alertas existente.
4. Los `.catch(() => {})` silenciosos en `deleteAllUserData` son reemplazados por conteo explicito de errores retornado en `DeletionResult`.
5. Tests cubren >= 80% del codigo nuevo, incluyendo escenarios de exito total, fallo parcial, y fallo de Storage.
