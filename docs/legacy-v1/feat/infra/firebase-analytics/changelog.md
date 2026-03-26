# Changelog — Firebase Analytics

**Issue:** [#57](https://github.com/benoffi7/modo-mapa/issues/57)

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/utils/analytics.ts` | Módulo central: `initAnalytics`, `trackEvent`, `setUserProperty`. Dynamic import, no-op en DEV |
| `src/hooks/useScreenTracking.ts` | Hook de screen tracking con React Router `useLocation` |
| `docs/feat-firebase-analytics/prd.md` | PRD |
| `docs/feat-firebase-analytics/specs.md` | Technical specs |
| `docs/feat-firebase-analytics/plan.md` | Technical plan |
| `docs/feat-firebase-analytics/changelog.md` | Este archivo |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/config/firebase.ts` | Import + llamada a `initAnalytics(app)` |
| `src/App.tsx` | Import + llamada a `useScreenTracking()` |
| `src/context/AuthContext.tsx` | `setUserProperty('auth_type', ...)` al autenticar |
| `src/context/ColorModeContext.tsx` | `setUserProperty('theme', ...)` al cambiar modo |
| `src/services/ratings.ts` | `trackEvent('rating_submit', ...)` |
| `src/services/favorites.ts` | `trackEvent('favorite_toggle', ...)` en add/remove |
| `src/services/comments.ts` | `trackEvent('comment_submit', ...)` y `trackEvent('comment_like', ...)` |
| `src/services/tags.ts` | `trackEvent('tag_vote', ...)` y `trackEvent('custom_tag_create', ...)` |
| `src/services/priceLevels.ts` | `trackEvent('price_level_vote', ...)` |
| `src/services/menuPhotos.ts` | `trackEvent('menu_photo_upload', ...)` |
| `src/services/feedback.ts` | `trackEvent('feedback_submit', ...)` |
| `src/components/business/BusinessSheet.tsx` | `trackEvent('business_view', ...)` |
| `src/components/search/SearchBar.tsx` | `trackEvent('business_search', ...)` en onBlur |
| `src/components/search/FilterChips.tsx` | `trackEvent('business_filter_tag/price', ...)` |
| `src/components/business/ShareButton.tsx` | `trackEvent('business_share', ...)` |
| `src/components/business/DirectionsButton.tsx` | `trackEvent('business_directions', ...)` |
| `src/components/layout/SideMenu.tsx` | `trackEvent('side_menu_open/section/dark_mode_toggle', ...)` |
| `src/components/business/BusinessComments.tsx` | Fix pre-existing `exactOptionalPropertyTypes` error |
