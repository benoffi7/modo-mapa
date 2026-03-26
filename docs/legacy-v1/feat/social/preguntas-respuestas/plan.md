# Plan: Preguntas y respuestas en comercios

**Feature:** preguntas-respuestas
**Fecha:** 2026-03-20
**PRD:** [prd.md](prd.md)
**Specs:** [specs.md](specs.md)

---

## Dependencias

Ninguna. Toda la infraestructura necesaria ya existe (comments collection, commentLikes, CF triggers, Firestore rules).

---

## Pasos de implementación

### Paso 1: Data model y converter

**Archivos a modificar:**

- `src/types/index.ts` — agregar `type?: 'comment' | 'question'` a interfaz `Comment`
- `src/config/converters.ts` — actualizar `commentConverter` para leer/escribir `type`

**Criterio de completitud:** El tipo compila sin errores, tests existentes siguen pasando.

### Paso 2: Firestore rules

**Archivos a modificar:**

- `firestore.rules` — agregar `type` a campos permitidos en create de `comments`, validar valores

**Criterio de completitud:** Rules unit tests pasan. Se puede crear doc con `type: 'question'`.

### Paso 3: Constants

**Archivos a crear:**

- `src/constants/questions.ts` — `MAX_QUESTION_LENGTH`, `BEST_ANSWER_MIN_LIKES`

**Criterio de completitud:** Constantes importables sin errores.

### Paso 4: Service functions

**Archivos a modificar:**

- `src/services/comments.ts` — agregar `fetchQuestions(businessId)`, `createQuestion(businessId, text)`

**Criterio de completitud:** Service tests pasan. `fetchQuestions` filtra por tipo, `createQuestion` setea `type: 'question'`.

### Paso 5: Cloud Function triggers (verificar)

**Archivos a revisar:**

- `functions/src/triggers/comments.ts` — verificar que `onCommentCreated`, `onCommentUpdated`, `onCommentDeleted` funcionan correctamente con docs que tienen `type: 'question'`

**Criterio de completitud:** No se esperan cambios. Si hay lógica condicional, ajustar. CF tests pasan.

### Paso 6: Firestore index

**Archivos a modificar:**

- `firestore.indexes.json` — agregar composite index `(businessId, type, createdAt)`

**Criterio de completitud:** Index deployable sin errores.

### Paso 7: UI — BusinessQuestions component

**Archivos a crear:**

- `src/components/business/BusinessQuestions.tsx` — lista de preguntas, expandir para ver respuestas, crear pregunta, crear respuesta, best answer badge

**Criterio de completitud:** Component test pasa. UI renderiza correctamente con datos mock.

### Paso 8: UI — Toggle tabs en BusinessSheet

**Archivos a modificar:**

- `src/components/business/BusinessSheet.tsx` — agregar tabs "Comentarios" / "Preguntas", renderizar componente según tab activo

**Criterio de completitud:** Toggle funciona, ambas vistas se muestran correctamente.

### Paso 9: Analytics events

**Archivos a modificar:**

- `src/components/business/BusinessQuestions.tsx` — agregar `logEvent` para `question_created`, `question_answered`, `question_viewed`

**Criterio de completitud:** Eventos se disparan en las acciones correctas.

### Paso 10: Tests

**Archivos a crear/modificar:**

- `src/components/business/__tests__/BusinessQuestions.test.tsx` — component tests
- `src/services/__tests__/comments.test.ts` — ampliar con tests de questions
- `functions/src/triggers/__tests__/comments.test.ts` — ampliar con tests de type handling

**Criterio de completitud:** Cobertura >= 80% en archivos nuevos/modificados.

---

## Orden de ejecución

```text
Paso 1 (model) → Paso 2 (rules) → Paso 3 (constants) → Paso 4 (service)
    → Paso 5 (CF verify) → Paso 6 (index) → Paso 7 (UI component)
    → Paso 8 (UI tabs) → Paso 9 (analytics) → Paso 10 (tests)
```

Los pasos son secuenciales porque cada uno depende del anterior. Tests se escriben al final pero se pueden ir agregando incrementalmente.

---

## Verification checklist

- [ ] `type` field en Comment interface
- [ ] Converter lee/escribe `type`
- [ ] Firestore rules permiten `type` en create
- [ ] `fetchQuestions` retorna solo preguntas
- [ ] `createQuestion` crea con `type: 'question'`
- [ ] CF triggers funcionan con preguntas
- [ ] Composite index creado
- [ ] BusinessQuestions renderiza preguntas y respuestas
- [ ] Best answer highlighted
- [ ] Tabs en BusinessSheet funcionan
- [ ] Analytics events disparan
- [ ] Tests >= 80% cobertura
- [ ] Rate limit compartido funciona (20/día total)
- [ ] Backward compat: comentarios existentes sin `type` siguen funcionando
