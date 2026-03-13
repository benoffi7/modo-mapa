# Technical Specs — Firebase Analytics

**Issue:** [#57](https://github.com/benoffi7/modo-mapa/issues/57)
**Fecha:** 2026-03-13

---

## 1. Archivos nuevos

### `src/utils/analytics.ts`

Módulo central de Analytics. Exporta `trackEvent` y `setUserProperty`.

```typescript
import type { Analytics } from 'firebase/analytics';

let analytics: Analytics | null = null;

export function initAnalytics(app: import('firebase/app').FirebaseApp): void {
  if (import.meta.env.PROD) {
    import('firebase/analytics').then(({ getAnalytics }) => {
      analytics = getAnalytics(app);
    });
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!analytics) return;
  import('firebase/analytics').then(({ logEvent }) => {
    logEvent(analytics!, name, params);
  });
}

export function setUserProperty(name: string, value: string): void {
  if (!analytics) return;
  import('firebase/analytics').then(({ setUserProperties }) => {
    setUserProperties(analytics!, { [name]: value });
  });
}
```

**Notas:**

- Dynamic `import('firebase/analytics')` para que en DEV no se cargue el módulo
- `analytics` es `null` en DEV → todos los calls son no-op
- Fire-and-forget: nunca await, nunca bloquea UI

### `src/components/analytics/AnalyticsProvider.tsx`

Componente que inicializa Analytics y trackea screen views via React Router.

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent, setUserProperty } from '../../utils/analytics';

export function useScreenTracking(): void {
  const location = useLocation();

  useEffect(() => {
    const screenName = location.pathname === '/'
      ? 'map'
      : location.pathname.replace(/^\//, '').replace(/\//g, '_');

    trackEvent('screen_view', { screen_name: screenName });
  }, [location.pathname]);
}
```

No es un Provider con context — es un hook liviano que se consume en `App.tsx`.

---

## 2. Archivos modificados

### `src/config/firebase.ts`

Agregar init de analytics después de App Check:

```typescript
import { initAnalytics } from '../utils/analytics';

// Al final del archivo, después del bloque if/else:
initAnalytics(app);
```

### `src/App.tsx`

Agregar `useScreenTracking`:

```typescript
import { useScreenTracking } from './components/analytics/AnalyticsProvider';

function App() {
  useScreenTracking();
  // ... rest unchanged
}
```

### `src/context/AuthContext.tsx`

Setear user property `auth_type` al autenticar:

```typescript
import { setUserProperty } from '../utils/analytics';

// Dentro del effect post-auth:
setUserProperty('auth_type', user.isAnonymous ? 'anonymous' : 'google');
```

### `src/context/ColorModeContext.tsx`

Setear user property `theme` al cambiar:

```typescript
import { setUserProperty } from '../utils/analytics';

// Cuando cambia el modo:
setUserProperty('theme', mode);
```

### Service layer — `trackEvent` calls

Cada service agrega un `trackEvent` después de la operación exitosa. Patrón:

```typescript
import { trackEvent } from '../utils/analytics';

// Al final de la función, después del write exitoso:
trackEvent('rating_submit', { business_id: businessId, score });
```

**Archivos y eventos:**

| Archivo | Función | Evento | Parámetros |
|---------|---------|--------|-----------|
| `services/ratings.ts` | `upsertRating` | `rating_submit` | `business_id`, `score` |
| `services/favorites.ts` | `addFavorite` | `favorite_toggle` | `business_id`, `action: 'add'` |
| `services/favorites.ts` | `removeFavorite` | `favorite_toggle` | `business_id`, `action: 'remove'` |
| `services/comments.ts` | `addComment` | `comment_submit` | `business_id`, `is_edit: false` |
| `services/comments.ts` | `editComment` | `comment_submit` | `business_id`, `is_edit: true` |
| `services/comments.ts` | `likeComment` | `comment_like` | `business_id` |
| `services/tags.ts` | `addUserTag` | `tag_vote` | `business_id`, `tag_name` |
| `services/tags.ts` | `createCustomTag` | `custom_tag_create` | `business_id` |
| `services/priceLevels.ts` | `upsertPriceLevel` | `price_level_vote` | `business_id`, `level` |
| `services/menuPhotos.ts` | `uploadMenuPhoto` | `menu_photo_upload` | `business_id` |
| `services/feedback.ts` | `sendFeedback` | `feedback_submit` | `category` |

### Component layer — `trackEvent` calls

| Archivo | Acción | Evento | Parámetros |
|---------|--------|--------|-----------|
| `components/business/BusinessSheet.tsx` | useEffect al abrir | `business_view` | `business_id`, `business_name`, `category` |
| `components/search/SearchBar.tsx` | onBlur (si query no vacío) | `business_search` | `query`, `results_count` |
| `components/search/FilterChips.tsx` | toggleFilter | `business_filter_tag` | `tag_name`, `active` |
| `components/search/FilterChips.tsx` | setPriceFilter | `business_filter_price` | `price_level`, `active` |
| `components/business/ShareButton.tsx` | handleShare | `business_share` | `business_id`, `method` |
| `components/business/DirectionsButton.tsx` | handleClick | `business_directions` | `business_id` |
| `components/layout/SideMenu.tsx` | al abrir | `side_menu_open` | — |
| `components/layout/SideMenu.tsx` | al cambiar sección | `side_menu_section` | `section` |
| `components/layout/SideMenu.tsx` | dark mode toggle | `dark_mode_toggle` | `enabled` |

---

## 3. Consideraciones de CI/CD

- **Tests**: `analytics.ts` no importa `firebase.ts` directamente — importa dinámicamente `firebase/analytics`. No debería causar problemas en tests CI.
- **Tests existentes**: No necesitan cambios. Los `trackEvent` calls en services son fire-and-forget y no afectan el flujo.
- **Build**: `firebase/analytics` se incluirá en el bundle vía tree-shaking (solo en PROD builds porque el import es dinámico).
- **No se necesitan nuevas env vars**: Analytics usa el `appId` que ya está configurado.

---

## 4. Qué NO se hace

- No se modifica el admin dashboard
- No se agregan tests específicos de analytics (son fire-and-forget no-ops en test)
- No se agrega consent banner (ver #56)
- No se configura BigQuery export
- No se cambian los triggers/counters de Cloud Functions
