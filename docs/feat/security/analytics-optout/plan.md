# Plan: Configuracion de privacidad — Opt-in de Analytics

## Orden de implementacion

### Paso 1: Modelo de datos

1. Agregar `analyticsEnabled: boolean` a `UserSettings` en `src/types/index.ts`
2. Agregar `analyticsEnabled: false` a `DEFAULT_SETTINGS` en `src/services/userSettings.ts`
3. Agregar `analyticsEnabled` al destructuring de first-write en `updateUserSettings`
4. Agregar `analyticsEnabled` al converter en `src/config/converters.ts`

**Verificar**: `npx tsc --noEmit -p tsconfig.app.json` pasa.

### Paso 2: Firestore rules

1. Agregar `&& request.resource.data.analyticsEnabled is bool` a la regla write de `userSettings`

### Paso 3: Analytics module

1. Reescribir `src/utils/analytics.ts` con soporte de consent:
   - `initAnalytics(app)` lee localStorage, solo activa si consent es `"true"`
   - `setAnalyticsEnabled(value)` actualiza localStorage + SDK
   - `trackEvent` y `setUserProperty` verifican `enabled`

**Verificar**: `npx tsc --noEmit -p tsconfig.app.json` pasa.

### Paso 4: Hook sync

1. En `src/hooks/useUserSettings.ts`, agregar sincronizacion de `setAnalyticsEnabled` cuando `settings.analyticsEnabled` cambia

### Paso 5: UI

1. Agregar seccion "Datos de uso" en `src/components/menu/SettingsPanel.tsx`

### Paso 6: Test local

1. `npm run lint`
2. `npm run test:run`
3. `npm run build`
4. `npm run dev` — verificar:
   - Toggle aparece en Configuracion
   - Por defecto deshabilitado
   - Al activar, localStorage tiene `analytics-consent: "true"`
   - Al desactivar, vuelve a `"false"`
