# Especificaciones Tecnicas: Feedback Status Tracking

**Issue:** #73
**Fecha:** 2026-03-14

## Tipos

### `FeedbackStatus` (en `src/types/index.ts`)

```typescript
export type FeedbackStatus = 'pending' | 'viewed' | 'responded' | 'resolved';
```

### `Feedback` (actualizado en `src/types/index.ts`)

```typescript
export interface Feedback {
  id: string;
  userId: string;
  message: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  createdAt: Date;
  flagged?: boolean;
  adminResponse?: string;
  respondedAt?: Date;
  respondedBy?: string;
  viewedByUser?: boolean;
}
```

Campos nuevos: `status`, `adminResponse`, `respondedAt`, `respondedBy`, `viewedByUser`.

### `NotificationType` (actualizado en `src/types/index.ts`)

```typescript
export type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking' | 'feedback_response';
```

Nuevo valor: `feedback_response`.

### `UserSettings` (actualizado en `src/types/index.ts`)

```typescript
export interface UserSettings {
  // ... campos existentes ...
  notifyFeedback: boolean;
  // ...
}
```

Nuevo campo: `notifyFeedback` (default `true` en converter).

## Constantes

### `src/constants/feedback.ts`

```typescript
export const FEEDBACK_STATUSES = {
  pending: { label: 'Enviado', color: 'default' as const },
  viewed: { label: 'Visto', color: 'info' as const },
  responded: { label: 'Respondido', color: 'success' as const },
  resolved: { label: 'Resuelto', color: 'default' as const },
};

export const MAX_ADMIN_RESPONSE_LENGTH = 500;
```

## Componentes a crear

### 1. `src/components/menu/MyFeedbackList.tsx`

Lista de feedback enviados por el usuario.

**Props:**

```typescript
interface Props {
  onNavigate: () => void;
}
```

**Estado:**

- `items: Feedback[]` -- lista de feedback del usuario
- `loading: boolean`
- `expandedId: string | null` -- ID del feedback expandido

**Logica:**

- Carga feedback del usuario con `fetchUserFeedback(user.uid)`
- Click en item alterna expand/collapse
- Al expandir un feedback con `adminResponse` y `viewedByUser !== true`, llama `markFeedbackViewed(fb.id)` y actualiza state local

**Render por item:**

- `ListItemButton` con `ListItemText`
- Primary: chips de categoria (color por tipo) + estado (outlined) + punto verde si hay respuesta no leida
- Secondary: preview del mensaje (noWrap) + fecha
- Collapse: mensaje completo + bloque de respuesta admin (si existe)

**Estado vacio:** `InboxOutlinedIcon` + "No enviaste feedback todavia"

**Helpers locales:**

- `categoryColor(cat)` -- mapea categoria a color de chip MUI
- `statusColor(status)` -- usa `FEEDBACK_STATUSES[status].color`
- `statusLabel(status)` -- usa `FEEDBACK_STATUSES[status].label`

## Componentes a modificar

### 2. `src/components/layout/SideMenu.tsx`

**Cambios:**

- Ampliar `Section`: agregar `'my-feedback'` al union type
- Agregar a `SECTION_TITLES`: `'my-feedback': 'Mis envios'`
- Lazy import: `const MyFeedbackList = lazy(() => import('../menu/MyFeedbackList'))`
- Agregar `ListItemButton` con icono `InboxOutlinedIcon` (color `#1565c0`) y texto "Mis envios"
- Agregar render: `{activeSection === 'my-feedback' && <MyFeedbackList onNavigate={handleClose} />}`

### 3. `src/components/admin/FeedbackList.tsx`

**Nota:** En la implementacion actual, el admin FeedbackList no tiene acciones de respuesta/resolucion integradas en el frontend. Las operaciones `respondToFeedback` y `resolveFeedback` se exponen como Cloud Functions callable. La tabla muestra el estado `flagged` pero no el `status` del feedback. Esto puede extenderse en una iteracion futura para agregar acciones inline.

### 4. `src/components/notifications/NotificationItem.tsx`

**Cambios:**

- El tipo `feedback_response` se maneja por el sistema de notificaciones existente
- El componente `getIcon` no tiene un case explicito para `feedback_response` (fall-through, sin icono especifico)
- Una iteracion futura puede agregar un icono dedicado (por ejemplo `FeedbackIcon`)

### 5. `src/components/menu/SettingsPanel.tsx`

**Cambios:**

- Agregar `SettingRow` para "Respuestas a feedback" con `settings.notifyFeedback`
- Deshabilitado cuando `notificationsEnabled` es `false`
- `onChange` llama `updateSetting('notifyFeedback', val)`

## Converters

### `src/config/converters.ts`

#### `feedbackConverter` (actualizado)

- `fromFirestore`: agrega campos `status` (default `'pending'`), `adminResponse`, `respondedAt`, `respondedBy`, `viewedByUser`
- `toFirestore`: agrega `status`

#### `userSettingsConverter` (actualizado)

- `fromFirestore`: agrega `notifyFeedback` (default `true`)
- `toFirestore`: agrega `notifyFeedback`

## Services

### `src/services/feedback.ts` (funciones nuevas)

```typescript
// Obtiene todos los feedback del usuario, ordenados por fecha descendente
export async function fetchUserFeedback(userId: string): Promise<Feedback[]>;

// Marca un feedback como visto por el usuario (solo viewedByUser: true)
export async function markFeedbackViewed(feedbackId: string): Promise<void>;
```

## Cloud Functions

### `functions/src/admin/feedback.ts` (nuevo archivo)

#### `respondToFeedback` (callable)

- Valida admin (email verificado + email match)
- Valida `feedbackId` (string) y `response` (1-500 chars)
- Actualiza documento: `status: 'responded'`, `adminResponse`, `respondedAt`, `respondedBy`
- Crea notificacion `feedback_response` para el usuario via `createNotification`
- `enforceAppCheck: !IS_EMULATOR`

#### `resolveFeedback` (callable)

- Valida admin (email verificado + email match)
- Valida `feedbackId` (string)
- Actualiza documento: `status: 'resolved'`
- `enforceAppCheck: !IS_EMULATOR`

### `functions/src/triggers/feedback.ts` (modificado)

- Paso 3 del trigger `onFeedbackCreated`: establece `status: 'pending'` en el documento creado

### `functions/src/utils/notifications.ts` (modificado)

- `NotificationType` actualizado con `'feedback_response'`
- Mapa de tipo a preferencia: `feedback_response: 'notifyFeedback'`
- `shouldNotify` consulta `notifyFeedback` del usuario

### `functions/src/index.ts` (modificado)

- Export: `export { respondToFeedback, resolveFeedback } from './admin/feedback'`

## Firestore Rules

### `match /feedback/{docId}`

```text
allow create: if request.auth != null
  && request.resource.data.keys().hasOnly(['userId', 'message', 'category', 'createdAt', 'rating'])
  && request.resource.data.userId == request.auth.uid
  && request.resource.data.message.size() > 0
  && request.resource.data.message.size() <= 1000
  && request.resource.data.category in ['bug', 'sugerencia', 'datos_usuario', 'datos_comercio', 'otro']
  && request.resource.data.createdAt == request.time;

allow read: if (request.auth != null && resource.data.userId == request.auth.uid)
            || isAdmin();

allow update: if isAdmin()
    && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['status', 'adminResponse', 'respondedAt', 'respondedBy'])
  || (request.auth != null
    && resource.data.userId == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewedByUser'])
    && request.resource.data.viewedByUser == true);

allow delete: if request.auth != null
  && resource.data.userId == request.auth.uid;
```

**Cambios clave respecto a la regla original:**

- `read`: ahora permite lectura al owner (antes solo create, sin read)
- `update`: dos paths -- admin puede actualizar campos de respuesta; owner puede solo marcar `viewedByUser: true`
- Se usa `diff().affectedKeys().hasOnly()` para limitar que campos puede tocar cada rol

## Interacciones con Firebase

| Accion | Operacion |
|--------|-----------|
| Cargar feedback del usuario | `getDocs(query(feedback, where('userId', '==', uid), orderBy('createdAt', 'desc')))` |
| Marcar feedback visto | `updateDoc(ref, { viewedByUser: true })` |
| Admin responder feedback | callable `respondToFeedback({ feedbackId, response })` |
| Admin resolver feedback | callable `resolveFeedback({ feedbackId })` |
| Notificacion de respuesta | `createNotification(db, { userId, type: 'feedback_response', message, referenceId })` |
