# PRD: Performance: dynamic import image-compression, parallelize fetchUserLikes, split AuthContext

**Feature:** 245-performance-improvements
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #245
**Prioridad:** Media

---

## Contexto

Una auditoria de performance del bundle y runtime detecto cinco oportunidades de mejora con diferente impacto. El proyecto ya tiene precedentes de optimizacion de carga (lazy loading de admin, Sentry via dynamic import, lazy analytics) pero quedan tres areas de impacto significativo: `browser-image-compression` importado estaticamente (30KB innecesarios en main bundle), `fetchUserLikes` con batches secuenciales (latencia multiplicada por cantidad de batches), y AuthContext causando re-renders en 22+ componentes. Tambien hay 8 funciones exportadas pero nunca importadas (dead code) y `recharts` cargado para StatsView user-facing.

## Problema

- **P2: browser-image-compression importado estaticamente** — `MenuPhotoUpload.tsx` importa ~30KB de `browser-image-compression` en el bundle principal, pero la compresion solo se necesita cuando el usuario sube una foto. Un dynamic import reduciria el main chunk.
- **P10: fetchUserLikes corre batches secuenciales** — `businessData.ts` usa un `for` loop secuencial para ejecutar batches de `documentId('in')` de 30. Si un comercio tiene 90 likes, son 3 queries secuenciales en vez de paralelas. `Promise.all` reduciria la latencia.
- **P5: AuthContext causa re-renders en 22+ componentes** — El contexto expone 17 campos y es consumido por componentes que solo necesitan `user` o `displayName`. Cualquier cambio en cualquier campo re-renderiza todos los consumidores. Splitear en `AuthStateContext` (datos) + `AuthActionsContext` (funciones) reduciria re-renders innecesarios.
- **P15: 8 funciones exportadas nunca importadas** — Dead code: `deleteAchievement`, `addFavoritesBatch`, `fetchUserFavoriteIds`, `fetchFollowers`, `copyList`, `deleteSpecial`, `invalidatePriceLevelCache`, `formatDateFull`.
- **P1: recharts cargado para StatsView** — 110KB gzip de `recharts` se carga para la seccion de estadisticas que es user-facing. Considerar lazy load o alternativa ligera.

## Solucion

### S1. Dynamic import de browser-image-compression

Cambiar el import estatico en `MenuPhotoUpload.tsx` a `const { default: imageCompression } = await import('browser-image-compression')` dentro de la funcion de upload. Sigue el patron existente de lazy Sentry (`import()` dinamico). El tipo se puede importar estaticamente con `import type`.

### S2. Paralelizar batches en fetchUserLikes

Reemplazar el `for` loop secuencial en `fetchUserLikes` (en `businessData.ts` o `services/comments.ts`) con `Promise.all(batches.map(...))`. Cada batch de 30 IDs se ejecuta en paralelo. No hay dependencia entre batches.

### S3. Split AuthContext en State + Actions

Crear `AuthStateContext` (user, displayName, avatarId, isAnonymous, isAdmin, authMethod, loading, error) y `AuthActionsContext` (login, register, logout, updateDisplayName, updateAvatar, deleteAccount, etc.). Los componentes que solo leen datos del usuario consumen `useAuthState()`. Los que necesitan acciones consumen `useAuthActions()`. El wrapper `useAuth()` existente puede mantenerse para backward compatibility consumiendo ambos.

Referencia de patron: este split sigue la recomendacion oficial de React para contextos con muchos consumidores. El proyecto ya tiene precedente con `ConnectivityContext` (estado separado de acciones).

### S4. Eliminar funciones dead code

Eliminar las 8 funciones exportadas que no se importan en ningun lugar del proyecto. Verificar con grep antes de eliminar.

### S5. Lazy load recharts para StatsView

Wrappear el import de `recharts` en `StatsView` con `React.lazy()` y `Suspense`, o usar dynamic `import()` para los componentes de grafico. Sigue el patron de lazy loading del admin panel.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Dynamic import de browser-image-compression en MenuPhotoUpload | Must | S |
| Paralelizar batches en fetchUserLikes con Promise.all | Must | S |
| Split AuthContext en AuthStateContext + AuthActionsContext | Should | M |
| Eliminar 8 funciones dead code | Should | S |
| Lazy load recharts para StatsView | Could | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Optimizar el tamano de recharts (tree-shaking, alternativas como lightweight charts)
- Profile y optimizar otros re-renders no relacionados con AuthContext
- Server-side rendering o streaming SSR
- Bundle splitting mas alla de los items especificos
- Cambios en la API publica de AuthContext (backward compat via wrapper)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/menu/MenuPhotoUpload.tsx` | Unit | Que la compresion funciona correctamente con dynamic import |
| `src/hooks/useBusinessData.ts` o `src/services/businessData.ts` | Unit | Que fetchUserLikes devuelve los mismos resultados con batches paralelos |
| `src/context/AuthContext.tsx` | Unit | Que AuthStateContext y AuthActionsContext exponen los valores correctos |
| `src/context/AuthContext.test.tsx` | Unit | Actualizar tests existentes (35 cases) para el nuevo split |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

- [ ] El dynamic import de browser-image-compression no introduce nuevos surface areas
- [ ] El split de AuthContext no expone datos de auth en contextos con permisos mas amplios
- [ ] La eliminacion de dead code no remueve funciones que se usan indirectamente (verificar con grep)
- [ ] `fetchUserLikes` paralelo no cambia la semantica de la query (mismos resultados)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A | N/A — optimizaciones internas sin nuevas superficies | Preservar validaciones existentes |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #243 Service layer violations | Prerequisito parcial | #243 extrae writes de AuthContext a services; conviene hacer #243 antes del split de #245 |
| #195 Component decomposition | Precedente | #195 extrajo hooks de componentes; #245 extiende la descomposicion a AuthContext |

### Mitigacion incorporada

- Se eliminan 8 funciones dead code que agregan peso innecesario al bundle
- Se reduce el main chunk en ~30KB (image-compression) + ~110KB potencial (recharts lazy)
- Se mejora la testability de AuthContext al separar estado de acciones

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| browser-image-compression import | read (module) | Cached por service worker | Fallback: upload sin compresion o error |
| fetchUserLikes | read | Firestore persistent cache | Datos de cache stale |
| recharts lazy load | read (module) | Cached por service worker | Skeleton loader |

### Checklist offline

- [ ] Dynamic import de browser-image-compression: manejar error de red si el chunk no esta cacheado
- [x] fetchUserLikes: ya usa Firestore persistent cache
- [ ] recharts lazy: agregar Suspense fallback para carga offline
- [x] UI: no hay cambios en indicador offline
- [x] Datos criticos: no afecta datos criticos

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

Este feature mejora significativamente la modularizacion: split de AuthContext reduce el god-context mas grande del proyecto, y la eliminacion de dead code reduce peso innecesario.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (AuthContext split separa estado de acciones)
- [x] Componentes nuevos son reutilizables (N/A)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas
- [x] Cada prop de accion tiene un handler real especificado
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta (context/)
- [x] Si el feature necesita estado global: usa contextos existentes (refactoreados)
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | AuthContext split reduce re-renders innecesarios en 22+ componentes |
| Estado global | - | God-context de 17 campos se splitea en 2 contextos especializados |
| Firebase coupling | = | Sin cambios (imports ya estan en services/context) |
| Organizacion por dominio | - | Dead code eliminado, imports mas limpios |

---

## Success Criteria

1. `browser-image-compression` no aparece en el main chunk de Vite (verificable con `vite-bundle-visualizer`)
2. `fetchUserLikes` ejecuta batches en paralelo con `Promise.all`, reduciendo latencia proporcional a la cantidad de batches
3. AuthContext splitado en AuthStateContext + AuthActionsContext, con `useAuth()` wrapper para backward compatibility
4. Las 8 funciones dead code eliminadas y ningun test falla
5. StatsView carga recharts via lazy import con Suspense fallback
