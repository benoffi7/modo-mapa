# Specs: Configuracion de privacidad — Opt-in de Analytics

## Modelo de datos

### `UserSettings` (actualizar)

```typescript
export interface UserSettings {
  profilePublic: boolean;
  notificationsEnabled: boolean;
  notifyLikes: boolean;
  notifyPhotos: boolean;
  notifyRankings: boolean;
  analyticsEnabled: boolean; // NUEVO — default false (opt-in)
  updatedAt: Date;
}
```

### Firestore rules (actualizar `userSettings`)

Agregar validacion del nuevo campo booleano:

```text
match /userSettings/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId
    && request.resource.data.profilePublic is bool
    && request.resource.data.notificationsEnabled is bool
    && request.resource.data.notifyLikes is bool
    && request.resource.data.notifyPhotos is bool
    && request.resource.data.notifyRankings is bool
    && request.resource.data.analyticsEnabled is bool    // NUEVO
    && request.resource.data.updatedAt == request.time;
}
```

### localStorage

Key: `analytics-consent`
Valores: `"true"` | `"false"` | ausente (= false por defecto)

Se lee sincronamente al boot en `initAnalytics()` para decidir si inicializar o no.

## Archivos a modificar

### `src/types/index.ts`

Agregar `analyticsEnabled: boolean` a `UserSettings`.

### `src/utils/analytics.ts`

Cambios:

1. Variable module-level `let enabled = false`
2. Al iniciar, leer `localStorage.getItem('analytics-consent')` — solo inicializar si es `"true"`
3. Exportar `setAnalyticsEnabled(value: boolean)`:
   - Guarda en localStorage
   - Si `value === true` y `analytics === null`, lazy-init analytics
   - Si `value === true` y analytics existe, `setAnalyticsCollectionEnabled(analytics, true)`
   - Si `value === false` y analytics existe, `setAnalyticsCollectionEnabled(analytics, false)`
   - Actualiza `enabled`
4. `trackEvent` y `setUserProperty` verifican `enabled` ademas de `analytics`

```typescript
import type { Analytics } from 'firebase/analytics';
import type { FirebaseApp } from 'firebase/app';

let analytics: Analytics | null = null;
let enabled = false;
let firebaseApp: FirebaseApp | null = null;

const LS_KEY = 'analytics-consent';

export function initAnalytics(app: FirebaseApp): void {
  firebaseApp = app;
  if (!import.meta.env.PROD) return;

  const consent = localStorage.getItem(LS_KEY);
  if (consent === 'true') {
    activateAnalytics(app);
  }
}

function activateAnalytics(app: FirebaseApp): void {
  enabled = true;
  import('firebase/analytics').then(({ getAnalytics, setAnalyticsCollectionEnabled }) => {
    analytics = getAnalytics(app);
    setAnalyticsCollectionEnabled(analytics, true);
  });
}

export function setAnalyticsEnabled(value: boolean): void {
  localStorage.setItem(LS_KEY, String(value));
  enabled = value;

  if (!import.meta.env.PROD || !firebaseApp) return;

  if (value && !analytics) {
    activateAnalytics(firebaseApp);
  } else if (analytics) {
    import('firebase/analytics').then(({ setAnalyticsCollectionEnabled }) => {
      setAnalyticsCollectionEnabled(analytics!, value);
    });
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!enabled || !analytics) return;
  import('firebase/analytics').then(({ logEvent }) => {
    logEvent(analytics!, name, params);
  });
}

export function setUserProperty(name: string, value: string): void {
  if (!enabled || !analytics) return;
  import('firebase/analytics').then(({ setUserProperties }) => {
    setUserProperties(analytics!, { [name]: value });
  });
}
```

### `src/services/userSettings.ts`

- Agregar `analyticsEnabled: false` a `DEFAULT_SETTINGS`
- Agregar `analyticsEnabled` al destructuring en first-write path

### `src/config/converters.ts`

Agregar `analyticsEnabled` a `userSettingsConverter` (toFirestore + fromFirestore).

### `src/hooks/useUserSettings.ts`

Sin cambios — el hook es generico sobre las keys de `UserSettings`.
Agregar efecto para sincronizar `setAnalyticsEnabled` cuando settings cambian:

```typescript
import { setAnalyticsEnabled } from '../utils/analytics';

// Dentro del hook, despues de computar settings:
const prevAnalyticsRef = useRef(settings.analyticsEnabled);
if (prevAnalyticsRef.current !== settings.analyticsEnabled) {
  prevAnalyticsRef.current = settings.analyticsEnabled;
  setAnalyticsEnabled(settings.analyticsEnabled);
}
```

Nota: se usa ref + comparacion en render (no useEffect) para evitar delay.
El React compiler permite leer refs durante render si no es el resultado de un setState en el mismo render.

### `src/components/menu/SettingsPanel.tsx`

Agregar seccion "Datos de uso" despues de "Notificaciones":

```tsx
<Divider sx={{ my: 1.5 }} />

{/* Analytics */}
<Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
  Datos de uso
</Typography>
<SettingRow
  label="Enviar datos de uso"
  description="Ayuda a mejorar la app enviando datos anonimos de uso"
  checked={settings.analyticsEnabled}
  onChange={(val) => updateSetting('analyticsEnabled', val)}
/>
```

### `firestore.rules`

Agregar `&& request.resource.data.analyticsEnabled is bool` a la regla write de `userSettings`.
