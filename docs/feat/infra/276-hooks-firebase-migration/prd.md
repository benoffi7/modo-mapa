# PRD: migrar hooks restantes al service layer (firebase/firestore)

**Feature:** 276-hooks-firebase-migration
**Categoria:** infra
**Fecha:** 2026-04-01
**Issue:** #276
**Prioridad:** Media

---

## Contexto

La auditoria de arquitectura (#276) detecto 10 hooks/utils que importaban `firebase/firestore` directamente. 7 ya fueron migrados exitosamente. Quedan 3 archivos con imports directos.

## Problema

- **P2**: `src/hooks/useAbuseLogsRealtime.ts` importa `collection`, `query`, `orderBy`, `limit`, `onSnapshot` de firebase/firestore y `db` de config/firebase. Viola la convencion de service layer.
- **P3**: `src/utils/getCountOfflineSafe.ts` importa `getCountFromServer` y `Query` de firebase/firestore. Es una utilidad de bajo nivel que deberia estar en services/.
- **P3**: `src/hooks/usePaginatedQuery.ts` importa multiples funciones de firebase/firestore (`query`, `getDocs`, `limit`, `startAfter`, `orderBy`, `where`, etc.). Es un hook generico de paginacion — puede ser aceptable como excepcion por ser infraestructura base.

## Solucion

### S1: Migrar useAbuseLogsRealtime

Crear `src/services/abuseLogs.ts` con una funcion que retorne la query o un listener de abuse logs. El hook importa desde el service en vez de firebase/firestore directamente.

### S2: Mover getCountOfflineSafe a services

Mover `src/utils/getCountOfflineSafe.ts` a `src/services/countOfflineSafe.ts` (o integrarlo en un service existente). Actualizar todos los imports.

### S3: Evaluar usePaginatedQuery

`usePaginatedQuery` es un hook de infraestructura generico que recibe `CollectionReference` y `QueryConstraint[]`. Al ser un building block usado por multiples features, puede ser aceptable que acceda a firebase/firestore directamente. Documentar como excepcion aceptada si se decide no migrar.

**Decision requerida:** migrar o documentar como excepcion.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Migrar useAbuseLogsRealtime a service layer | P2 | S |
| Mover getCountOfflineSafe a services/ | P3 | S |
| Evaluar/documentar usePaginatedQuery | P3 | S |

**Esfuerzo total estimado:** S

---

## Tests

- Build exitoso sin errores de tipos
- Grep: solo archivos en `src/services/` y `src/config/` deben importar de `firebase/firestore` (con excepcion documentada de usePaginatedQuery si aplica)
- Verificar que useAbuseLogsRealtime sigue funcionando en admin (realtime updates)

## Seguridad

- `useAbuseLogsRealtime` es admin-only. Verificar que el service no expone la query sin contexto de admin.
- Sin otros impactos de seguridad.
