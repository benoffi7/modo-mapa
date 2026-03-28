# Specs: Harden useForceUpdate reload loop protection

**PRD:** [4-force-update-loop.md](4-force-update-loop.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

No hay cambios en Firestore. Este cambio es puramente client-side.

La unica lectura de Firestore existente es `getDoc(doc(db, 'config', 'appVersion'))` que ya existe y no cambia.

## Firestore Rules

Sin cambios. La lectura de `config/appVersion` ya esta permitida como public read.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `getDoc('config/appVersion')` en `useForceUpdate.ts` | config | Any (no auth required) | `allow read: if true` (public) | No |

## Cloud Functions

Sin cambios.

## Componentes

Sin componentes nuevos. No hay cambios en componentes React.

El hook `useForceUpdate` se llama en `src/App.tsx` sin cambios en su interfaz publica (sigue siendo `useForceUpdate(): void`).

## Hooks

### `useForceUpdate` (modificacion)

**Archivo:** `src/hooks/useForceUpdate.ts`

**Cambios:**

1. **Migrar cooldown de `sessionStorage` a `localStorage`** -- Reemplazar todas las referencias a `sessionStorage` por `localStorage`. Usar la misma key renombrada (ver Servicios/constantes abajo).

2. **Agregar contador de reloads con limite** -- Nuevo mecanismo:
   - Al intentar un reload, leer un JSON de `localStorage` con estructura `{ count: number, firstAt: number }`.
   - Si `Date.now() - firstAt >= FORCE_UPDATE_COOLDOWN_MS` (5 min), resetear el contador (ventana expirada).
   - Si `count >= MAX_FORCE_UPDATE_RELOADS` (3) dentro de la ventana, NO hacer reload. En su lugar, loguear un warning y activar un flag que sera leido por el banner.
   - Si el contador permite, incrementar `count` y proceder con el reload.

3. **Exponer estado `updateAvailable` para banner manual** -- Cambiar la firma del hook:
   - **Antes:** `useForceUpdate(): void`
   - **Despues:** `useForceUpdate(): { updateAvailable: boolean }`
   - Cuando el limite de reloads se alcanza, setear estado `updateAvailable = true`.
   - El componente que consume el hook (`App.tsx`) puede renderizar un banner condicional.

4. **Funciones internas refactorizadas:**
   - `isCooldownActive()` -- Lee de `localStorage` en vez de `sessionStorage`. Misma logica de TTL.
   - `getReloadCount()` -- Nueva. Lee el JSON del contador de `localStorage`. Devuelve `{ count, firstAt }` o `{ count: 0, firstAt: 0 }` si no existe o esta corrupto.
   - `incrementReloadCount()` -- Nueva. Incrementa el contador o lo inicializa si la ventana expiro.
   - `isReloadLimitReached()` -- Nueva. Retorna `true` si `count >= MAX_FORCE_UPDATE_RELOADS` dentro de la ventana activa.
   - `checkVersion()` -- Modificada para usar las nuevas funciones y retornar `'reloading' | 'limit-reached' | 'up-to-date' | 'error'` en vez de `void`.

**Exports para testing:**

```typescript
/** @internal Exported for testing only */
export const _checkVersion: () => Promise<'reloading' | 'limit-reached' | 'up-to-date' | 'error'>;
export const _getReloadCount: () => { count: number; firstAt: number };
export const _isReloadLimitReached: () => boolean;
```

## Servicios

Sin servicios nuevos o modificados.

## Constantes

### `src/constants/storage.ts` (modificacion)

```typescript
// Reemplazar:
// export const SESSION_KEY_FORCE_UPDATE_LAST_REFRESH = 'force_update_last_refresh';

// Por:
export const STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH = 'force_update_last_refresh';
export const STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT = 'force_update_reload_count';
```

Nota: el prefijo cambia de `SESSION_KEY_` a `STORAGE_KEY_` para reflejar que ahora usa `localStorage`.

### `src/constants/timing.ts` (modificacion)

```typescript
// Agregar:
/** Maximum number of forced refreshes allowed within the cooldown window */
export const MAX_FORCE_UPDATE_RELOADS = 3;
```

### `src/constants/analyticsEvents.ts` (modificacion)

```typescript
// Agregar:
export const EVT_FORCE_UPDATE_LIMIT_REACHED = 'force_update_limit_reached';
```

## Integracion

### `src/App.tsx` (modificacion)

Consumir el nuevo retorno del hook y renderizar un banner cuando `updateAvailable` es `true`:

```typescript
function App() {
  useScreenTracking();
  const { updateAvailable } = useForceUpdate();

  return (
    <ColorModeProvider>
      {/* ... providers ... */}
      {updateAvailable && <ForceUpdateBanner />}
      {/* ... routes ... */}
    </ColorModeProvider>
  );
}
```

### `src/components/layout/ForceUpdateBanner.tsx` (nuevo)

Componente simple que muestra un Alert de MUI con un mensaje y un boton de recarga manual.

**Props:** ninguna (el boton llama a `window.location.reload()` directamente).

**Render:**

```tsx
<Alert severity="warning" action={<Button onClick={() => window.location.reload()}>Recargar</Button>}>
  Hay una nueva version disponible. Recarga la pagina para actualizar.
</Alert>
```

**Ubicacion:** Top-level, encima de todo el contenido de la app. Usa `position: fixed`, `top: 0`, `left: 0`, `right: 0`, `zIndex: theme.zIndex.snackbar` para ser siempre visible.

## Tests

### Archivos a testear

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useForceUpdate.test.ts` | Cooldown con localStorage, contador de reloads, limite de 3, banner state, ventana de 5 min, reset de ventana | Hook (modificacion) |

### Casos nuevos a agregar al test existente

El archivo `src/hooks/useForceUpdate.test.ts` ya existe con 7 tests. Se deben agregar:

1. **Cooldown usa localStorage (no sessionStorage)** -- Verificar que `isCooldownActive` lee de `localStorage`.
2. **Reload counter incrementa en localStorage** -- Verificar que tras un reload, el contador en localStorage es 1.
3. **Reload limit reached (3 reloads)** -- Simular 3 reloads en <5 min, verificar que el 4to no ejecuta `window.location.reload()`.
4. **checkVersion retorna 'limit-reached' cuando el limite se alcanza** -- Verificar el retorno.
5. **updateAvailable state se activa al alcanzar el limite** -- Renderizar el hook y verificar que retorna `{ updateAvailable: true }`.
6. **Ventana expira y resetea el contador** -- Simular que pasaron 5 min, verificar que el contador se resetea y permite reloads nuevamente.
7. **localStorage corrupto no rompe el flujo** -- Escribir basura en la key del contador, verificar que se comporta como si no existiera.
8. **Analytics event al alcanzar el limite** -- Verificar que se trackea `EVT_FORCE_UPDATE_LIMIT_REACHED`.

### Casos existentes a actualizar

- Test "respects cooldown from sessionStorage" debe cambiar a usar `localStorage`.

### Mock strategy

- Mismos mocks existentes (Firestore, analytics, logger, SW, caches, location).
- Agregar `vi.stubGlobal` o spy para `localStorage.getItem`/`setItem` donde sea necesario (jsdom ya provee localStorage).
- Usar `vi.useFakeTimers()` para tests de ventana temporal.

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo en `useForceUpdate.ts`.
- Todos los paths condicionales cubiertos (cooldown activo, limite alcanzado, ventana expirada, localStorage corrupto/inaccesible).

## Analytics

| Evento | Parametros | Cuando |
|--------|-----------|--------|
| `EVT_FORCE_UPDATE_TRIGGERED` (existente) | `{ from, to }` | Antes de cada reload (sin cambio) |
| `EVT_FORCE_UPDATE_LIMIT_REACHED` (nuevo) | `{ from, to, reloadCount }` | Cuando se alcanza el limite de 3 reloads |

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Cooldown timestamp | Escritura directa | 5 min (FORCE_UPDATE_COOLDOWN_MS) | localStorage |
| Reload counter | Escritura directa (JSON) | 5 min (misma ventana) | localStorage |

### Writes offline

No aplica. Este feature es puramente client-side y no escribe a Firestore.

### Fallback UI

Cuando el usuario esta offline, `checkVersion` falla silenciosamente en el `catch` (sin cambio). El banner `ForceUpdateBanner` solo aparece si la version check fue exitosa Y el limite de reloads se alcanzo, lo cual no puede pasar si esta offline.

---

## Decisiones tecnicas

1. **localStorage sobre sessionStorage** -- `sessionStorage` se limpia al cerrar tab y algunos browsers mobile lo limpian en reload, eliminando la proteccion de cooldown. `localStorage` persiste entre tabs y sesiones, garantizando que el cooldown funcione siempre.

2. **Contador con ventana temporal vs cooldown simple** -- Un solo cooldown no previene loops lentos (un reload cada 5 min que nunca logra resolver). El contador con ventana de 5 min y limite de 3 detecta el patron de loop y lo detiene definitivamente hasta que el usuario intervenga manualmente.

3. **Banner manual vs bloqueo total** -- Despues de alcanzar el limite, no bloqueamos la app. Mostramos un banner no-intrusivo que permite al usuario recargar cuando quiera. Esto cumple el criterio "el usuario siempre puede acceder a la app".

4. **Retorno de estado vs context/provider** -- El hook retorna `{ updateAvailable }` directamente en vez de usar un context. Solo `App.tsx` consume este valor, un context seria over-engineering para un solo consumidor.

5. **JSON en localStorage para el contador** -- Usamos un objeto `{ count, firstAt }` serializado como JSON en una sola key, en vez de dos keys separadas. Esto es atomico (un solo `setItem`) y simplifica la lectura.

6. **Renombrar SESSION_KEY_ a STORAGE_KEY_** -- Para reflejar el cambio de storage mechanism y mantener consistencia con las demas constantes en `storage.ts` que usan el prefijo `STORAGE_KEY_`.
