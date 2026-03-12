# PRD — Comentarios 2.0 + Compartir comercio

**Issues:** [#45](https://github.com/benoffi7/modo-mapa/issues/45), [#46](https://github.com/benoffi7/modo-mapa/issues/46), cierra [#17](https://github.com/benoffi7/modo-mapa/issues/17)
**Version objetivo:** 2.0.0
**Fase:** 1 del roadmap funcional

---

## Objetivo

Transformar la sección de comentarios de "solo escribir y borrar" a una experiencia interactiva con edición, likes y ordenamiento. Agregar la posibilidad de compartir un comercio via deep link.

---

## F1 — Comentarios 2.0

### F1.1 — Editar comentarios propios

**Como** usuario que escribió un comentario,
**quiero** poder editarlo,
**para** corregir errores sin tener que eliminarlo y reescribirlo.

#### Criterios de aceptación

- [ ] Botón "Editar" (icono lápiz) visible **solo** en comentarios del usuario actual
- [ ] Al tocar editar, el texto se convierte en TextField inline editable
- [ ] Botones "Guardar" y "Cancelar" reemplazan el botón editar
- [ ] Guardar actualiza el texto en Firestore y muestra el nuevo texto
- [ ] Cancelar descarta los cambios y vuelve al modo lectura
- [ ] Mismas validaciones que creación: 1-500 caracteres
- [ ] Campo `updatedAt` en Firestore marca la fecha de edición
- [ ] Indicador visual "editado" (texto gris sutil junto a la fecha)
- [ ] Moderación server-side en trigger `onUpdate` (re-evalúa flagged)
- [ ] Firestore rules permiten update solo al owner, validan campos

### F1.2 — Eliminar con undo

**Como** usuario que quiere eliminar un comentario,
**quiero** poder deshacer la acción,
**para** no perder mi comentario por un toque accidental.

#### Criterios de aceptación

- [ ] Al tocar eliminar, el comentario desaparece inmediatamente (optimistic)
- [ ] Snackbar aparece: "Comentario eliminado" con botón "Deshacer" (5 segundos)
- [ ] Si toca "Deshacer", el comentario reaparece en su posición original
- [ ] Si no toca deshacer (5s), se ejecuta el delete real en Firestore
- [ ] Eliminar el dialog de confirmación actual (el undo lo reemplaza)
- [ ] Mismo comportamiento en BusinessComments y CommentsList

### F1.3 — Likes en comentarios

**Como** usuario,
**quiero** darle like a comentarios útiles de otros,
**para** destacar la información valiosa.

#### Criterios de aceptación

- [ ] Botón like (icono corazón o thumbs-up) en cada comentario
- [ ] **No** visible en comentarios propios (no auto-like)
- [ ] Toggle: tocar una vez = like, tocar otra vez = unlike
- [ ] Contador de likes visible junto al botón
- [ ] Estado del like del usuario actual se carga junto con los comentarios
- [ ] Cloud Function trigger actualiza `likeCount` atómicamente
- [ ] Rate limiting: max 50 likes/día por usuario

#### Modelo de datos

```text
commentLikes/{userId}__{commentId}
  ├── userId: string
  ├── commentId: string
  └── createdAt: Timestamp

Comment (campos nuevos):
  └── likeCount: number (default 0)
```

### F1.4 — Ordenamiento de comentarios

**Como** usuario que lee comentarios de un comercio,
**quiero** ordenarlos por fecha o utilidad,
**para** encontrar los más relevantes rápido.

#### Criterios de aceptación

- [ ] Selector de orden como chips compactos encima de la lista
- [ ] Opciones: "Recientes" (default), "Antiguos", "Útiles" (por likes desc)
- [ ] Orden se aplica client-side sobre los comentarios cargados
- [ ] Orden persiste mientras el bottom sheet está abierto
- [ ] Se resetea a "Recientes" al abrir otro comercio

---

## F8 — Compartir comercio

**Como** usuario que encontró un buen comercio,
**quiero** compartirlo con otros,
**para** recomendar lugares a mis compañeros.

#### Criterios de aceptación

- [ ] Botón "Compartir" (icono share) en BusinessHeader junto a favorito y direcciones
- [ ] En dispositivos con Web Share API: abre el sheet nativo del OS
- [ ] Fallback: copia el link al clipboard + Snackbar "Link copiado"
- [ ] URL: `https://modo-mapa-app.web.app/?business={businessId}`
- [ ] Texto compartido: "Mirá {nombre} en Modo Mapa — {dirección}"
- [ ] Al abrir un deep link, la app centra el mapa y abre el bottom sheet del comercio
- [ ] El deep link funciona correctamente en PWA y en browser

---

## Fuera de alcance

- Threads / respuestas a comentarios (Fase 4)
- Notificaciones de likes (Fase 3)
- Foto de menú (Fase 2)
- Perfil público de usuario (Fase 3)

---

## Dependencias entre features

```text
F1.1 (editar) ──────────────── independiente
F1.2 (undo eliminar) ───────── independiente
F1.3 (likes) ───┐
                 ├─── F1.4 depende de F1.3 para "Más útiles"
F1.4 (orden) ───┘
F8 (compartir) ──────────────── independiente
```

---

## Impacto en Firestore

| Feature | Reads | Writes | Nueva colección |
|---------|-------|--------|-----------------|
| F1.1 Editar | 0 | +1 update por edit | — |
| F1.2 Undo | 0 (delayed delete) | 0 (mismo delete) | — |
| F1.3 Likes | +1 query por comercio (user likes) | +1 toggle por like | `commentLikes` |
| F1.4 Orden | 0 (client-side sort) | 0 | — |
| F8 Compartir | 0 | 0 | — |

---

## Archivos afectados (estimación)

### Frontend

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Agregar `updatedAt?`, `likeCount` a Comment. Nuevo tipo `CommentLike` |
| `src/services/comments.ts` | Nueva `editComment()`, `likeComment()`, `unlikeComment()` |
| `src/config/collections.ts` | Nueva colección `commentLikes` |
| `src/config/converters.ts` | Converter para `commentLikes` |
| `src/components/business/BusinessComments.tsx` | Edit inline, like button, sort selector, undo delete |
| `src/components/business/BusinessHeader.tsx` | Botón compartir |
| `src/components/menu/CommentsList.tsx` | Undo delete |
| `src/hooks/useBusinessData.ts` | Cargar likes del usuario en la query |
| `src/components/layout/AppShell.tsx` | Leer query param `?business=` para deep link |

### Backend

| Archivo | Cambio |
|---------|--------|
| `firestore.rules` | Regla update para comments, reglas para commentLikes |
| `functions/src/triggers/comments.ts` | Trigger onUpdate para re-moderar |
| `functions/src/triggers/commentLikes.ts` | Nuevo: counter de likeCount |
| `functions/src/index.ts` | Exportar nuevos triggers |

### Tests

| Archivo | Cambio |
|---------|--------|
| `functions/src/triggers/__tests__/` | Tests para onUpdate y commentLikes triggers |
