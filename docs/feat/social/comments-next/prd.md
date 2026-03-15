# PRD: Comentarios — Respuestas no leidas + Virtualizacion

**Feature:** comments-next
**Categoria:** social
**Fecha:** 2026-03-14
**Issues:** #100, #112
**Prioridad:** Media

---

## Contexto

El feature `comments-improvements` (v2.4.0) transformo la seccion "Mis Comentarios" del menu lateral en un hub completo con busqueda, sorting, filtros, edicion inline, stats y swipe actions. Quedaron pendientes dos mejoras de la propuesta original (#85):

1. **#100 — Indicador de respuestas nuevas**: cuando alguien responde a un comentario del usuario, no hay forma de saberlo sin ir al comercio. No hay badge ni dot visual.
2. **#112 — Virtualizacion para listas largas**: `CommentsList` renderiza todos los items cargados en un `<List>` plano. Con 50+ comentarios en dispositivos low-end, el scroll se vuelve lento.

---

## Problema

### P1: Respuestas invisibles

- El usuario no sabe que alguien respondio a su comentario salvo que abra manualmente cada comercio.
- El sistema de notificaciones in-app no cubre este caso (no existe tipo `comment_reply`).
- Esto reduce engagement: las respuestas pasan desapercibidas y no generan conversacion.

### P2: Performance con muchos comentarios

- `CommentsList` monta todos los items en el DOM simultaneamente.
- Con busqueda activa se ejecuta `loadAll()` que puede traer 200+ items.
- En dispositivos low-end (2GB RAM, CPU lento) esto causa jank visible en scroll y transiciones.
- No hay virtualizacion en ninguna lista del menu lateral.

---

## Solucion

### S1: Indicador de respuestas no leidas (#100)

#### S1.1: Cloud Function — Notificacion de respuesta

- Crear trigger `onReplyCreated` que detecte cuando un comentario con `parentId` se crea.
- Enviar notificacion al autor del comentario padre (tipo `comment_reply`).
- Reutilizar la coleccion `notifications` existente con nuevo tipo.

**Campos de la notificacion:**

| Campo | Valor |
|-------|-------|
| userId | `parentComment.userId` |
| type | `comment_reply` |
| title | `"{replyAuthorName} respondio tu comentario"` |
| body | Texto truncado de la respuesta (80 chars) |
| relatedId | `businessId` del comentario padre |
| read | `false` |
| createdAt | serverTimestamp |

**Archivos:**

- `functions/src/triggers/comments.ts` — nuevo trigger `onReplyCreated`
- `src/types/index.ts` — agregar `'comment_reply'` a `NotificationType`

#### S1.2: Badge en SideMenu

- En el item "Comentarios" del `SideMenu`, mostrar un `Badge` con la cantidad de notificaciones no leidas de tipo `comment_reply`.
- Reutilizar el hook de notificaciones existente filtrando por tipo.

**Archivos:**

- `src/components/layout/SideMenu.tsx` — Badge en el ListItemButton de comentarios

#### S1.3: Dot por comentario en CommentsList

- En cada comentario que tenga respuestas no leidas, mostrar un dot azul junto al `replyCount`.
- Al abrir el BusinessSheet de ese comercio (click en el comentario), marcar las notificaciones `comment_reply` relacionadas como leidas.

**Archivos:**

- `src/components/menu/CommentsList.tsx` — dot visual por item
- `src/services/notifications.ts` — funcion para marcar como leidas por `relatedId`

#### S1.4: Configuracion de usuario

- Agregar toggle `notifyReplies` en `UserSettings` y `SettingsPanel`.
- La Cloud Function respeta este flag antes de crear la notificacion.

**Archivos:**

- `src/types/index.ts` — agregar `notifyReplies` a `UserSettings`
- `src/components/settings/SettingsPanel.tsx` — nuevo toggle
- `functions/src/triggers/comments.ts` — check `userSettings.notifyReplies`

---

### S2: Virtualizacion de CommentsList (#112)

#### S2.1: Dependencia

- Agregar `@tanstack/react-virtual` (liviano, sin dependencias, compatible con React 19).
- No usar `react-window` (API legacy, no soporta dynamic heights nativamente).

#### S2.2: Implementacion

- Wrappear la `<List>` en `CommentsList` con `useVirtualizer`.
- Estimar altura de cada item (72px base, ~120px si esta en modo edicion).
- Overscan de 5 items para scroll suave.
- Mantener compatibilidad con `loadMore` (trigger al llegar al final del viewport virtual).

**Archivos:**

- `package.json` — agregar `@tanstack/react-virtual`
- `src/components/menu/CommentsList.tsx` — wrappear lista con virtualizer

#### S2.3: Extensibilidad

- Si la virtualizacion funciona bien en `CommentsList`, evaluar aplicarla a `FavoritesList` y `RatingsList` en un futuro issue.
- No implementar en otras listas en este scope.

---

## Scope

| Item | Issue | Prioridad | Esfuerzo |
|------|-------|-----------|----------|
| S1.1: Cloud Function reply notification | #100 | Alta | M |
| S1.2: Badge en SideMenu | #100 | Alta | S |
| S1.3: Dot por comentario | #100 | Media | S |
| S1.4: Toggle notifyReplies | #100 | Media | S |
| S2.1: Dependencia @tanstack/react-virtual | #112 | Media | XS |
| S2.2: Virtualizar CommentsList | #112 | Media | M |

**Esfuerzo total estimado:** M-L

---

## Fases

### Fase 1: Respuestas no leidas (#100)

1. S1.1 — Cloud Function trigger
2. S1.4 — Toggle en settings (prerequisito para S1.1)
3. S1.2 — Badge en SideMenu
4. S1.3 — Dot por comentario

### Fase 2: Virtualizacion (#112)

1. S2.1 — Instalar dependencia
2. S2.2 — Virtualizar CommentsList

---

## Out of Scope

- Notificaciones push (solo in-app).
- Virtualizar otras listas del menu (FavoritesList, RatingsList) — issue separado si es necesario.
- Read receipts bidireccionales (el autor del reply no sabe si el otro lo leyo).
- Respuestas anidadas mas alla de 1 nivel (ya limitado por diseno).
- Indicador en tiempo real (WebSocket/listener) — se usa polling existente de 60s.

---

## Dependencias

- Sistema de notificaciones in-app existente (coleccion `notifications`, polling 60s, drawer).
- Cloud Functions v2 (`functions/src/triggers/`).
- `UserSettings` ya tiene toggles granulares (`notifyLikes`, `notifyPhotos`, etc.).
- `replyCount` ya existe en el tipo `Comment` y es mantenido por Cloud Functions.

---

## Riesgos

| Riesgo | Mitigacion |
|--------|------------|
| Spam de notificaciones si alguien responde muchas veces | Rate limit en Cloud Function (max 1 notif por comentario padre por minuto) |
| Performance de query para "no leidas por tipo" | Indice compuesto `userId + type + read` en Firestore |
| Virtualizer rompe swipe actions | Testear interaccion swipe + virtual scroll en dispositivos reales |
| Altura dinamica de items (edicion inline) | Usar `measureElement` de @tanstack/react-virtual para recalcular |

---

## Success Criteria

1. El usuario recibe notificacion in-app cuando alguien responde a su comentario.
2. Badge visible en el icono de Comentarios del SideMenu cuando hay respuestas nuevas.
3. Dot azul junto al reply count de cada comentario con respuestas no leidas.
4. Toggle `notifyReplies` en configuracion, respetado por la Cloud Function.
5. CommentsList con 100+ items mantiene scroll fluido (60fps) en dispositivos low-end.
6. `loadMore` sigue funcionando correctamente con virtualizacion activa.

---

## Impacto en otras areas

### Help Section

- Agregar en topic "Comentarios": "Recibis una notificacion cuando alguien responde a tu comentario. Podes desactivarlo en Configuracion."

### Privacy Policy

- Sin cambios: las notificaciones ya estan cubiertas. `notifyReplies` es un setting mas del mismo tipo.

### Seed Data

- Agregar `notifyReplies: true` al default de `userSettings` en el seed script.
- Agregar notificaciones de ejemplo con tipo `comment_reply`.

### Admin Panel

- Sin cambios inmediatos. El tipo `comment_reply` aparecera automaticamente en las stats de notificaciones existentes.

---

## Analytics

| Evento | Cuando | Propiedades |
|--------|--------|-------------|
| `notification_received` | Cloud Function crea notif de reply | `type: 'comment_reply'` |
| `notification_click` | Usuario toca la notificacion de reply | `type: 'comment_reply'` |
| `setting_change` | Toggle notifyReplies | `setting: 'notifyReplies', value: boolean` |
