# Specs: Admin content moderation actions

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

### Nueva coleccion: `moderationLogs`

Registra cada accion de moderacion para audit trail.

```typescript
type ModerationAction = 'delete' | 'hide';
type ModerationTargetCollection = 'comments' | 'ratings' | 'customTags';

interface ModerationLog {
  id: string;
  adminId: string;
  action: ModerationAction;
  targetCollection: ModerationTargetCollection;
  targetDocId: string;
  targetUserId: string;
  reason?: string | undefined;
  snapshot: Record<string, unknown>; // copia del doc antes de moderar
  timestamp: Date;
}
```

Los tipos `ModerationAction`, `ModerationTargetCollection` y `ModerationLog` van en `src/types/admin.ts`.

### Campo nuevo en `comments`: `hidden`

Tipo: `boolean` (opcional). Cuando `true`, el comentario fue ocultado por moderacion. El filtro en queries del usuario final esta out of scope (PRD), pero el campo queda preparado.

No requiere cambio en Firestore rules de `comments` porque la escritura de `hidden` es via Admin SDK (Cloud Function), que bypasea rules.

---

## Firestore Rules

### Nueva regla: `moderationLogs`

```javascript
match /moderationLogs/{docId} {
  allow read: if isAdmin();
  allow create, update, delete: if false;
}
```

Solo admin puede leer. Toda escritura es via Admin SDK (Cloud Functions callables).

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|----------------------|------------|-------------|--------------------|--------------------|
| `fetchModerationLogs()` (services/admin/moderation.ts) | moderationLogs | Admin | `allow read: if isAdmin()` | SI -- regla nueva |
| `moderateComment` callable (functions) | comments, commentLikes, moderationLogs | Admin SDK | Bypasea rules | No |
| `moderateRating` callable (functions) | ratings, moderationLogs | Admin SDK | Bypasea rules | No |
| `moderateCustomTag` callable (functions) | customTags, moderationLogs | Admin SDK | Bypasea rules | No |

### Field whitelist check

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|----------------------|----------------------|--------------------------------------|--------------------|
| moderationLogs | (coleccion nueva) | N/A -- `allow create: if false` | N/A -- `allow update: if false` | No (Admin SDK) |
| comments | hidden | N/A | N/A | No (Admin SDK bypasea rules) |

---

## Cloud Functions

### `functions/src/admin/moderation.ts` (archivo nuevo)

Tres Cloud Functions callables:

#### `moderateComment`

- **Input:** `{ commentId: string, action: 'delete' | 'hide' }`
- **Guards:** `assertAdmin(request.auth)` + `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`
- **Rate limit:** `checkCallableRateLimit(db, 'moderate_${auth.uid}', 5, auth.uid)` -- 5/min compartido entre las 3 callables
- **Logica:**
  1. Validar input: `commentId` string no vacio, `action` es `'delete'` o `'hide'`
  2. Leer doc de `comments/{commentId}`. Si no existe, throw `HttpsError('not-found')`
  3. Guardar snapshot en `moderationLogs` (via Admin SDK)
  4. Si `action === 'delete'`:
     - Eliminar replies huerfanas (cascade): query `comments` where `parentId == commentId`, batch delete
     - Eliminar commentLikes asociados: query `commentLikes` where `commentId == commentId`, batch delete
     - Si el comentario es reply (tiene `parentId`), decrementar `replyCount` del padre
     - Eliminar el doc. Nota: `onCommentDeleted` trigger se activara y manejara counters + aggregates
  5. Si `action === 'hide'`: update doc con `{ hidden: true }`
  6. Return `{ success: true }`

Nota sobre cascade: la callable hace cascade manual en vez de depender de `onCommentDeleted` para replies, porque `onCommentDeleted` ya maneja cascade pero agregar el delete de commentLikes ahi seria scope creep. La callable hace las 3 operaciones atomicamente (replies + likes + doc) para consistencia.

#### `moderateRating`

- **Input:** `{ ratingId: string, action: 'delete' }`
- **Guards:** identicos a `moderateComment`
- **Rate limit:** compartido (`moderate_${auth.uid}`)
- **Logica:**
  1. Validar input: `ratingId` string no vacio, `action === 'delete'`
  2. Leer doc. 404 si no existe
  3. Snapshot en `moderationLogs`
  4. Eliminar el doc. `onRatingWritten` trigger se activara para counters

#### `moderateCustomTag`

- **Input:** `{ customTagId: string, action: 'delete' }`
- **Guards y rate limit:** identicos
- **Logica:**
  1. Validar input: `customTagId` string no vacio, `action === 'delete'`
  2. Leer doc. 404 si no existe
  3. Snapshot en `moderationLogs`
  4. Eliminar el doc. `onCustomTagDeleted` trigger se activara para counters

#### Helper compartido: `writeModerationLog`

Funcion interna para escribir a `moderationLogs`:

```typescript
async function writeModerationLog(
  db: Firestore,
  params: {
    adminId: string;
    action: ModerationAction;
    targetCollection: ModerationTargetCollection;
    targetDocId: string;
    targetUserId: string;
    snapshot: Record<string, unknown>;
  }
): Promise<void>
```

---

## Componentes

### `ModerationActions.tsx` (nuevo)

**Ruta:** `src/components/admin/ModerationActions.tsx`

**Props:**

```typescript
interface ModerationActionsProps {
  itemId: string;
  targetCollection: 'comments' | 'ratings' | 'customTags';
  /** Solo para comments -- permite accion "hide" */
  allowHide?: boolean | undefined;
  /** Si true, botones con color error (para flagged) */
  emphasized?: boolean | undefined;
  onDeleted: (id: string) => void;
  onHidden?: ((id: string) => void) | undefined;
}
```

**Comportamiento:**
- Renderiza 1-2 IconButtons: DeleteOutline (siempre), VisibilityOff (solo si `allowHide`)
- Click en boton abre dialog de confirmacion (`role="alertdialog"`)
- Dialog tiene boton "Cancelar" y "Confirmar" con loading state (disabled mientras opera)
- Tras confirmar, llama al service layer y ejecuta callback `onDeleted` / `onHidden`
- Toast de exito/error via `useToast()`
- Estimacion: ~80 lineas

### `ModerationLogTable.tsx` (nuevo)

**Ruta:** `src/components/admin/ModerationLogTable.tsx`

**Props:**

```typescript
interface ModerationLogTableProps {
  logs: ModerationLog[];
}
```

**Comportamiento:**
- Reutiliza `ActivityTable` existente con columns: Fecha, Admin, Accion, Tipo, Usuario, Contenido (snapshot truncado)
- Estimacion: ~40 lineas

### `ActivityFeed.tsx` (modificacion)

**Cambios:**
1. Agregar columna "Acciones" a las tablas de comentarios (tab 0), ratings (tab 1) y custom tags (tab 3, solo custom)
2. La columna renderiza `<ModerationActions>` con los callbacks apropiados
3. Agregar estado local `removedIds` (Set) para optimistic UI: al eliminar/ocultar, agregar el ID al set y filtrar la lista renderizada
4. Agregar tab nuevo "Moderacion" al final de las tabs (tab 7) que muestra `ModerationLogTable`
5. Agregar fetch de `moderationLogs` al `fetcher` del `useAsyncData`

**Estimacion post-cambio:** ~260 lineas (actualmente 190 + ~70 por callbacks, estado, tab nuevo). Bajo el limite de 400.

### Mutable prop audit

No aplica. `ActivityFeed` no recibe props -- obtiene datos via `useAsyncData`. Las acciones de moderacion mutan datos server-side y actualizan UI localmente via `removedIds` set (optimistic removal).

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Comentario eliminado" | toast en ModerationActions | - |
| "Comentario ocultado" | toast en ModerationActions | - |
| "Rating eliminado" | toast en ModerationActions | - |
| "Tag eliminado" | toast en ModerationActions | - |
| "No se pudo completar la accion" | toast error en ModerationActions | tilde en accion |
| "Eliminar contenido" | titulo del dialog | - |
| "Ocultar contenido" | titulo del dialog | - |
| "Esta accion no se puede deshacer. El contenido sera eliminado permanentemente." | body del dialog delete | tilde en accion y sera |
| "El contenido sera ocultado pero no eliminado." | body del dialog hide | tilde en sera |
| "Cancelar" | boton dialog | - |
| "Confirmar" | boton dialog | - |
| "Moderacion" | label del tab en ActivityFeed | tilde en Moderacion |

Todos estos textos van en `src/constants/messages/admin.ts` como extensiones de `MSG_ADMIN`.

---

## Hooks

No se crean hooks nuevos. La logica de moderacion es simple (callable + toast) y vive en el service layer. Los callbacks en `ActivityFeed` son inline handlers que llaman al servicio.

---

## Servicios

### `src/services/admin/moderation.ts` (nuevo)

```typescript
export async function moderateComment(commentId: string, action: 'delete' | 'hide'): Promise<void>;
export async function moderateRating(ratingId: string): Promise<void>;
export async function moderateCustomTag(customTagId: string): Promise<void>;
export async function fetchModerationLogs(count: number): Promise<ModerationLog[]>;
```

- Las 3 funciones de moderacion son wrappers de `httpsCallable` (patron existente en `content.ts` con `fetchStorageStats`)
- `fetchModerationLogs` es una query directa a Firestore (`moderationLogs`, orderBy timestamp desc, limit)
- Usa `moderationLogConverter` de `adminConverters.ts`

---

## Integracion

### Archivos existentes que necesitan modificacion

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/ActivityFeed.tsx` | Agregar columna acciones + tab moderacion + estado removedIds |
| `src/types/admin.ts` | Agregar tipos ModerationLog, ModerationAction, ModerationTargetCollection |
| `src/constants/admin.ts` | Agregar constantes de acciones de moderacion |
| `src/constants/messages/admin.ts` | Agregar mensajes de moderacion |
| `src/config/collections.ts` | Agregar `MODERATION_LOGS: 'moderationLogs'` |
| `src/config/adminConverters.ts` | Agregar `moderationLogConverter` |
| `src/services/admin/index.ts` | Re-exportar funciones de moderation.ts |
| `functions/src/index.ts` | Exportar las 3 callables |
| `firestore.rules` | Agregar regla para moderationLogs |

### Preventive checklist

- [x] **Service layer**: Los componentes no importan `firebase/functions` -- usan `src/services/admin/moderation.ts`
- [x] **Duplicated constants**: Acciones de moderacion centralizadas en `constants/admin.ts`
- [x] **Context-first data**: N/A -- datos de admin no estan en contexto
- [x] **Silent .catch**: Handlers usan try/catch con toast de error via `useToast()`
- [x] **Stale props**: N/A -- ActivityFeed no recibe props mutables

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/admin/moderation.test.ts` | assertAdmin gate, input validation, doc-not-found, delete comment (happy path), delete comment con replies (cascade), delete comment con likes (cascade), hide comment, delete rating, delete custom tag, audit log write, rate limit | Unit |
| `src/services/admin/__tests__/moderation.test.ts` | httpsCallable invocation para cada funcion, error propagation, fetchModerationLogs query | Unit |

### Casos a cubrir

**Cloud Functions (`moderation.test.ts`):**
- [ ] `moderateComment` -- unauthorized (no admin) rechazado
- [ ] `moderateComment` -- input invalido (missing commentId, invalid action)
- [ ] `moderateComment` -- doc no encontrado (404)
- [ ] `moderateComment` -- delete happy path (doc eliminado, audit log escrito)
- [ ] `moderateComment` -- delete con replies (cascade: replies y likes eliminados)
- [ ] `moderateComment` -- delete reply (decrementa replyCount del padre)
- [ ] `moderateComment` -- hide (campo hidden: true)
- [ ] `moderateRating` -- unauthorized rechazado
- [ ] `moderateRating` -- input invalido
- [ ] `moderateRating` -- delete happy path
- [ ] `moderateCustomTag` -- unauthorized rechazado
- [ ] `moderateCustomTag` -- input invalido
- [ ] `moderateCustomTag` -- delete happy path
- [ ] Rate limit exceeded (resource-exhausted)

**Service layer (`moderation.test.ts`):**
- [ ] `moderateComment` llama httpsCallable correctamente
- [ ] `moderateRating` llama httpsCallable correctamente
- [ ] `moderateCustomTag` llama httpsCallable correctamente
- [ ] `fetchModerationLogs` retorna logs ordenados
- [ ] Error propagation

### Mock strategy

**Cloud Functions:** Patron existente de `feedback.test.ts` -- mock `onCall` para capturar handlers, mock `getDb` retorna db fake, mock `assertAdmin`.

**Service layer:** Mock `firebase/functions` (`httpsCallable`) y `firebase/firestore` (query/getDocs).

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos (delete vs hide, con/sin replies, doc exists/not-found)
- Side effects verificados (audit log write, cascade deletes, counter decrements)

---

## Analytics

No se agregan eventos de analytics nuevos. Las acciones de moderacion son admin-only y quedan registradas en `moderationLogs` (audit trail propio).

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Activity data (comments, ratings, tags) | Firestore persistent cache (ya activo) | N/A | IndexedDB |
| Moderation logs | Firestore persistent cache | N/A | IndexedDB |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Moderar contenido (delete/hide) | No soportado offline | Boton deshabilitado si offline. Requiere confirmacion server-side |

### Fallback UI

El admin panel ya tiene manejo de error en `AdminPanelWrapper`. Si offline, los botones de moderacion se deshabilitan (check `useConnectivity().isOffline`).

---

## Decisiones tecnicas

1. **Admin SDK para writes, no rules de admin**: Las callables usan Admin SDK (server-side) que bypasea Firestore rules. Esto es correcto para moderacion: el admin no deberia tener rules client-side que permitan delete de contenido ajeno. Patron consistente con `approveMenuPhoto`, `rejectMenuPhoto`.

2. **Rate limit compartido entre las 3 callables**: Un solo rate limit key (`moderate_${uid}`) con 5/min cubre las 3 acciones. Razon: un admin legitimamente no necesita mas de 5 acciones de moderacion por minuto. Si necesitara bulk moderation, se haria un feature separado (out of scope).

3. **Cascade manual en callable vs depender de trigger**: La callable hace cascade de replies y commentLikes al eliminar un comentario, en vez de depender exclusivamente de `onCommentDeleted`. Razon: `onCommentDeleted` ya hace cascade de replies pero no de commentLikes. Agregar limpieza de likes al trigger seria scope creep y afectaria deletes normales de usuarios. La callable maneja el caso especifico de moderacion.

4. **`removedIds` set en vez de refetch**: Tras moderar, el item se remueve del UI via set local en vez de refetchear toda la data. Razon: evita latencia extra y es el patron existente en `AbuseAlerts` (`localUpdates` Map).

5. **Tab de moderacion dentro de ActivityFeed**: En vez de crear un tab nuevo en `AdminDashboard`, el historial de moderacion se agrega como sub-tab de ActivityFeed (tab 7). Razon: esta estrechamente relacionado con la actividad (el admin ve actividad y toma acciones; el log muestra las acciones tomadas). Evita agregar mas tabs al admin dashboard (ya tiene 16).

---

## Hardening de seguridad

### Firestore rules requeridas

```javascript
// En firestore.rules, dentro del match /databases/{database}/documents
match /moderationLogs/{docId} {
  allow read: if isAdmin();
  allow create, update, delete: if false;
}
```

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| moderationLogs (via callables) | 5/min por admin | `checkCallableRateLimit(db, 'moderate_${auth.uid}', 5, auth.uid)` en cada callable |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Llamadas masivas para borrar contenido | assertAdmin + AppCheck + rate limit 5/min | `functions/src/admin/moderation.ts` |
| Lectura de moderation logs por no-admin | `allow read: if isAdmin()` en rules | `firestore.rules` |
| Escritura directa a moderationLogs | `allow create/update/delete: if false` | `firestore.rules` |
| Input injection (IDs invalidos) | Validacion de tipo y no-vacio en callable | `functions/src/admin/moderation.ts` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de seguridad ni tech debt (`gh issue list` retorna listas vacias para ambos labels). El backlog esta limpio tras la 3ra ronda de auditoria. Este feature no toca archivos con deuda conocida.

---

## File size estimation

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Dentro de limite? |
|---------|----------------|------------------------------|-------------------|
| `functions/src/admin/moderation.ts` | (nuevo) | ~180 | Si (< 400) |
| `src/services/admin/moderation.ts` | (nuevo) | ~50 | Si |
| `src/components/admin/ModerationActions.tsx` | (nuevo) | ~80 | Si |
| `src/components/admin/ModerationLogTable.tsx` | (nuevo) | ~40 | Si |
| `src/components/admin/ActivityFeed.tsx` | 190 | ~260 | Si (< 400) |
| `functions/src/__tests__/admin/moderation.test.ts` | (nuevo) | ~250 | Si |
| `src/services/admin/__tests__/moderation.test.ts` | (nuevo) | ~80 | Si |
