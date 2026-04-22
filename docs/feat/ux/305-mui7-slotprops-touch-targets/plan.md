# Plan: MUI 7 slotProps + touch targets + 360px overflow

**PRD:** [prd.md](prd.md)
**Specs:** [specs.md](specs.md)
**Issue:** #305

---

## Estrategia

Tech debt de UI agrupado en 9 soluciones (S1-S9). Se ejecutan en orden según impacto (Alta → Media → Baja) y acoplamiento (S6 requiere más archivos coordinados). Todos los cambios son localizados y sin dependencias cruzadas con otros features en desarrollo.

**Ramas:** una sola rama `fix/305-mui-ux-debt` desde `new-home`. Sin worktree (cambios no son paralelizables — algunos archivos se tocan en múltiples soluciones, ej: `TrendingNearYouSection.tsx` en S2 y S6).

**Riesgo:** bajo. Sin cambios de API, sin Firestore rules, sin Cloud Functions. Cambios visuales mínimos (touch targets crecen, nombres largos truncan).

---

## Pasos

### 1. Setup

- [ ] Crear rama `fix/305-mui-ux-debt` desde `new-home`.
- [ ] Verificar estado limpio (`git status`).
- [ ] Correr baseline: `npm run test:run`, `npm run build`, anotar warnings MUI actuales.

### 2. S1 — slotProps migration (Alta)

Orden: archivos más simples primero para validar patrón, luego los complejos.

- [ ] `src/components/profile/PendingActionsSection.tsx:146-147` — reemplazar `primaryTypographyProps`/`secondaryTypographyProps` por `slotProps`.
- [ ] `src/components/profile/OnboardingChecklist.tsx:175` — idem.
- [ ] `src/components/profile/LocalityPicker.tsx:150-151` — idem.
- [ ] `src/components/profile/CommentsListItem.tsx:140` — idem.
- [ ] `src/components/profile/RatingsList.tsx:144` — idem.
- [ ] `src/components/lists/EditorsDialog.tsx:113-114` — idem.
- [ ] `src/components/admin/FeaturedListsPanel.tsx:133-134` — idem.
- [ ] `src/components/user/UserProfileContent.tsx:127-128` — idem.
- [ ] `src/components/home/SpecialsSection.tsx:141-142` — idem.
- [ ] `src/components/search/SearchListView.tsx:42` — idem.
- [ ] `src/components/business/AddToListDialog.tsx:173-174` — idem.
- [ ] Correr `npm run build` — confirmar que warnings MUI deprecation desaparecieron.
- [ ] Correr `npm run test:run` — ningún test debe romperse.
- [ ] Commit: `fix(#305): migrate primaryTypographyProps to slotProps (11 files)`.

### 3. S2 — Touch targets WCAG (Alta)

- [ ] `src/components/home/RecentSearches.tsx`: Button "Borrar" — reemplazar `sx={{ minWidth: 0, p: 0, color: 'text.disabled', fontSize: '0.75rem', textTransform: 'none' }}` con `sx={{ minWidth: 44, minHeight: 44, color: 'text.disabled', fontSize: '0.75rem', textTransform: 'none', px: 1 }}`.
- [ ] `src/components/home/ActivityDigestSection.tsx`: Button "Ver todas" — mismo ajuste (`minWidth: 44, minHeight: 44`).
- [ ] `src/components/home/TrendingNearYouSection.tsx`: Button "Configurá tu localidad" — mismo ajuste.
- [ ] `src/components/business/CommentRow.tsx:174`: IconButton like — mantener `size="small"` pero agregar `sx={{ minWidth: 44, minHeight: 44 }}` (reemplazar `p: 0.5`).
- [ ] `src/components/business/CommentRow.tsx:234,243`: IconButtons edit/delete — idem.
- [ ] Correr `npm run test:run`.
- [ ] Commit: `fix(#305): enforce 44x44 touch targets (WCAG 2.5.5)`.

### 4. S3 — FavoriteButton derived state refactor (Alta)

- [ ] Editar `src/components/business/FavoriteButton.tsx`:
  - Remover `const [prevIsFavorite, setPrevIsFavorite] = useState(isFavorite);`.
  - Remover el bloque `if (isFavorite !== prevIsFavorite) { ... }` de render.
  - Agregar `useEffect(() => { setOptimistic(null); }, [isFavorite]);`.
- [ ] Crear `src/components/business/FavoriteButton.test.tsx` con casos:
  - Render básico (isFavorite=true, false).
  - Click toggle llama a `addFavorite` cuando no favorito.
  - Click toggle llama a `removeFavorite` cuando favorito.
  - Error de servicio → rollback optimistic + toast error.
  - Prop `isFavorite` cambia → `shown` refleja nueva prop (optimistic reseteado).
  - Modo offline → llama `withOfflineSupport` con tipo correcto.
- [ ] Correr `npm run test:run -- FavoriteButton`.
- [ ] Correr `npm run test:coverage` — verificar >= 80% en FavoriteButton.
- [ ] Commit: `fix(#305): refactor FavoriteButton derived state to useEffect + tests`.

### 5. S4 — TabBar FAB selector stability (Alta)

- [ ] Editar `src/components/layout/TabBar.tsx`:
  - Extraer el `Box` del FAB a componente `SearchFab` dentro del mismo archivo.
  - `SearchFab` consume `useTab()` y decide `bgcolor` según `activeTab === 'buscar'`.
  - Eliminar el `sx` con selector `.Mui-selected .MuiBox-root`.
- [ ] Correr `npm run test:run` — ningún test de navegación debe romperse.
- [ ] Verificar visual en DevTools: el FAB mantiene el `primary.dark` cuando la tab Buscar está activa.
- [ ] Commit: `fix(#305): stabilize TabBar FAB with dedicated component`.

### 6. S5 — setState during render fix (Media)

- [ ] Editar `src/components/business/BusinessSheetContent.tsx:66-81`:
  - Remover los dos bloques de `if` con setState inline.
  - Remover los dos `eslint-disable` asociados.
  - Agregar dos `useEffect`:

    ```tsx
    useEffect(() => {
      if (initialTab) {
        setActiveTab(initialTab);
        onTabConsumed?.();
      }
    }, [initialTab, onTabConsumed]);

    useEffect(() => {
      if (businessId !== prevBusinessIdRef.current) {
        prevBusinessIdRef.current = businessId;
        setActiveTab('info');
      }
    }, [businessId]);
    ```

- [ ] Correr `npm run test:run` — ningún test de BusinessSheet debe romperse.
- [ ] Verificar manual: abrir business, cambiar tab a Opiniones, cerrar, abrir otro business → inicia en Info.
- [ ] Verificar manual: deep link `?business=X&sheetTab=opiniones` → abre directo en Opiniones.
- [ ] Commit: `fix(#305): remove setState during render in BusinessSheetContent`.

### 7. S6 — Empty state + divider fix (Media)

- [ ] Crear `src/context/HomeEmptyContext.tsx` con `HomeEmptyProvider` y `useHomeEmpty` hook.
- [ ] Editar `src/components/home/homeSections.ts`:
  - Agregar `canBeEmpty?: boolean` a interface `HomeSection`.
  - Marcar `trending-near`, `interests`, `recent-searches`, `for-you` con `canBeEmpty: true`.
- [ ] Editar `src/components/home/HomeScreen.tsx`:
  - Wrappear el Box con `<HomeEmptyProvider>`.
  - Extraer el body a `HomeScreenInner`.
  - En `HomeScreenInner`, leer `emptyIds` y decidir `showDivider = hasDividerAfter && !emptyIds.has(id)`.
- [ ] Editar secciones con `canBeEmpty`:
  - `ForYouSection.tsx`: agregar `useEffect` para reportar empty; uniformar loading a `Skeleton` si aplica.
  - `TrendingNearYouSection.tsx`: agregar `useEffect`; uniformar loading a `Skeleton`.
  - `RecentSearches.tsx`: agregar `useEffect`.
  - `YourInterestsSection.tsx`: agregar `useEffect` si la sección puede ser vacía.
- [ ] Correr `npm run test:run`.
- [ ] Verificar manual en HomeScreen: simular estado con secciones vacías (logout, sin recents) → no hay dividers huérfanos.
- [ ] Commit: `fix(#305): HomeEmptyContext to skip dividers for empty sections`.

### 8. S7 — 360px overflow fixes (Media)

- [ ] Editar `src/components/business/BusinessHeader.tsx`: agregar `overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'` al Typography del nombre.
- [ ] Editar `src/components/search/SearchScreen.tsx`:
  - Mover `<ViewToggle />` fuera de `position: absolute`.
  - Crear fila flex con FilterChips + ViewToggle lado a lado.
  - Eliminar `position: absolute`, `top`, `right`, `zIndex`, `boxShadow` del `sx` de ViewToggle.
  - Ajustar el `top` del contenedor `<Box>` de vista lista para no restar el espacio del toggle absoluto.
- [ ] Editar `src/components/profile/StatsCards.tsx:46`: aplicar `noWrap` al Typography del valor numérico.
- [ ] Verificar en DevTools 360x640: nombres largos truncan con ellipsis, ViewToggle y chips no se superponen.
- [ ] Commit: `fix(#305): prevent overflow in BusinessHeader + SearchScreen + StatsCards (360px)`.

### 9. S8 — Chip height unification (Media)

- [ ] Editar `src/theme/cards.ts`: agregar export `CHIP_SMALL_SX` con `{ fontSize: '0.7rem', height: 24 }`.
- [ ] Editar `src/components/business/BusinessHeader.tsx:30,38`: reemplazar `sx={{ fontSize: '0.75rem', height: 24 }}` por `sx={CHIP_SMALL_SX}`.
- [ ] Editar `src/components/home/TrendingBusinessCard.tsx:67`: reemplazar `sx={{ fontSize: '0.7rem', height: 24 }}` por `sx={CHIP_SMALL_SX}`.
- [ ] Editar `src/components/search/SearchListView.tsx:35`: reemplazar `sx={{ height: 20, fontSize: '0.7rem' }}` por `sx={CHIP_SMALL_SX}` (unifica a 24).
- [ ] Editar `src/components/business/AddToListDialog.tsx:168`: reemplazar `sx={{ height: 18, fontSize: '0.6rem' }}` por `sx={CHIP_SMALL_SX}` (unifica a 24).
- [ ] Verificar visual: chips mantienen legibilidad, altura consistente en toda la app.
- [ ] Commit: `fix(#305): unify Chip size="small" height via CHIP_SMALL_SX`.

### 10. S9 — Low priority polish (Baja, opcional)

- [ ] `src/components/home/GreetingHeader.tsx:22`: `component="h1"` al Typography.
- [ ] `src/components/profile/ProfileScreen.tsx:72`: `component="header"` al Toolbar.
- [ ] `src/components/map/LocationFAB.tsx`: reemplazar `bottom: 24` por `(theme) => theme.spacing(3)` + sumar `TAB_BAR_HEIGHT` desde `'../layout/TabBar'`.
- [ ] `src/components/map/OfficeFAB.tsx`: idem.
- [ ] `src/components/common/FollowTagChip.tsx:21`: `borderRadius: 2`.
- [ ] `src/components/business/BusinessSheet.tsx`: agregar `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeSheet(); } }}` al drag handle + `tabIndex={0}` si no lo tiene.
- [ ] Commit: `fix(#305): landmark semantics + theme tokens + polish`.

### 11. Tests + coverage

- [ ] Correr `npm run test:run` completo — todos los tests pasan.
- [ ] Correr `npm run test:coverage` — confirmar >= 80% global.
- [ ] Si coverage del nuevo FavoriteButton.test.tsx < 80%, agregar casos faltantes.

### 12. Build + lint

- [ ] `npm run lint` — sin nuevos errores; los 2 eslint-disable de BusinessSheetContent ya NO están.
- [ ] `npm run build` — sin warnings MUI deprecation; sin errores TS.

### 13. Actualizar docs

- [ ] `docs/reference/patterns.md`: agregar nota sobre `CHIP_SMALL_SX` en la sección "UI patterns".
- [ ] `docs/reference/patterns.md`: agregar nota sobre `HomeEmptyContext` en la sección "HOME_SECTIONS registry".
- [ ] `docs/_sidebar.md`: agregar entry PRD/Specs/Plan bajo categoria **UX**.
- [ ] `docs/reports/tech-debt.md`: marcar #305 como resolved post-merge.

### 14. Verificación final manual (Chrome DevTools 360x640)

- [ ] HomeScreen: scroll, sin dividers huérfanos, todos los botones >= 44px.
- [ ] BusinessSheet: abrir comercio con nombre largo → truncado con ellipsis; apertura deep-link en Opiniones → funciona.
- [ ] SearchScreen: ViewToggle visible sin superponerse a chips; cambio map↔list sin flicker.
- [ ] FavoriteButton: toggle 5 veces rápido → UI responde sin desynchronizar con server.
- [ ] TabBar: FAB en "Buscar" se oscurece correctamente.
- [ ] Lighthouse Accessibility >= 95 en Home y BusinessSheet.

### 15. PR

- [ ] Push rama `fix/305-mui-ux-debt`.
- [ ] Crear PR con título `fix(#305): MUI 7 slotProps + touch targets + 360px overflow + architecture polish`.
- [ ] Body: referenciar PRD/Specs, listar las 9 soluciones con check status, incluir screenshots before/after de HomeScreen 360px y BusinessHeader con nombre largo.
- [ ] Asignar labels `enhancement`, `ux`.

### 16. Merge

- [ ] Invocar `/merge` skill después de aprobación.
- [ ] Post-merge: cerrar issue #305 con mensaje de referencia a commit + v2.x.y.
- [ ] Verificar deploy a producción (GH Actions workflow).
- [ ] Smoke test en `https://modo-mapa-app.web.app` en mobile real o emulador.

---

## Consideraciones

### Dependencias entre pasos

- S6 (HomeEmptyContext) debe hacerse DESPUÉS o JUNTO CON S2 (touch targets) porque ambos tocan `RecentSearches.tsx`, `TrendingNearYouSection.tsx`, `ActivityDigestSection.tsx`, `ForYouSection.tsx`.
- S8 (chip height) puede tocar `BusinessHeader.tsx` junto con S7 (overflow fix) — hacerlos en el mismo commit evita re-edición.
- S3 (FavoriteButton) y S4 (TabBar) son independientes entre sí y de los demás.

### Rollback strategy

- Si S6 (HomeEmptyContext) introduce regresión (secciones tardan en aparecer, dividers inconsistentes), revertir solo ese commit. Las demás soluciones son completamente aisladas.
- Si S3 (FavoriteButton refactor) rompe optimistic UI, revertir a versión con `memo` + derived state y documentar como intentional tech debt pendiente.

### Compatibilidad

- Ningún cambio afecta Firestore, Cloud Functions, rules, ni APIs externas.
- Sin breaking changes en props públicas (ni `BusinessSheetContent` ni `FavoriteButton` tienen consumers externos relevantes).
- Service worker cache se invalida automáticamente por version bump en deploy.

### Deuda no resuelta

- Muchos `fontSize: '0.75rem'` hardcodeados siguen sin migrar a `variant="caption"` — audit completo queda fuera de scope (mencionado en #305 como Low).
- `BusinessSheet.tsx` drag handle añade `onKeyDown` pero no se rediseña — rework completo fuera de scope.
- `LocationFAB` / `OfficeFAB` siguen con `bottom` hardcoded aun si se migra a theme.spacing — sincronizarlo con `TAB_BAR_HEIGHT` dinámicamente requiere más trabajo (valor estático aceptable por ahora).
