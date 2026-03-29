# PRD: Mover import de firebase/firestore fuera de ReceivedRecommendations.tsx

**Feature:** firebase-import-recommendations
**Categoria:** infra
**Fecha:** 2026-03-28
**Issue:** #221
**Prioridad:** Baja

---

## Contexto

El proyecto tiene una convencion documentada en `patterns.md` (Service layer) que establece que solo `src/services/`, `src/config/`, `src/context/` y `src/hooks/` pueden importar del SDK de Firebase. `ReceivedRecommendations.tsx` (un componente de UI) importa `where` y `QueryConstraint` directamente de `firebase/firestore`, violando esta convencion.

## Problema

- `ReceivedRecommendations.tsx` importa `where` de `firebase/firestore` para construir query constraints en linea 9
- Tambien importa `QueryConstraint` como tipo en linea 10 (aunque `import type` no acopla en runtime, la convencion pide que componentes no referencien el SDK)
- Esto acopla un componente de UI directamente al SDK de Firestore, dificultando testing y violando la separacion de capas

## Solucion

### S1. Mover la construccion de constraints al servicio de recomendaciones

Agregar una funcion en `src/services/recommendations.ts` que construya los `QueryConstraint[]` necesarios para las recomendaciones recibidas por un usuario. Algo como `getReceivedRecommendationsConstraints(userId: string)` que retorne el array con `where('recipientId', '==', userId)`.

El tipo de retorno puede ser el generico de Firestore (`QueryConstraint[]`) ya que el servicio si puede importar del SDK.

### S2. Actualizar ReceivedRecommendations.tsx

Reemplazar los imports de `firebase/firestore` por una llamada a la nueva funcion del servicio. El `useMemo` de constraints pasa a llamar al servicio en vez de construir el `where` directamente.

### S3. Verificar que no queden otros componentes con imports similares

Auditar que ningun otro componente de `src/components/` importe directamente de `firebase/firestore` (excepto `import type` si fuera estrictamente necesario para tipado de props, aunque es preferible re-exportar los tipos desde services/hooks).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Nueva funcion en `services/recommendations.ts` | Alta | S |
| Actualizar imports en `ReceivedRecommendations.tsx` | Alta | S |
| Auditar otros componentes por imports similares | Baja | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Refactorizar la logica de `usePaginatedQuery` o cambiar como recibe constraints
- Mover mas logica fuera del componente (ej: el `handleClick` o el `markAllRecommendationsAsRead`)
- Agregar una regla de ESLint para prevenir imports de firebase en componentes
- Cambios en `useUnreadRecommendations.ts` (ya sigue la convencion correctamente, delegando a `services/recommendations.ts`)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/recommendations.ts` | Service | La nueva funcion retorna constraints correctos para un userId dado, y un array vacio si no hay userId |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

Nota: el esfuerzo de testing es minimo ya que la nueva funcion es un wrapper simple. Los tests existentes de `usePaginatedQuery` y el componente no deberian requerir cambios.

---

## Seguridad

No hay impacto en seguridad. Este cambio es puramente de organizacion de codigo. No se modifica ninguna query, no se cambian colecciones, no se agregan inputs de usuario.

- [ ] Sin imports del SDK en componentes de UI (este es el objetivo del issue)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Query de recomendaciones recibidas | read | Sin cambio (Firestore persistent cache) | Sin cambio |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline? -- Si, sin cambios
- [x] Writes: tienen queue offline o optimistic UI? -- N/A, no hay writes nuevos
- [x] APIs externas: hay manejo de error de red? -- N/A
- [x] UI: hay indicador de estado offline en contextos relevantes? -- Sin cambios
- [x] Datos criticos: disponibles en cache para primera carga? -- Sin cambios

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion

Este issue es precisamente sobre mejorar la modularizacion. El cambio mueve logica de construccion de queries fuera de un componente de UI hacia el service layer.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) -- objetivo del issue
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout -- N/A, no hay componentes nuevos
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu -- N/A
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout -- sin cambios
- [x] Cada prop de accion (onClick, onSelect, onNavigate) tiene un handler real especificado -- sin cambios

---

## Success Criteria

1. `ReceivedRecommendations.tsx` no tiene ningun import de `firebase/firestore` (ni runtime ni tipo)
2. La funcionalidad de la pantalla de recomendaciones recibidas no cambia (misma query, mismos resultados)
3. La nueva funcion en `services/recommendations.ts` es simple y bien tipada
4. No hay regresiones en los tests existentes
5. No quedan otros componentes en `src/components/` con imports directos de `firebase/firestore`
