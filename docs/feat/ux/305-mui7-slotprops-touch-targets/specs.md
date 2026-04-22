# Specs: MUI 7 slotProps + touch targets + 360px overflow

**PRD:** [prd.md](prd.md)
**Issue:** #305

---

## Archivos afectados

### Nuevos (0)

No se crean archivos nuevos. Todos los cambios son ediciones a componentes existentes.

### Modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/business/AddToListDialog.tsx` | S1 slotProps; S8 chip height |
| `src/components/search/SearchListView.tsx` | S1 slotProps; S8 chip height |
| `src/components/home/SpecialsSection.tsx` | S1 slotProps |
| `src/components/profile/RatingsList.tsx` | S1 slotProps |
| `src/components/profile/CommentsListItem.tsx` | S1 slotProps |
| `src/components/profile/PendingActionsSection.tsx` | S1 slotProps |
| `src/components/profile/OnboardingChecklist.tsx` | S1 slotProps |
| `src/components/profile/LocalityPicker.tsx` | S1 slotProps |
| `src/components/lists/EditorsDialog.tsx` | S1 slotProps |
| `src/components/admin/FeaturedListsPanel.tsx` | S1 slotProps |
| `src/components/user/UserProfileContent.tsx` | S1 slotProps |
| `src/components/home/TrendingNearYouSection.tsx` | S2 touch target en "Configurá tu localidad" Button |
| `src/components/home/RecentSearches.tsx` | S2 touch target en "Borrar" Button |
| `src/components/home/ActivityDigestSection.tsx` | S2 touch target en "Ver todas" Button |
| `src/components/business/CommentRow.tsx` | S2 touch targets en IconButtons (like, edit, delete, reply) |
| `src/components/business/FavoriteButton.tsx` | S3 refactor derived state |
| `src/components/layout/TabBar.tsx` | S4 FAB selector stability |
| `src/components/business/BusinessSheetContent.tsx` | S5 setState during render fix |
| `src/components/home/homeSections.ts` | S6 empty state + divider |
| `src/components/home/HomeScreen.tsx` | S6 filtrar secciones vacías para dividers |
| `src/components/home/ForYouSection.tsx` | S6 uniformar empty/loading state |
| `src/components/home/TrendingNearYouSection.tsx` | S6 uniformar loading (Skeleton vs spinner) |
| `src/components/home/RecentSearches.tsx` | S6 adoptar strategy de empty reporting |
| `src/components/business/BusinessHeader.tsx` | S7 noWrap en Typography; S8 chip height |
| `src/components/search/SearchScreen.tsx` | S7 reorganizar ViewToggle vs chips |
| `src/components/profile/StatsCards.tsx` | S7 noWrap en valores |
| `src/components/home/TrendingBusinessCard.tsx` | S8 chip height |
| `src/theme/cards.ts` | S8 agregar `CHIP_SMALL_SX` constante |
| `src/components/home/GreetingHeader.tsx` | S9 component="h1" |
| `src/components/profile/ProfileScreen.tsx` | S9 component="header" Toolbar |
| `src/components/map/LocationFAB.tsx` | S9 usar theme.spacing |
| `src/components/map/OfficeFAB.tsx` | S9 usar theme.spacing |
| `src/components/common/FollowTagChip.tsx` | S9 borderRadius 2 |
| `src/components/business/BusinessSheet.tsx` | S9 onKeyDown en drag handle |

### Tests

| Archivo | Cambio |
|---------|--------|
| `src/components/business/FavoriteButton.test.tsx` | Nuevo — tests de optimistic state sync, memo, error rollback |

---

## Contratos

### S1 — slotProps migration

**Antes:**

```tsx
<ListItemText
  primary={list.name}
  secondary={`${list.itemCount} comercios`}
  primaryTypographyProps={{ fontSize: '0.9rem' }}
  secondaryTypographyProps={{ fontSize: '0.75rem' }}
/>
```

**Despues:**

```tsx
<ListItemText
  primary={list.name}
  secondary={`${list.itemCount} comercios`}
  slotProps={{
    primary: { sx: { fontSize: '0.9rem' } },
    secondary: { sx: { fontSize: '0.75rem' } },
  }}
/>
```

**Nota:** MUI 7 acepta `slotProps` con cualquier prop válida del slot. Para props simples (`fontSize`, `fontWeight`), anidar en `sx`. Para `component`, `display`, etc., pasar directo.

**Referencia canónica:** `src/components/business/CommentRow.tsx:162`.

### S2 — Touch target contract

Todo `<Button variant="text">` o `<IconButton>` debe tener dimensiones mínimas de 44x44px. Patrones aceptados:

```tsx
// Button de texto con padding interno
<Button
  variant="text"
  size="small"
  sx={{ minWidth: 44, minHeight: 44, textTransform: 'none' }}
>
  Borrar
</Button>

// IconButton sin size="small" (default = 48px)
<IconButton aria-label="Cerrar" onClick={handleClose}>
  <CloseIcon />
</IconButton>

// IconButton size="small" con padding compensatorio
<IconButton
  size="small"
  aria-label="Editar"
  sx={{ minWidth: 44, minHeight: 44 }}
>
  <EditIcon sx={{ fontSize: 18 }} />
</IconButton>
```

**No usar** `p: 0` ni `p: 0.25` en botones interactivos.

### S3 — FavoriteButton refactor

**Antes (lines 21-35):**

```tsx
const [optimistic, setOptimistic] = useState<boolean | null>(null);
const [prevIsFavorite, setPrevIsFavorite] = useState(isFavorite);

if (isFavorite !== prevIsFavorite) {
  setPrevIsFavorite(isFavorite);
  setOptimistic(null);
}

const shown = optimistic ?? isFavorite;
```

**Despues:**

```tsx
const [optimistic, setOptimistic] = useState<boolean | null>(null);

// Reset optimistic when prop changes (derived state via useEffect)
useEffect(() => {
  setOptimistic(null);
}, [isFavorite]);

const shown = optimistic ?? isFavorite;
```

**Trade-off aceptado:** un render adicional post-prop-change (setState in effect vs setState in render). El visual no cambia porque el efecto corre sincrónicamente después del commit. Alternativa: eliminar `memo()` si no aporta (requiere medir).

### S4 — TabBar FAB selector stability

**Antes:**

```tsx
sx={{
  '&.Mui-selected': {
    '& .MuiBox-root': { bgcolor: 'primary.dark' },
  },
}}
```

**Despues:** extraer el FAB a componente y usar `className` propio.

```tsx
function SearchFab() {
  const { activeTab } = useTab();
  const isSelected = activeTab === 'buscar';
  return (
    <Box
      className="search-fab"
      sx={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        bgcolor: isSelected ? 'primary.dark' : 'primary.main',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mt: -2.5,
        boxShadow: 3,
      }}
    >
      <SearchIcon sx={{ color: 'primary.contrastText', fontSize: 28 }} />
    </Box>
  );
}

// Uso:
<BottomNavigationAction label="Buscar" icon={<SearchFab />} />
```

### S5 — setState during render

**Antes (BusinessSheetContent.tsx:69-81):**

```tsx
if (initialTab) {
  onTabConsumed?.();
  if (activeTab !== initialTab) {
    setActiveTab(initialTab);
  }
}
if (businessId !== prevBusinessIdRef.current) {
  prevBusinessIdRef.current = businessId;
  if (activeTab !== 'info' && businessId !== null) {
    setActiveTab('info');
  }
}
```

**Despues:**

```tsx
// Consume deep-link tab
useEffect(() => {
  if (initialTab) {
    setActiveTab(initialTab);
    onTabConsumed?.();
  }
}, [initialTab, onTabConsumed]);

// Reset tab on business change
useEffect(() => {
  if (businessId !== prevBusinessIdRef.current) {
    prevBusinessIdRef.current = businessId;
    setActiveTab('info');
  }
}, [businessId]);
```

**Trade-off:** primer render del sheet al cambiar de comercio muestra brevemente el tab anterior antes de resetear a 'info'. Dado que `showSkeleton` oculta el contenido durante `isLoading`, el usuario no percibe el cambio. Se elimina el eslint-disable.

### S6 — Empty sections + dividers

**Opción elegida:** cada sección exporta un marker opcional para reportar empty state; el registry filtra. Implementación minimal:

```ts
// homeSections.ts
export interface HomeSection {
  id: string;
  component: ComponentType;
  hasDividerAfter?: boolean;
  /** Para secciones condicionales, returns true si deberían omitirse + su divider */
  canBeEmpty?: boolean;
}

export const HOME_SECTIONS: HomeSection[] = [
  { id: 'greeting', component: GreetingHeader },
  { id: 'quick-actions', component: QuickActions, hasDividerAfter: true },
  { id: 'specials', component: SpecialsSection, hasDividerAfter: true },
  { id: 'trending-near', component: TrendingNearYouSection, hasDividerAfter: true, canBeEmpty: true },
  { id: 'interests', component: YourInterestsSection, hasDividerAfter: true, canBeEmpty: true },
  { id: 'recent-searches', component: RecentSearches, canBeEmpty: true },
  { id: 'for-you', component: ForYouSection, hasDividerAfter: true, canBeEmpty: true },
  { id: 'digest', component: ActivityDigestSection },
];
```

Complementariamente, cada sección que puede ser vacía usa un wrapper común:

```tsx
// Patrón: en lugar de `if (empty) return null`, renderizar un marker
export default function RecentSearches() {
  const { visits } = useVisitHistory();
  const recent = visits.filter((v) => v.business !== null).slice(0, 4);
  if (recent.length === 0) return <Box data-home-empty="recent-searches" sx={{ display: 'none' }} />;
  // ...resto
}
```

**HomeScreen.tsx** usa IntersectionObserver + `data-home-empty` attribute O más simple: cada sección con empty state expone un hook context que actualiza un Set global de `emptyIds` en `HomeEmptyProvider`. HomeScreen consume y omite el divider.

**Solución simplest (recomendada):** aceptar el approach del `null` return pero hacer que `HomeScreen` use `Children.toArray` y un ref forwarding. Pero el problema es que `null` se renderiza ANTES del divider. La solucion correcta es:

```tsx
// HomeScreen.tsx
const sections = HOME_SECTIONS.map((s) => ({ ...s, isEmpty: /* context state */ }));
return (
  <Box>
    {sections.map((s, i) => (
      <Suspense key={s.id} fallback={null}>
        <Section />
        {s.hasDividerAfter && !isNextSectionEmpty(sections, i) && <Divider />}
      </Suspense>
    ))}
  </Box>
);
```

**Opción pragmática final:** crear `HomeEmptyContext` con setter + Map<id, isEmpty>. Cada sección empty-capable llama `setEmpty(id, true/false)` vía useEffect. HomeScreen lee el Map y omite dividers para secciones vacías **y** para la sección anterior cuando la siguiente está vacía (evitar doble divider sequences).

Alternativa más simple y mantenida en este specs: **eliminar hasDividerAfter**, y en HomeScreen usar un stateful hook que inyecta Dividers entre secciones NO vacías adyacentes. Pero eso requiere rework más amplio.

**Decisión final de specs:** ir con `HomeEmptyContext`. Es simple, localizado, testeable.

```ts
// src/context/HomeEmptyContext.tsx (nuevo)
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Ctx {
  emptyIds: Set<string>;
  setEmpty: (id: string, isEmpty: boolean) => void;
}

const HomeEmptyContext = createContext<Ctx | null>(null);

export function HomeEmptyProvider({ children }: { children: ReactNode }) {
  const [emptyIds, setEmptyIds] = useState<Set<string>>(new Set());
  const setEmpty = useCallback((id: string, isEmpty: boolean) => {
    setEmptyIds((prev) => {
      const next = new Set(prev);
      if (isEmpty) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  return <HomeEmptyContext.Provider value={{ emptyIds, setEmpty }}>{children}</HomeEmptyContext.Provider>;
}

export function useHomeEmpty() {
  const ctx = useContext(HomeEmptyContext);
  if (!ctx) throw new Error('useHomeEmpty must be used within HomeEmptyProvider');
  return ctx;
}
```

Cada sección con `canBeEmpty: true` reporta su estado:

```tsx
// RecentSearches.tsx
const { setEmpty } = useHomeEmpty();
const isEmpty = recent.length === 0;
useEffect(() => {
  setEmpty('recent-searches', isEmpty);
  return () => setEmpty('recent-searches', false);
}, [isEmpty, setEmpty]);

if (isEmpty) return null;
```

`HomeScreen.tsx` consume el context para decidir dividers:

```tsx
export default function HomeScreen() {
  return (
    <HomeEmptyProvider>
      <HomeScreenInner />
    </HomeEmptyProvider>
  );
}

function HomeScreenInner() {
  const { emptyIds } = useHomeEmpty();
  const ratingPrompt = useRatingPrompt();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {HOME_SECTIONS.map(({ id, component: Section, hasDividerAfter }, index) => {
        const isThisEmpty = emptyIds.has(id);
        const showDivider = hasDividerAfter && !isThisEmpty;
        return (
          <Suspense key={id} fallback={null}>
            {index === 1 && ratingPrompt.promptData && (
              <RatingPromptBanner {...} />
            )}
            <Section />
            {showDivider && <Divider sx={{ my: 0.5 }} />}
          </Suspense>
        );
      })}
    </Box>
  );
}
```

### S7 — 360px overflow fixes

**BusinessHeader.tsx:**

```tsx
<Typography
  variant="h6"
  sx={{
    fontWeight: 600,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }}
>
  {business.name}
</Typography>
```

**SearchScreen.tsx:** reorganizar `ViewToggle` de `position: absolute` a un row flex dedicado debajo de FilterChips:

```tsx
<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.5 }}>
  <Box sx={{ flex: 1, overflow: 'auto' }}>
    <FilterChips />
  </Box>
  <ViewToggle mode={viewMode} onChange={setViewMode} />
</Box>
```

Requiere quitar `position: absolute` de ViewToggle.

**StatsCards.tsx (línea 46):** aplicar `noWrap` + tooltip opcional al valor numérico.

### S8 — Chip height unification

**Nueva constante en `src/theme/cards.ts`:**

```ts
import type { SxProps, Theme } from '@mui/material';

export const CHIP_SMALL_SX: SxProps<Theme> = {
  fontSize: '0.7rem',
  height: 24,
};
```

Uso:

```tsx
<Chip label="Tendencia" size="small" sx={CHIP_SMALL_SX} />
```

Aplicar a las 4 ubicaciones detectadas (BusinessHeader, TrendingBusinessCard, SearchListView, AddToListDialog). Eliminar valores únicos de `height: 18/20/24`.

### S9 — Low priority polish

- `GreetingHeader.tsx:22`: `<Typography component="h1" variant="h5" fontWeight={700}>`.
- `ProfileScreen.tsx:72`: `<Toolbar component="header" ...>`.
- `LocationFAB.tsx`, `OfficeFAB.tsx`: reemplazar `bottom: 24` con `(theme) => theme.spacing(3)` + import `TAB_BAR_HEIGHT` + offset derivado.
- `FollowTagChip.tsx:21`: `sx={{ borderRadius: 2 }}` (16px = convention del proyecto).
- `BusinessSheet.tsx` drag handle: agregar `onKeyDown` manejando `Enter` y `Space`.

---

## Testing

### Archivos a testear

| Archivo | Tipo | Tests nuevos |
|---------|------|-------------|
| `src/components/business/FavoriteButton.test.tsx` | Component | Optimistic state sync, memo behavior, toggle with error rollback, offline-aware toggle |

### Casos a cubrir

- [x] FavoriteButton: prop `isFavorite` cambia de `false` a `true` — optimistic se resetea a `null` via useEffect, `shown` refleja prop.
- [x] FavoriteButton: click toggle → optimistic=!prev, call service, on success mantener optimistic hasta prop change.
- [x] FavoriteButton: click toggle con error → rollback optimistic a `null`, mostrar toast error.
- [x] FavoriteButton: modo offline → llamar a `withOfflineSupport` con tipo correcto, no mostrar toast success inmediato.
- [x] CHIP_SMALL_SX: snapshot básico de un Chip renderizado con la constante.

### Mock strategy

- `useAuth()`: mockear con user autenticado.
- `useToast()`: spy en `success/error/info`.
- `useConnectivity()`: mock `isOffline` variable.
- `services/favorites`: spy en `addFavorite`/`removeFavorite`.
- `services/offlineInterceptor`: spy en `withOfflineSupport`.

### Criterio de aceptacion

- Cobertura ≥ 80% de FavoriteButton.tsx.
- Todos los paths condicionales cubiertos (isFavorite true/false, isOffline true/false, error success).
- Tests existentes (CommentRow, EditorsDialog, etc.) NO rompen — los slotProps no cambian el output visible.

---

## Patterns referenced

- **slotProps**: `src/components/business/CommentRow.tsx:162` (canónico).
- **Touch target**: `src/components/home/TrendingNearYouSection.tsx:101-108` (IconButton ya corregido con `minWidth: 44, minHeight: 44`).
- **HomeSection registry**: `src/components/home/homeSections.ts` (extender, no rewrite).
- **derived state con useEffect**: patrón estándar React para sincronizar state con props.
- **chip height constant**: análogo a `cardSx` y `iconCircleSx` en `src/theme/cards.ts`.

---

## Validación pre-merge

- [ ] `npm run build` sin warnings MUI deprecation.
- [ ] `npm run lint` sin errores nuevos; eslint-disables de BusinessSheetContent eliminados.
- [ ] `npm run test:run` pasa (incluye nuevo FavoriteButton test).
- [ ] Visual regression en Chrome DevTools 360x640: HomeScreen scroll, BusinessSheet apertura, SearchScreen toggle.
- [ ] Lighthouse Accessibility >= 95 en HomeScreen y BusinessSheet.
- [ ] Coverage global >= 80%.
