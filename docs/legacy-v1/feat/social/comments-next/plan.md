# Plan de Implementacion: Respuestas no leidas + Virtualizacion

**Feature:** comments-next
**Fecha:** 2026-03-14
**PRD:** revision 1 | **Specs:** revision 1
**Issues:** #100, #112

---

## Estrategia

**Feature branch** como punto de integracion. Cada fase se mergea al feature branch. Main solo con aprobacion del usuario.

```text
main
  └── feat/comments-next                    ← feature branch (integracion)
        ├── feat/comments-reply-notif       ← Fase 1: #100
        └── feat/comments-virtualization    ← Fase 2: #112
```

---

## Fase 1: Respuestas no leidas (#100)

### Step 1: Tipos + defaults + rules

**Archivos a modificar:**

- `src/types/index.ts` — agregar `'comment_reply'` a `NotificationType`, `notifyReplies` a `UserSettings`
- `src/services/userSettings.ts` — agregar `notifyReplies: true` a `DEFAULT_SETTINGS`
- `src/config/converters.ts` — agregar `notifyReplies` a `userSettingsConverter.fromFirestore`
- `firestore.rules` — agregar `'notifyReplies'` al `keys().hasOnly()` de `userSettings`

**Cambios:**

```typescript
// src/types/index.ts
// NotificationType: agregar | 'comment_reply'
// UserSettings: agregar notifyReplies: boolean

// src/services/userSettings.ts
// DEFAULT_SETTINGS: agregar notifyReplies: true

// src/config/converters.ts
// userSettingsConverter.fromFirestore: agregar notifyReplies: d.notifyReplies ?? true
```

```text
// firestore.rules — userSettings keys().hasOnly
// Agregar 'notifyReplies' a la lista
```

**Test:** Compilacion limpia (`npm run build`). Verificar que el tipo se propaga sin errores.
**Riesgo:** Ninguno — cambios aditivos, retrocompatibles.

---

### Step 2: Server-side — notificacion en Cloud Function

**Archivos a modificar:**

- `functions/src/utils/notifications.ts` — agregar `'comment_reply'` al tipo, mapping y defaults
- `functions/src/triggers/comments.ts` — agregar paso 5 en `onCommentCreated`

**Cambios en `notifications.ts`:**

```typescript
// NotificationType: agregar | 'comment_reply'
// TYPE_TO_SETTING: agregar comment_reply: 'notifyReplies'
// DEFAULT_SETTINGS: agregar notifyReplies: true
```

**Cambios en `comments.ts`:**

- Importar `createNotification` desde `../utils/notifications`
- Refactorizar paso 3: guardar `parentSnap` en variable para reutilizar en paso 5
- Agregar paso 5 despues de counters: si `parentId` y `parentSnap.exists`, fetch author, check no self-notify, crear notificacion tipo `comment_reply`

**Test:** `npm run build` en `functions/`. Test unitario del trigger (mock de `createNotification`).
**Test manual con emuladores:**

1. Crear comentario con `parentId`
2. Verificar que se crea doc en coleccion `notifications` con tipo `comment_reply`
3. Verificar que NO se crea si el reply es del mismo autor del parent

**Riesgo:** Bajo — agrega logica al final de un trigger existente sin modificar pasos 1-4.

---

### Step 3: UI — icono + toggle

**Archivos a modificar:**

- `src/components/notifications/NotificationItem.tsx` — agregar case `comment_reply` con `ReplyIcon`
- `src/components/menu/SettingsPanel.tsx` — agregar `SettingRow` para `notifyReplies`

**Cambios en `NotificationItem.tsx`:**

```typescript
// Import: ReplyIcon de @mui/icons-material/Reply
// Agregar case 'comment_reply': return <ReplyIcon color="info" fontSize="small" />
```

**Cambios en `SettingsPanel.tsx`:**

```tsx
// Agregar despues del toggle "Likes en comentarios":
// <SettingRow label="Respuestas a comentarios" checked={settings.notifyReplies}
//   disabled={!settings.notificationsEnabled} indented
//   onChange={(val) => updateSetting('notifyReplies', val)} />
```

**Test manual:** Verificar que el toggle aparece, se guarda, y que las notificaciones de reply muestran el icono correcto.
**Riesgo:** Ninguno.

---

### Step 4: Badge en SideMenu

**Archivos a modificar:**

- `src/components/layout/SideMenu.tsx` — agregar `Badge` al icono de Comentarios

**Approach:** Necesitamos el count de notificaciones `comment_reply` no leidas. Verificar como se conecta `useNotifications` con `SideMenu`.

**Pre-investigacion:** Leer el padre de SideMenu para determinar si ya tiene acceso a `useNotifications` o si necesitamos agregar una prop.

**Cambios:**

- Import `Badge` de MUI
- Agregar prop `unreadReplyCount?: number` (o calcular internamente si SideMenu ya tiene acceso a notifications)
- Wrappear `ChatBubbleOutlineIcon` en `<Badge badgeContent={count} color="error" max={9}>`

**Test manual:** Crear reply via emulador → verificar badge aparece → click en Comentarios → verificar badge se limpia.
**Riesgo:** Bajo — depende de como se propaga `useNotifications`.

---

### Step 5: Dot + mark-as-read en CommentsList

**Archivos a modificar:**

- `src/components/menu/CommentsList.tsx` — agregar dot azul, mark-as-read on click

**Cambios:**

1. Importar `useNotifications` y `markNotificationRead`
2. Derivar `unreadReplyCommentIds: Set<string>` via `useMemo` filtrando notificaciones `comment_reply` no leidas
3. En metadata row: agregar dot azul (6x6px, `bgcolor: info.main`) junto al replyCount cuando `unreadReplyCommentIds.has(comment.id)`
4. En `handleSelectBusiness`: agregar logica de mark-as-read para notificaciones del comentario clickeado

**Test manual:**

1. Crear reply via emulador → dot azul aparece junto al replyCount
2. Click en el comentario → navega al comercio → dot desaparece
3. Badge de SideMenu se actualiza

**Riesgo:** Bajo.

---

### Step 6: Ayuda + Seed

**Archivos a modificar:**

- `src/components/menu/HelpSection.tsx` — agregar texto sobre notificaciones de respuestas
- `scripts/seed-admin-data.mjs` — agregar `notifyReplies: true` en userSettings, notificaciones de ejemplo tipo `comment_reply`

**Validacion:** Correr `help-docs-reviewer` y `seed-manager` agents post-cambios.

---

## Fase 2: Virtualizacion (#112)

### Step 7: Instalar dependencia

```bash
npm install @tanstack/react-virtual
```

**Verificar:** `npm run build` pasa. Bundle size delta (esperar ~3KB gzipped).

---

### Step 8: Virtualizar CommentsList

**Archivos a modificar:**

- `src/components/menu/CommentsList.tsx`

**Cambios:**

1. Importar `useVirtualizer` de `@tanstack/react-virtual`
2. Agregar constante `VIRTUALIZE_THRESHOLD = 20`
3. Agregar `scrollContainerRef = useRef<HTMLDivElement>(null)`
4. Setup `useVirtualizer` con `estimateSize: 72`, `overscan: 5`, `measureElement`
5. Render condicional: si `filteredComments.length >= VIRTUALIZE_THRESHOLD` → render virtual, sino → render plano actual
6. Render virtual: `Box` wrapper con `ref={scrollContainerRef}` + `overflow: auto`, `List` con `height: getTotalSize()`, items con `position: absolute` + `translateY`
7. Auto-loadMore: `useEffect` que detecta cuando el ultimo item virtual esta cerca del final

**Test manual:**

1. Con <20 comentarios → lista plana (sin cambios)
2. Con 50+ comentarios → scroll fluido, items se renderizan/desrenderizan al scrollear
3. Swipe funciona en items virtualizados
4. Editar inline funciona (altura se recalcula)
5. Busqueda + loadAll + virtualizacion funciona
6. "Cargar mas" se triggerea automaticamente al llegar al final

**Test en dispositivo low-end:** Verificar 60fps scroll con 100+ items.

**Riesgo:** Medio — interaccion swipe + virtual scroll necesita testing en dispositivos reales.

---

## Checklist pre-merge a feature branch

Por cada fase:

- [ ] `npm run build` sin errores
- [ ] `npm run lint` sin warnings nuevos
- [ ] Tests existentes pasan (162+)
- [ ] Tests nuevos escritos y pasando
- [ ] Test manual en emuladores
- [ ] Markdownlint en archivos .md nuevos/modificados

## Checklist pre-merge a main

- [ ] Auditorias: dark-mode, help-docs, seed-manager
- [ ] Actualizar PROJECT_REFERENCE
- [ ] Actualizar seed script
- [ ] `/bump` (minor — feat)
- [ ] CI verde
- [ ] Cerrar issues #100, #112
