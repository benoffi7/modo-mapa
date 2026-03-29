# Plan: Coding Standards — Documentar patrones arquitecturales faltantes

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Agregar secciones a coding-standards.md

**Branch:** `feat/coding-standards-gaps`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/coding-standards.md` | Agregar seccion "## Offline Support System" despues de "State Management > Caching". Contenido: descripcion del flujo `withOfflineSupport()`, diagrama texto componente->wrapper->online/offline, ejemplo de `useFollow.ts`, regla de decision. Cross-ref a `patterns.md#offline-queue` |
| 2 | `docs/reference/coding-standards.md` | Agregar seccion "## Client-side Cache (3-tier)". Expandir la seccion "Caching" existente con diagrama 3-tier (memory -> IndexedDB -> Firestore), TTLs, `StaleBanner`, invalidacion. Cross-ref a `patterns.md#queries-y-cache` |
| 3 | `docs/reference/coding-standards.md` | Agregar seccion "## Storage Decision Criteria" despues de cache. Tabla de localStorage vs Context vs IndexedDB con ejemplos del codebase y regla de decision rapida |
| 4 | `docs/reference/coding-standards.md` | Agregar seccion "## Optimistic Updates". Tabla de 5 variantes (Map-based, pending state, derived state, undo delete, revert on error) con regla de cuando usar cada una. Cross-ref a `patterns.md#ui-patterns` |
| 5 | `docs/reference/coding-standards.md` | Agregar seccion "## Deep Linking". Deep links soportados, validacion, consumo de params, como agregar uno nuevo. Cross-ref a `patterns.md#ui-patterns` y `patterns.md#shared-lists` |
| 6 | `docs/reference/coding-standards.md` | Agregar seccion "## Screen Tracking". Convencion de nombres, `useScreenTracking`, regla de no duplicar tracking manual |
| 7 | `docs/reference/coding-standards.md` | Agregar seccion "## Converter Layers". Tabla de 3 converter files, regla de decision por audiencia, patron de agregar converter nuevo. Cross-ref a `firestore.md#converters` |
| 8 | `docs/reference/coding-standards.md` | Agregar seccion "## Analytics Event Naming". Convencion `EVT_*`, naming `{feature}_{action}`, regla de no string literals. Cross-ref a `patterns.md#constantes-centralizadas` |
| 9 | `docs/reference/coding-standards.md` | Agregar seccion "## Advanced Pagination". API de `usePaginatedQuery`, cursor-based, `cacheKey`, `loadAll`, backward compat. Cross-ref a `patterns.md#queries-y-cache` |
| 10 | `docs/reference/coding-standards.md` | Agregar seccion "## Component Sub-folder Organization". Regla de 3+ archivos, estructura estandar, ejemplos `admin/perf/` y `admin/alerts/` |

### Fase 2: Crear issues de tech debt en GitHub

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | GitHub issue | `gh issue create --title "tech debt: BusinessComments.tsx excede 300 lineas (398)" --label "tech debt" --body "..."` con detalles de la violacion y sugerencia de refactor (extraer subcomponentes como se hizo con CommentRow/CommentInput) |
| 2 | GitHub issue | `gh issue create --title "tech debt: BusinessQuestions.tsx excede 300 lineas (392) + noop callbacks" --label "tech debt" --body "..."` con detalles: lineas 139-140 usan `() => {}` en vez de `throw new Error('not implemented')` |
| 3 | GitHub issue | `gh issue create --title "tech debt: FollowedList.tsx importa QueryDocumentSnapshot de firebase/firestore" --label "tech debt" --body "..."` con detalle de la violacion del service layer boundary |

### Fase 3: Cross-references y coherencia

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/coding-standards.md` | Revisar todas las secciones nuevas y verificar que cada cross-reference a `patterns.md` usa un anchor valido (verificar con el heading real en patterns.md) |
| 2 | `docs/reference/coding-standards.md` | Agregar nota en la seccion "Caching" existente que apunte a la nueva seccion "Client-side Cache (3-tier)" para evitar confusion entre la seccion breve existente y la nueva expandida |
| 3 | `docs/reference/coding-standards.md` | Verificar que el formato y tono de las secciones nuevas es consistente con las existentes (tablas, code blocks, reglas en negrita) |

### Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Agregar entrada para coding-standards-gaps: "Documentados 10 patrones arquitecturales faltantes en coding-standards.md" |
| 2 | `docs/reference/project-reference.md` | Actualizar fecha y agregar nota sobre las 10 secciones nuevas en coding-standards.md |

---

## Orden de implementacion

1. **Fase 1 pasos 1-10** — Agregar las 10 secciones a `coding-standards.md`. Sin dependencias entre si, pero se escriben en orden logico (offline -> cache -> storage -> optimistic -> deep linking -> tracking -> converters -> analytics -> pagination -> sub-folders)
2. **Fase 2 pasos 1-3** — Crear los 3 issues de tech debt en GitHub. Depende de Fase 1 (para referenciar las secciones que documentan los estandares violados)
3. **Fase 3 pasos 1-3** — Verificar cross-references y coherencia. Depende de Fase 1
4. **Fase final** — Actualizar docs de referencia

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Supera 400? | Estrategia |
|---------|----------------|------------------------------|-------------|-----------|
| `docs/reference/coding-standards.md` | 443 | ~750 | N/A (doc markdown, no codigo) | El limite de 400 lineas aplica a archivos de codigo `.ts/.tsx`, no a documentacion de referencia. El documento ya tiene 443 lineas y esta organizado por secciones con tabla de contenidos implicita |

## Riesgos

1. **Secciones demasiado largas hacen el documento dificil de navegar** — Mitigacion: cada seccion nueva tiene maximo 1 parrafo de descripcion + 1 tabla/diagrama + 1 ejemplo + 1 regla de decision. No mas de 30 lineas por seccion.

2. **Cross-references a patterns.md se rompen si patterns.md cambia** — Mitigacion: usar anchors basados en headings (que son estables) y verificar en Fase 3 que todos los anchors resuelven.

3. **Issues de tech debt se crean pero no se priorizan** — Mitigacion: el label `tech debt` permite filtrar en backlog reviews. Los issues referencian el estandar violado para contexto.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — N/A (solo docs)
- [x] Archivos nuevos en carpeta de dominio correcta — solo `docs/reference/`
- [x] Logica de negocio en hooks/services, no en componentes — N/A
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — N/A (solo docs)
- [x] Ningun archivo resultante supera 400 lineas — N/A (documento markdown, no codigo)

## Criterios de done

- [ ] `coding-standards.md` contiene las 10 secciones nuevas, cada una con: descripcion, ubicacion en codebase, ejemplo, regla de decision
- [ ] Cada seccion tiene cross-references validas a `patterns.md` cuando el patron ya esta documentado ahi
- [ ] La seccion "Storage Decision Criteria" tiene tabla clara de localStorage vs Context vs IndexedDB
- [ ] 3 issues de GitHub creados con label `tech debt` (BusinessComments 398 lineas, BusinessQuestions 392 lineas + noops, FollowedList firebase import)
- [ ] El documento mantiene formato y tono consistente con secciones existentes
- [ ] No lint errors en markdown (`markdownlint`)
- [ ] `docs/reference/features.md` y `docs/reference/project-reference.md` actualizados
