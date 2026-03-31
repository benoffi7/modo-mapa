# Specs: Extraer writes de AuthContext y Firebase imports de componentes

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No se crean colecciones ni campos nuevos. Es un refactor puro que mueve operaciones existentes a la capa de servicios.

### Tipos existentes referenciados

```typescript
// src/types/index.ts
export interface UserProfile {
  displayName: string;
  avatarId?: string | undefined;
  createdAt: Date;
}
```

No se modifican tipos.

## Firestore Rules

No se requieren cambios en rules. Las operaciones de escritura que se extraen ya estan cubiertas por las rules existentes de la coleccion `users`.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|------------|-------------|-------------------|----------------|
| `createUserProfile(uid, name)` | users | Owner (uid match) | `allow create: if auth.uid == userId && keys().hasOnly(...)` | No |
| `updateUserDisplayName(uid, name)` | users | Owner (uid match) | `allow update: if auth.uid == userId && affectedKeys().hasOnly(...)` | No |
| `updateUserAvatar(uid, id)` | users | Owner (uid match) | `allow update: if auth.uid == userId && affectedKeys().hasOnly(...)` | No |
| `fetchUserProfileDoc(uid)` (read en onAuthStateChanged) | users | Any authenticated | `allow read: if auth != null` | No |
| `reportMenuPhoto(photoId)` (callable) | N/A (callable) | Any authenticated | App Check + auth en callable | No |
| `getMenuPhotoUrl(path)` (Storage) | N/A (Storage) | Any authenticated | Storage rules: read auth | No |

### Field whitelist check

| Collection | Campo | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|-------|----------------------|--------------------------------------|-------------------|
| users | displayName | SI | SI | No |
| users | displayNameLower | SI | SI | No |
| users | avatarId | SI | SI | No |
| users | createdAt | SI | N/A (no en update) | No |

No hay campos nuevos. Todas las escrituras que se extraen usan exactamente los mismos campos que ya estan en las rules.

## Cloud Functions

No se requieren cambios en Cloud Functions. La callable `reportMenuPhoto` ya existe en `functions/src/callable/`.

## Componentes

### Componentes modificados

| Componente | Cambio | Detalle |
|-----------|--------|---------|
| `MenuPhotoViewer` | Eliminar import de `firebase/functions` | Reemplazar `httpsCallable(functions, 'reportMenuPhoto')` por `reportMenuPhoto(photoId)` del servicio |
| `MenuPhotoSection` | Eliminar import de `firebase/storage` | Reemplazar `ref(storage, path)` + `getDownloadURL(...)` por `getMenuPhotoUrl(path)` del servicio |

No se crean componentes nuevos.

### Mutable prop audit

N/A. No hay componentes nuevos que reciban datos como props y los modifiquen.

## Textos de usuario

N/A. No se agregan ni modifican textos visibles al usuario. Es un refactor interno.

## Hooks

No se crean ni modifican hooks.

## Servicios

### `src/services/userProfile.ts` (extender)

Se agregan 4 funciones al servicio existente:

| Funcion | Params | Return | Operacion Firestore |
|---------|--------|--------|-------------------|
| `fetchUserProfileDoc(uid: string)` | userId | `Promise<UserProfile \| null>` | `getDoc` con `userProfileConverter` |
| `createUserProfile(uid: string, displayName: string)` | userId, nombre | `Promise<void>` | `setDoc` con displayName, displayNameLower, createdAt |
| `updateUserDisplayName(uid: string, name: string)` | userId, nombre | `Promise<void>` | Check exists: `updateDoc` si existe, `setDoc` si no. Campos: displayName, displayNameLower |
| `updateUserAvatar(uid: string, avatarId: string)` | userId, avatarId | `Promise<void>` | `updateDoc` con avatarId |

Notas:
- `updateUserDisplayName` preserva la logica actual de AuthContext: si el doc no existe hace `setDoc` con `createdAt: serverTimestamp()`, si existe hace `updateDoc`.
- La validacion de `MAX_DISPLAY_NAME_LENGTH` y trim se mantiene en AuthContext (es logica de UI/estado, no de persistencia). El servicio recibe el nombre ya validado.
- La validacion de `getAvatarById(id)` se mantiene en AuthContext (depende de constantes de UI).

### `src/services/menuPhotos.ts` (extender)

Se agregan 2 funciones al servicio existente:

| Funcion | Params | Return | Operacion |
|---------|--------|--------|-----------|
| `reportMenuPhoto(photoId: string)` | photoId | `Promise<void>` | `httpsCallable(functions, 'reportMenuPhoto')({ photoId })` |
| `getMenuPhotoUrl(path: string)` | storagePath | `Promise<string>` | `ref(storage, path)` + `getDownloadURL(ref)` |

Notas:
- `reportMenuPhoto` necesita importar `functions` de `config/firebase` y `httpsCallable` de `firebase/functions`. Estos imports son validos en la capa de servicios.
- `getMenuPhotoUrl` necesita importar `storage` de `config/firebase` y `getDownloadURL` de `firebase/storage`. `menuPhotos.ts` ya importa `storage`.

## Integracion

### AuthContext.tsx

- Eliminar imports de `firebase/firestore`: `doc`, `getDoc`, `setDoc`, `updateDoc`, `serverTimestamp`
- Eliminar import de `db` desde `config/firebase` (mantener `auth`)
- Eliminar import de `COLLECTIONS` desde `config/collections`
- Eliminar import de `userProfileConverter` desde `config/converters`
- Agregar imports de `fetchUserProfileDoc`, `createUserProfile` (implicitamente via `updateUserDisplayName`), `updateUserDisplayName`, `updateUserAvatar` desde `services/userProfile`
- En `onAuthStateChanged`: reemplazar `getDoc(doc(db, ...))` por `fetchUserProfileDoc(uid)`
- En `setDisplayName`: reemplazar logica de `getDoc` + `updateDoc`/`setDoc` por `updateUserDisplayName(uid, trimmed)`
- En `setAvatarId`: reemplazar `updateDoc(doc(db, ...))` por `updateUserAvatar(uid, id)`

### MenuPhotoViewer.tsx

- Eliminar import de `httpsCallable` desde `firebase/functions`
- Eliminar import de `functions` desde `config/firebase`
- Agregar import de `reportMenuPhoto` desde `services/menuPhotos`
- En `handleReport`: reemplazar `httpsCallable(functions, 'reportMenuPhoto')({ photoId })` por `reportMenuPhoto(photoId)`

### MenuPhotoSection.tsx

- Eliminar import de `ref`, `getDownloadURL` desde `firebase/storage`
- Eliminar import de `storage` desde `config/firebase`
- Agregar import de `getMenuPhotoUrl` desde `services/menuPhotos`
- En useEffect de photo URL: reemplazar `getDownloadURL(ref(storage, path))` por `getMenuPhotoUrl(path)`

### Preventive checklist

- [x] **Service layer**: AuthContext, MenuPhotoViewer, MenuPhotoSection importan firebase SDK directamente. Este refactor lo resuelve.
- [x] **Duplicated constants**: No se duplican constantes. `MAX_DISPLAY_NAME_LENGTH` ya viene de `constants/validation`.
- [x] **Context-first data**: No aplica. Las nuevas funciones de servicio no duplican datos de contextos.
- [x] **Silent .catch**: Las funciones de servicio propagan errores. Los callsites existentes ya tienen manejo de errores.
- [x] **Stale props**: No aplica. No hay componentes nuevos con props mutables.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/__tests__/userProfile.test.ts` | `fetchUserProfileDoc`: doc existe/no existe; `updateUserDisplayName`: doc existe (updateDoc) / doc no existe (setDoc); `updateUserAvatar`: updateDoc call correcto | Unit |
| `src/services/__tests__/menuPhotos.test.ts` | `reportMenuPhoto`: invocacion correcta de httpsCallable, propagacion de errores; `getMenuPhotoUrl`: resolucion de URL, propagacion de errores | Unit |

### Casos a cubrir

**userProfile.ts (funciones nuevas):**

- `fetchUserProfileDoc` — doc existe, retorna UserProfile
- `fetchUserProfileDoc` — doc no existe, retorna null
- `updateUserDisplayName` — doc existe, llama updateDoc con displayName + displayNameLower
- `updateUserDisplayName` — doc no existe, llama setDoc con displayName + displayNameLower + createdAt
- `updateUserAvatar` — llama updateDoc con avatarId
- Error propagation en cada funcion

**menuPhotos.ts (funciones nuevas):**

- `reportMenuPhoto` — llama httpsCallable correctamente
- `reportMenuPhoto` — propaga errores
- `getMenuPhotoUrl` — retorna URL correcta
- `getMenuPhotoUrl` — propaga errores de Storage

### Mock strategy

```typescript
// userProfile.test.ts
vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('../../config/collections', () => ({ COLLECTIONS: { USERS: 'users' } }));
vi.mock('../../config/converters', () => ({ userProfileConverter: {} }));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

// menuPhotos.test.ts (funciones nuevas, agregar a test existente o crear)
vi.mock('../../config/firebase', () => ({ db: {}, storage: {}, functions: {} }));
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));
const mockGetDownloadURL = vi.fn();
const mockRef = vi.fn();
vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
  uploadBytesResumable: vi.fn(),
}));
```

## Analytics

No se agregan nuevos eventos de analytics. Los `trackEvent` existentes permanecen en AuthContext donde estan (son logica de contexto, no de servicio).

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| User profile doc | Firestore persistent cache | N/A (managed by Firestore) | IndexedDB |
| Menu photo URLs | Sin cache (URL directa de Storage) | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| createUserProfile | Firestore persistent cache (write-through) | Last write wins |
| updateUserDisplayName | Firestore persistent cache (write-through) | Last write wins |
| updateUserAvatar | Firestore persistent cache (write-through) | Last write wins |
| reportMenuPhoto | Sin soporte offline (callable HTTP) | N/A — toast de error |

### Fallback UI

Sin cambios. El comportamiento offline existente se preserva identico.

---

## Decisiones tecnicas

1. **Validacion se queda en AuthContext, no en servicios.** La validacion de `MAX_DISPLAY_NAME_LENGTH`, trim, y `getAvatarById` es logica de UI que depende de constantes de presentacion. Los servicios reciben datos ya validados, consistente con el patron de otros servicios como `ratings.ts` y `comments.ts` donde la validacion de inputs esta en hooks/componentes.

2. **`fetchUserProfileDoc` separada de `fetchUserProfile`.** La funcion existente `fetchUserProfile` hace 7 queries en paralelo para construir un perfil completo. AuthContext solo necesita leer displayName y avatarId del doc de usuario. Se crea `fetchUserProfileDoc` como funcion ligera de lectura unica.

3. **`updateUserDisplayName` absorbe la logica de create-or-update.** En vez de que AuthContext decida si hacer setDoc o updateDoc, el servicio encapsula esta logica internamente. El consumidor solo dice "actualiza el nombre" y el servicio se encarga.

4. **No se mueve `trackEvent` a servicios.** Los eventos de analytics son concerns de la capa de UI/contexto, no de la capa de datos. Otros servicios del proyecto no llaman `trackEvent` (excepto `uploadMenuPhoto` que es un caso especial con progreso de upload).

---

## Hardening de seguridad

### Firestore rules requeridas

No se requieren cambios. Las rules existentes para `users` ya cubren todas las operaciones:

```
match /users/{userId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && request.auth.uid == userId
    && request.resource.data.keys().hasOnly(['displayName', 'displayNameLower', 'avatarId', 'createdAt'])
    && request.resource.data.displayName is string
    && request.resource.data.displayName.size() > 0
    && request.resource.data.displayName.size() <= 30
    && request.resource.data.displayNameLower is string
    && (!('avatarId' in request.resource.data) || request.resource.data.avatarId is string)
    && request.resource.data.createdAt == request.time;
  allow update: if request.auth != null && request.auth.uid == userId
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'displayNameLower', 'avatarId'])
    && request.resource.data.displayName is string
    && request.resource.data.displayName.size() > 0
    && request.resource.data.displayName.size() <= 30
    && (!('displayNameLower' in request.resource.data) || request.resource.data.displayNameLower is string)
    && (!('avatarId' in request.resource.data) || request.resource.data.avatarId is string);
}
```

### Rate limiting

N/A. No se crean colecciones nuevas escribibles.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| N/A | Refactor puro sin nuevas superficies de ataque | N/A |

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #243 service layer violations | Se eliminan las 3 violaciones restantes del service layer | Fases 1-2 |
| `userProfile.ts` sin tests (marcado como pending en tests.md) | Se crean tests para las funciones nuevas | Fase 1, paso 3 |
| `menuPhotos.ts` sin tests (marcado como pending en tests.md) | Se crean tests para las funciones nuevas | Fase 2, paso 3 |

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Excede 400? |
|---------|----------------|------------------------------|-------------|
| `src/services/userProfile.ts` | 121 | ~175 (+54 por 4 funciones nuevas) | No |
| `src/services/menuPhotos.ts` | 126 | ~150 (+24 por 2 funciones nuevas) | No |
| `src/context/AuthContext.tsx` | 260 | ~240 (-20 por eliminacion de imports y logica inline) | No |
| `src/components/business/MenuPhotoViewer.tsx` | 77 | ~72 (-5 por simplificacion de imports) | No |
| `src/components/business/MenuPhotoSection.tsx` | 156 | ~150 (-6 por simplificacion de imports) | No |
| `src/services/__tests__/userProfile.test.ts` | 0 (nuevo) | ~120 | No |
| `src/services/__tests__/menuPhotos.test.ts` | 0 (nuevo) | ~80 | No |
