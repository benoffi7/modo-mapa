# Specs: Offline Hardening (#271-#273)

**Issues:** #271 (CRITICAL), #272 (HIGH), #273 (MEDIUM)
**Fecha:** 2026-03-31

---

## Alcance

Agrupado en un fix/ branch. Tres issues, tres fases. Sin cambios a modelo de datos ni Firestore rules.

---

## Fase 1 — #271: getCountFromServer sin wrapper

### Problema

`recommendations.ts` llama a `getCountFromServer` directamente en dos lugares.
Si el dispositivo esta offline, Firestore lanza una excepcion no manejada en lugar de devolver un valor seguro.

### Cambios en servicios

**`src/services/recommendations.ts`**

`countUnreadRecommendations` (linea 81): reemplazar `getCountFromServer` + `snap.data().count` con `getCountOfflineSafe`.

Antes:

```ts
const snap = await getCountFromServer(query(...));
return snap.data().count;
```

Despues:

```ts
return getCountOfflineSafe(query(...));
```

`countRecommendationsSentToday` (linea 107): mismo reemplazo dentro del bloque `try`. El bloque `catch` existente que devuelve `cached?.count ?? 0` se mantiene — es correcto, pero el `try` ya no necesita manejar el offline porque `getCountOfflineSafe` lo hace internamente. Resultado: la funcion pasa a ser mas sencilla sin perder el fallback al cache local.

Imports a agregar: `getCountOfflineSafe` desde `'../utils/getCountOfflineSafe'`.
Import a remover: `getCountFromServer` de `'firebase/firestore'` (si no hay otro uso).

### Tests

**`src/services/recommendations.test.ts`** — agregar casos:

| Caso | Descripcion |
|------|-------------|
| `countUnreadRecommendations offline` | Mockear `navigator.onLine = false`, esperar retorno 0 |
| `countRecommendationsSentToday offline` | Mismo mock, esperar retorno de cache (o 0 si cache vacio) |

---

## Fase 2 — #272: Guards offline faltantes

### 2a. MenuPhotoUpload — boton "Enviar" offline

**`src/components/business/MenuPhotoUpload.tsx`**

- Importar `useConnectivity` desde `'../../context/ConnectivityContext'`.
- Agregar `const { isOffline } = useConnectivity();` dentro del componente.
- En el boton "Enviar": agregar `isOffline` a la condicion `disabled`:

```tsx
disabled={!selectedFile || uploading || isOffline}
```

- Agregar `title` al boton cuando offline: `title={isOffline ? 'Requiere conexion' : undefined}`.

No se necesita toast — el boton disabled es feedback suficiente para una accion que siempre requiere Storage upload.

### 2b. EditorsDialog — removeEditor sin guard

**`src/components/lists/EditorsDialog.tsx`**

- Importar `useConnectivity` desde `'../../context/ConnectivityContext'`.
- Agregar `const { isOffline } = useConnectivity();` dentro del componente.
- En `handleRemove`: guard al inicio:

```ts
const handleRemove = async (targetUid: string) => {
  if (isOffline) {
    toast.warning(MSG_OFFLINE.noConnection);
    return;
  }
  // ...resto igual
};
```

- Deshabilitar el `IconButton` de remover cuando `isOffline`:

```tsx
disabled={removing === editor.uid || isOffline}
```

Importar `MSG_OFFLINE` desde `'../../constants/messages'`.

### 2c. SharedListsView — fetchFeaturedLists sin cache offline

**`src/components/lists/SharedListsView.tsx`**

El problema: `fetchFeaturedLists` llama a una Cloud Function (`getFeaturedLists`) que falla silenciosamente offline. El log llega a `logger.error` pero el usuario ve la seccion vacia sin explicacion.

Estrategia: cache en `localStorage` con key `mm_featured_lists` y TTL de 24h. Si la funcion falla, leer el cache y usarlo. Si no hay cache, no mostrar la seccion (comportamiento actual — correcto).

Cambios en el `useEffect` de `fetchFeaturedLists`:

```ts
useEffect(() => {
  let ignore = false;
  const CACHE_KEY = 'mm_featured_lists';
  const CACHE_TTL = 24 * 60 * 60 * 1000;

  // Warm from cache immediately
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, ts } = JSON.parse(cached) as { data: SharedList[]; ts: number };
      if (Date.now() - ts < CACHE_TTL && !ignore) {
        setFeaturedLists(data.map((l) => ({
          ...l,
          createdAt: new Date(l.createdAt),
          updatedAt: new Date(l.updatedAt),
        })));
      }
    }
  } catch { /* ignore malformed cache */ }

  fetchFeaturedLists()
    .then((result) => {
      if (!ignore) {
        setFeaturedLists(result);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }));
        } catch { /* storage full */ }
      }
    })
    .catch((err) => logger.error('[SharedListsView] fetchFeaturedLists failed:', err));
  return () => { ignore = true; };
}, []);
```

La constante `CACHE_KEY` y `CACHE_TTL` van inline (no justifican extraer a constants dado el alcance del fix).

---

## Fase 3 — #273: Fallbacks de imagen y manejo de writes en notificaciones

### 3a. MenuPhotoSection — img sin onError

**`src/components/business/MenuPhotoSection.tsx`** (linea 81)

Agregar `onError` al `<img>`:

```tsx
<img
  src={photoUrl}
  alt="Menú"
  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 4 }}
  onError={() => setPhotoUrl(null)}
/>
```

Cuando `photoUrl` se setea a `null`, el bloque `menuPhoto && photoUrl` pasa a falso y el componente renderiza el estado "sin foto" existente — correcto, sin necesidad de estado de error adicional.

### 3b. MenuPhotoViewer — pantalla negra si imagen falla

**`src/components/business/MenuPhotoViewer.tsx`** (linea 65)

Agregar estado local `imageError`:

```tsx
const [imageError, setImageError] = useState(false);
```

En el bloque de imagen:

```tsx
{imageError ? (
  <Box sx={{ textAlign: 'center', color: 'grey.500' }}>
    <Typography variant="body2">No se pudo cargar la imagen</Typography>
  </Box>
) : (
  <img
    src={photoUrl}
    alt="Foto del menú"
    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
    onError={() => setImageError(true)}
  />
)}
```

Resetear `imageError` cuando cambia `photoUrl` (si el viewer se reutiliza):

```tsx
useEffect(() => { setImageError(false); }, [photoUrl]);
```

### 3c. NotificationsContext — markRead/markAllRead sin .catch()

**`src/context/NotificationsContext.tsx`** (lineas 86-99)

Los metodos `markRead` y `markAllRead` hacen `await` directo sin catch. Si la escritura falla (ej: offline o error de red), la promesa rechaza hacia el caller sin feedback.

Patron a aplicar: optimistic update ya esta hecho (el state local se actualiza antes del `await`). Agregar catch que revierte el optimistic update y muestra toast de error.

`markRead`:

```ts
const markRead = useCallback(async (notificationId: string) => {
  // optimistic
  setNotifications((prev) =>
    prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
  );
  setUnreadCount((prev) => Math.max(0, prev - 1));
  try {
    await markNotificationRead(notificationId);
  } catch (err) {
    logger.warn('[NotificationsContext] markRead failed:', err);
    // revert
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: false } : n)),
    );
    setUnreadCount((prev) => prev + 1);
    toast.error(MSG_NOTIFICATIONS.markReadError);
  }
}, [toast]);
```

`markAllRead`:

```ts
const markAllRead = useCallback(async () => {
  if (!uid) return;
  const prevNotifications = notifications;
  const prevCount = unreadCount;
  // optimistic
  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  setUnreadCount(0);
  try {
    await markAllNotificationsRead(uid);
  } catch (err) {
    logger.warn('[NotificationsContext] markAllRead failed:', err);
    // revert
    setNotifications(prevNotifications);
    setUnreadCount(prevCount);
    toast.error(MSG_NOTIFICATIONS.markAllReadError);
  }
}, [uid, notifications, unreadCount, toast]);
```

Nota: `toast` se obtiene con `useToast()` dentro de `NotificationsProvider`. Agregar import.

Agregar a `src/constants/messages/` — nueva entrada en `common.ts` o en un archivo `notifications.ts` si ya existe. Dado que no existe un `notifications.ts`, agregar las claves a `common.ts`:

```ts
markReadError: 'No se pudo marcar como leida',
markAllReadError: 'No se pudo marcar todo como leido',
```

Importar como `MSG_COMMON` en el context (o crear `MSG_NOTIFICATIONS` si se prefiere isolacion — decision de implementacion).

La segunda entrada en `loadCountOnly` tambien tiene `catch { // silent }` (linea 54). Reemplazar con `catch (err) { logger.warn('[NotificationsContext] loadCountOnly failed:', err); }` — no requiere toast porque es un poll background.

### 3d. useUserSettings — revert silencioso sin toast

**`src/hooks/useUserSettings.ts`** (linea 50)

El catch ya llama a `logger.error` y revierte el optimistic update (lineas 51-55). Falta el toast al usuario.

Agregar `useToast` al hook:

```ts
const toast = useToast();
```

En el catch de `updateSetting`:

```ts
.catch((err) => {
  logger.error('[useUserSettings] updateUserSettings failed:', err);
  setOptimistic((prev) => {
    const next = { ...prev };
    delete next[key];
    return next;
  });
  toast.warning(MSG_COMMON.settingUpdateError);
});
```

Agregar a `src/constants/messages/common.ts`:

```ts
settingUpdateError: 'No se pudo guardar el cambio',
```

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `'No se pudo marcar como leida'` | toast en NotificationsContext.markRead | tilde en leida |
| `'No se pudo marcar todo como leido'` | toast en NotificationsContext.markAllRead | |
| `'No se pudo guardar el cambio'` | toast en useUserSettings.updateSetting | |
| `'No se pudo cargar la imagen'` | MenuPhotoViewer error state | |
| `'Requiere conexion'` | title en botones disabled offline | sin tilde (title HTML, no visible UX primario) |

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| MenuPhotoViewer | img error state Box | n/a | n/a | Typography "No se pudo cargar la imagen" |
| MenuPhotoUpload | Boton "Enviar" | n/a | 44x44px (ya correcto) | disabled + title offline |
| EditorsDialog | IconButton remover | ya tiene aria-label | ya correcto | disabled offline |

---

## Offline — resumen por fix

| Fix | Estrategia |
|-----|-----------|
| #271 countUnreadRecommendations | `getCountOfflineSafe` devuelve 0 si offline |
| #271 countRecommendationsSentToday | `getCountOfflineSafe` + fallback a cache en-memoria |
| #272 MenuPhotoUpload | boton disabled, no se intenta el upload |
| #272 EditorsDialog | guard early-return + toast + boton disabled |
| #272 SharedListsView | localStorage cache 24h; muestra stale si fetch falla |
| #273 MenuPhotoSection | `onError` setea photoUrl a null, muestra estado vacio |
| #273 MenuPhotoViewer | `onError` muestra mensaje, no pantalla negra |
| #273 NotificationsContext | optimistic ya hecho; catch revierte + toast |
| #273 useUserSettings | catch ya existe; agregar toast al revert |

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/recommendations.test.ts` | `countUnreadRecommendations` y `countRecommendationsSentToday` con `navigator.onLine = false` | unit |

Los cambios de componentes (#272, #273) son defensivos (guard, disabled, onError, catch). No requieren tests nuevos — el comportamiento offline se verifica manualmente. Los tests de componentes existentes no deben romperse.

---

## Modelo de datos

Sin cambios.

## Firestore Rules

Sin cambios.

## Cloud Functions

Sin cambios.

## Seed Data

Sin cambios.

---

## Decisiones tecnicas

**LocalStorage para featured lists (vs IndexedDB):** La lista featured es un array plano de `SharedList` (metadata sin subcollections). LocalStorage es suficiente, sin overhead de IndexedDB. TTL de 24h es conservador — las listas featured cambian raramente.

**Optimistic-then-catch en NotificationsContext:** El estado local ya se actualiza antes del await. El patron correcta es mover el update antes del try, y revertir en el catch. Esto evita el flicker de esperar la confirmacion del server para un toggle de lectura.

**No toast en MenuPhotoUpload offline:** El boton disabled ya comunica la restriccion. Un toast adicional seria ruidoso para un caso donde el usuario puede ver visualmente que esta offline.
