# Specs: Pull-to-refresh global

**Feature:** pull-to-refresh
**Issue:** #146
**Fecha:** 2026-03-16

---

## Estado actual

- Rankings tiene botón manual de refresh con `refetch()` de `useAsyncData`.
- FavoritesList, CommentsList, RatingsList usan `usePaginatedQuery` con `reload()`.
- RecentVisits usa localStorage (no Firestore).
- No existe hook ni componente de pull-to-refresh gesture.
- `useSwipeActions` existe para swipe horizontal en items, no para pull vertical.

---

## Cambios

### 1. Crear hook usePullToRefresh

**Archivo nuevo:** `src/hooks/usePullToRefresh.ts`

```typescript
interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // px to trigger, default 80
}

interface UsePullToRefreshReturn {
  containerRef: RefObject<HTMLDivElement>;
  isRefreshing: boolean;
  pullProgress: number; // 0-1
}
```

- Detectar touch start/move/end en el contenedor.
- Solo activar si `scrollTop === 0` (al tope del scroll).
- Mostrar indicador visual de progreso (pull distance / threshold).
- Al superar threshold y soltar, ejecutar `onRefresh()`.
- Mostrar spinner durante `onRefresh()`.

### 2. Crear componente PullToRefreshWrapper

**Archivo nuevo:** `src/components/common/PullToRefreshWrapper.tsx`

- Wrapper que encapsula el hook y renderiza el indicador visual.
- Indicador: `CircularProgress` de MUI con opacidad proporcional al pull.
- Props: `onRefresh`, `disabled`, `children`.

### 3. Integrar en FavoritesList

**Archivo:** `src/components/menu/FavoritesList.tsx`

- Wrappear el contenido con `<PullToRefreshWrapper onRefresh={reload}>`.

### 4. Integrar en CommentsList

**Archivo:** `src/components/menu/CommentsList.tsx`

- Wrappear con `<PullToRefreshWrapper onRefresh={reload}>`.

### 5. Integrar en RatingsList

**Archivo:** `src/components/menu/RatingsList.tsx`

- Wrappear con `<PullToRefreshWrapper onRefresh={reload}>`.

### 6. Integrar en RankingsView

**Archivo:** `src/components/menu/RankingsView.tsx`

- Wrappear con `<PullToRefreshWrapper onRefresh={refetch}>`.
- Mantener el botón de refresh existente como alternativa.

---

## Archivos

| Archivo | Acción |
|---------|--------|
| `src/hooks/usePullToRefresh.ts` | **Nuevo** |
| `src/components/common/PullToRefreshWrapper.tsx` | **Nuevo** |
| `src/components/menu/FavoritesList.tsx` | Integrar wrapper |
| `src/components/menu/CommentsList.tsx` | Integrar wrapper |
| `src/components/menu/RatingsList.tsx` | Integrar wrapper |
| `src/components/menu/RankingsView.tsx` | Integrar wrapper |

---

## Decisiones

1. **Hook propio** — no instalar librería externa, el gesto es simple.
2. **Solo touch** — no mouse, es feature mobile-first.
3. **Threshold 80px** — distancia estándar en apps nativas.
4. **No en RecentVisits** — usa localStorage, no Firestore, no hay que refetchear.
5. **No en el mapa** — interfiere con pan/zoom del mapa.
