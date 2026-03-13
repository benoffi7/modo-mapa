# Plan de implementación — Comentarios 2.0 + Compartir comercio

**Branch:** `feat/45-comments-2.0`
**Issues:** #45, #46, cierra #17

---

## Orden de implementación

### Paso 1 — Tipos y config

**Archivos:**

- `src/types/index.ts` — Agregar `updatedAt?`, `likeCount` a Comment. Nuevo `CommentLike`
- `src/config/collections.ts` — Agregar `COMMENT_LIKES`
- `src/config/converters.ts` — Actualizar `commentConverter` (likeCount, updatedAt). Nuevo `commentLikeConverter`

**Validación:** `npm run lint` pasa

---

### Paso 2 — Service layer

**Archivos:**

- `src/services/comments.ts` — Agregar `editComment()`, `likeComment()`, `unlikeComment()`

**Validación:** `npm run lint` pasa

---

### Paso 3 — Firestore rules

**Archivos:**

- `firestore.rules` — Agregar `allow update` en comments (owner, text 1-500, updatedAt == request.time, campos inmutables). Nueva colección `commentLikes` (read auth, create owner + timestamp, delete owner)

**Validación:** Sintaxis válida

---

### Paso 4 — Cloud Functions

**Archivos:**

- `functions/src/triggers/comments.ts` — Agregar `onCommentUpdated` (re-moderar si texto cambió, quitar flag si texto limpio)
- `functions/src/triggers/commentLikes.ts` — Nuevo: `onCommentLikeCreated` (rate limit 50/day, increment likeCount, counters), `onCommentLikeDeleted` (decrement likeCount, counters)
- `functions/src/index.ts` — Exportar los 3 nuevos triggers

**Validación:** `cd functions && npm run lint` pasa

---

### Paso 5 — Hook useBusinessData (likes query)

**Archivos:**

- `src/hooks/useBusinessData.ts` — Agregar `userCommentLikes: Set<string>` al return. En `fetchBusinessData`, después de obtener comments, hacer `getDoc` por cada comment para verificar si el usuario likeó. En `fetchSingleCollection('comments')`, hacer lo mismo. Agregar `userCommentLikes` al tipo de datos del estado
- `src/hooks/useBusinessDataCache.ts` — Agregar `userCommentLikes` al tipo `BusinessCacheEntry`

**Validación:** `npm run lint` pasa, tipo correcto

---

### Paso 6 — BusinessComments (edit + undo + likes + sort)

**Archivos:**

- `src/components/business/BusinessComments.tsx` — Reescritura significativa:
  1. **Sort selector**: chips "Recientes" / "Antiguos" / "Útiles" encima de la lista
  2. **Edit inline**: si editingId === comment.id, TextField + Save/Cancel en lugar del texto
  3. **Like button**: corazón + contador en cada comment (no en propios). Optimistic UI
  4. **Undo delete**: quitar dialog, usar pendingDelete + Snackbar 5s + timer
  5. **Indicador editado**: "(editado)" gris junto a la fecha si updatedAt existe

**Props nuevos:** `userCommentLikes: Set<string>`

**Validación:** Funciona visualmente en dev

---

### Paso 7 — BusinessSheet (pasar datos)

**Archivos:**

- `src/components/business/BusinessSheet.tsx` — Pasar `userCommentLikes={data.userCommentLikes}` a BusinessComments. Agregar ShareButton al header

**Validación:** Bottom sheet muestra todo correctamente

---

### Paso 8 — CommentsList (undo delete)

**Archivos:**

- `src/components/menu/CommentsList.tsx` — Reemplazar dialog de confirmación por mismo patrón de undo (pendingDelete + Snackbar + timer)

**Validación:** Undo funciona en menu lateral

---

### Paso 9 — ShareButton + deep link

**Archivos:**

- `src/components/business/ShareButton.tsx` — Nuevo componente
- `src/components/business/BusinessHeader.tsx` — Agregar prop `shareButton`, renderizar junto a favoriteButton
- `src/components/layout/AppShell.tsx` — Leer `?business=` al montar, seleccionar comercio, limpiar param

**Validación:** Share funciona (clipboard fallback en desktop), deep link abre el comercio

---

### Paso 10 — Tests

**Archivos:**

- `functions/src/triggers/__tests__/commentLikes.test.ts` — Tests del trigger (rate limit, increment, decrement)
- Verificar que tests existentes pasan

**Validación:** `npm run test:run` pasa, `cd functions && npm run test` pasa

---

### Paso 11 — Test local completo

- `npm run dev:full` — Probar flujo completo con emuladores:
  1. Crear comentario → editar → verificar "(editado)"
  2. Dar like a comentario ajeno → verificar contador
  3. Cambiar ordenamiento → verificar orden
  4. Eliminar comentario → verificar undo → verificar delete real
  5. Compartir comercio → verificar deep link
  6. En menu lateral: eliminar con undo

---

### Paso 12 — Commit, push, PR, merge

- Bump version a 2.0.0 en `package.json`
- Actualizar `docs/PROJECT_REFERENCE.md`
- Crear changelog.md
- Commit + push + PR + merge
