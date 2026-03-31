# Plan: Admin GA4 behavioral analytics dashboard

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Extraer componentes y definiciones

**Branch:** `feat/259-admin-ga4-analytics`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/features/ga4FeatureDefinitions.ts` | Crear archivo con interfaces `GA4FeatureDef` y `GA4FeatureCategory`, y el array `GA4_FEATURE_CATEGORIES` con 10 categorias. Importar iconos de MUI. Incluir las 7 features GA4 existentes (surprise, lists, search, share, photos, darkMode, questions) reubicadas en una categoria "Otras features". Agregar las ~33 features nuevas distribuidas en las 9 categorias restantes (Onboarding, Trending, Home Engagement, Interests, Digest, Offline, Business, Social, System, Navigation). |
| 2 | `src/components/admin/features/TrendIcon.tsx` | Extraer el componente `TrendIcon` de FeaturesPanel (lineas 83-87). Exportar como default. Props: `{ today: number; yesterday: number }`. Importa `TrendingUpIcon`, `TrendingDownIcon`, `TrendingFlatIcon`. |
| 3 | `src/components/admin/features/GA4FeatureCard.tsx` | Crear componente que recibe `{ feature, events, isExpanded, onToggle }`. Importar `buildGA4FeatureData` de FeaturesPanel. Renderizar Card con border-left, icono, nombre, count de hoy, TrendIcon, "hoy (GA4) -- ultimos 30d total", Collapse con LineChartCard. Extraido del JSX actual en lineas 239-275 de FeaturesPanel. |
| 4 | `src/components/admin/features/GA4CategorySection.tsx` | Crear componente que recibe `{ category, events, expandedFeature, onToggleFeature, defaultExpanded? }`. Estado local `open` (useState, default `defaultExpanded ?? true`). Renderiza header con Typography h6 + IconButton expand/collapse + chip con count de features. Collapse con Grid container que itera `category.features` renderizando GA4FeatureCard. |

### Fase 2: Actualizar Cloud Function + Refactorizar FeaturesPanel

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/admin/analyticsReport.ts` | Expandir `GA4_EVENT_NAMES` array: agregar los ~35 event names nuevos (onboarding 10, trending 6, home 4, interests 6, digest 4, offline 4, business 7 nuevos, social 7, system 3, navigation 3, questions 2, list_icon_changed 1). Remover `side_menu_section` y `business_filter_tag` (legacy). Mantener los 8 existentes validos. |
| 2 | `src/components/admin/FeaturesPanel.tsx` | Refactorizar: (a) Eliminar interface `GA4FeatureDef`, array `GA4_FEATURES`, componente `TrendIcon`. (b) Exportar `buildGA4FeatureData` como named export. (c) Importar `GA4_FEATURE_CATEGORIES` de `./features/ga4FeatureDefinitions`, `GA4CategorySection` de `./features/GA4CategorySection`, `TrendIcon` de `./features/TrendIcon`. (d) Reemplazar el bloque de GA4 feature cards (lineas 227-276) por iteracion: `GA4_FEATURE_CATEGORIES.map(category => <GA4CategorySection .../>)`. (e) Mantener intacto: Firestore FEATURES + cards, buildFeatureTrend, fetcher, seccion Adoption. |

### Fase 3: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/features/__tests__/buildGA4FeatureData.test.ts` | Crear test file. Mock `vi.useFakeTimers()` para controlar fecha. Tests: (1) aggregation de multiple event names, (2) today count con formato YYYYMMDD, (3) yesterday count, (4) total across all dates, (5) trend sorted chronologically con formato YYYY-MM-DD, (6) empty events returns zeros, (7) events sin match de today/yesterday. Importar `buildGA4FeatureData` de `../../FeaturesPanel`. |
| 2 | `src/components/admin/features/__tests__/ga4FeatureDefinitions.test.ts` | Crear test file. Tests: (1) all feature keys unique across categories, (2) no duplicate eventNames across all features, (3) every feature has at least 1 eventName, (4) every category has at least 1 feature, (5) category IDs unique, (6) all features have required fields (key, name, eventNames, color). |
| 3 | N/A | Ejecutar `npm run test:run` para verificar que todos los tests pasan. |

### Fase 4: Lint + Build

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `npx eslint src/components/admin/FeaturesPanel.tsx src/components/admin/features/` para verificar lint. |
| 2 | N/A | Ejecutar `npm run build` para verificar build completo. |
| 3 | N/A | Ejecutar `cd functions && npm run build` para verificar build de Cloud Functions. |

### Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Actualizar seccion del admin panel: documentar que el features panel ahora muestra ~40 features GA4 agrupadas en 10 categorias con secciones colapsables. |
| 2 | `docs/reference/patterns.md` | Agregar nota en seccion "Admin panel decomposition": mencionar `FeaturesPanel -> admin/features/` (GA4FeatureCard, GA4CategorySection, ga4FeatureDefinitions, TrendIcon) como ejemplo del patron de archivos de definicion para admin panels. |

---

## Orden de implementacion

1. `ga4FeatureDefinitions.ts` -- no tiene dependencias, es el archivo de datos
2. `TrendIcon.tsx` -- componente simple sin dependencias externas
3. `GA4FeatureCard.tsx` -- depende de TrendIcon + buildGA4FeatureData (aun en FeaturesPanel)
4. `GA4CategorySection.tsx` -- depende de GA4FeatureCard
5. `functions/src/admin/analyticsReport.ts` -- independiente del frontend, se puede hacer en paralelo con 3-4
6. `FeaturesPanel.tsx` -- refactorizar una vez que los componentes estan listos
7. Tests -- dependen de que las exportaciones esten estables
8. Lint + build
9. Docs

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas estimadas | Supera 400? |
|---------|-----------------|-------------|
| `ga4FeatureDefinitions.ts` | ~180 | No |
| `TrendIcon.tsx` | ~15 | No |
| `GA4FeatureCard.tsx` | ~65 | No |
| `GA4CategorySection.tsx` | ~70 | No |
| `FeaturesPanel.tsx` (post-refactor) | ~160 | No |
| `functions/src/admin/analyticsReport.ts` | ~110 | No |
| `buildGA4FeatureData.test.ts` | ~90 | No |
| `ga4FeatureDefinitions.test.ts` | ~50 | No |

## Riesgos

1. **GA4 API query size:** Expandir de 10 a ~45 event names en el `inListFilter` podria impactar la velocidad de la query GA4. Mitigacion: el cache de 1h server-side minimiza el impacto. La GA4 Data API soporta hasta 300 dimension values en un `inListFilter`, asi que 45 esta dentro del limite.

2. **Eventos sin datos:** Algunas features nuevas podrian no tener datos GA4 (ej: `offline_sync_failed` si nunca fallo). Las cards mostrarian 0/0/0, lo cual es correcto pero no muy informativo. Mitigacion: las categorias colapsables permiten ocultar secciones poco relevantes.

3. **Build size de Cloud Functions:** Agregar ~35 strings al array `GA4_EVENT_NAMES` es negligible en tamano de bundle. No hay riesgo.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (`src/components/admin/features/`)
- [x] Logica de negocio en helpers (`buildGA4FeatureData`), no en componentes
- [x] No se toca ningun archivo con deuda tecnica sin incluir fix (FeaturesPanel se reduce de 313 a ~160 lineas)
- [x] Ningun archivo resultante supera 400 lineas

## Criterios de done

- [ ] Las 10 categorias de eventos GA4 visibles en el admin panel con cards y trend charts de 30 dias
- [ ] FeaturesPanel.tsx no supera 200 lineas post-refactor
- [ ] Las 7 features GA4 existentes (surprise, lists, search, share, photos, darkMode, questions) siguen funcionando
- [ ] Ningun archivo nuevo supera 300 lineas
- [ ] Tests cubren `buildGA4FeatureData` helper y validacion de estructura de definiciones
- [ ] Tests pass con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds (frontend + Cloud Functions)
- [ ] Reference docs actualizados (features.md, patterns.md)
