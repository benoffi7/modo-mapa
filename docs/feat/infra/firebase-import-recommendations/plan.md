# Plan: Mover import de firebase/firestore fuera de ReceivedRecommendations.tsx

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Nueva funcion en el servicio

**Branch:** `fix/firebase-import-recommendations`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/recommendations.ts` | Agregar funcion `getReceivedRecommendationsConstraints(userId: string \| undefined): QueryConstraint[]`. Implementacion: si `!userId` retorna `[]`, sino retorna `[where('recipientId', '==', userId)]`. Agregar export. No se necesitan imports nuevos ya que `where` y `QueryConstraint` ya estan importados. |
| 2 | `src/services/recommendations.test.ts` | Agregar `describe('getReceivedRecommendationsConstraints')` con 3 tests: userId valido retorna array con 1 constraint y llama `where` con args correctos, undefined retorna `[]`, string vacio retorna `[]`. Importar la nueva funcion en el bloque de imports existente (linea 36). |

### Fase 2: Actualizar componente

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `src/components/menu/ReceivedRecommendations.tsx` | Eliminar linea 9 (`import { where } from 'firebase/firestore'`) y linea 10 (`import type { QueryConstraint } from 'firebase/firestore'`). Agregar `getReceivedRecommendationsConstraints` al import existente de `../../services/recommendations` (linea 14). Reemplazar el `useMemo` de constraints (lineas 41-44) por: `const constraints = useMemo(() => getReceivedRecommendationsConstraints(userId), [userId])`. |

### Fase 3: Verificacion y lint

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | N/A | Ejecutar `npx eslint src/components/menu/ReceivedRecommendations.tsx src/services/recommendations.ts` para verificar que no hay errores de lint. |
| 5 | N/A | Ejecutar `npm run test:run -- --reporter=verbose recommendations` para verificar tests existentes + nuevos. |
| 6 | N/A | Ejecutar `grep -r "from 'firebase/firestore'" src/components/` para confirmar que solo queda el `import type` en FollowedList.tsx. |

---

## Orden de implementacion

1. `src/services/recommendations.ts` -- agregar funcion (sin dependencias)
2. `src/services/recommendations.test.ts` -- agregar tests de la nueva funcion
3. `src/components/menu/ReceivedRecommendations.tsx` -- actualizar imports y useMemo
4. Lint + tests + auditoria de imports residuales

---

## Estimacion de archivos

| Archivo | Lineas actuales | Lineas nuevas | Total estimado | Accion |
|---------|----------------|---------------|----------------|--------|
| `src/services/recommendations.ts` | 129 | +4 | ~133 | OK |
| `src/services/recommendations.test.ts` | 163 | +20 | ~183 | OK |
| `src/components/menu/ReceivedRecommendations.tsx` | 140 | -3 (neto) | ~137 | OK |

---

## Riesgos

1. **Regresion en usePaginatedQuery:** El tipo de retorno de `getReceivedRecommendationsConstraints` es `QueryConstraint[]`, identico a lo que el componente construia inline. `usePaginatedQuery` acepta `QueryConstraint[]`, por lo que no hay riesgo de incompatibilidad de tipos.

2. **FollowedList.tsx import type residual:** No se toca en este PR. Si un linter futuro lo flaggea, hay un issue separado para resolverlo.

---

## Criterios de done

- [x] All items from PRD scope implemented
- [ ] `ReceivedRecommendations.tsx` no tiene ningun import de `firebase/firestore`
- [ ] La nueva funcion `getReceivedRecommendationsConstraints` existe y esta exportada en `src/services/recommendations.ts`
- [ ] Tests pasan con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds
- [ ] No quedan otros componentes en `src/components/` con imports runtime de `firebase/firestore`
