# Plan: GA4 Data API + FeaturesPanel integration

**Specs:** [Specs](./specs.md)
**Issue:** #161
**Branch:** `feat/ga4-api`

---

## Pre-requisitos (manual, antes de codear)

1. **Service account GA4 access:**
   - Ir a Google Analytics Admin > Property Access Management
   - Agregar `{project-id}@appspot.gserviceaccount.com` con rol **Viewer**
2. **Secret GA4_PROPERTY_ID:**
   ```bash
   firebase functions:secrets:set GA4_PROPERTY_ID
   # Ingresar el property ID numerico de GA4 (ej: 123456789)
   ```

---

## Pasos de implementacion

### Paso 1: Cloud Function `getAnalyticsReport`

1. Instalar dependencia:
   ```bash
   cd functions && npm install @google-analytics/data
   ```
2. Crear `functions/src/admin/analyticsReport.ts`:
   - Interfaces locales: `GA4EventCount`, `AnalyticsReportResponse`
   - Constante `GA4_EVENT_NAMES` (10 eventos)
   - `onCall` con `enforceAppCheck`, `secrets: ['GA4_PROPERTY_ID']`
   - `assertAdmin(request.auth)`
   - Lectura de cache `config/analyticsCache` con TTL 1h
   - Si cache miss: `BetaAnalyticsDataClient.runReport()` con `inListFilter` en `eventName`
   - Parseo de rows, escritura de cache, retorno
   - Error handling: `logger.error` + `captureException` + `HttpsError`
3. Exportar desde `functions/src/index.ts`

**Verificacion:**
```bash
cd functions && npx tsc --noEmit
```

### Paso 2: Tipos frontend + service function

1. Agregar en `src/types/admin.ts`:
   - `GA4EventCount` (eventName, date, eventCount)
   - `AnalyticsReportResponse` (events, cachedAt, fromCache)
2. Agregar en `src/services/admin.ts`:
   - `fetchAnalyticsReport()` usando `httpsCallable` (mismo patron que `fetchAuthStats`)

**Verificacion:**
```bash
npx tsc --noEmit
```

### Paso 3: Integracion en FeaturesPanel

1. Definir `GA4FeatureDef` y constante `GA4_FEATURES` (6 features con eventNames, icon, color)
2. Agregar `fetchAnalyticsReport()` al fetcher con `Promise.allSettled` (no bloquear si GA4 falla)
3. Crear helper `buildGA4FeatureData(events, eventNames)` que agrupa por fecha y calcula today/total/trend
4. Eliminar seccion separada "Features solo en GA4"
5. Renderizar GA4 features en el mismo Grid con cards + grafico expandible
6. Si GA4 falla: mostrar `Alert severity="warning"` en lugar de las GA4 cards

**Verificacion:**
```bash
npx tsc --noEmit && npm run lint && npm run test:run
```

### Paso 4: Deploy a staging y verificacion manual

1. Mergear a `staging` branch y verificar deploy
2. Deploy rules+functions a staging si aplica
3. Verificar en panel admin:
   - Cards GA4 muestran datos reales (o warning si no hay acceso)
   - Cache funciona (segunda carga muestra `fromCache: true` en network)
   - Features Firestore siguen funcionando sin regresion

---

## Criterios de completitud

- [ ] `@google-analytics/data` agregado en `functions/package.json`
- [ ] Cloud Function `getAnalyticsReport` exportada y desplegable
- [ ] Cache en `config/analyticsCache` con TTL 1h funcional
- [ ] Tipos `GA4EventCount` y `AnalyticsReportResponse` en `src/types/admin.ts`
- [ ] `fetchAnalyticsReport()` en `src/services/admin.ts`
- [ ] FeaturesPanel muestra 6 GA4 features con datos reales (cards + grafico 30d)
- [ ] Fallo de GA4 no rompe el panel (graceful degradation con Alert)
- [ ] Seccion separada "Solo GA4" eliminada — UI unificada
- [ ] Compilacion limpia: `tsc --noEmit` (functions + frontend), `lint`, `test:run`
- [ ] Secret `GA4_PROPERTY_ID` configurado en Firebase
- [ ] Service account tiene rol Viewer en GA4 property
