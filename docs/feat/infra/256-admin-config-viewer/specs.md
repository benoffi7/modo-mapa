# Specs: Admin Config Collection Viewer/Editor

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No se crean colecciones nuevas. Se leen documentos existentes de la coleccion `config` y la subcolleccion `activityFeed/{userId}/items`.

### Tipos nuevos (`src/types/admin.ts`)

```typescript
/** Generic config document — key/value pairs with unknown structure */
export interface ConfigDocument {
  id: string; // doc ID: 'counters' | 'moderation' | 'appVersion' | 'perfCounters' | 'aggregates' | 'analyticsCache'
  data: Record<string, unknown>;
}

/** Typed moderation config */
export interface ModerationConfig {
  bannedWords: string[];
}

/** Activity feed diagnostic item (returned by callable) */
export interface ActivityFeedDiagItem {
  id: string;
  actorId: string;
  actorName: string;
  type: 'rating' | 'comment' | 'favorite';
  businessId: string;
  businessName: string;
  referenceId: string;
  createdAt: string; // ISO string (serialized from Firestore Timestamp)
  expiresAt: string; // ISO string
  isExpired: boolean;
}

export interface ActivityFeedDiagResponse {
  items: ActivityFeedDiagItem[];
  total: number;
}
```

## Firestore Rules

No se requieren cambios. Las reglas existentes cubren todos los accesos:

- `config/{document=**}`: `allow read: if isAdmin()` — ya permite lectura admin
- `config/appVersion`: `allow read: if true` — lectura publica (no afectado)
- `activityFeed/{userId}/items`: lectura via Admin SDK en callable (bypasea rules)
- Escrituras a `config/moderation`: via Admin SDK en callable (bypasea rules)

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `fetchConfigDocs()` | config | Admin user | `allow read: if isAdmin()` | No |
| `fetchConfigDoc('moderation')` | config | Admin user | `allow read: if isAdmin()` | No |
| `updateModerationConfig` callable | config/moderation | Admin SDK | Bypasses rules | No |
| `getActivityFeedDiag` callable | activityFeed/{userId}/items | Admin SDK | Bypasses rules | No |
| Audit log write | abuseLogs | Admin SDK | Bypasses rules | No |

### Field whitelist check

No hay campos nuevos escritos via Firestore client SDK. Todas las escrituras son via Admin SDK en Cloud Functions, que bypasea `hasOnly()`.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

### `updateModerationConfig` (callable, `functions/src/admin/moderationConfig.ts`)

- **Trigger:** `onCall` con `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`
- **Input:** `{ bannedWords: string[] }`
- **Validacion:**
  - `assertAdmin(request.auth)` — verifica custom claim admin
  - `bannedWords` debe ser un array
  - Cada elemento debe ser string, `length <= 50`
  - Array length `<= 500`
- **Logica:**
  1. Lee el doc actual `config/moderation` para obtener `bannedWords` previo (para audit log)
  2. Escribe `{ bannedWords }` a `config/moderation` con `set({ bannedWords }, { merge: true })`
  3. Loguea en `abuseLogs` con tipo `'config_edit'`, detail con valores antes/despues
- **Rate limit:** `checkCallableRateLimit(db, 'moderation_edit_' + auth.uid, 5, auth.uid)` — 5/dia

### `getActivityFeedDiag` (callable, `functions/src/admin/activityFeedDiag.ts`)

- **Trigger:** `onCall` con `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`
- **Input:** `{ userId: string, limit?: number }`
- **Validacion:**
  - `assertAdmin(request.auth)` — verifica custom claim admin
  - `userId` debe ser string no vacio
  - `limit` debe ser numero entre 1 y 50 (default 50)
- **Logica:**
  1. Lee `activityFeed/{userId}/items` ordenado por `createdAt desc`, limitado a `limit`
  2. Para cada item, calcula `isExpired` comparando `expiresAt` con `now`
  3. Serializa timestamps a ISO strings
  4. Retorna `{ items, total }` (total es el count de items retornados)

## Componentes

### ConfigPanel (`src/components/admin/ConfigPanel.tsx`)

- **Props:** ninguna (tab-level component)
- **Patron:** `useAsyncData` + `AdminPanelWrapper`
- **Comportamiento:**
  - Fetches todos los docs de `config` collection via `fetchConfigDocs()`
  - Renderiza cada doc como un `Accordion` (MUI) con titulo = doc ID
  - Cada accordion muestra campos en formato key-value con `Typography`
  - Seccion especial para `moderation`: incluye `ModerationEditor`
  - Seccion `ActivityFeedDiag` al final (separada por Divider)
- **Estimacion:** ~120 lineas

### ModerationEditor (`src/components/admin/config/ModerationEditor.tsx`)

- **Props:**
  ```typescript
  interface ModerationEditorProps {
    bannedWords: string[];
    onSave: (words: string[]) => Promise<void>;
  }
  ```
- **Comportamiento:**
  - Muestra lista de banned words como `Chip`s con delete
  - TextField para agregar nueva palabra + boton "Agregar"
  - Validacion client-side: palabra no vacia, <= 50 chars, no duplicada
  - Boton "Guardar cambios" (disabled si no hay cambios)
  - Dialog de confirmacion antes de guardar: "Estas por modificar la lista de palabras baneadas. Confirmar?"
  - Loading state durante save, toast success/error
- **Estimacion:** ~150 lineas

### ActivityFeedDiag (`src/components/admin/config/ActivityFeedDiag.tsx`)

- **Props:** ninguna (self-contained section)
- **Comportamiento:**
  - TextField para userId + boton "Buscar"
  - Llama a `fetchActivityFeedDiag(userId)` via `httpsCallable`
  - Resultados en `Table` con columnas: Tipo, Actor, Negocio, Fecha, Estado
  - Chip de color por tipo: rating=`info`, comment=`success`, favorite=`secondary`
  - Estado: "Activo" (Chip success) / "Expirado" (Chip error)
  - Estados: vacio (sin busqueda), loading, error, sin resultados, con resultados
- **Estimacion:** ~160 lineas

### ConfigDocViewer (`src/components/admin/config/ConfigDocViewer.tsx`)

- **Props:**
  ```typescript
  interface ConfigDocViewerProps {
    docId: string;
    data: Record<string, unknown>;
  }
  ```
- **Comportamiento:**
  - Renderiza campos del doc en formato key-value
  - Arrays se muestran como lista con bullets
  - Objetos anidados se muestran indentados
  - Timestamps se formatean con `formatDateMedium`
  - Numeros se formatean con `toLocaleString`
- **Estimacion:** ~80 lineas

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| ModerationEditor | bannedWords: string[] | bannedWords (add/remove) | YES — local copy of array | onSave(updatedWords) |
| ActivityFeedDiag | (none) | N/A | N/A — self-contained | N/A |
| ConfigDocViewer | data: Record | none (read-only) | NO | N/A |

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Configuracion" | Tab label en AdminLayout | tilde en o |
| "Palabras baneadas" | Titulo seccion ModerationEditor | |
| "Agregar palabra" | Placeholder TextField ModerationEditor | |
| "Guardar cambios" | Boton ModerationEditor | |
| "Confirmar cambios de moderacion" | Titulo Dialog confirmacion | tilde en o |
| "Estas por modificar la lista de palabras baneadas. Esta accion afecta la moderacion de contenido." | Body Dialog confirmacion | tilde en a (Estas), tilde en o (accion, moderacion) |
| "Cambios guardados" | Toast success | |
| "No se pudieron guardar los cambios" | Toast error | |
| "Diagnostico de Activity Feed" | Titulo seccion ActivityFeedDiag | tilde en o |
| "ID de usuario" | Label TextField ActivityFeedDiag | |
| "Buscar" | Boton busqueda | |
| "Sin resultados para este usuario" | Empty state | |
| "Activo" | Chip estado item | |
| "Expirado" | Chip estado item | |

## Hooks

No se crean hooks nuevos. Se reutiliza `useAsyncData` existente para el fetching de config docs en `ConfigPanel`.

## Servicios

### `src/services/admin/config.ts` (nuevo)

```typescript
/** Fetch all known config documents */
export async function fetchConfigDocs(): Promise<ConfigDocument[]>
// Lee docs: counters, moderation, appVersion, perfCounters, aggregates, analyticsCache
// Usa getDoc para cada doc conocido. Si no existe, omite.

/** Fetch a single config document */
export async function fetchConfigDoc(docId: string): Promise<ConfigDocument | null>

/** Update moderation banned words via callable */
export async function updateModerationBannedWords(words: string[]): Promise<void>
// Usa httpsCallable(functions, 'updateModerationConfig')

/** Fetch activity feed diagnostic via callable */
export async function fetchActivityFeedDiag(userId: string): Promise<ActivityFeedDiagResponse>
// Usa httpsCallable(functions, 'getActivityFeedDiag')
```

### Barrel update (`src/services/admin/index.ts`)

Agregar exports de `config.ts`:

```typescript
export { fetchConfigDocs, fetchConfigDoc, updateModerationBannedWords, fetchActivityFeedDiag } from './config';
```

## Integracion

### AdminLayout.tsx

- Agregar import de `ConfigPanel` (tab 16, index)
- Agregar `<Tab label="Configuracion" />` como tab 17 (posicion final)
- Agregar `{tab === 16 && <ConfigPanel />}` al render

### functions/src/index.ts

- Agregar exports de nuevas callables:
  ```typescript
  export { updateModerationConfig } from './admin/moderationConfig';
  export { getActivityFeedDiag } from './admin/activityFeedDiag';
  ```

### Preventive checklist

- [x] **Service layer**: ConfigPanel usa `src/services/admin/config.ts`, no importa firebase directamente
- [x] **Duplicated constants**: Config doc IDs definidos como constante en service file
- [x] **Context-first data**: No aplica — config docs no estan en ningun context
- [x] **Silent .catch**: Handlers usan try/catch con toast de error
- [x] **Stale props**: ModerationEditor copia `bannedWords` a state local

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/admin/__tests__/config.test.ts` | fetchConfigDocs (all docs, missing docs), fetchConfigDoc, updateModerationBannedWords (callable invocation), fetchActivityFeedDiag (callable invocation) | Service |
| `functions/src/admin/__tests__/moderationConfig.test.ts` | assertAdmin, input validation (not array, strings too long, array too large, empty), rate limit, successful update, audit log write | Callable |
| `functions/src/admin/__tests__/activityFeedDiag.test.ts` | assertAdmin, input validation (missing userId, invalid limit), successful query, expired items calculation, empty feed | Callable |
| `src/components/admin/__tests__/ConfigPanel.test.tsx` | Render with data, loading state, error state, accordion expansion | Component |
| `src/components/admin/config/__tests__/ModerationEditor.test.tsx` | Add word, remove word, validation (empty, too long, duplicate), save confirmation dialog, save success/error | Component |
| `src/components/admin/config/__tests__/ActivityFeedDiag.test.tsx` | Search trigger, results rendering, type chips, expired state, empty/loading/error states | Component |

### Mock strategy

- Firestore: mock `getDoc`, `collection`, `doc` via `vi.mock('firebase/firestore')`
- Callables: mock `httpsCallable` via `vi.mock('firebase/functions')`
- Cloud Functions tests: mock `firebase-admin/firestore`, `assertAdmin`, `checkCallableRateLimit`
- Components: mock service functions, render with `@testing-library/react`

## Analytics

Nuevo archivo `src/constants/analyticsEvents/admin.ts`:

```typescript
// Admin config events
export const ADMIN_CONFIG_VIEWED = 'admin_config_viewed';
export const ADMIN_MODERATION_UPDATED = 'admin_moderation_updated';
export const ADMIN_ACTIVITY_FEED_DIAG = 'admin_activity_feed_diag';
```

Agregar `export * from './admin'` al barrel `src/constants/analyticsEvents/index.ts`.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Config docs | Firestore persistent cache (prod) | Session | IndexedDB (Firestore SDK) |
| Moderation update | No soportado offline | N/A | N/A |
| Activity feed diag | No soportado offline | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Update moderation bannedWords | Callable — requiere conexion | N/A — boton deshabilitado offline |

### Fallback UI

- ConfigPanel: `AdminPanelWrapper` muestra error state con retry si falla el fetch
- ModerationEditor: boton "Guardar" deshabilitado si `navigator.onLine === false`
- ActivityFeedDiag: boton "Buscar" deshabilitado si `navigator.onLine === false`, mensaje "Requiere conexion"

---

## Decisiones tecnicas

1. **Config docs como Record<string, unknown> generico:** Los documentos de config tienen estructuras heterogeneas (counters vs moderation vs appVersion). En lugar de tipar cada uno con una interface dedicada, se usa un tipo generico `ConfigDocument` con `data: Record<string, unknown>` y un viewer generico. Solo `moderation` tiene tipo dedicado porque es editable.

2. **Callables vs client SDK para writes:** Se usan callables para escribir a `config/moderation` y leer `activityFeed` porque: (a) las Firestore rules bloquean client writes a `config`, (b) `activityFeed` solo permite lectura al owner, y el admin necesita leer feeds de cualquier usuario.

3. **Audit log via abuseLogger existente:** Se extiende el tipo `AbuseLogEntry.type` para incluir `'config_edit'` en lugar de crear un sistema de audit log separado. Reutiliza infraestructura probada.

4. **Doc IDs como constante en servicio:** Los 6 doc IDs conocidos de la coleccion config (`counters`, `moderation`, etc.) se definen como array constante en el service file para iterar y fetchear. Si se agrega un doc nuevo en el futuro, solo hay que agregar al array.

---

## Hardening de seguridad

### Firestore rules requeridas

No se requieren cambios. Las rules existentes son suficientes:

```
match /config/appVersion {
  allow read: if true;
  allow write: if false;
}
match /config/{document=**} {
  allow read: if isAdmin();
  allow write: if false;
}
```

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| config/moderation (via callable) | 5/dia por admin | `checkCallableRateLimit(db, 'moderation_edit_' + auth.uid, 5, auth.uid)` |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Spam de actualizaciones a moderation | Rate limit 5/dia + assertAdmin + App Check | `functions/src/admin/moderationConfig.ts` |
| Scraping activity feed de otros usuarios | assertAdmin + App Check + max 50 items | `functions/src/admin/activityFeedDiag.ts` |
| Injection de bannedWords malformadas | Validacion: array de strings, cada string <= 50 chars, max 500 items | `functions/src/admin/moderationConfig.ts` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de seguridad o tech debt que afecten directamente a este feature.

El tipo `AbuseLogEntry.type` en `functions/src/utils/abuseLogger.ts` se extiende con `'config_edit'` como parte de este feature, agregando trazabilidad para cambios de configuracion que hoy no existe.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| (ninguno aplicable) | N/A | N/A |
