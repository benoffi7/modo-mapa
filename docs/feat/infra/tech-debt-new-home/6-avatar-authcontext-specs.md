# Specs: Move avatar to AuthContext

**PRD:** [6-avatar-authcontext.md](6-avatar-authcontext.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

### Cambios en `users` collection

El campo `avatarId` ya se escribe en el doc de usuario desde `ProfileScreen.handleAvatarSelect`, pero no se lee en `AuthContext`. No hay cambio en el schema de Firestore, solo en donde se lee/escribe desde el frontend.

```typescript
// src/types/index.ts — modificar interfaz existente
export interface UserProfile {
  displayName: string;
  avatarId?: string | undefined;  // NUEVO — id del avatar seleccionado
  createdAt: Date;
}
```

No se necesitan indices nuevos.

## Firestore Rules

No se necesitan cambios. La regla de `users/{userId}` actual no tiene `keys().hasOnly()` en create ni update, por lo que agregar `avatarId` al documento no requiere modificacion de reglas.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `getDoc(users/{uid})` en AuthContext (login) | users | Owner reading own doc | `allow read: if request.auth != null` | No |
| `updateDoc(users/{uid}, { avatarId })` en AuthContext | users | Owner updating own doc | `allow update: if auth.uid == userId && displayName valid` | No -- rule only validates displayName, no hasOnly |
| `setDoc(users/{uid}, { ..., avatarId })` en AuthContext (new doc) | users | Owner creating own doc | `allow create: if auth.uid == userId && displayName valid && createdAt == request.time` | No -- rule only validates displayName + createdAt, no hasOnly |

## Cloud Functions

No se necesitan Cloud Functions nuevas ni modificaciones.

## Componentes

### ProfileScreen (modificar)

**Archivo:** `src/components/profile/ProfileScreen.tsx`

Cambios:
- Eliminar el `useEffect` que hace `getDoc(users/{uid})` para leer `avatarId` (lineas 66-72)
- Eliminar el estado local `selectedAvatarId` -- consumir `avatarId` del context via `useAuth()`
- Eliminar `handleAvatarSelect` que hace `updateDoc` directo -- usar `setAvatarId` del context
- Eliminar imports de `doc`, `updateDoc`, `getDoc` de `firebase/firestore` y `db`, `COLLECTIONS`
- La prop `onSelect` del `AvatarPicker` pasa a llamar `setAvatarId(a.id)` del context

**Resultado:** ProfileScreen deja de tener cualquier interaccion directa con Firestore.

## Hooks

No se crean hooks nuevos.

## Servicios

No se crean servicios nuevos. La logica de persistencia de `avatarId` queda dentro de `AuthContext` (patron existente -- `setDisplayName` ya hace `updateDoc` directamente en el context).

## Integracion

### AuthContext (modificar)

**Archivo:** `src/context/AuthContext.tsx`

1. **Estado nuevo:** `avatarId: string | null` (inicializado en `null`)
2. **Lectura en login:** En el `onAuthStateChanged` callback (linea ~92-95), al leer el user doc que ya existe para `displayName`, extraer tambien `avatarId`:

   ```typescript
   if (userDoc.exists()) {
     const data = userDoc.data();
     setDisplayNameState(data.displayName || null);
     setAvatarIdState(data.avatarId ?? null);  // NUEVO
   }
   ```

3. **Setter `setAvatarId`:** Nuevo `useCallback` que:
   - Valida que `user` exista
   - Valida que `avatarId` sea un ID valido de `AVATAR_OPTIONS` (usando `getAvatarById`)
   - Hace optimistic update del state local
   - Hace `updateDoc(userRef, { avatarId })` con catch que revierte
4. **Interfaz `AuthContextType`:** Agregar `avatarId: string | null` y `setAvatarId: (id: string) => Promise<void>`
5. **Valor del context (useMemo):** Agregar `avatarId` y `setAvatarId` al objeto y al array de deps
6. **Default del context:** Agregar `avatarId: null` y `setAvatarId: async () => {}`

### userProfileConverter (modificar)

**Archivo:** `src/config/converters.ts`

El converter actual solo serializa/deserializa `displayName` y `createdAt`. Se debe agregar `avatarId`:

```typescript
export const userProfileConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(profile: UserProfile) {
    return { displayName: profile.displayName, avatarId: profile.avatarId, createdAt: profile.createdAt };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserProfile {
    const d = snapshot.data(options);
    return { displayName: d.displayName, avatarId: d.avatarId, createdAt: toDate(d.createdAt) };
  },
};
```

## Tests

### Archivos a testear

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/context/AuthContext.test.tsx` | Carga de avatarId en login, setAvatarId happy path, validacion de ID invalido, revert on error | Unit (hook) |
| `src/config/converters.test.ts` | userProfileConverter con avatarId presente y ausente | Unit |

### Casos a cubrir -- AuthContext.test.tsx (tests nuevos)

- [ ] `avatarId` se carga del user doc cuando existe
- [ ] `avatarId` es null cuando user doc no tiene avatarId
- [ ] `avatarId` es null cuando user doc no existe
- [ ] `setAvatarId` actualiza state local inmediatamente (optimistic)
- [ ] `setAvatarId` llama `updateDoc` con `{ avatarId }`
- [ ] `setAvatarId` revierte state si `updateDoc` falla
- [ ] `setAvatarId` rechaza ID invalido (no llama updateDoc)
- [ ] `setAvatarId` no hace nada si user es null

### Casos a cubrir -- converters.test.ts (modificar test existente)

- [ ] `userProfileConverter.fromFirestore` incluye `avatarId` cuando esta presente
- [ ] `userProfileConverter.fromFirestore` tiene `avatarId: undefined` cuando no esta
- [ ] `userProfileConverter.toFirestore` incluye `avatarId`

### Mock strategy

- Firestore: reusar mocks existentes (`mockGetDoc`, `mockUpdateDoc`) del test de AuthContext
- `getAvatarById`: mockear `constants/avatars` para controlar validacion
- Analytics: mock existente de `trackEvent`

## Analytics

No se agregan eventos nuevos. La seleccion de avatar es una accion de personalizacion menor que no justifica tracking.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| avatarId | Cargado en AuthContext al login, persiste en memoria durante la sesion | Sesion completa | Memory (state de React) |

Firestore persistent cache (habilitado en prod) ya cachea el user doc, asi que lecturas subsecuentes del avatarId estaran disponibles offline via el SDK.

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| setAvatarId | `updateDoc` directo (Firestore SDK maneja offline queue internamente) | Last write wins (Firestore default) |

No se usa `withOfflineSupport` porque `updateDoc` de Firestore ya tiene offline queue nativo con persistent cache habilitado en produccion.

### Fallback UI

No se necesita fallback especifico. Si el avatar no se puede cargar, el componente ya tiene fallback a la inicial del nombre (`userName.charAt(0).toUpperCase()`).

---

## Decisiones tecnicas

1. **avatarId en AuthContext vs hook dedicado:** Se mantiene en AuthContext porque (a) el dato ya se lee del mismo user doc que displayName, (b) el patron es identico a `setDisplayName`, y (c) otros componentes futuros (UserProfileSheet, ActivityFeed actor avatar) podran consumirlo sin prop drilling.

2. **Validacion con getAvatarById:** Se valida el ID contra `AVATAR_OPTIONS` antes de escribir en Firestore para evitar IDs basura. Es una validacion client-side ligera (busqueda en array de 20 elementos).

3. **Optimistic update con revert:** Se actualiza el state local antes del `updateDoc` para UI instantanea. Si falla, se revierte al valor anterior. Esto sigue el patron establecido en `useFollow` y `FavoriteButton`.

4. **No se usa servicio dedicado:** La operacion es tan simple (un `updateDoc` con un campo) que no justifica un servicio en `src/services/`. El patron existente de `setDisplayName` en AuthContext hace lo mismo directamente.
