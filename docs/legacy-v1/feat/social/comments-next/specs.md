# Specs Tecnicas: Respuestas no leidas + Virtualizacion

**Feature:** comments-next
**Fecha:** 2026-03-14
**Issues:** #100, #112
**PRD:** revision 1

---

## Fase 1: Respuestas no leidas (#100)

### 1.1: Tipo `comment_reply` en NotificationType

**Archivo:** `src/types/index.ts`

```typescript
// Antes
type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking' | 'feedback_response';

// Despues
type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking' | 'feedback_response' | 'comment_reply';
```

**Archivo:** `functions/src/utils/notifications.ts`

```typescript
// Antes
type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking' | 'feedback_response';

// Despues
type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking' | 'feedback_response' | 'comment_reply';
```

> **Nota:** El tipo se define en 2 lugares (client + server) porque el proyecto no comparte tipos entre ambos.

---

### 1.2: Setting `notifyReplies`

#### 1.2a: Tipo UserSettings

**Archivo:** `src/types/index.ts`

```typescript
interface UserSettings {
  profilePublic: boolean;
  notificationsEnabled: boolean;
  notifyLikes: boolean;
  notifyPhotos: boolean;
  notifyRankings: boolean;
  notifyFeedback: boolean;
  notifyReplies: boolean;        // NUEVO
  analyticsEnabled: boolean;
  updatedAt: Date;
}
```

#### 1.2b: Default settings

**Archivo:** `src/services/userSettings.ts`

```typescript
export const DEFAULT_SETTINGS: UserSettings = {
  profilePublic: false,
  notificationsEnabled: false,
  notifyLikes: false,
  notifyPhotos: false,
  notifyRankings: false,
  notifyFeedback: true,
  notifyReplies: true,           // NUEVO — ON por defecto (alta relevancia)
  analyticsEnabled: false,
  updatedAt: new Date(),
};
```

#### 1.2c: Server-side defaults + mapping

**Archivo:** `functions/src/utils/notifications.ts`

```typescript
const TYPE_TO_SETTING: Record<NotificationType, string> = {
  like: 'notifyLikes',
  photo_approved: 'notifyPhotos',
  photo_rejected: 'notifyPhotos',
  ranking: 'notifyRankings',
  feedback_response: 'notifyFeedback',
  comment_reply: 'notifyReplies',   // NUEVO
};

const DEFAULT_SETTINGS: Record<string, boolean> = {
  notificationsEnabled: false,
  notifyLikes: false,
  notifyPhotos: false,
  notifyRankings: false,
  notifyFeedback: true,
  notifyReplies: true,              // NUEVO
};
```

> **No agregar a `BYPASS_MASTER_TOGGLE`**: las respuestas a comentarios no son comunicaciones admin→usuario, respetan el master toggle.

#### 1.2d: Firestore rules

**Archivo:** `firestore.rules`

Agregar `'notifyReplies'` al `keys().hasOnly()` de la coleccion `userSettings`:

```
match /userSettings/{userId} {
  allow write: if request.auth.uid == userId
    && request.resource.data.keys().hasOnly([
      'profilePublic', 'notificationsEnabled',
      'notifyLikes', 'notifyPhotos', 'notifyRankings', 'notifyFeedback',
      'notifyReplies',              // NUEVO
      'analyticsEnabled', 'updatedAt'
    ]);
}
```

#### 1.2e: UserSettings converter

**Archivo:** `src/config/converters.ts`

En `userSettingsConverter.fromFirestore`, agregar lectura del campo:

```typescript
notifyReplies: d.notifyReplies ?? true,  // default true para retrocompatibilidad
```

#### 1.2f: Toggle en SettingsPanel

**Archivo:** `src/components/menu/SettingsPanel.tsx`

Agregar despues del toggle "Likes en comentarios" (logicamente relacionado):

```tsx
<SettingRow
  label="Likes en comentarios"
  checked={settings.notifyLikes}
  disabled={!settings.notificationsEnabled}
  indented
  onChange={(val) => updateSetting('notifyLikes', val)}
/>
{/* NUEVO */}
<SettingRow
  label="Respuestas a comentarios"
  checked={settings.notifyReplies}
  disabled={!settings.notificationsEnabled}
  indented
  onChange={(val) => updateSetting('notifyReplies', val)}
/>
```

---

### 1.3: Cloud Function — Notificacion de respuesta

**Archivo:** `functions/src/triggers/comments.ts`

Agregar logica de notificacion al final de `onCommentCreated`, despues del bloque de counters + aggregates (paso 4). Importar `createNotification` desde `../utils/notifications`.

```typescript
import { createNotification } from '../utils/notifications';

// Dentro de onCommentCreated, despues del paso 4:

    // 5. Notify parent author on reply
    if (parentId) {
      const parentSnap = await db.collection('comments').doc(parentId).get();
      if (parentSnap.exists) {
        const parentData = parentSnap.data()!;
        const parentAuthorId = parentData.userId as string;

        // Don't self-notify
        if (parentAuthorId !== userId) {
          // Fetch reply author name
          const userSnap = await db.doc(`users/${userId}`).get();
          const actorName = userSnap.exists
            ? (userSnap.data()!.displayName as string)
            : 'Alguien';

          const replyText = (data.text as string).slice(0, 80);
          const businessId = data.businessId as string | undefined;

          await createNotification(db, {
            userId: parentAuthorId,
            type: 'comment_reply',
            message: `${actorName} respondió tu comentario: "${replyText}"`,
            actorId: userId,
            actorName,
            ...(businessId && { businessId }),
            referenceId: parentId,
          });
        }
      }
    }
```

**Detalle de campos:**

| Campo | Valor | Motivo |
|-------|-------|--------|
| `userId` | `parentAuthorId` | Destinatario de la notificacion |
| `type` | `'comment_reply'` | Nuevo tipo |
| `message` | `"${actorName} respondió tu comentario: \"${text80}\""` | Mensaje descriptivo con preview |
| `actorId` | `userId` del que responde | Para perfil clickeable |
| `actorName` | displayName del que responde | Para mostrar sin fetch |
| `businessId` | `data.businessId` | Para navegar al comercio |
| `referenceId` | `parentId` | ID del comentario padre (para marcar como leido) |

**Optimizacion:** El `parentSnap` ya se fetcheo en el paso 3 para incrementar `replyCount`. Refactorizar para reutilizar:

```typescript
    // 3. Increment parent replyCount + fetch for notification (reutilizar snap)
    const parentId = data.parentId as string | undefined;
    let parentSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    if (parentId) {
      const parentRef = db.collection('comments').doc(parentId);
      parentSnap = await parentRef.get();
      if (parentSnap.exists) {
        await parentRef.update({ replyCount: FieldValue.increment(1) });
      }
    }

    // 4. Counters + aggregates (sin cambios)
    // ...

    // 5. Notify parent author on reply
    if (parentId && parentSnap?.exists) {
      const parentData = parentSnap.data()!;
      const parentAuthorId = parentData.userId as string;

      if (parentAuthorId !== userId) {
        const userSnap = await db.doc(`users/${userId}`).get();
        const actorName = userSnap.exists
          ? (userSnap.data()!.displayName as string)
          : 'Alguien';

        const replyText = (data.text as string).slice(0, 80);
        const businessId = data.businessId as string | undefined;

        await createNotification(db, {
          userId: parentAuthorId,
          type: 'comment_reply',
          message: `${actorName} respondió tu comentario: "${replyText}"`,
          actorId: userId,
          actorName,
          ...(businessId && { businessId }),
          referenceId: parentId,
        });
      }
    }
```

**Rate limit de notificaciones:** No necesario. El rate limit de comentarios (20/dia) ya limita la cantidad de replies. Con 20 replies max/dia, no hay riesgo de spam de notificaciones.

---

### 1.4: Icono en NotificationItem

**Archivo:** `src/components/notifications/NotificationItem.tsx`

Agregar import y case:

```typescript
import ReplyIcon from '@mui/icons-material/Reply';

function getIcon(type: AppNotification['type']) {
  switch (type) {
    case 'like':
      return <FavoriteIcon color="error" fontSize="small" />;
    case 'photo_approved':
    case 'photo_rejected':
      return <CameraAltIcon color="primary" fontSize="small" />;
    case 'ranking':
      return <LeaderboardIcon color="warning" fontSize="small" />;
    case 'feedback_response':
      return <FeedbackOutlinedIcon sx={{ color: 'success.main' }} fontSize="small" />;
    case 'comment_reply':                                              // NUEVO
      return <ReplyIcon color="info" fontSize="small" />;              // NUEVO
  }
}
```

---

### 1.5: Badge en SideMenu

**Archivo:** `src/components/layout/SideMenu.tsx`

El badge muestra la cantidad de notificaciones no leidas de tipo `comment_reply`. Para no agregar un listener nuevo, reutilizar `useNotifications` que ya tiene `notifications` cargadas.

**Approach:** Pasar `unreadReplyCount` desde el padre que ya usa `useNotifications`.

**Problema:** `SideMenu` no usa `useNotifications` directamente — lo usa `NotificationBell` en la barra de busqueda. Para evitar duplicar el hook, calcular el count en `NotificationBell` y propagarlo via contexto o prop.

**Solucion elegida:** Calcular `unreadReplyCount` en el componente padre que tiene acceso a `useNotifications` y pasarlo como prop a `SideMenu`.

**Archivo:** `src/components/layout/SideMenu.tsx`

Agregar prop y Badge:

```typescript
// Agregar a imports
import Badge from '@mui/material/Badge';

// Agregar prop
interface SideMenuProps {
  // ... props existentes
  unreadReplyCount?: number;
}

// En el ListItemButton de Comentarios:
<ListItemButton onClick={() => setActiveSection('comments')}>
  <ListItemIcon>
    <Badge
      badgeContent={unreadReplyCount}
      color="error"
      max={9}
      invisible={!unreadReplyCount}
    >
      <ChatBubbleOutlineIcon sx={{ color: 'primary.main' }} />
    </Badge>
  </ListItemIcon>
  <ListItemText primary="Comentarios" />
</ListItemButton>
```

**Archivo padre** (el que renderiza `SideMenu` — verificar si es `MapView` o `App`):

```typescript
const { notifications } = useNotifications();
const unreadReplyCount = useMemo(
  () => notifications.filter((n) => n.type === 'comment_reply' && !n.read).length,
  [notifications],
);
// Pasar a <SideMenu unreadReplyCount={unreadReplyCount} />
```

> **Alternativa si SideMenu no recibe props:** crear un hook `useUnreadReplyCount` liviano que haga una query `count` directa. Pero preferir la prop para evitar queries extra.

---

### 1.6: Dot por comentario en CommentsList

**Archivo:** `src/components/menu/CommentsList.tsx`

Para saber que comentarios tienen respuestas no leidas, necesitamos las notificaciones de tipo `comment_reply` del usuario. Usar el hook `useNotifications` ya existente.

**Nuevo estado derivado:**

```typescript
import { useNotifications } from '../../hooks/useNotifications';

// Dentro de CommentsList:
const { notifications } = useNotifications();

// Set de commentIds (referenceId) con respuestas no leidas
const unreadReplyCommentIds = useMemo(() => {
  const ids = new Set<string>();
  for (const n of notifications) {
    if (n.type === 'comment_reply' && !n.read && n.referenceId) {
      ids.add(n.referenceId);
    }
  }
  return ids;
}, [notifications]);
```

**UI — dot azul junto al replyCount:**

```tsx
{(comment.replyCount ?? 0) > 0 && (
  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
    <ChatBubbleOutlineIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
    <Typography component="span" variant="caption" color="text.secondary">
      {comment.replyCount}
    </Typography>
    {/* Dot azul si hay respuestas no leidas */}
    {unreadReplyCommentIds.has(comment.id) && (
      <Box
        component="span"
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: 'info.main',
          ml: 0.25,
        }}
        aria-label="Respuestas nuevas"
      />
    )}
  </Box>
)}
```

**Marcar como leidas al navegar:** Cuando el usuario hace click en un comentario con dot (navega al comercio), marcar las notificaciones `comment_reply` con ese `referenceId` como leidas.

```typescript
import { markNotificationRead } from '../../services/notifications';

const handleSelectBusiness = useCallback(
  (business: Business | null, commentId: string) => {
    if (!business) return;
    setSelectedBusiness(business);
    onNavigate();

    // Mark reply notifications as read for this comment
    if (unreadReplyCommentIds.has(commentId)) {
      for (const n of notifications) {
        if (n.type === 'comment_reply' && !n.read && n.referenceId === commentId) {
          markNotificationRead(n.id).catch(() => {});
        }
      }
    }
  },
  [setSelectedBusiness, onNavigate, unreadReplyCommentIds, notifications],
);
```

Actualizar la invocacion en `onClick` del `ListItemButton`:

```tsx
onClick={() =>
  editingId !== id && !isSwiped && handleSelectBusiness(business, comment.id)
}
```

---

### 1.7: Firestore — Sin nuevos indices

Los indices existentes para `notifications` ya cubren los queries necesarios:

- `userId ASC + createdAt DESC` — para `fetchUserNotifications()`
- `userId ASC + read ASC + createdAt DESC` — para `getUnreadCount()`

No se necesitan indices adicionales. El filtro por `type === 'comment_reply'` se hace client-side sobre las notificaciones ya cargadas.

---

### 1.8: Export en functions/src/index.ts

**No necesario.** La notificacion se crea dentro del trigger `onCommentCreated` existente, que ya esta exportado. No hay nuevo trigger que exportar.

---

## Fase 2: Virtualizacion (#112)

### 2.1: Dependencia

**Archivo:** `package.json`

```bash
npm install @tanstack/react-virtual
```

> Version actual: `^3.13.x`. Compatible con React 19. Sin dependencias transitivas pesadas (~3KB gzipped).

---

### 2.2: Virtualizar CommentsList

**Archivo:** `src/components/menu/CommentsList.tsx`

#### 2.2a: Imports

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
```

#### 2.2b: Ref del contenedor scrollable

El contenedor scrollable es el `Drawer` del `SideMenu`. `CommentsList` necesita un ref al elemento scrollable padre.

**Opcion 1 — Ref propio dentro de CommentsList:**

Wrappear la lista en un `Box` con `overflow: auto` y altura fija. Esto es mas simple y autocontenido.

```tsx
const scrollContainerRef = useRef<HTMLDivElement>(null);
```

**Opcion 2 — Ref del Drawer padre:**

Mas complejo, requiere prop drilling. Descartado.

**Se usa Opcion 1.**

#### 2.2c: Setup del virtualizer

```typescript
const virtualizer = useVirtualizer({
  count: filteredComments.length,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => 72,  // Altura base de un item (titulo + texto + metadata)
  overscan: 5,
  measureElement: (el) => el.getBoundingClientRect().height,  // Alturas reales
});
```

**Alturas estimadas:**

| Estado | Altura aprox |
|--------|-------------|
| Normal | 72px |
| Con replyCount + likeCount | 76px |
| En modo edicion | 140px |

`measureElement` recalcula automaticamente cuando el DOM cambia (ej: al entrar en modo edicion).

#### 2.2d: Render virtualizado

Reemplazar el `<List>` actual:

```tsx
{filteredComments.length > 0 && (
  <Box
    ref={scrollContainerRef}
    sx={{
      flex: 1,
      overflow: 'auto',
      // Altura calculada: 100% del espacio disponible
      // El PaginatedListShell ya gestiona el layout
    }}
  >
    <List
      disablePadding
      sx={{
        height: virtualizer.getTotalSize(),
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const { id, comment, business } = filteredComments[virtualRow.index];
        const isSwiped = swipe.swipedId === id;
        const itemRef = getSwipeRef(id);
        const handlers = swipe.getHandlers(id, itemRef);
        const style = swipe.getStyle(id);

        return (
          <Box
            key={id}
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {/* Contenido del item — mismo JSX actual */}
            <Box sx={{ position: 'relative', overflow: 'hidden' }}>
              {/* Swipe actions + ListItemButton — sin cambios */}
            </Box>
          </Box>
        );
      })}
    </List>
  </Box>
)}
```

#### 2.2e: Trigger loadMore en scroll virtual

El boton "Cargar mas" del `PaginatedListShell` sigue funcionando. Adicionalmente, trigger automatico cuando el ultimo item virtual es visible:

```typescript
// Auto-load when near the end
const lastItem = virtualizer.getVirtualItems().at(-1);
useEffect(() => {
  if (!lastItem) return;
  if (
    lastItem.index >= filteredComments.length - 3 &&
    hasMore &&
    !isLoadingMore &&
    !searchInput
  ) {
    loadMore();
  }
}, [lastItem?.index, filteredComments.length, hasMore, isLoadingMore, searchInput, loadMore]);
```

#### 2.2f: Recalcular al editar

Cuando `editingId` cambia, la altura del item editado cambia (~72px → ~140px). `measureElement` via ref callback lo maneja automaticamente con `@tanstack/react-virtual`. No se necesita accion manual.

#### 2.2g: Compatibilidad con swipe

`useSwipeActions` usa `touch events` + `transform: translateX()` en el item. El virtualizer usa `transform: translateY()` en el wrapper. No hay conflicto porque operan en ejes distintos. El `ref` del swipe se mantiene en el inner `Box`, no en el wrapper virtual.

---

### 2.3: Threshold de activacion

La virtualizacion agrega complejidad. Solo activarla cuando hay suficientes items para justificarla.

```typescript
const VIRTUALIZE_THRESHOLD = 20;
const shouldVirtualize = filteredComments.length >= VIRTUALIZE_THRESHOLD;
```

Si `shouldVirtualize` es `false`, renderizar la lista plana actual (sin cambios). Si es `true`, usar el render virtualizado. Esto evita overhead innecesario para listas cortas.

---

## Actualizaciones de plataforma

### Seccion de Ayuda

**Archivo:** `src/components/menu/HelpSection.tsx`

Agregar en la seccion "Menu lateral" > "Comentarios":

```text
"Recibís una notificación cuando alguien responde a tu comentario.
Podés desactivar estas notificaciones en Configuración > Notificaciones > Respuestas a comentarios."
```

### Seed Data

**Archivo:** `scripts/seed-admin-data.mjs`

Agregar:

- Campo `notifyReplies: true` en los `userSettings` de seed
- 2-3 notificaciones de tipo `comment_reply` con campos `actorName`, `businessId`, `referenceId`

### Politica de Privacidad

Sin cambios. Las notificaciones in-app ya estan cubiertas. `notifyReplies` es un setting mas del mismo tipo.

### Panel Admin

Sin cambios. El tipo `comment_reply` aparecera en las stats de notificaciones existentes automaticamente.

---

## Orden de implementacion

### Fase 1 — Respuestas no leidas

1. **1.2a-c**: Agregar tipo `comment_reply`, campo `notifyReplies`, defaults (types, services, functions)
2. **1.2d**: Actualizar Firestore rules
3. **1.2e**: Actualizar converter
4. **1.3**: Cloud Function — notificacion en `onCommentCreated`
5. **1.4**: Icono en `NotificationItem`
6. **1.2f**: Toggle en `SettingsPanel`
7. **1.5**: Badge en `SideMenu`
8. **1.6**: Dot + mark-as-read en `CommentsList`
9. **Ayuda + Seed**

### Fase 2 — Virtualizacion

1. **2.1**: Instalar `@tanstack/react-virtual`
2. **2.2**: Implementar virtualizer en `CommentsList`
3. **2.3**: Threshold de activacion
4. **Test manual** en dispositivo low-end con 100+ items

---

## Testing

| Item | Tipo | Que verificar |
|------|------|---------------|
| `onCommentCreated` reply notif | Unit (functions) | Crea notificacion, no self-notify, respeta settings |
| `notifyReplies` default | Unit | Default true en client y server |
| `comment_reply` icon | Render | ReplyIcon con color info |
| Badge SideMenu | Render | Muestra count, invisible cuando 0 |
| Dot en CommentsList | Render | Visible cuando hay unread, desaparece al navegar |
| Mark-as-read on click | Integration | Notificaciones marcadas al navegar al comercio |
| Firestore rules | Unit | `notifyReplies` aceptado en `keys().hasOnly` |
| Virtualizer render | Render | Items visibles correctos, scroll fluido |
| Virtualizer + swipe | Integration | Swipe funciona dentro de items virtualizados |
| Virtualizer + edit | Integration | Altura recalculada al editar inline |
| Virtualizer + loadMore | Integration | Carga automatica al llegar al final |
| Threshold 20 items | Unit | Lista plana debajo de 20, virtual arriba |
