# Technical Plan — Firebase Analytics

**Issue:** [#57](https://github.com/benoffi7/modo-mapa/issues/57)
**Fecha:** 2026-03-13

---

## Orden de implementación

### Paso 1: Core — `analytics.ts` + init en `firebase.ts`

**Crear** `src/utils/analytics.ts`:

- `initAnalytics(app)` — dynamic import de `firebase/analytics`, solo PROD
- `trackEvent(name, params?)` — no-op si analytics es null
- `setUserProperty(name, value)` — no-op si analytics es null

**Modificar** `src/config/firebase.ts`:

- Importar `initAnalytics` desde `../utils/analytics`
- Llamar `initAnalytics(app)` al final del archivo (fuera del if/else)

**Verificar**: `npx tsc --noEmit -p tsconfig.app.json` pasa.

### Paso 2: Screen tracking — `useScreenTracking` hook

**Crear** `src/hooks/useScreenTracking.ts`:

- Hook que usa `useLocation()` y llama `trackEvent('screen_view', ...)` en cada cambio de pathname
- Mapea pathname a screen_name legible

**Modificar** `src/App.tsx`:

- Importar y llamar `useScreenTracking()` dentro de `App()`

**Nota**: `useScreenTracking` debe estar dentro de `<BrowserRouter>` (ya lo está porque App está wrapeado en BrowserRouter en main.tsx).

### Paso 3: User properties — auth_type + theme

**Modificar** `src/context/AuthContext.tsx`:

- Después de sign-in exitoso, llamar `setUserProperty('auth_type', ...)`

**Modificar** `src/context/ColorModeContext.tsx`:

- Cuando cambia el modo, llamar `setUserProperty('theme', mode)`

### Paso 4: Eventos en service layer (11 eventos)

Agregar `trackEvent` al final de cada función de servicio, después del write exitoso:

1. `services/ratings.ts` → `upsertRating`
2. `services/favorites.ts` → `addFavorite`, `removeFavorite`
3. `services/comments.ts` → `addComment`, `editComment`, `likeComment`
4. `services/tags.ts` → `addUserTag`, `createCustomTag`
5. `services/priceLevels.ts` → `upsertPriceLevel`
6. `services/menuPhotos.ts` → `uploadMenuPhoto`
7. `services/feedback.ts` → `sendFeedback`

### Paso 5: Eventos en components (9 eventos)

1. `BusinessSheet.tsx` — `business_view` en el useEffect existente
2. `SearchBar.tsx` — `business_search` en onBlur
3. `FilterChips.tsx` — `business_filter_tag` y `business_filter_price`
4. `ShareButton.tsx` — `business_share`
5. `DirectionsButton.tsx` — `business_directions`
6. `SideMenu.tsx` — `side_menu_open`, `side_menu_section`, `dark_mode_toggle`

### Paso 6: Verificación

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run test:run
npm run build
npm run analyze  # Verificar impacto en bundle
```

---

## Archivos tocados (resumen)

| Acción | Archivo |
|--------|---------|
| **Crear** | `src/utils/analytics.ts` |
| **Crear** | `src/hooks/useScreenTracking.ts` |
| **Modificar** | `src/config/firebase.ts` |
| **Modificar** | `src/App.tsx` |
| **Modificar** | `src/context/AuthContext.tsx` |
| **Modificar** | `src/context/ColorModeContext.tsx` |
| **Modificar** | `src/services/ratings.ts` |
| **Modificar** | `src/services/favorites.ts` |
| **Modificar** | `src/services/comments.ts` |
| **Modificar** | `src/services/tags.ts` |
| **Modificar** | `src/services/priceLevels.ts` |
| **Modificar** | `src/services/menuPhotos.ts` |
| **Modificar** | `src/services/feedback.ts` |
| **Modificar** | `src/components/business/BusinessSheet.tsx` |
| **Modificar** | `src/components/search/SearchBar.tsx` |
| **Modificar** | `src/components/search/FilterChips.tsx` |
| **Modificar** | `src/components/business/ShareButton.tsx` |
| **Modificar** | `src/components/business/DirectionsButton.tsx` |
| **Modificar** | `src/components/layout/SideMenu.tsx` |
| **Crear** | `docs/feat-firebase-analytics/changelog.md` |

**Total**: 3 archivos nuevos, 16 archivos modificados.

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Dynamic import de `firebase/analytics` no resuelve en build | Verificar con `npm run build` + `npm run analyze` |
| Tests fallan por import de analytics | analytics.ts no importa firebase.ts, usa dynamic imports — no debería afectar |
| Bundle crece más de lo esperado | `npm run analyze` para verificar delta antes de mergear |
