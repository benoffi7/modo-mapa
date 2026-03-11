# PRD: Mitigaciones de Cuota Firebase y Modo Offline

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

## Mitigación 1: Firestore Offline Persistence

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

### Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Datos desactualizados en cache | Firestore listener sync automatico al reconectar; datos de esta app cambian poco |
| Aumento de storage en dispositivo | IndexedDB se autogestiona; datos de esta app son pequenos (<1MB) |
| Conflicto con emuladores | Deshabilitar persistence en modo DEV (ya se detecta `import.meta.env.DEV`) |

### Complejidad: Baja

Cambio solo en `firebase.ts`. No afecta ningun componente.

---

## Mitigacion 2: Cache client-side con TTL para Business View

### Descripcion

Implementar cache en memoria para los datos del business view. Cuando el usuario abre un comercio que ya visito en la sesion, los datos se sirven desde cache sin hacer queries a Firestore.

### Implementacion

Crear un hook `useBusinessDataCache` que:

1. Mantiene un `Map<businessId, { data, timestamp }>` en memoria (via Context o module-level)
2. Al abrir un comercio, verifica si hay datos en cache con TTL valido (5 minutos)
3. Si hay cache valido: retorna datos inmediatamente, sin queries
4. Si no hay cache o expiro: hace las 5 queries normales y guarda en cache
5. Al hacer un write (comentar, votar tag, etc.): invalida el cache de ese comercio

### Componentes afectados

| Componente | Cambio |
|-----------|--------|
| `BusinessSheet` | Nuevo: pasa datos cacheados a hijos |
| `FavoriteButton` | Recibe `isFavorite` como prop en vez de hacer getDoc |
| `BusinessRating` | Recibe `ratings` como prop en vez de hacer getDocs |
| `BusinessComments` | Recibe `comments` como prop en vez de hacer getDocs |
| `BusinessTags` | Recibe `userTags` + `customTags` como props en vez de hacer getDocs |

### Impacto estimado

- **-60% reads por business view** en sesiones donde el usuario reabre comercios
- En una sesion tipica de 3 comercios, si el usuario abre cada uno 2 veces: de 30 reads a 15 reads
- Escrituras invalidan cache, garantizando consistencia

### Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Cache desactualizado por otro usuario | TTL de 5 min limita la ventana; datos de interaccion social toleran delay |
| Memoria | Map en memoria se limpia al cerrar tab; con 40 comercios max ~200KB |
| Complejidad extra | Un solo hook centralizado, patron bien conocido |

### Complejidad: Media

Requiere refactor de como los componentes del business view obtienen datos. Los componentes hijos pasan a recibir datos como props.

---

## Mitigacion 3: Cache de listas del menu lateral

### Descripcion

Las listas del menu (favoritos, comentarios, ratings) se recargan cada vez que el usuario abre la seccion. Cachear en memoria con invalidacion al escribir.

### Implementacion

Modificar `usePaginatedQuery` para:

1. Mantener cache por query key (coleccion + userId + pagina)
2. Al montar la seccion: si hay cache valido (TTL 2 minutos), usar cache
3. Al hacer write en la coleccion (agregar/eliminar favorito, comentario, etc.): invalidar cache de esa coleccion
4. Mantener la funcionalidad de "Cargar mas" (paginacion)

### Componentes afectados

| Componente | Cambio |
|-----------|--------|
| `usePaginatedQuery` | Agregar capa de cache con TTL |
| `FavoriteButton` | Al toggle, invalidar cache de favorites |
| `BusinessComments` | Al crear/eliminar, invalidar cache de comments |
| `BusinessRating` | Al calificar, invalidar cache de ratings |

### Impacto estimado

- **-30% reads en sesiones largas** donde el usuario navega entre secciones del menu repetidamente
- No afecta la primera carga de cada seccion

### Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Paginacion + cache es compleja | Solo cachear la primera pagina; "Cargar mas" siempre va a Firestore |
| Inconsistencia tras write | Invalidar cache de la coleccion entera al escribir |

### Complejidad: Media

Cambio contenido en `usePaginatedQuery`. Los componentes solo necesitan llamar una funcion de invalidacion.

---

## Mitigacion 4: Modo offline completo

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

### Dependencias nuevas

| Paquete | Uso |
|---------|-----|
| `vite-plugin-pwa` | Genera service worker con Workbox |

### Componentes afectados

| Componente | Cambio |
|-----------|--------|
| `vite.config.ts` | Agregar VitePWA plugin |
| `AppShell` | Indicador de estado offline |
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

## Evaluacion y recomendacion

### Matriz de costo/beneficio

| Mitigacion | Reduccion reads | Complejidad | Archivos afectados | Recomendacion |
|-----------|----------------|-------------|-------------------|--------------|
| 1. Offline Persistence | -40% recurrentes | Baja | 1 (firebase.ts) | **Implementar primero** |
| 2. Cache Business View | -60% business view | Media | 6 | **Implementar segundo** |
| 3. Cache listas menu | -30% sesiones largas | Media | 4 | **Implementar tercero** |
| 4. Modo offline completo | N/A (UX) | Media-Alta | 3+ config | **Evaluar post-mitigaciones** |

### Impacto combinado estimado (mitigaciones 1-3)

| Escenario | Sin mitigacion | Con mitigaciones | Reduccion |
|-----------|---------------|-----------------|-----------|
| 100 usuarios, 3 comercios/sesion | 54,000 reads/mes | ~25,000 reads/mes | -54% |
| 200 usuarios, 3 comercios/sesion | 108,000 reads/mes | ~50,000 reads/mes | -54% |

Con las mitigaciones 1-3, la app soporta ~200 usuarios dentro de la cuota gratuita.

### Plan de implementacion priorizado

**Fase 1** — Offline Persistence (mitigacion 1)

- 1 archivo modificado
- Impacto inmediato sin cambiar logica

**Fase 2** — Cache Business View (mitigacion 2)

- Refactor de data fetching en business view
- Mayor impacto en reads

**Fase 3** — Cache listas menu (mitigacion 3)

- Mejora `usePaginatedQuery`
- Complementa fase 2

**Fase 4** (futura) — Modo offline / PWA (mitigacion 4)

- Requiere que fases 1-3 esten estables
- Evaluar si la UX offline justifica la complejidad adicional
- Puede ser un issue separado

---

## Fuera de alcance

- Cambiar estructura de colecciones Firestore (breaking change)
- Migrar a otro backend (Supabase, etc.)
- Server-side aggregation (Cloud Functions para pre-computar datos)
- Firestore bundles (requiere server-side)
- Reduccion de writes (ya estan dentro de cuota)

---

## Criterios de aceptacion

- [ ] Firestore offline persistence habilitada en produccion
- [ ] Persistence deshabilitada en modo DEV (emuladores)
- [ ] Cache client-side para business view con TTL de 5 min
- [ ] Invalidacion de cache al hacer writes
- [ ] Cache de primera pagina en listas del menu con TTL de 2 min
- [ ] 0 regresiones en funcionalidad existente
- [ ] Reads por sesion tipica reducidos >50%
- [ ] 0 errores de lint, build y tests existentes
- [ ] Tests para logica de cache (TTL, invalidacion)
