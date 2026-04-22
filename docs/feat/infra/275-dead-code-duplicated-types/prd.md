# PRD: limpiar codigo muerto y tipos duplicados restantes

**Feature:** 275-dead-code-duplicated-types
**Categoria:** infra
**Fecha:** 2026-04-01
**Issue:** #275
**Prioridad:** Baja

---

## Contexto

La auditoria de arquitectura (#275) detecto dead code y tipos duplicados. La mayoria de los "dead exports" de hooks resultaron estar en uso. Quedan 3 items pendientes: una interface duplicada, una constante duplicada, y un archivo sin consumidores.

## Problema

- **P3**: `UserSearchResult` esta definida identicamente en `src/services/users.ts` (linea ~59) y `src/hooks/useUserSearch.ts` (linea ~5). Duplicacion innecesaria.
- **P3**: `MAX_FOLLOWS` esta definida en `src/constants/social.ts` (exportada, nunca importada) y en `src/services/follows.ts` (copia local, valor 200). Duplicacion + dead export.
- **P3**: `src/constants/social.ts` no es importado por ningun archivo. Dead file.

## Solucion

### S1: Consolidar UserSearchResult

Eliminar la definicion local de `UserSearchResult` en `src/hooks/useUserSearch.ts`. Importarla desde `src/services/users.ts` (donde ya esta definida y exportada).

### S2: Eliminar constants/social.ts y consolidar MAX_FOLLOWS

Eliminar `src/constants/social.ts` (dead file). La constante `MAX_FOLLOWS` en `src/services/follows.ts` es la unica en uso y queda como fuente de verdad. Si otros archivos necesitan el valor en el futuro, importaran desde follows.ts o se movera a constants/ en ese momento.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Consolidar UserSearchResult (importar desde services) | P3 | S |
| Eliminar constants/social.ts | P3 | S |

**Esfuerzo total estimado:** S

---

## Tests

- Build exitoso (`npm run build`) sin errores de tipos
- Grep: `UserSearchResult` definida en un solo archivo
- Grep: `constants/social` no importado en ningun lugar (confirmar antes de eliminar)

## Seguridad

- Sin impacto de seguridad. Cambios puramente de cleanup.
