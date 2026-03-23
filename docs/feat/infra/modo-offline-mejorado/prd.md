# PRD: Modo offline mejorado

**Feature:** modo-offline-mejorado
**Categoria:** infra
**Fecha:** 2026-03-23
**Issue:** #136
**Prioridad:** Alta

---

## Contexto

Modo Mapa ya tiene infraestructura offline parcial: `vite-plugin-pwa` genera un service worker con Workbox (precaching de 44 entries), Firestore usa `persistentLocalCache` + `persistentMultipleTabManager` en produccion para cachear datos en IndexedDB, y un `OfflineIndicator` muestra un chip "Sin conexion" cuando `navigator.onLine` es false. Sin embargo, las acciones de escritura (ratings, comentarios, favoritos, tags, price levels) fallan o muestran errores genericos cuando no hay conectividad, y no existe ningun mecanismo para encolar y reintentar esas acciones.

## Problema

- Las escrituras offline fallan silenciosamente o muestran toast de error generico, sin que el usuario sepa si su accion se perdio
- El UI optimista (pendingRating, optimistic comments/likes, FavoriteButton derived state) no tiene un path de recuperacion cuando la escritura a Firestore falla por falta de conexion
- No hay cola de acciones pendientes que persista entre sesiones y se sincronice automaticamente al reconectar
- En zonas con conectividad intermitente (comun en Buenos Aires, especialmente en subte), la experiencia es frustrante: el usuario pierde ratings y comentarios que escribio

## Solucion

### S1: Cola de acciones pendientes (Offline Action Queue)

Implementar un sistema de cola persistente para acciones de escritura que no pudieron completarse:

- **Storage**: IndexedDB via una abstraccion simple (no localStorage — soporta datos estructurados, mayor capacidad, no bloquea main thread)
- **Tipos de acciones encolables**: rating (create/update/delete), comentario (create), toggle favorito (add/remove), price level (create/update/delete), tag vote (create/delete)
- **Estructura de cada accion en cola**: `{ id, type, payload, createdAt, retryCount, status }` donde status es `pending | syncing | failed`
- **Deteccion de offline**: reutilizar la logica existente de `OfflineIndicator` (ya escucha `online`/`offline` events) elevandola a un contexto compartido `useConnectivity()`
- **Intercepcion en service layer**: los servicios en `src/services/` que hacen escrituras (`ratings.ts`, `comments.ts`, `favorites.ts`, `priceLevels.ts`, `tags.ts`) detectan si estan offline y encolan la accion en vez de llamar a Firestore directamente
- **Constantes**: `OFFLINE_QUEUE_MAX_ITEMS = 50`, `OFFLINE_QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000` (7 dias) en `src/constants/offline.ts`

### S2: Sincronizacion automatica al reconectar

- Escuchar `online` event + verificar conectividad real con un fetch ligero (evitar falsos positivos de `navigator.onLine`)
- Procesar la cola en orden FIFO, una accion a la vez
- Reintentos con backoff exponencial: 1s, 2s, 4s, max 3 reintentos por accion
- Si una accion falla despues de 3 reintentos, marcarla como `failed` y notificar al usuario
- Conflictos: estrategia last-write-wins (simple, consistente con el modelo actual de Firestore)
- Limpiar acciones sincronizadas exitosamente de IndexedDB
- Limpiar acciones con mas de 7 dias automaticamente

### S3: UI de estado offline mejorado

- **Contexto `ConnectivityContext`**: reemplaza la logica local de `OfflineIndicator`, expone `isOffline` y `pendingActionsCount` a toda la app
- **OfflineIndicator mejorado**: ademas de "Sin conexion", mostrar badge con cantidad de acciones pendientes (ej: "Sin conexion - 3 pendientes")
- **Toast de encolado**: cuando una accion se encola offline, mostrar toast info "Guardado offline — se sincronizara al reconectar" via `useToast().info()`
- **Toast de sincronizacion**: al reconectar y completar sync, toast success "N acciones sincronizadas"
- **Toast de error**: si alguna accion fallo despues de reintentos, toast warning con opcion de reintentar manualmente
- **Badge en SideMenu**: indicador de acciones pendientes junto al nombre de usuario (solo si > 0)
- **Seccion "Pendientes" en SideMenu**: lista de acciones pendientes con opcion de descartar individualmente. Formato: tipo de accion + nombre del comercio + fecha. Solo visible si hay acciones pendientes

### S4: Mejoras al service worker existente

- Revisar la configuracion actual de `vite-plugin-pwa` para asegurar que las rutas de la SPA esten cubiertas por el SW (navigateFallback)
- Agregar runtime caching para Google Maps tiles si es posible (Workbox `StaleWhileRevalidate` para `maps.googleapis.com`)
- Asegurar que el precache incluya los assets criticos del bundle actual

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| `ConnectivityContext` + `useConnectivity()` hook | Alta | S |
| Abstraccion IndexedDB para cola offline | Alta | M |
| Constantes offline (`src/constants/offline.ts`) | Alta | S |
| Intercepcion en services: `ratings.ts`, `comments.ts`, `favorites.ts` | Alta | M |
| Intercepcion en services: `priceLevels.ts`, `tags.ts` | Media | S |
| Motor de sincronizacion (FIFO + backoff + cleanup) | Alta | L |
| `OfflineIndicator` mejorado con badge de pendientes | Alta | S |
| Toast de encolado/sincronizacion via `useToast()` | Media | S |
| Seccion "Pendientes" en SideMenu | Media | M |
| Revision de config `vite-plugin-pwa` y SW | Baja | S |
| Runtime caching para Maps tiles | Baja | S |

**Esfuerzo total estimado:** XL

---

## Out of Scope

- Edicion offline de datos existentes (editar comentarios, actualizar perfil) — solo creaciones y toggles
- Resolucion avanzada de conflictos (CRDTs, merge strategies) — se usa last-write-wins
- Cache offline del mapa completo (tiles para toda Buenos Aires) — solo runtime caching oportunista
- Push notifications nativas para notificar sync completado — se usan toasts in-app
- Soporte para acciones admin offline — solo acciones de usuario regular

---

## Offline

Esta feature ES el sistema offline. A continuacion el detalle de como interactua con la infraestructura existente:

### Estado actual

| Componente | Estado | Detalle |
|------------|--------|---------|
| Service Worker | Activo | `vite-plugin-pwa` con Workbox, precache de 44 entries (HTML, JS, CSS, assets) |
| Firestore persistence | Activo | `persistentLocalCache` + `persistentMultipleTabManager` en prod. Lecturas offline funcionan |
| OfflineIndicator | Activo | Chip "Sin conexion" fijo top-center, basado en `navigator.onLine` |
| Escrituras offline | No funciona | Fallan con error, UI optimista no se recupera |

### Cambios propuestos

1. **Lectura offline**: sin cambios, Firestore persistent cache ya lo maneja
2. **Escritura offline**: nueva cola en IndexedDB intercepta escrituras cuando `isOffline === true`
3. **Navegacion offline**: verificar que `navigateFallback` en SW cubre `/` para SPA routing
4. **Assets offline**: precache existente cubre el bundle; agregar runtime cache para Maps tiles
5. **Datos criticos offline**: comercios ya estan en JSON local (`businesses.json`), no requieren red. Las interacciones del usuario (ratings, comments, favorites) se leen de Firestore persistent cache
6. **Sincronizacion**: nuevo motor de sync que procesa la cola al reconectar, respetando rate limits existentes del servidor (20 comments/dia, 50 likes/dia)

### Limitaciones conocidas

- Google Maps tiles requieren red para la carga inicial; el runtime cache solo sirve para tiles ya visitados
- Las notificaciones no se generaran hasta que la accion se sincronice (los triggers corren server-side)
- El ranking no se actualizara con acciones pendientes hasta la sincronizacion
- Si el usuario hace la misma accion online antes de que la cola se sincronice (ej: califica el mismo comercio desde otro dispositivo), last-write-wins aplica

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/offlineQueue.ts` | Service | Enqueue, dequeue, persist/restore, max items, max age cleanup, serialization |
| `src/hooks/useConnectivity.ts` | Hook | Online/offline transitions, pendingActionsCount reactivity |
| `src/services/syncEngine.ts` | Service | FIFO ordering, backoff timing, retry logic, max retries, cleanup post-sync |
| `src/services/ratings.ts` (changes) | Service | Offline interception: enqueues instead of writing to Firestore when offline |
| `src/services/comments.ts` (changes) | Service | Offline interception |
| `src/services/favorites.ts` (changes) | Service | Offline interception |
| `src/constants/offline.ts` | Constants | No tests needed (pure constants) |
| `src/components/ui/OfflineIndicator.tsx` (changes) | Component | Badge count display, connectivity context integration |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (online path, offline enqueue, sync success, sync failure, max retries)
- Side effects verificados (IndexedDB writes, toast calls, analytics events)
- Mock strategy: mock IndexedDB con in-memory Map, mock `navigator.onLine`, mock Firestore SDK, mock `useToast()`

---

## Seguridad

- [ ] Cola offline no almacena tokens ni credenciales — solo payloads de datos (userId, businessId, score, text)
- [ ] Validacion de datos en cola antes de sincronizar — mismas validaciones client-side que el path online (longitud de texto, rango de score, etc.)
- [ ] Rate limits server-side siguen aplicando al sincronizar — la cola no puede bypassear los 20 comments/dia ni los 50 likes/dia
- [ ] Limitar cantidad de acciones en cola (50 max) para prevenir abuso de storage
- [ ] Limitar edad de acciones en cola (7 dias max) para evitar datos stale
- [ ] No encolar acciones sin `userId` valido (requiere auth, aunque sea anonima)
- [ ] IndexedDB es per-origin, no accesible cross-site — mismo modelo de seguridad que localStorage

---

## Success Criteria

1. El usuario puede calificar, comentar y marcar favoritos sin conexion, y la UI muestra feedback inmediato de que la accion quedo encolada
2. Al reconectar, todas las acciones pendientes se sincronizan automaticamente sin intervencion del usuario, con toast de confirmacion
3. Si la app se cierra y reabre offline, las acciones pendientes persisten en IndexedDB y se sincronizan cuando vuelve la conexion
4. El indicador offline muestra la cantidad de acciones pendientes, y el SideMenu ofrece una lista detallada con opcion de descartar
5. Las acciones que fallan despues de 3 reintentos se marcan como fallidas y el usuario puede reintentar manualmente o descartarlas
