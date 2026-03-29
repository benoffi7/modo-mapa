# Plan: 3 coding standard violations (large components, noop callbacks, layer breach)

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: CommentRow props opcionales + eliminar noops

**Branch:** `fix/coding-standard-violations`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/CommentRow.tsx` | Hacer opcionales las 7 props de edicion en `CommentRowProps`: `isEditing?`, `editText?`, `isSavingEdit?`, `onStartEdit?`, `onSaveEdit?`, `onCancelEdit?`, `onEditTextChange?`. Agregar defaults en desestructuracion: `isEditing = false`, `editText = ''`, `isSavingEdit = false`. |
| 2 | `src/components/business/CommentRow.tsx` | En la condicion de linea 215 (`{isOwn && !isEditing && (`), cambiar a `{isOwn && !isEditing && onStartEdit && (` para que el boton de editar solo aparezca si `onStartEdit` esta definido. Mantener el boton de eliminar sin condicion adicional (siempre visible para `isOwn`). |
| 3 | `src/components/business/BusinessQuestions.tsx` | Eliminar lineas 139-140 (`noopEdit` y `noopEditText`). Remover de AMBAS invocaciones de `CommentRow` (linea 212 y linea 278) las props: `isEditing={false}`, `editText=""`, `isSavingEdit={false}`, `onStartEdit={noopEdit}`, `onSaveEdit={noopEdit}`, `onCancelEdit={noopEdit}`, `onEditTextChange={noopEditText}`. |
| 4 | `src/components/business/__tests__/CommentRow.test.tsx` | Crear test con 4 casos: (1) renderiza con todas las props de edicion, (2) renderiza sin props de edicion (no muestra boton editar, no muestra TextField inline), (3) boton editar visible solo cuando `isOwn && onStartEdit` definido, (4) boton eliminar visible cuando `isOwn` independientemente de `onStartEdit`. |

### Fase 2: Extraer CommentThreadList de BusinessComments

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/CommentThreadList.tsx` | Crear subcomponente con el contenido del `<List>` (lineas 258-381 de BusinessComments). Incluir: el `.map()` sobre sortedTopLevel, renderCommentRow, thread expand/collapse, inline reply form, dividers, y mensaje vacio. Exportar interfaz `CommentThreadListProps`. |
| 2 | `src/components/business/BusinessComments.tsx` | Reemplazar el bloque `<List disablePadding>...</List>` (lineas 258-381) por `<CommentThreadList ... />`. Pasar todos los handlers y state como props. Eliminar la funcion `renderCommentRow` y `toggleThread` del archivo (se mueven a CommentThreadList). Eliminar `getReplyCount` (mover a CommentThreadList). Remover imports no usados (`List`, `Divider`, `Collapse`, `Alert`, `TextField`, `SendIcon`, `CloseIcon`, `MAX_COMMENT_LENGTH`). |
| 3 | `src/components/business/__tests__/CommentThreadList.test.tsx` | Crear test con 4 casos: (1) renderiza lista de comentarios con CommentRow, (2) muestra boton "Ver N respuestas" y togglea expand, (3) muestra formulario de respuesta inline cuando replyingTo coincide, (4) muestra mensaje vacio cuando no hay comentarios. |

### Fase 3: Extraer QuestionThread de BusinessQuestions

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/QuestionThread.tsx` | Crear subcomponente con el contenido de cada iteracion del `.map()` (lineas 211-367 de BusinessQuestions). Incluir: CommentRow para la pregunta, thread expand/collapse con chip "Mejor respuesta", inline reply form, y divider. Exportar interfaz `QuestionThreadProps`. |
| 2 | `src/components/business/BusinessQuestions.tsx` | Reemplazar el bloque `<List disablePadding>...</List>` (lineas 203-375) por `<List disablePadding>{visibleQuestions.map(...) => <QuestionThread ... />}...</List>` con mensaje vacio. Eliminar `toggleQuestion` del archivo (mover a QuestionThread o pasar como prop). Remover imports no usados (`Collapse`, `Chip`, `TextField`, `SendIcon`, `CloseIcon`, `BEST_ANSWER_MIN_LIKES`, `MAX_COMMENT_LENGTH`). |
| 3 | `src/components/business/__tests__/QuestionThread.test.tsx` | Crear test con 4 casos: (1) renderiza pregunta con CommentRow sin props de edicion, (2) muestra boton "Ver N respuestas" y togglea, (3) muestra chip "Mejor respuesta" para answer con >= BEST_ANSWER_MIN_LIKES y primera posicion, (4) no renderiza boton editar en CommentRow. |

### Fase 4: Fix layer breach en FollowedList

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/follows.ts` | Exportar `export type FollowCursor = QueryDocumentSnapshot<Follow>;`. Modificar retorno de `fetchFollowing` para incluir campo `cursor`: `return { docs, hasMore, cursor: docs[docs.length - 1] ?? null };`. Aplicar lo mismo a `fetchFollowers` por consistencia. |
| 2 | `src/components/social/FollowedList.tsx` | Reemplazar `import type { QueryDocumentSnapshot } from 'firebase/firestore'` por `import type { FollowCursor } from '../../services/follows'`. Actualizar `import { fetchFollowing } from '../../services/follows'` para incluir `FollowCursor` en el import. Cambiar `useState<QueryDocumentSnapshot<Follow> | null>` a `useState<FollowCursor | null>`. En `loadPage`, usar `result.cursor` en vez de `result.docs[result.docs.length - 1]`. Remover `import type { Follow } from '../../types'` si ya no se usa directamente. |

### Fase 5: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `npm run lint` y verificar que no hay errores de ESLint (especialmente `no-empty-function`). |
| 2 | N/A | Ejecutar `npm run test:run` y verificar que todos los tests pasan. |
| 3 | N/A | Verificar conteo de lineas: `wc -l src/components/business/BusinessComments.tsx src/components/business/BusinessQuestions.tsx` ambos < 300. |
| 4 | N/A | Verificar que `grep -r "firebase/firestore" src/components/social/FollowedList.tsx` no retorna resultados. |
| 5 | N/A | Ejecutar `npm run build` y verificar que compila sin errores. |

### Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Actualizar entrada de `CommentRow (memo)` para documentar que las props de edicion son opcionales. Agregar nota de que CommentRow no renderiza controles de edicion cuando las props no se pasan. |
| 2 | `docs/reference/patterns.md` | Agregar entradas para `CommentThreadList` y `QuestionThread` en la seccion "Component decomposition (#195)". |
| 3 | `docs/reference/patterns.md` | Agregar patron `FollowCursor` tipo opaco en seccion "Follows y activity feed" para documentar que los componentes usan el alias en vez de importar de firebase/firestore. |

---

## Orden de implementacion

1. **CommentRow.tsx** (Fase 1, paso 1-2) — hacer props opcionales. Es prerequisito de todo lo demas.
2. **BusinessQuestions.tsx** (Fase 1, paso 3) — eliminar noops. Depende de paso 1.
3. **CommentRow.test.tsx** (Fase 1, paso 4) — tests del nuevo path opcional.
4. **CommentThreadList.tsx** (Fase 2, paso 1) — crear subcomponente. Depende de paso 1 (usa CommentRow con props opcionales en los thread replies si se desea).
5. **BusinessComments.tsx** (Fase 2, paso 2) — integrar subcomponente. Depende de paso 4.
6. **CommentThreadList.test.tsx** (Fase 2, paso 3) — tests.
7. **QuestionThread.tsx** (Fase 3, paso 1) — crear subcomponente. Depende de paso 1.
8. **BusinessQuestions.tsx** (Fase 3, paso 2) — integrar subcomponente. Depende de paso 7.
9. **QuestionThread.test.tsx** (Fase 3, paso 3) — tests.
10. **follows.ts** (Fase 4, paso 1) — agregar cursor opaco.
11. **FollowedList.tsx** (Fase 4, paso 2) — fix import. Depende de paso 10.
12. **Verificacion** (Fase 5) — lint, test, build.
13. **Documentacion** (Fase final) — actualizar patterns.md.

## Riesgos

1. **Regresion visual en BusinessComments/BusinessQuestions**: La extraccion de subcomponentes podria alterar el layout si se pierden props de sx o estilos. Mitigacion: verificar manualmente en `dev:full` que el render es identico antes y despues del refactor.

2. **Props mismatch al pasar handlers a subcomponentes**: Los subcomponentes reciben muchas props. Si se omite una, el TypeScript compiler lo detectara. Mitigacion: confiar en strict type checking y no usar `any`.

3. **fetchFollowing breaking change**: Agregar el campo `cursor` al retorno podria afectar otros consumidores. Mitigacion: verificar con `grep -r "fetchFollowing\|fetchFollowers" src/` que no hay otros consumidores ademas de FollowedList y el servicio mismo.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (`src/components/business/`)
- [x] Logica de negocio en hooks/services, no en componentes (los nuevos subcomponentes son puramente de rendering)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (las 3 violaciones se resuelven)
- [x] Ningun archivo resultante supera 400 lineas (max estimado: ~250 para BusinessComments)

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Actualizar `CommentRow (memo)` — props de edicion ahora opcionales. Agregar `CommentThreadList` y `QuestionThread` a decomposition. Agregar `FollowCursor` tipo opaco. |

## Criterios de done

- [x] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] BusinessComments.tsx < 300 lineas
- [ ] BusinessQuestions.tsx < 300 lineas y sin callbacks noop `() => {}`
- [ ] FollowedList.tsx no importa nada de `firebase/firestore`
- [ ] CommentRow acepta props de edicion opcionales y no renderiza controles de edicion cuando estan ausentes
- [ ] `npm run lint` y `npm run test:run` pasan sin errores
- [ ] Reference docs updated (patterns.md)
