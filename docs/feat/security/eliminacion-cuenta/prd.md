# PRD: Eliminacion de cuenta de usuario

**Feature:** eliminacion-cuenta
**Categoria:** security
**Fecha:** 2026-03-27
**Issue:** #192
**Prioridad:** Alta

---

## Contexto

Modo Mapa permite autenticacion anonima por defecto y opcionalmente email/password via `linkWithCredential`. Los usuarios anonimos ya cuentan con "Limpiar mis datos" en SettingsMenu (que ejecuta `signOut` y Firebase auto-crea nueva cuenta anonima). Sin embargo, los usuarios autenticados con email/password no tienen forma de eliminar permanentemente su cuenta y todos sus datos asociados, lo cual es un requisito legal (GDPR) y de las plataformas de distribucion (App Store, Play Store).

## Problema

- Los usuarios autenticados (email/password) no pueden eliminar su cuenta ni sus datos de forma permanente
- GDPR exige el derecho a eliminacion de datos personales ("right to erasure"), y la app no lo cumple actualmente
- Las politicas de App Store y Play Store requieren que las apps con creacion de cuenta ofrezcan eliminacion de cuenta como condicion para publicacion

## Solucion

### S1: UI en SettingsPanel

Agregar un boton "Eliminar cuenta" en la seccion Cuenta del `SettingsPanel`, visible solo cuando `authMethod === 'email'`. El boton se ubica debajo de "Cambiar contrasena" y "Cerrar sesion", con estilo destructivo (`color="error"`).

Al hacer click se abre un `DeleteAccountDialog` (lazy-loaded) con:

- Texto de advertencia explicando que la accion es permanente y se eliminaran todos los datos
- Campo de contrasena para re-autenticacion (usando `PasswordField` existente)
- Boton "Eliminar cuenta permanentemente" (disabled hasta ingresar contrasena)
- Boton "Cancelar"
- Estado de loading con spinner durante la operacion
- Manejo de errores (contrasena incorrecta, error de red, error del callable)

Patron existente de referencia: `ChangePasswordDialog` (re-autenticacion con contrasena actual, lazy-loaded con Suspense).

### S2: Cloud Function callable `deleteUserAccount`

Nueva Cloud Function callable en `functions/src/callable/deleteUserAccount.ts` que:

1. Verifica que el usuario esta autenticado y tiene `auth.token.email` (no anonimo)
2. Elimina todos los documentos del usuario en las siguientes colecciones, usando batch writes (500 por batch):

| Coleccion | Query | Notas |
|-----------|-------|-------|
| `userSettings` | `doc(uid)` | Doc ID = uid |
| `users` | `doc(uid)` | Doc ID = uid |
| `ratings` | `where('userId', '==', uid)` | Compound ID `{uid}__{businessId}` |
| `comments` | `where('userId', '==', uid)` | Incluye root comments y replies |
| `commentLikes` | `where('userId', '==', uid)` | Compound ID `{uid}__{commentId}` |
| `favorites` | `where('userId', '==', uid)` | Compound ID `{uid}__{businessId}` |
| `userTags` | `where('userId', '==', uid)` | |
| `customTags` | `where('userId', '==', uid)` | |
| `priceLevels` | `where('userId', '==', uid)` | |
| `feedback` | `where('userId', '==', uid)` | Incluye media en Storage |
| `menuPhotos` | `where('userId', '==', uid)` | Incluye archivos en Storage + subcolleccion `reports` |
| `notifications` | `where('userId', '==', uid)` | |
| `sharedLists` | `where('ownerId', '==', uid)` | Cascade: eliminar `listItems` asociados |
| `listItems` | `where('addedBy', '==', uid)` | Items en listas ajenas (colaborativas) |
| `follows` | `where('followerId', '==', uid)` OR `where('followedId', '==', uid)` | Bidireccional |
| `recommendations` | `where('fromUserId', '==', uid)` OR `where('toUserId', '==', uid)` | Enviadas y recibidas |
| `checkins` | `where('userId', '==', uid)` | |
| `userRankings` | `doc(uid)` | Doc ID = uid |
| `activityFeed` | subcolleccion `activityFeed/{uid}/items` | Eliminar toda la subcolleccion |
| `_rateLimits` | `where('userId', '==', uid)` | Cleanup |

3. Elimina archivos de Storage asociados al usuario:
   - `feedback-media/{uid}/**` (media de feedback)
   - Menu photos del usuario (path extraido de docs de `menuPhotos`)

4. Llama a `admin.auth().deleteUser(uid)` para eliminar la cuenta de Firebase Auth

5. Registra la eliminacion en logs (sin datos personales, solo uid hasheado y timestamp)

Patron existente de referencia: batch writes en `fanOut.ts` (batches de 500), `admin.auth()` usage en `authStats.ts`.

Seguridad: la funcion usa `ENFORCE_APP_CHECK = !IS_EMULATOR` (igual que otros user-facing callables). Rate limit: 1 invocacion por minuto para prevenir abuso.

### S3: Flujo cliente post-eliminacion

Despues de que el callable retorna exito:

1. Limpiar localStorage: `STORAGE_KEY_VISITS` y cualquier otro dato local del usuario
2. Invalidar caches: `invalidateQueryCache()` y business data cache
3. Llamar `signOut()` de Firebase Auth — esto dispara `onAuthStateChanged` que auto-crea una nueva cuenta anonima
4. Mostrar toast de confirmacion: "Tu cuenta y datos fueron eliminados permanentemente"
5. Cerrar el dialog y el SideMenu

Si el callable falla, mostrar error en el dialog sin cerrar (el usuario puede reintentar).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| `DeleteAccountDialog` component (UI + re-auth + loading/error states) | P0 | S |
| Boton "Eliminar cuenta" en `SettingsPanel` (condicional a `authMethod`) | P0 | S |
| `deleteUserAccount` Cloud Function callable | P0 | L |
| Service function `deleteAccount()` en `services/emailAuth.ts` | P0 | S |
| Storage cleanup (feedback media + menu photos) | P0 | M |
| Subcollection cleanup (`activityFeed/{uid}/items`, `menuPhotos/{id}/reports`) | P0 | M |
| Cascade delete `listItems` al eliminar `sharedLists` del usuario | P0 | S |
| Bidirectional follows cleanup | P0 | S |
| Analytics events (`account_deleted`) | P1 | S |
| Tests (frontend service + Cloud Function) | P0 | M |
| Update HelpSection con info sobre eliminacion de cuenta | P1 | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Eliminacion de cuenta para usuarios autenticados via Google Sign-In (solo admin usa Google)
- Periodo de gracia / recuperacion de cuenta post-eliminacion
- Eliminacion automatica de cuentas inactivas (scheduled)
- Notificacion por email confirmando la eliminacion (podria agregarse despues)
- Anonimizacion como alternativa a eliminacion (reemplazar datos en vez de borrar)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/callable/deleteUserAccount.ts` | Callable | Eliminacion completa de todas las colecciones, Storage cleanup, auth deletion, errores (no autenticado, anonimo, callable fails mid-deletion), batch writes, rate limiting |
| `src/services/emailAuth.ts` (extension) | Service | `deleteAccount()`: re-auth + callable invocation + cache cleanup + signOut, error handling (wrong password, network error, callable error) |
| `src/components/auth/DeleteAccountDialog.tsx` | Component | Render condicional, password input, submit flow, loading state, error display, cancel, success flow |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache invalidation, analytics, Storage cleanup, auth deletion)
- Mock strategy: mock `httpsCallable` para el callable, mock `reauthenticateWithCredential` para re-auth, mock admin SDK para Cloud Function tests

---

## Seguridad

- [x] Re-autenticacion obligatoria antes de eliminar (contrasena actual via `reauthenticateWithCredential`)
- [ ] Cloud Function valida `auth.token.email` exists (rechaza anonimos)
- [ ] Cloud Function usa `admin.auth().deleteUser()` (server-side, no client-side)
- [ ] Rate limit en callable: max 1 invocacion por minuto por usuario
- [ ] No exponer en logs datos personales del usuario eliminado (solo UID hasheado)
- [ ] Firestore rules: no se requieren cambios (el callable usa admin SDK que bypasea rules)
- [ ] App Check: `enforceAppCheck: !IS_EMULATOR` en el callable
- [ ] El boton solo es visible para `authMethod === 'email'` (no anonimos, no Google)
- [ ] Cleanup completo: no quedan documentos huerfanos con datos del usuario
- [ ] Storage cleanup: eliminar archivos subidos por el usuario (feedback media, menu photos)
- [ ] El callable es idempotente: si falla a mitad, re-ejecutar no causa errores (queries con `where` no fallan si los docs ya fueron eliminados)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Re-autenticacion | write (auth) | Requiere conexion | Error "Necesitas conexion a internet para eliminar tu cuenta" |
| Callable deleteUserAccount | write (callable) | Requiere conexion | Error de red en dialog |
| signOut post-eliminacion | write (auth) | Funciona offline (local) | N/A |

### Checklist offline

- [ ] Reads de Firestore: N/A (toda la operacion es server-side)
- [ ] Writes: N/A (el callable requiere conexion obligatoria)
- [x] APIs externas: hay manejo de error de red? Si, error handling en dialog
- [ ] UI: hay indicador de estado offline en contextos relevantes? Deshabilitar boton si offline via `useConnectivity()`
- [ ] Datos criticos: N/A (operacion destructiva, no cacheable)

### Esfuerzo offline adicional: S

---

## Modularizacion

La solucion sigue la separacion UI/logica existente:

- La logica de eliminacion vive en `services/emailAuth.ts` (extension) y la Cloud Function
- `DeleteAccountDialog` es un componente autocontenido, lazy-loaded, que recibe `open` y `onClose` como props
- `SettingsPanel` solo agrega el boton y el estado `deleteDialogOpen`, sin logica de negocio inline
- El dialog usa `useAuth()` para obtener el usuario actual y `useToast()` para feedback

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout)
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion (onClick, onSelect, onNavigate) tiene un handler real especificado — nunca noop `() => {}`

---

## Success Criteria

1. Un usuario con cuenta email/password puede eliminar permanentemente su cuenta y todos sus datos desde Configuracion
2. Despues de la eliminacion, el usuario es redirigido a una nueva sesion anonima sin datos residuales
3. No quedan documentos en ninguna coleccion de Firestore asociados al UID eliminado
4. No quedan archivos en Storage asociados al UID eliminado
5. La cuenta de Firebase Auth es eliminada y el email queda disponible para re-registro
6. La operacion requiere re-autenticacion con contrasena para prevenir eliminaciones accidentales
7. Si la eliminacion falla a mitad de proceso, re-ejecutar el callable completa la limpieza sin errores
