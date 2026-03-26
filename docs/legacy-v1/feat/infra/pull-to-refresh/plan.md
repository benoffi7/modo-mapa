# Plan: Pull-to-refresh global

**Feature:** pull-to-refresh
**Issue:** #146

---

## Paso 1: Crear usePullToRefresh hook

- Detectar touchstart/touchmove/touchend.
- Solo activar si scrollTop === 0.
- Calcular pullProgress y trigger al superar threshold.

## Paso 2: Crear PullToRefreshWrapper

- Componente wrapper con indicador visual (CircularProgress).
- Renderizar spinner durante refresh.

## Paso 3: Integrar en FavoritesList

- Wrappear con PullToRefreshWrapper + reload.

## Paso 4: Integrar en CommentsList

- Wrappear con PullToRefreshWrapper + reload.

## Paso 5: Integrar en RatingsList

- Wrappear con PullToRefreshWrapper + reload.

## Paso 6: Integrar en RankingsView

- Wrappear con PullToRefreshWrapper + refetch.

## Paso 7: Tests

- Test del hook con eventos touch simulados.

---

## Criterios de merge

- [ ] Pull-to-refresh funciona en FavoritesList, CommentsList, RatingsList, RankingsView
- [ ] Indicador visual de progreso durante el pull
- [ ] Spinner durante el refresh
- [ ] No se activa si no estás al tope del scroll
- [ ] No interfiere con scroll normal ni swipe actions
- [ ] Lint y tests pasan
