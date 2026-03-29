# PRD: data-layer.md covers only 40-47% of actual services/hooks/utils

**Feature:** data-layer-coverage
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #224
**Prioridad:** Media

---

## Contexto

El archivo `docs/reference/data-layer.md` es la referencia principal para el service layer, hooks compartidos y utilidades del proyecto. Actualmente documenta menos de la mitad del codigo real: 14 de 30 servicios, 21 de 52 hooks y 5 de 11 utils. Ademas contiene 4 funciones "fantasma" que ya no existen o fueron renombradas. Este gap se ha ido acumulando a medida que se agregaron features (follows, activity feed, recommendations, offline, achievements, check-ins, rankings, etc.) sin actualizar la documentacion en paralelo.

## Problema

- **Cobertura insuficiente:** Solo el 40-47% de los modulos del data layer estan documentados, lo que genera friccion al desarrollar nuevas features porque no hay referencia confiable de lo que ya existe.
- **Funciones fantasma:** 4 entradas documentan funciones que no existen (`getBusinessPriceLevels` en vez de la API real, `fetchPriceLevelStats`, `fetchCommentLikeStats`, `fetchNotificationStats` vs `fetchNotificationDetails`), generando confusion al buscar la API correcta.
- **PRDs y specs desactualizados:** Los agentes de PRD, specs y plan consultan `data-layer.md` como referencia autoritativa. Si esta incompleta, los nuevos features pueden reinventar hooks/servicios que ya existen o nombrar funciones incorrectamente.

## Solucion

### S1. Auditar el codebase actual

Recorrer `src/services/`, `src/hooks/` y `src/utils/` para generar un inventario completo de todas las funciones exportadas, comparar contra lo documentado, y clasificar los gaps en: missing (no documentado), phantom (documentado pero no existe), y stale (documentado con nombre/firma incorrecta).

### S2. Corregir funciones fantasma

Eliminar o corregir las 4 entradas fantasma identificadas en el issue:

- `getBusinessPriceLevels` actualizar a la API real: `getPriceLevelsCollection`, `upsertPriceLevel`, `deletePriceLevel`
- `fetchPriceLevelStats` eliminar (no existe)
- `fetchCommentLikeStats` eliminar (no existe)
- `fetchNotificationStats` corregir a `fetchNotificationDetails`

### S3. Documentar servicios faltantes (16 servicios)

Agregar entradas para: achievements, activityFeed, businessData, checkins, follows, notifications, offlineInterceptor, offlineQueue, queryCache (ya parcialmente documentado, verificar completitud), rankings, readCache, recommendations, specials, syncEngine, userProfile, users.

Seguir el formato existente de la tabla de servicios: modulo, coleccion, operaciones.

### S4. Documentar hooks faltantes (31 hooks)

Agregar entradas para los 31 hooks listados en el issue. Seguir el formato existente: hook, descripcion. Agrupar por dominio funcional (social, offline, UI, admin, auth) para facilitar la lectura.

### S5. Documentar utils faltantes (6 utils)

Agregar entradas para: contrast, distance (verificar completitud), getCountOfflineSafe, logger, media, version. Seguir el formato existente con tabla de funciones y descripciones.

### S6. Validacion cruzada

Verificar que el inventario final sea consistente con:

- `docs/reference/features.md` (features documentadas deben tener sus hooks/services en data-layer)
- `docs/reference/patterns.md` (patrones mencionados deben referenciar hooks/services que existan en data-layer)
- `docs/reference/tests.md` (archivos testeados deben estar documentados en data-layer)

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Auditar codebase (inventario completo) | Alta | S |
| S2. Corregir funciones fantasma (4 entradas) | Alta | S |
| S3. Documentar 16 servicios faltantes | Alta | M |
| S4. Documentar 31 hooks faltantes | Alta | M |
| S5. Documentar 6 utils faltantes | Media | S |
| S6. Validacion cruzada con otros docs | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Reescribir la estructura del archivo data-layer.md (se mantiene el formato actual de tablas)
- Documentar componentes de UI (eso es arquitectura, no data layer)
- Documentar Cloud Functions (ya tienen su propia seccion en features.md y security.md)
- Agregar JSDoc o documentacion inline en el codigo fuente

---

## Tests

Este feature es puramente de documentacion, no hay codigo nuevo que testear.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A | N/A | No hay codigo nuevo |

### Criterios de testing

- No aplica (documentacion solamente)
- Validacion manual: verificar que cada funcion documentada existe en el codebase con `grep`
- Validacion cruzada: verificar consistencia con features.md, patterns.md y tests.md

---

## Seguridad

No aplica directamente. Este feature es documentacion interna que no expone superficies nuevas.

- [x] El archivo data-layer.md no contiene secretos, API keys ni credenciales
- [x] Las firmas de funciones documentadas no exponen detalles de infraestructura interna

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A | N/A | N/A |

El repositorio es publico, asi que data-layer.md es visible. Solo documenta interfaces publicas del service layer, sin detalles de implementacion sensibles.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| Firestore rules field whitelist audit (backlog) | mitiga | Al documentar cada servicio, verificar que los campos que escribe estan en la whitelist de rules |
| Copy audit (backlog, parcial) | no agrava | Documentacion en ingles tecnico, no afecta textos user-facing |

### Mitigacion incorporada

- Al documentar los 16 servicios faltantes, se puede detectar si algun servicio escribe campos no cubiertos por `hasOnly()` en Firestore rules (efecto secundario positivo de la auditoria).
- Al corregir funciones fantasma, se evita que futuros PRDs referencien APIs inexistentes.

---

## Offline

No aplica. Este feature es documentacion, no modifica comportamiento runtime.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

- [x] No aplica (documentacion solamente)

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

No aplica directamente. Sin embargo, la documentacion completa del data layer facilita que futuros features reutilicen hooks y servicios existentes en vez de crear duplicados, lo cual contribuye indirectamente a reducir el acoplamiento.

### Checklist modularizacion

- [x] No aplica (documentacion solamente)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No hay codigo nuevo |
| Estado global | = | No hay codigo nuevo |
| Firebase coupling | = | No hay codigo nuevo |
| Organizacion por dominio | = | No hay codigo nuevo |

---

## Success Criteria

1. `data-layer.md` documenta el 100% de los servicios exportados en `src/services/` (30+ servicios)
2. `data-layer.md` documenta el 100% de los hooks exportados en `src/hooks/` (52+ hooks)
3. `data-layer.md` documenta el 100% de las utils exportadas en `src/utils/` (11+ utils)
4. Las 4 funciones fantasma estan eliminadas o corregidas con los nombres reales
5. Validacion cruzada completada: no hay inconsistencias con features.md, patterns.md ni tests.md
