# Specs: Docs Conflict Markers + project-reference + firestore.md + patterns.md

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No aplica. Este feature es exclusivamente de documentacion.

## Firestore Rules

No se modifican reglas. Se documenta el estado actual de `userSettings` incluyendo campos pendientes de rules fix (#251).

### Rules impact analysis

No hay queries nuevas. Solo se actualiza documentacion.

### Field whitelist check

No se agregan campos a interfaces ni servicios. Solo se documenta el estado actual.

| Coleccion | Campo documentado | En create `hasOnly()`? | En update `hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| userSettings | notificationDigest | SI | SI | No (ya incluido en rules) |
| userSettings | followedTags | NO | NO | SI — pendiente de #251 |
| userSettings | followedTagsUpdatedAt | NO | NO | SI — pendiente de #251 |
| userSettings | followedTagsLastSeenAt | NO | NO | SI — pendiente de #251 |

> Los campos `followedTags*` se documentan en firestore.md con una nota indicando que dependen de #251 para el rules fix.

## Cloud Functions

No aplica.

## Componentes

No aplica.

## Hooks

No aplica.

## Servicios

No aplica.

## Integracion

No aplica. Todos los cambios son en archivos `.md` de documentacion.

### Preventive checklist

No aplica (no hay codigo fuente modificado).

## Tests

No aplica. Este feature es exclusivamente de documentacion.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | N/A | N/A |

### Verificaciones manuales

- `grep -c '<<<<' docs/reference/features.md` retorna 0
- `grep -c '====' docs/reference/features.md` retorna 0
- `grep -c '>>>>' docs/reference/features.md` retorna 0
- Version en `project-reference.md` es `2.34.1`
- Test count en `project-reference.md` es `212 (95+117)`

## Analytics

No aplica.

---

## Offline

No aplica.

---

## Decisiones tecnicas

### DT1: Resolucion de merge conflict en features.md

Las lineas 419-446 contienen un conflicto entre HEAD (Verification Badges #201) y `feat/205-seguir-tags` (Seguir Tags #205). La resolucion correcta es **mantener ambos bloques**, ya que son features independientes que deben coexistir:

1. Mantener la seccion de Verification Badges (#201) tal cual esta en HEAD
2. Mantener la seccion de Seguir Tags (#205) como seccion separada con su heading `## Seguir Tags / Tus Intereses (#205)`

### DT2: Conteo de test files

El conteo actual es 212 test files (95 frontend + 117 functions). El valor anterior de 108 (74+34) estaba desactualizado tras multiples features recientes.

### DT3: Cloud Functions count

El conteo actual es 13 callable/admin + 16 triggers + 7 scheduled = 36 total. El valor anterior de "14 callable + 17 triggers + 6 scheduled" estaba ligeramente desactualizado.

### DT4: Campos de userSettings en firestore.md

Se agregan:

- `notificationDigest?: DigestFrequency` — ya en rules, ya en tipo TypeScript
- `followedTags?: string[]` — en tipo TypeScript, NO en rules (pendiente #251)
- `followedTagsUpdatedAt?: Date` — en tipo TypeScript, NO en rules (pendiente #251)
- `followedTagsLastSeenAt?: Date` — en tipo TypeScript, NO en rules (pendiente #251)

### DT5: Patrones a documentar en patterns.md

1. **HOME_SECTIONS registry**: array declarativo en `homeSections.ts` que define secciones de HomeScreen. Cada entrada tiene `id`, `component` (lazy-loaded), y `hasDividerAfter?`. Agregar seccion nueva = agregar entrada al array, sin tocar JSX.

2. **Regla de no-append para barrel files**: referencia a `docs/procedures/worktree-workflow.md` seccion "Regla de no-append". En patterns.md se agrega una referencia breve al patron con link al procedimiento completo.

---

## Hardening de seguridad

No aplica. Solo documentacion.

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #251 userSettings rules | Se documenta el estado actual con nota de pendiente | Fase 2, paso 2 |
| Merge conflict en features.md | Se resuelve el conflicto que corrompia el archivo | Fase 1, paso 1 |
| project-reference desactualizado | Se corrigen version y conteos | Fase 1, paso 2 |
