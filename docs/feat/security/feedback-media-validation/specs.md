# Specs: Feedback Media URL Validation

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No se agregan colecciones ni documentos nuevos. Se modifica el tipo existente `Feedback` en `src/types/index.ts`:

```typescript
// Antes
mediaType?: 'image' | 'video' | 'pdf';

// Despues
mediaType?: 'image' | 'pdf';
```

Se elimina `'video'` que no se usa ni se soporta en Storage rules ni en el servicio `sendFeedback`.

---

## Firestore Rules

Modificar la regla de `feedback` para validar `mediaUrl` y `mediaType` tanto en create como en update.

### Create rule

Agregar validacion condicional: si `mediaUrl` esta presente en los datos, debe ser un string que empiece con `https://firebasestorage.googleapis.com/`. Si `mediaType` esta presente, debe ser `'image'` o `'pdf'`.

Nota: en el flujo actual, `sendFeedback` primero crea el doc sin `mediaUrl`/`mediaType`, y luego hace un `updateDoc` para agregarlos. Por lo tanto la validacion en create es preventiva (defense in depth) ya que el flujo normal no envia estos campos en create. Pero la regla de create los permite en `hasOnly`, asi que debemos validar por si alguien los envia directamente.

```javascript
// Dentro de match /feedback/{docId} — create rule
// Agregar al final de la cadena de validaciones:
&& (!('mediaUrl' in request.resource.data) || (request.resource.data.mediaUrl is string && request.resource.data.mediaUrl.matches('^https://firebasestorage\\.googleapis\\.com/.*')))
&& (!('mediaType' in request.resource.data) || request.resource.data.mediaType in ['image', 'pdf'])
```

### Update rule (owner mediaUrl/mediaType)

Agregar validacion al bloque que permite al owner actualizar `mediaUrl` y `mediaType`:

```javascript
// Reemplazar el bloque actual:
|| (request.auth != null
  && resource.data.userId == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['mediaUrl', 'mediaType']))

// Con:
|| (request.auth != null
  && resource.data.userId == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['mediaUrl', 'mediaType'])
  && request.resource.data.mediaUrl is string
  && request.resource.data.mediaUrl.matches('^https://firebasestorage\\.googleapis\\.com/.*')
  && request.resource.data.mediaType in ['image', 'pdf'])
```

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `sendFeedback` — addDoc (create) | feedback | Owner | `allow create: if auth != null && userId == auth.uid ...` | YES — agregar validacion de mediaUrl/mediaType |
| `sendFeedback` — updateDoc (mediaUrl+mediaType) | feedback | Owner | `allow update: ... affectedKeys().hasOnly(['mediaUrl', 'mediaType'])` | YES — agregar validacion de formato |
| `markFeedbackViewed` — updateDoc (viewedByUser) | feedback | Owner | `allow update: ... affectedKeys().hasOnly(['viewedByUser'])` | No |
| `fetchUserFeedback` — getDocs | feedback | Owner | `allow read: if userId == auth.uid` | No |
| `respondToFeedback` (callable) | feedback | Admin (Cloud Function) | Admin SDK bypasses rules | No |
| `fetchRecentFeedback` (admin) | feedback | Admin | `allow read: ... isAdmin()` | No |

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| feedback | mediaUrl (existing) | YES | YES | NO — fields already in whitelist; adding format validation only |
| feedback | mediaType (existing) | YES | YES | NO — fields already in whitelist; adding value validation only |

---

## Cloud Functions

No se necesitan cambios en Cloud Functions. La validacion es a nivel de Firestore rules (server-side) y frontend (client-side).

---

## Componentes

### Modificaciones en componentes existentes

#### `src/components/admin/FeedbackList.tsx`

Agregar guard con `isValidStorageUrl` antes de renderizar `mediaUrl` como `<img src>` o `<Link href>`. Si la URL no es valida, renderizar texto "Adjunto no disponible" en su lugar.

Cambio en la seccion de renderizado de media (lineas ~159-172):

```tsx
// Antes: renderiza f.mediaUrl directamente
// Despues: wrappea con isValidStorageUrl(f.mediaUrl)
{f.mediaUrl && isValidStorageUrl(f.mediaUrl) && f.mediaType === 'pdf' ? (
  <Link href={f.mediaUrl} ...>
  ...
) : f.mediaUrl && isValidStorageUrl(f.mediaUrl) ? (
  <Box component="img" src={f.mediaUrl} .../>
) : f.mediaUrl ? (
  <Typography variant="caption" color="text.disabled">Adjunto no disponible</Typography>
) : null}
```

Tambien aplicar en el Dialog de media fullscreen (si `mediaOpen` tiene una URL invalida, no abrir).

#### `src/components/menu/MyFeedbackList.tsx`

Mismo patron de guard que `FeedbackList.tsx`. Lineas ~116-128:

```tsx
{fb.mediaUrl && isValidStorageUrl(fb.mediaUrl) && fb.mediaType === 'pdf' ? (
  <Link href={fb.mediaUrl} ...>
  ...
) : fb.mediaUrl && isValidStorageUrl(fb.mediaUrl) ? (
  <Box component="img" src={fb.mediaUrl} .../>
) : fb.mediaUrl ? (
  <Typography variant="caption" color="text.disabled">Adjunto no disponible</Typography>
) : null}
```

### Mutable prop audit

No aplica. Los componentes modificados solo leen `mediaUrl` — no la editan.

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Adjunto no disponible" | FeedbackList.tsx, MyFeedbackList.tsx | Fallback cuando mediaUrl no pasa validacion |

---

## Hooks

No se crean ni modifican hooks.

---

## Servicios

No se modifican servicios. El servicio `sendFeedback` ya genera URLs validas de Firebase Storage via `getDownloadURL`. La validacion es defensiva contra escrituras directas a Firestore.

---

## Integracion

### Archivo nuevo: `src/utils/media.ts`

Funcion utilitaria pura sin dependencias de framework:

```typescript
const STORAGE_URL_PREFIX = 'https://firebasestorage.googleapis.com/';

export function isValidStorageUrl(url: string | undefined | null): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  return url.startsWith(STORAGE_URL_PREFIX);
}
```

Importada en `FeedbackList.tsx` y `MyFeedbackList.tsx`.

### Archivo nuevo: `src/utils/media.test.ts`

Tests para la funcion utilitaria.

### Modificacion: `src/types/index.ts`

Cambiar `mediaType` en la interfaz `Feedback` de `'image' | 'video' | 'pdf'` a `'image' | 'pdf'`.

### Modificacion: `src/config/converters.ts`

Actualizar el cast de `mediaType` en `feedbackConverter.fromFirestore` de `'image' | 'video' | 'pdf'` a `'image' | 'pdf'`.

### Modificacion: `src/constants/messages/feedback.ts`

Agregar el texto del fallback:

```typescript
mediaNotAvailable: 'Adjunto no disponible',
```

### Preventive checklist

- [x] **Service layer**: Los componentes no importan `firebase/firestore` para writes. `sendFeedback` ya esta en `src/services/feedback.ts`.
- [x] **Duplicated constants**: La constante `STORAGE_URL_PREFIX` se define una sola vez en `src/utils/media.ts`. Si en el futuro otros modulos la necesitan, se puede extraer a `src/constants/`.
- [x] **Context-first data**: No aplica — feedback data no esta en ningun context.
- [x] **Silent .catch**: No se agregan .catch en este feature.
- [x] **Stale props**: No aplica — componentes solo leen mediaUrl, no la mutan.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/utils/media.test.ts` (nuevo) | `isValidStorageUrl`: URLs validas de Firebase Storage, URLs externas rechazadas, `javascript:` URIs, `data:` URIs, strings vacias, `undefined`, `null`, URLs con prefijo parcial | Unit |
| `src/config/converters.test.ts` (modificar) | Verificar que el converter sigue manejando `mediaType: 'image'` y `mediaType: 'pdf'` correctamente, y que no acepta `'video'` como tipo valido (si hay test existente, actualizarlo) | Unit |

### Casos a cubrir (`media.test.ts`)

- URL valida de Firebase Storage con token → `true`
- URL de otro dominio (e.g. `https://evil.com/img.png`) → `false`
- `javascript:alert(1)` → `false`
- `data:text/html,...` → `false`
- String vacia → `false`
- `undefined` → `false`
- `null` → `false`
- URL que contiene el prefijo pero como substring (e.g. `https://evil.com/https://firebasestorage.googleapis.com/...`) → `false` (startsWith previene esto)

### Mock strategy

- `isValidStorageUrl` es una funcion pura sin dependencias — no necesita mocks.
- Tests de converters: mock pattern existente en `converters.test.ts`.

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs maliciosos listados en el PRD

---

## Analytics

No se agregan eventos de analytics nuevos. El evento `feedback_submit` existente no cambia.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Feedback con mediaUrl | Firestore persistent cache (sin cambios) | Indefinido (Firestore cache) | IndexedDB (Firestore) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Create feedback con media | Upload requiere conexion (sin cambio) | N/A — falla sin red |
| Update mediaUrl/mediaType | Firestore offline queue (sin cambio) | Last-write-wins |

### Fallback UI

No se necesitan cambios de UI para offline. La validacion de `isValidStorageUrl` funciona client-side sobre datos ya cacheados. Si la URL es invalida (caso edge de dato corrupto en cache), se muestra "Adjunto no disponible".

---

## Decisiones tecnicas

1. **Validacion con `startsWith` en vez de regex completo en frontend**: La funcion `isValidStorageUrl` usa `startsWith('https://firebasestorage.googleapis.com/')` en vez de un regex que valide todo el formato de URL. Razon: el patron de URL de Firebase Storage puede cambiar en el path/token, y validar el dominio es suficiente para prevenir los ataques descritos (javascript:, data:, URLs externas). En Firestore rules se usa `matches()` con regex por ser la unica opcion disponible.

2. **No migrar datos existentes**: Si algun documento de feedback tiene un `mediaUrl` invalido (improbable pero posible), el frontend simplemente mostrara "Adjunto no disponible". No se ejecuta una migracion retroactiva.

3. **Eliminar `'video'` de mediaType**: El tipo `'video'` nunca se uso — no hay UI para subir ni reproducir video, Storage rules solo permiten imagenes en `feedback-media/`, y el servicio `sendFeedback` solo genera `'image'` o `'pdf'`. Eliminarlo reduce superficie de ataque y simplifica el tipo.

4. **Texto de fallback centralizado en messages**: Se agrega `MSG_FEEDBACK.mediaNotAvailable` en vez de hardcodear el string en los dos componentes, siguiendo el patron de copywriting centralizado.
