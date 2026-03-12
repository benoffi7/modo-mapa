# PRD: Mitigaciones de Cuota Firebase y Modo Offline

## Estado actual

> **Mitigaciones 1-3: COMPLETADAS** (PR #26, mergeado a main)
>
> Las mitigaciones de cache y persistence se implementaron en el branch
> `feat/24-firebase-quota-offline` y se mergearon en PR #26. Estas redujeron
> los reads de Firestore en ~54%, permitiendo soportar ~200 usuarios dentro
> de la cuota gratuita.
>
> **Pendiente: Mitigacion 4 — Modo offline completo (PWA + Service Worker)**
> Este es el trabajo restante, cubierto en issue #25.

---

## Contexto

La app usa Firestore sin persistencia offline configurada. Cada read/write requiere conexión y consume cuota. Con 100 usuarios estimados, los reads superan ligeramente la cuota gratuita (54K vs 50K/mes).

### Reads actuales por business view (5 queries separadas)

| Query | Componente | Colección | Tipo |
|-------|-----------|-----------|------|
| Check favorito | FavoriteButton | `favorites` | getDoc |
| Ratings del comercio | BusinessRating | `ratings` | getDocs (where businessId) |
| Comentarios | BusinessComments | `comments` | getDocs (where businessId) |
| User tags | BusinessTags | `userTags` | getDocs (where businessId) |
| Custom tags | BusinessTags | `customTags` | getDocs (where userId + businessId) |

### Reads adicionales por sesión

| Query | Componente | Colección | Trigger |
|-------|-----------|-----------|---------|
| Perfil usuario | AuthContext | `users` | Auth state change |
| Favoritos lista | FavoritesList | `favorites` | Abrir menú sección |
| Comentarios lista | CommentsList | `comments` | Abrir menú sección |
| Ratings lista | RatingsList | `ratings` | Abrir menú sección |

### Cuota gratuita mensual

| Recurso | Cuota free | Estimación 100 usuarios | Estado |
|---------|-----------|------------------------|--------|
| Reads | 50,000/mes | 54,000/mes | Ligeramente over |
| Writes | 20,000/mes | 6,000/mes | OK |
| Deletes | 20,000/mes | ~1,000/mes | OK |

---

## Objetivos

Reducir el consumo de reads de Firestore y habilitar navegación offline, implementando las mitigaciones con mejor relación costo/beneficio.

---

## Mitigación 1: Firestore Offline Persistence — COMPLETADA

### Descripcion

Habilitar persistencia offline de Firestore usando IndexedDB. Los datos ya consultados se sirven desde cache local en visitas posteriores, eliminando reads duplicados.

### Implementacion

Usar `enableMultiTabIndexedDbPersistence()` (o `initializeFirestore` con `persistenceEnabled: true` en Firebase v10+) en `src/config/firebase.ts`.

```text
firebase.ts
  initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  })
```

### Impacto estimado

- **-40% reads** para usuarios recurrentes que visitan los mismos comercios
- Los datos se sirven desde IndexedDB si existen en cache
- Firestore sincroniza automáticamente cuando hay conexión
- Sin cambio en la lógica de los componentes

### Complejidad: Baja

Cambio solo en `firebase.ts`. No afecta ningun componente.

---

## Mitigacion 2: Cache client-side con TTL para Business View — COMPLETADA

### Descripcion

Implementar cache en memoria para los datos del business view. Cuando el usuario abre un comercio que ya visito en la sesion, los datos se sirven desde cache sin hacer queries a Firestore.

### Implementacion

Hook `useBusinessDataCache` que:

1. Mantiene un `Map<businessId, { data, timestamp }>` en memoria (via Context o module-level)
2. Al abrir un comercio, verifica si hay datos en cache con TTL valido (5 minutos)
3. Si hay cache valido: retorna datos inmediatamente, sin queries
4. Si no hay cache o expiro: hace las 5 queries normales y guarda en cache
5. Al hacer un write (comentar, votar tag, etc.): invalida el cache de ese comercio

### Impacto estimado

- **-60% reads por business view** en sesiones donde el usuario reabre comercios
- En una sesion tipica de 3 comercios, si el usuario abre cada uno 2 veces: de 30 reads a 15 reads
- Escrituras invalidan cache, garantizando consistencia

### Complejidad: Media

Requiere refactor de como los componentes del business view obtienen datos. Los componentes hijos pasan a recibir datos como props.

---

## Mitigacion 3: Cache de listas del menu lateral — COMPLETADA

### Descripcion

Las listas del menu (favoritos, comentarios, ratings) se recargan cada vez que el usuario abre la seccion. Cachear en memoria con invalidacion al escribir.

### Implementacion

Modificar `usePaginatedQuery` para:

1. Mantener cache por query key (coleccion + userId + pagina)
2. Al montar la seccion: si hay cache valido (TTL 2 minutos), usar cache
3. Al hacer write en la coleccion (agregar/eliminar favorito, comentario, etc.): invalidar cache de esa coleccion
4. Mantener la funcionalidad de "Cargar mas" (paginacion)

### Impacto estimado

- **-30% reads en sesiones largas** donde el usuario navega entre secciones del menu repetidamente
- No afecta la primera carga de cada seccion

### Complejidad: Media

Cambio contenido en `usePaginatedQuery`. Los componentes solo necesitan llamar una funcion de invalidacion.

---

## Mitigacion 4: Modo offline completo (PENDIENTE — Issue #25)

### Descripcion

Permitir navegar el mapa y ver datos cacheados cuando no hay conexion. Los datos estaticos (comercios) ya estan en JSON local. Las interacciones se encolan y sincronizan al reconectar.

### Implementacion

1. **Service Worker** con Workbox (via `vite-plugin-pwa`):
   - Precache de assets estaticos (HTML, JS, CSS, JSON)
   - Runtime cache de Google Maps tiles (stale-while-revalidate)
   - Runtime cache de API responses

2. **Indicador de estado offline**:
   - Banner o chip cuando no hay conexion
   - Icono en SearchBar o AppShell

3. **Writes offline**:
   - Firestore con persistence ya encola writes automaticamente
   - Mostrar indicador "pendiente de sincronizacion" en items no confirmados

4. **PWA manifest** (`manifest.json`):
   - Nombre, iconos, theme color para instalabilidad
   - `display: standalone` para experiencia app-like

### Dependencias nuevas

| Paquete | Uso |
|---------|-----|
| `vite-plugin-pwa` | Genera service worker con Workbox |

### Componentes afectados

| Componente | Cambio |
|-----------|--------|
| `vite.config.ts` | Agregar VitePWA plugin |
| `AppShell` | Indicador de estado offline |
| `public/manifest.json` | Manifiesto PWA para instalabilidad |
| Componentes de write | Indicador "pendiente de sync" (opcional) |

### Impacto estimado

- **100% funcionalidad de lectura offline** (mapa + datos cacheados)
- **Writes offline encolados** se sincronizan automaticamente al reconectar
- Mejora UX en zonas con mala conectividad (tipico en horario de almuerzo en CABA)

### Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Google Maps tiles no cacheados | Stale-while-revalidate; sin red, mapa puede no cargar si tiles no estan en cache |
| Conflictos de sync | Firestore resuelve conflictos por last-write-wins; aceptable para esta app |
| Tamano del service worker | Workbox genera SW optimizado; precache solo assets criticos |
| Complejidad de testing | Testear en Chrome DevTools con Network offline toggle |

### Complejidad: Media-Alta

Service worker + PWA config. No cambia logica de negocio pero agrega infraestructura.

---

## Evaluacion y resultados

### Matriz de costo/beneficio

| Mitigacion | Reduccion reads | Complejidad | Estado |
|-----------|----------------|-------------|--------|
| 1. Offline Persistence | -40% recurrentes | Baja | COMPLETADA (PR #26) |
| 2. Cache Business View | -60% business view | Media | COMPLETADA (PR #26) |
| 3. Cache listas menu | -30% sesiones largas | Media | COMPLETADA (PR #26) |
| 4. Modo offline completo | N/A (UX) | Media-Alta | PENDIENTE (Issue #25) |

### Resultados de mitigaciones 1-3

Las mitigaciones 1-3 lograron una reduccion de ~54% en reads:

| Escenario | Sin mitigacion | Con mitigaciones | Reduccion |
|-----------|---------------|-----------------|-----------|
| 100 usuarios, 3 comercios/sesion | 54,000 reads/mes | ~25,000 reads/mes | -54% |
| 200 usuarios, 3 comercios/sesion | 108,000 reads/mes | ~50,000 reads/mes | -54% |

Con las mitigaciones 1-3, la app soporta ~200 usuarios dentro de la cuota gratuita.

---

## Fuera de alcance

- Cambiar estructura de colecciones Firestore (breaking change)
- Migrar a otro backend (Supabase, etc.)
- Server-side aggregation (Cloud Functions para pre-computar datos)
- Firestore bundles (requiere server-side)
- Reduccion de writes (ya estan dentro de cuota)

---

## Criterios de aceptacion

### Mitigaciones 1-3 (COMPLETADAS)

- [x] Firestore offline persistence habilitada en produccion
- [x] Persistence deshabilitada en modo DEV (emuladores)
- [x] Cache client-side para business view con TTL de 5 min
- [x] Invalidacion de cache al hacer writes
- [x] Cache de primera pagina en listas del menu con TTL de 2 min
- [x] 0 regresiones en funcionalidad existente
- [x] Reads por sesion tipica reducidos >50%
- [x] 0 errores de lint, build y tests existentes
- [x] Tests para logica de cache (TTL, invalidacion)

### Mitigacion 4 — PWA + Service Worker (PENDIENTE)

- [ ] Service Worker con Workbox generado via `vite-plugin-pwa`
- [ ] Precache de assets estaticos (HTML, JS, CSS, JSON de comercios)
- [ ] Runtime cache de Google Maps tiles (stale-while-revalidate)
- [ ] Indicador visual de estado offline (banner/chip)
- [ ] Manifiesto PWA (`manifest.json`) con iconos y configuracion de instalabilidad
- [ ] App instalable desde navegador (prompt "Agregar a pantalla de inicio")
- [ ] 0 regresiones en funcionalidad existente
- [ ] 0 errores de lint, build y tests existentes
