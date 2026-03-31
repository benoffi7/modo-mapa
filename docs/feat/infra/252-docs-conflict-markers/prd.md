# PRD: features.md con merge conflict markers + project-reference desactualizado

**Feature:** 252-docs-conflict-markers
**Categoria:** infra
**Fecha:** 2026-03-30
**Issue:** #252
**Prioridad:** Alta

---

## Contexto

Tras multiples merges recientes (v2.34.0 - v2.34.1), varios documentos de referencia quedaron desactualizados o corruptos. `features.md` tiene marcadores de conflicto git sin resolver, `project-reference.md` reporta version y conteos incorrectos, `firestore.md` le faltan campos nuevos, y `patterns.md` no documenta patrones recientes. Estos documentos son la fuente de verdad para el PRD writer y el implementation agent, por lo que errores aqui se propagan a toda la cadena de desarrollo.

## Problema

- **CRITICO**: `features.md` tiene marcadores de conflicto git (`<<<<<<`, `=======`, `>>>>>>`) entre las lineas 419-446, haciendo que el archivo no se parsee correctamente desde ese punto.
- **HIGH**: `project-reference.md` dice version 2.34.0 (deberia ser 2.34.1) y reporta 108 test files (74+34) cuando el conteo actual es 212+ (95+117).
- **HIGH**: `firestore.md` no tiene el campo `notificationDigest` en `userSettings`, ni los campos `followedTags*` (pendientes del rules fix #251).
- **MEDIUM**: `patterns.md` no documenta el patron HOME_SECTIONS registry ni la regla no-append.

## Solucion

### S1: Resolver merge conflicts en features.md

Abrir `features.md`, localizar los marcadores de conflicto (lineas 419-446), y resolver manualmente eligiendo el contenido correcto. Verificar que no haya otros marcadores en el resto del archivo.

### S2: Actualizar project-reference.md

- Corregir version a 2.34.1.
- Actualizar conteo de test files al valor correcto (consultar `find src -name '*.test.*' | wc -l` y `find functions -name '*.test.*' | wc -l`).
- Verificar otras metricas (Cloud Functions count, colecciones, etc.).

### S3: Actualizar firestore.md

- Agregar `notificationDigest` a la seccion de `userSettings`.
- Agregar `followedTags`, `followedTagsUpdatedAt`, `followedTagsLastSeenAt` a `userSettings` (marcar como pendiente de rules fix #251 si corresponde).
- Verificar que no falten otros campos recientes.

### S4: Actualizar patterns.md

- Documentar HOME_SECTIONS registry pattern.
- Documentar la regla no-append (si aplica al proyecto actual).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Resolver merge conflicts en features.md | P0 | S |
| Actualizar version y test count en project-reference.md | P0 | S |
| Agregar campos faltantes a firestore.md | P1 | S |
| Documentar patrones faltantes en patterns.md | P2 | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Reescribir secciones completas de la documentacion.
- Agregar documentacion de features nuevos no mencionados en el issue.
- Cambiar la estructura de los archivos de referencia.
- Actualizar `tests.md` (se actualiza como parte del merge skill).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A | N/A | Este feature es solo documentacion, no requiere tests |

### Criterios de testing

- Verificar que `features.md` no contenga marcadores de conflicto (`grep -c '<<<<' docs/reference/features.md` retorna 0).
- Verificar que `project-reference.md` tenga la version correcta.
- Verificar que markdownlint pase en todos los archivos modificados.

---

## Seguridad

No aplica. Este feature es exclusivamente de documentacion.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #251 userSettings rules | afecta | Los campos followedTags* se documentan en firestore.md como parte de este fix |

### Mitigacion incorporada

- Corregir la documentacion de referencia previene que futuros PRDs y specs se generen con informacion incorrecta.
- Eliminar merge conflict markers restaura la parseabilidad de features.md.

---

## Offline

No aplica. Este feature es exclusivamente de documentacion.

---

## Modularizacion y % monolitico

No aplica. Este feature es exclusivamente de documentacion.

---

## Success Criteria

1. `features.md` no contiene marcadores de conflicto git y se parsea correctamente de principio a fin.
2. `project-reference.md` refleja la version 2.34.1 y el conteo real de test files.
3. `firestore.md` documenta todos los campos de `userSettings` incluyendo `notificationDigest` y `followedTags*`.
4. `patterns.md` documenta HOME_SECTIONS registry y la regla no-append.
5. Todos los archivos modificados pasan markdownlint.
