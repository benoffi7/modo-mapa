# Specs: users collection hasOnly() field injection fix

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No hay cambios en el modelo de datos. La coleccion `users` mantiene la misma estructura. Los campos existentes son:

```typescript
// Campos escritos por el cliente (AuthContext)
interface UserDoc_ClientWritable {
  displayName: string;        // 1-30 chars, ya validado
  displayNameLower: string;   // lowercase de displayName, para busqueda
  avatarId: string;           // avatar seleccionado por el usuario
  createdAt: Timestamp;       // solo en create, validado como request.time
}

// Campos escritos por Cloud Functions (Admin SDK, bypasean rules)
interface UserDoc_ServerOnly {
  followersCount: number;     // gestionado por onFollowCreated/onFollowDeleted
  followingCount: number;     // gestionado por onFollowCreated/onFollowDeleted
  displayNameLower: string;   // tambien inicializado por onUserCreated trigger
}
```

No se agregan campos nuevos. No se necesitan indices nuevos.

## Firestore Rules

### Regla actual (vulnerable)

```javascript
match /users/{userId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && request.auth.uid == userId
    && request.resource.data.displayName is string
    && request.resource.data.displayName.size() > 0
    && request.resource.data.displayName.size() <= 30
    && request.resource.data.createdAt == request.time;
  allow update: if request.auth != null && request.auth.uid == userId
    && request.resource.data.displayName is string
    && request.resource.data.displayName.size() > 0
    && request.resource.data.displayName.size() <= 30;
}
```

### Regla corregida

```javascript
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

Cambios clave:

1. **Create**: se agrega `keys().hasOnly([...])` con los 4 campos que el cliente puede escribir
2. **Create**: se agrega validacion de tipo para `displayNameLower` (string obligatorio) y `avatarId` (string opcional)
3. **Update**: se agrega `affectedKeys().hasOnly([...])` con los 3 campos que el cliente puede modificar
4. **Update**: se agrega validacion de tipo para `displayNameLower` y `avatarId` (ambos opcionales en update porque un update puede cambiar solo uno de ellos)

Nota sobre `avatarId` en create: el flujo actual de `AuthContext.setDisplayName` NO incluye `avatarId` en el `setDoc` de create. Sin embargo, lo incluimos en la whitelist de create por si el flujo cambia en el futuro y se quiere crear el doc con avatar incluido. Si se prefiere ser mas estricto, se puede remover de la whitelist de create.

### Rules impact analysis

| Query (service/hook) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `AuthContext.setDisplayName` (create) | users | Owner (`auth.uid == userId`) | `allow create` con `keys().hasOnly` | NO -- campos escritos (`displayName`, `displayNameLower`, `createdAt`) estan en la whitelist |
| `AuthContext.setDisplayName` (update) | users | Owner | `allow update` con `affectedKeys().hasOnly` | NO -- campos modificados (`displayName`, `displayNameLower`) estan en la whitelist |
| `AuthContext.setAvatarId` (update) | users | Owner | `allow update` con `affectedKeys().hasOnly` | NO -- campo modificado (`avatarId`) esta en la whitelist |
| `useUserSearch` (read) | users | Any authenticated | `allow read: if request.auth != null` | NO |
| `onUserCreated` (CF trigger, set) | users | Admin SDK | Bypasea rules | NO |
| `onFollowCreated` (CF trigger, update/set) | users | Admin SDK | Bypasea rules | NO |
| `onFollowDeleted` (CF trigger, update) | users | Admin SDK | Bypasea rules | NO |
| `deleteUserData` (CF, update) | users | Admin SDK | Bypasea rules | NO |

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| users | displayName | YES (ya validado) | YES (nuevo en whitelist) | YES -- agregar a `affectedKeys().hasOnly()` |
| users | displayNameLower | YES (nuevo en whitelist) | YES (nuevo en whitelist) | YES -- agregar a ambos |
| users | avatarId | YES (nuevo en whitelist) | YES (nuevo en whitelist) | YES -- agregar a ambos |
| users | createdAt | YES (ya validado) | NO (no debe ser modificable) | NO |
| users | followersCount | NO (server-only) | NO (server-only) | NO -- Admin SDK bypasea rules |
| users | followingCount | NO (server-only) | NO (server-only) | NO -- Admin SDK bypasea rules |

## Cloud Functions

No se requieren cambios en Cloud Functions. Los triggers existentes (`onUserCreated`, `onFollowCreated`, `onFollowDeleted`) usan Admin SDK que bypasea Firestore rules.

## Componentes

No se requieren cambios en componentes React. Este fix es exclusivamente en `firestore.rules`.

### Mutable prop audit

N/A -- no hay componentes afectados.

## Textos de usuario

N/A -- este cambio no agrega textos visibles al usuario.

## Hooks

No se requieren cambios en hooks.

## Servicios

No se requieren cambios en servicios. Los writes existentes en `AuthContext` ya usan exactamente los campos de la whitelist.

## Integracion

Este cambio no modifica integraciones existentes. Las operaciones de `AuthContext.setDisplayName` y `AuthContext.setAvatarId` siguen funcionando sin cambios porque escriben exactamente los campos permitidos.

### Preventive checklist

- [x] **Service layer**: No hay componentes que importen `firebase/firestore` para writes a `users` -- todo va via `AuthContext`
- [x] **Duplicated constants**: N/A
- [x] **Context-first data**: N/A
- [x] **Silent .catch**: N/A
- [x] **Stale props**: N/A

## Tests

El proyecto no tiene `@firebase/rules-unit-testing` instalado ni tests existentes para Firestore rules. Se recomienda validar manualmente en emuladores con los escenarios documentados abajo. Si se decide agregar tests automatizados en el futuro, estos son los escenarios a cubrir.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A (validacion manual en emuladores) | Create con campos validos pasa | Manual |
| N/A | Create con campo extra (`isAdmin: true`) falla | Manual |
| N/A | Create con campo extra (`followersCount: 999`) falla | Manual |
| N/A | Update con `displayName` + `displayNameLower` pasa | Manual |
| N/A | Update con `avatarId` pasa | Manual |
| N/A | Update con `followersCount` falla | Manual |
| N/A | Update con campo inventado (`isAdmin`) falla | Manual |
| N/A | Cloud Functions (Admin SDK) siguen escribiendo `followersCount`/`followingCount` sin error | Manual |

### Escenarios de validacion manual

Ejecutar con emuladores (`npm run dev:full`):

1. **Create OK**: Crear cuenta nueva, ingresar displayName -- doc se crea correctamente
2. **Update displayName OK**: Editar displayName desde perfil -- update funciona
3. **Update avatarId OK**: Cambiar avatar desde perfil -- update funciona
4. **Create con campo extra**: Desde la consola del emulador de Firestore o un script, intentar `setDoc` con `isAdmin: true` como campo adicional -- debe fallar
5. **Update con campo extra**: Intentar `updateDoc` con `followersCount: 999` -- debe fallar
6. **Cloud Functions**: Seguir a otro usuario -- verificar que `followersCount`/`followingCount` se actualizan correctamente (Admin SDK bypasea rules)

## Analytics

No se requieren cambios en analytics.

---

## Offline

Este cambio no afecta el comportamiento offline. Las rules se evaluan server-side cuando el write se sincroniza.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| User doc | Firestore persistent cache (existente) | N/A | IndexedDB |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Create user doc | Firestore SDK enqueue | Si campos invalidos, falla al sync (correcto) |
| Update displayName | Firestore SDK enqueue | Si campos invalidos, falla al sync (correcto) |
| Update avatarId | Firestore SDK enqueue + optimistic UI con rollback | Si falla al sync, rollback en AuthContext |

### Fallback UI

No se requieren cambios en offline UI.

---

## Decisiones tecnicas

1. **`avatarId` incluido en whitelist de create**: Aunque el flujo actual no lo incluye en `setDoc`, se agrega a la whitelist preventivamente. Si el flujo cambia para crear el doc con avatar, no sera necesario modificar las rules de nuevo. El campo es opcional (validado con `!('avatarId' in ...) || ...`).

2. **`displayNameLower` validado como obligatorio en create, opcional en update**: En create, `displayNameLower` siempre se incluye junto con `displayName` (ver `AuthContext.setDisplayName` linea 132). En update, un update puede cambiar solo `avatarId` sin tocar `displayNameLower`, asi que se valida como opcional.

3. **No se instala `@firebase/rules-unit-testing`**: Agregar una dependencia nueva y un test suite completo para rules esta fuera del scope de este fix de seguridad. Se documenta como deuda tecnica pendiente. La validacion manual en emuladores cubre los escenarios criticos.

4. **`followersCount`/`followingCount` excluidos de ambas whitelists**: Estos campos solo los escriben Cloud Functions via Admin SDK. Excluirlos de la whitelist del cliente es exactamente la proteccion que este fix provee -- un cliente malicioso no puede manipular contadores de seguidores.
