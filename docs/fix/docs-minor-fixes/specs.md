# Specs: docs: minor fixes — broken link, version mismatch, badges vs achievements

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No aplica. Este feature solo modifica archivos `.md` de documentacion.

## Firestore Rules

No aplica. No hay cambios en reglas.

### Rules impact analysis

No hay queries nuevas.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | N/A |

### Field whitelist check

No hay campos nuevos ni modificados.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | N/A |

## Cloud Functions

No aplica.

## Componentes

No aplica. No se crean ni modifican componentes React.

### Mutable prop audit

No aplica.

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| N/A | N/A | N/A | N/A | N/A |

## Textos de usuario

No aplica. Todos los cambios son en documentacion interna, no en textos visibles al usuario final.

## Hooks

No aplica.

## Servicios

No aplica.

## Integracion

No aplica. Los archivos modificados son exclusivamente documentacion en `docs/`.

### Preventive checklist

- [x] **Service layer**: No aplica (solo docs)
- [x] **Duplicated constants**: No aplica (solo docs)
- [x] **Context-first data**: No aplica (solo docs)
- [x] **Silent .catch**: No aplica (solo docs)
- [x] **Stale props**: No aplica (solo docs)

## Tests

No aplica. No hay codigo nuevo que testear.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | N/A | N/A |

## Analytics

No aplica.

---

## Offline

No aplica.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

No aplica.

---

## Decisiones tecnicas

### S1. Eliminar fila de link roto en reports/README.md

El archivo `docs/reports/usability-report-2026-03-14.md` no existe. Se elimina la fila completa de la tabla en `docs/reports/README.md` que referencia ese archivo. No se intenta recrear el reporte porque no hay datos fuente.

### S2. Actualizar version en backlog-producto.md

La linea 38 de `docs/reports/backlog-producto.md` dice `v2.10.0 – v2.30.0`. La version actual es `v2.30.4` (commit `be59904`). Se actualiza a `v2.10.0 – v2.30.4`.

### S3. Actualizar fecha en tech-debt.md

La linea 3 de `docs/reports/tech-debt.md` dice `**Ultima actualizacion:** 2026-03-25`. La ultima auditoria real fue el 2026-03-29 (este fix). Se actualiza a `2026-03-29`.

### S4. Clarificar badges vs achievements en features.md

Actualmente `docs/reference/features.md` linea 60 menciona "Sistema de badges/logros (11 badges: ...)" dentro de la seccion Rankings, pero no distingue entre los dos sistemas de reconocimiento que existen en el codigo:

1. **Achievements** (8 tipos, `src/constants/achievements.ts`): progresion goal-based con `target` numerico. Definiciones estaticas con `AchievementDefinition` interface. Servicio en `src/services/achievements.ts`. Coleccion Firestore `achievements`. Tipos: explorador (10 check-ins), social (5 follows), critico (10 ratings), viajero (3 localidades), coleccionista (20 favoritos), fotografo (5 fotos), embajador (10 recomendaciones), racha (7 dias).

2. **Badges** (11 tipos, `src/constants/badges.ts`): milestones activity-based evaluados via `check()` function contra `UserRankingEntry.breakdown`. Usados en Rankings. Tipos: primera resena, comentarista, influencer, primera foto, fotografo, primera calificacion, critico, popular, todoterreno, podio, racha 7d.

Se agrega una subseccion despues de "HomeScreen -- SpecialsSection" (que ya menciona `achievements`) que explique ambos sistemas y referencie los archivos fuente.

---

## Hardening de seguridad

No aplica. No se modifica codigo fuente, reglas, ni funciones.

### Firestore rules requeridas

Ninguna.

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| N/A | N/A | N/A |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| N/A | N/A | N/A |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de seguridad ni tech debt en GitHub.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| N/A | N/A | N/A |
