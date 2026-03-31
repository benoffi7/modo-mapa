# Plan: Docs Conflict Markers + project-reference + firestore.md + patterns.md

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Resolver conflictos y actualizar project-reference

**Branch:** `fix/252-docs-conflict-markers`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Resolver merge conflict lineas 419-446: mantener AMBOS bloques (Verification Badges de HEAD + Seguir Tags de feat/205). Eliminar marcadores `<<<<<<<`, `=======`, `>>>>>>>`. Verificar que no haya otros marcadores en todo el archivo |
| 2 | `docs/reference/project-reference.md` | Corregir version de `2.34.0` a `2.34.1`. Actualizar conteo test files de `108 (74+34)` a `212 (95+117)`. Actualizar Cloud Functions count de `14 callable + 17 triggers + 6 scheduled` a `13 callable + 16 triggers + 7 scheduled` |

### Fase 2: Actualizar firestore.md

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Agregar `notificationDigest` (DigestFrequency: 'realtime'/'daily'/'weekly') a la tabla de campos de `userSettings` |
| 2 | `docs/reference/firestore.md` | Agregar `followedTags?` (string[]), `followedTagsUpdatedAt?` (Date), `followedTagsLastSeenAt?` (Date) a la tabla de campos de `userSettings`. Marcar con nota: "Pendiente rules fix #251 — campos NO incluidos en hasOnly() de userSettings" |
| 3 | `docs/reference/firestore.md` | Agregar `notificationDigest` y `followedTags*` al interface `UserSettings` en la seccion de tipos TypeScript |

### Fase 3: Actualizar patterns.md

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar patron **HOME_SECTIONS registry** en seccion "UI patterns": array declarativo en `homeSections.ts` con `HomeSection` interface (`id`, `component`, `hasDividerAfter?`). Agregar seccion = agregar entrada al array. Lazy-loaded via `React.lazy()` + `Suspense` |
| 2 | `docs/reference/patterns.md` | Agregar patron **Regla de no-append** en seccion "TypeScript y build": en trabajo paralelo (worktrees), crear archivos por dominio en vez de appendear a barrel files. Referencia completa en `docs/procedures/worktree-workflow.md` seccion "Regla de no-append" |

### Fase 4: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `grep -c '<<<<<<' docs/reference/features.md` — debe retornar 0 |
| 2 | N/A | Verificar que `grep '2.34.1' docs/reference/project-reference.md` matchea |
| 3 | N/A | Verificar que `grep 'notificationDigest' docs/reference/firestore.md` matchea |
| 4 | N/A | Verificar que `grep 'HOME_SECTIONS' docs/reference/patterns.md` matchea |

---

## Orden de implementacion

1. `docs/reference/features.md` — resolver conflicto (P0, bloquea parseabilidad)
2. `docs/reference/project-reference.md` — corregir version y conteos (P0)
3. `docs/reference/firestore.md` — agregar campos faltantes (P1)
4. `docs/reference/patterns.md` — documentar patrones faltantes (P2)
5. Verificacion final

No hay dependencias entre los archivos; el orden es por prioridad.

## Riesgos

1. **Resolucion incorrecta del merge conflict**: Si se elige solo un lado del conflicto, se pierde documentacion de un feature. Mitigacion: mantener explicitamente ambos bloques como secciones separadas.
2. **Conteos desactualizados rapidamente**: Los conteos de test files y Cloud Functions cambian con cada feature. Mitigacion: actualizar al valor exacto de hoy y confiar en el merge skill para mantenerlos actualizados.
3. **Campos followedTags sin rules**: Documentar campos que no estan en hasOnly() puede causar confusion. Mitigacion: nota explicita de que dependen de #251.

## Guardrails de modularidad

No aplica (solo documentacion). Ningun archivo de codigo fuente es modificado.

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Ningun archivo resultante supera 400 lineas

## Estimacion de tamano de archivos

| Archivo | Tamano actual (aprox) | Delta | Tamano resultante |
|---------|----------------------|-------|-------------------|
| `docs/reference/features.md` | ~450 lineas | -3 (marcadores) +0 neto | ~447 lineas |
| `docs/reference/project-reference.md` | ~104 lineas | ~0 | ~104 lineas |
| `docs/reference/firestore.md` | ~448 lineas | +8 | ~456 lineas |
| `docs/reference/patterns.md` | ~219 lineas | +6 | ~225 lineas |

> features.md supera 400 lineas pero es un archivo de referencia existente, no codigo. No requiere decomposicion.

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Actualizado en Fase 2 (campos faltantes en userSettings) |
| 2 | `docs/reference/features.md` | Actualizado en Fase 1 (merge conflict resuelto) |
| 3 | `docs/reference/patterns.md` | Actualizado en Fase 3 (HOME_SECTIONS + no-append) |
| 4 | `docs/reference/project-reference.md` | Actualizado en Fase 1 (version + conteos) |

> Este feature ES la actualizacion de docs, por lo que la fase final se cumple intrinsecamente.

## Criterios de done

- [x] features.md no contiene marcadores de conflicto git
- [x] project-reference.md refleja version 2.34.1 y conteo real de test files (212)
- [x] firestore.md documenta notificationDigest y followedTags* en userSettings
- [x] patterns.md documenta HOME_SECTIONS registry y regla no-append
- [x] Todos los archivos modificados pasan markdownlint
- [x] No lint errors
- [x] Build succeeds (no aplica directamente — solo docs)
