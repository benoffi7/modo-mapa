# PRD: docs: minor fixes — broken link, version mismatch, badges vs achievements

**Feature:** docs-minor-fixes
**Categoria:** fix
**Fecha:** 2026-03-29
**Issue:** #228
**Prioridad:** Baja

---

## Contexto

Durante una auditoria comprehensiva de documentacion vs codigo el 2026-03-29 se encontraron 4 inconsistencias menores en la documentacion del proyecto. El proyecto esta en v2.30.4 y la documentacion se despliega en GitHub Pages, por lo que errores en docs confunden tanto al desarrollador como a cualquier agente que los use como referencia.

## Problema

- `docs/reports/README.md` referencia `usability-report-2026-03-14.md` que no existe, generando un link roto en el indice de reportes
- `docs/reports/backlog-producto.md` dice "v2.10.0 - v2.30.0" pero la version actual es v2.30.4 (el bump se hizo en commit be59904)
- `docs/reports/tech-debt.md` tiene fecha de ultima actualizacion desactualizada
- `docs/reference/features.md` no distingue claramente entre los dos sistemas de reconocimiento: Achievements (8 tipos, goal-based, en `achievements.ts`) y Badges (11 tipos, activity-based, en `badges.ts`)

## Solucion

### S1. Corregir link roto en reports/README.md

Eliminar la fila de "Usability Report 2026-03-14" de la tabla en `docs/reports/README.md`, ya que el archivo referenciado no existe.

### S2. Actualizar rango de versiones en backlog-producto.md

Cambiar "v2.10.0 - v2.30.0" a "v2.10.0 - v2.30.4" en la seccion de metricas de progreso.

### S3. Actualizar fecha de tech-debt.md

Revisar la fecha de ultima actualizacion en `docs/reports/tech-debt.md` y actualizarla a la fecha de la ultima auditoria real.

### S4. Clarificar badges vs achievements en features.md

Agregar una subseccion o nota en `docs/reference/features.md` que distinga:

- **Achievements** (8 tipos): sistema de progresion basado en metas acumulativas. Definidos en `src/constants/achievements.ts` con logica en `src/services/achievements.ts`.
- **Badges** (11 tipos): milestones basados en actividad. Definidos en `src/constants/badges.ts`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Eliminar link roto en reports/README.md | Alta | XS |
| S2. Actualizar version en backlog-producto.md | Alta | XS |
| S3. Actualizar fecha en tech-debt.md | Media | XS |
| S4. Clarificar badges vs achievements en features.md | Media | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Reescribir secciones completas de features.md
- Crear el archivo usability-report que falta (si existio, se perdio; si nunca existio, no hay datos)
- Auditar todos los links de la documentacion (solo se corrige el reportado)
- Cambios en codigo fuente (solo documentacion)

---

## Tests

Este feature es puramente de documentacion. No hay codigo nuevo que testear.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A | N/A | No hay codigo nuevo |

### Criterios de testing

- Verificar que el link roto ya no aparece en reports/README.md
- Verificar que la version en backlog-producto.md coincide con la version actual del proyecto
- Verificar que features.md tiene la distincion entre achievements y badges
- Verificar que docs build (GH Pages) no tiene errores

---

## Seguridad

No aplica. Este feature solo modifica archivos `.md` de documentacion.

### Vectores de ataque automatizado

No hay superficies expuestas por este feature.

---

## Deuda tecnica y seguridad

No hay issues abiertos de seguridad ni tech debt en GitHub al momento de este PRD.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| N/A | N/A | N/A |

### Mitigacion incorporada

Ninguna. Este feature es exclusivamente correctivo de documentacion.

---

## Offline

No aplica. No hay data flows ni operaciones de lectura/escritura involucradas.

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

No aplica. No se crea ni modifica codigo fuente.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| N/A | = | Solo documentacion |

---

## Success Criteria

1. `docs/reports/README.md` no contiene links rotos
2. `docs/reports/backlog-producto.md` refleja la version actual (v2.30.4)
3. `docs/reports/tech-debt.md` tiene la fecha de ultima actualizacion correcta
4. `docs/reference/features.md` distingue claramente entre Achievements y Badges con sus respectivos archivos fuente
5. GitHub Pages se despliega correctamente con los cambios
