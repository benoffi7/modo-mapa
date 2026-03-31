# PRD: Admin GA4 behavioral analytics dashboard

**Feature:** 259-admin-ga4-analytics
**Categoria:** infra
**Fecha:** 2026-03-30
**Issue:** #259
**Prioridad:** Media

---

## Contexto

La app trackea ~70 eventos GA4 distribuidos en 9 archivos de dominio bajo `src/constants/analyticsEvents/` (onboarding, trending, offline, social, navigation, system, business, digest, interests), pero el panel admin FeaturesPanel solo expone 7 features GA4 (surprise, lists, search, share, photos, darkMode, questions) cubriendo ~10 eventos. La infraestructura para visualizar metricas GA4 ya existe: `fetchAnalyticsReport()` callable, cache de 1h server-side, `buildGA4FeatureData()` helper, y el patron de cards con trend charts de 30 dias. Solo falta extender el array `GA4_FEATURES` con las categorias faltantes y reorganizar la UI para agrupar por categoria.

## Problema

- **Punto ciego de onboarding**: No se puede medir conversion del funnel de registro (banner shown/clicked/dismissed, benefits screen, verification nudge, activity reminder) -- 10 eventos trackeados pero invisibles.
- **Engagement del home invisible**: Trending (6 eventos), specials, for you, quick actions, recent searches -- todas las secciones del home generan eventos que no se pueden analizar en el admin.
- **Features nuevas sin metricas**: Interests/tags (6 eventos), digest (4 eventos), offline health (4 eventos), business engagement (business_view, business_directions, rating_prompt) -- features criticas sin visibilidad.
- **El archivo FeaturesPanel.tsx ya tiene 313 lineas**: Agregar ~30 nuevas features GA4 directamente al componente lo llevaria a >400 lineas, violando la directiva de file size. Se necesita extraer las definiciones a un archivo de configuracion.

## Solucion

### S1. Extraer definiciones GA4 a archivo de configuracion

Crear `src/components/admin/features/ga4FeatureDefinitions.ts` con las definiciones agrupadas por categoria. Cada grupo tiene un `category` label y un array de `GA4FeatureDef`. Esto saca ~150 lineas de definiciones fuera de FeaturesPanel.

Categorias:

| Categoria | Eventos | Fuente |
|-----------|---------|--------|
| Onboarding | banner_shown/clicked/dismissed, benefits_screen_shown/continue, verification_nudge_shown/resend/dismissed, activity_reminder_shown/clicked | `onboarding.ts` |
| Home: Trending | trending_viewed, trending_business_clicked, trending_near_viewed/tapped/configure_tapped, rankings_zone_filter | `trending.ts` |
| Home: Engagement | special_tapped, for_you_tapped, quick_action_tapped, recent_search_tapped | string literals en componentes del home |
| Interests | tag_followed/unfollowed, interests_section_viewed, interests_business_tapped, interests_cta_tapped, interests_suggested_tapped | `interests.ts` |
| Digest | digest_section_viewed, digest_item_tapped, digest_cta_tapped, digest_frequency_changed | `digest.ts` |
| Offline | offline_action_queued, offline_sync_completed, offline_sync_failed, offline_action_discarded | `offline.ts` |
| Business | business_view, business_directions, rating_prompt_shown/clicked/dismissed/converted, business_sheet_phase1_ms/phase2_ms/cache_hit | `business.ts` + string literals |
| Social | follow, unfollow, feed_viewed, feed_item_clicked, recommendation_sent/opened/list_viewed | `social.ts` |
| System | force_update_triggered, force_update_limit_reached, account_deleted | `system.ts` |
| Navigation | tab_switched, sub_tab_switched, business_sheet_tab_changed | `navigation.ts` |

### S2. UI con secciones colapsables por categoria

Reemplazar el grid plano de GA4 features por secciones con header de categoria (Typography h6 + Collapse). Cada seccion se expande/colapsa independientemente. Patron similar al que ya usan los cards individuales pero a nivel de grupo.

Mantener la compatibilidad con las 7 features GA4 existentes (surprise, lists, search, share, photos, darkMode, questions) -- se reubican en la categoria apropiada o se mantienen como "Otras features".

### S3. Extraer GA4FeatureCard como componente reutilizable

El JSX de rendering de un GA4 feature card (lineas 239-275 del FeaturesPanel actual) se repite identico al de Firestore feature cards. Extraer a `src/components/admin/features/GA4FeatureCard.tsx` para reutilizar y reducir lineas del orquestador.

Consideraciones de seguridad: No hay superficie nueva. El `analyticsReport` callable ya esta protegido con App Check y admin guard. Solo se consumen datos que ya llegan.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Crear `ga4FeatureDefinitions.ts` con ~10 categorias y ~40 features | Must | M |
| Extraer `GA4FeatureCard.tsx` de FeaturesPanel | Must | S |
| Extraer `GA4CategorySection.tsx` (header + collapse + grid de cards) | Must | S |
| Refactorizar FeaturesPanel para usar nuevos componentes | Must | S |
| Mantener features GA4 existentes (7) funcionales | Must | S |
| Tests para `buildGA4FeatureData` helper (ya existente, sin tests) | Should | S |
| Tests para `ga4FeatureDefinitions` (validar estructura, no duplicados) | Should | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Agregar nuevos eventos GA4 al tracking del frontend (solo exponer los que ya se trackean)
- Modificar el `analyticsReport` callable o su cache server-side
- Dashboards custom con filtros de fecha o comparaciones de periodos
- Exportar datos de analytics a CSV o similar
- Alertas automaticas basadas en metricas GA4

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/admin/features/ga4FeatureDefinitions.ts` | Unit | Estructura valida, no hay eventNames duplicados entre features, todos los keys unicos |
| `src/components/admin/FeaturesPanel.tsx` (helper `buildGA4FeatureData`) | Unit | Aggregation correcta por multiples eventNames, today/yesterday calc, trend ordering, empty data |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

- [x] No hay nuevas superficies de escritura -- feature es read-only de datos GA4
- [x] `analyticsReport` callable ya tiene App Check + admin guard
- [x] No se exponen datos de usuarios individuales -- solo conteos agregados de eventos
- [x] No se introduce `dangerouslySetInnerHTML` ni HTML dinamico

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `analyticsReport` callable | Llamadas excesivas para agotar quota GA4 | Ya tiene rate limit callable 5/min + cache 1h server-side |

---

## Deuda tecnica y seguridad

No hay issues abiertos de seguridad ni tech debt que afecten directamente este feature.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| FeaturesPanel 313 lineas (near limit) | Empeora si no se refactoriza | Extraer componentes como parte del feature |
| String literals en trackEvent calls (business_view, business_directions, etc.) | No afecta directamente | Nota: hay ~15 eventos trackeados con string literals en vez de constantes. No se corrige en este issue pero se documenta como tech debt futuro |

### Mitigacion incorporada

- Extraer GA4FeatureCard y GA4CategorySection reduce FeaturesPanel de 313 a ~150 lineas
- Definiciones GA4 en archivo separado facilitan agregar nuevas features sin tocar el componente orquestador

---

## Robustez del codigo

### Checklist de hooks async

- [x] No hay hooks async nuevos -- el feature reutiliza `useAsyncData` existente en FeaturesPanel
- [x] No hay `setState` nuevos despues de operaciones async
- [x] Funciones exportadas que no se usan fuera del archivo y tests: N/A

### Checklist de documentacion

- [ ] Nuevos analytics events en archivo de dominio bajo `src/constants/analyticsEvents/` -- N/A (no se agregan eventos nuevos)
- [ ] Nuevos tipos en archivo de dominio bajo `src/types/` -- posible tipo `GA4FeatureCategory` en `types/admin.ts`
- [ ] `docs/reference/features.md` actualizado con la nueva capacidad del admin panel
- [ ] `docs/reference/patterns.md` actualizado si se establece patron de admin panel decomposition por archivos de definicion

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `fetchAnalyticsReport()` | read (callable) | No disponible offline | Alert "No se pudieron cargar las metricas de GA4" (ya existente) |
| `fetchCounters()` + `fetchDailyMetrics()` | read (Firestore) | Persistencia offline de Firestore | Datos cached si disponibles |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (Firestore persistent cache en prod)
- [x] Writes: N/A (feature read-only)
- [x] APIs externas: GA4 analytics report tiene manejo de error con `Promise.allSettled` (ya implementado)
- [x] UI: Alert warning cuando GA4 falla (ya implementado en FeaturesPanel)
- [x] Datos criticos: Firestore counters disponibles en cache

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services (definiciones en archivo de config, no inline)
- [ ] Componentes nuevos son reutilizables fuera del contexto actual de layout (GA4FeatureCard reutilizable)
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] Props explicitas en vez de dependencias implicitas a contextos de layout
- [ ] Cada prop de accion (onClick, onSelect, onNavigate) tiene un handler real especificado
- [ ] Ningun componente nuevo importa directamente de `firebase/firestore`, `firebase/functions`, o `firebase/storage`
- [ ] Archivos nuevos van en carpeta de dominio correcta (`src/components/admin/features/`)
- [ ] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | FeaturesPanel se descompone en 3 archivos mas pequenos |
| Estado global | = | Sin cambios, usa `useAsyncData` existente |
| Firebase coupling | = | Sin cambios, queries ya estan en `services/admin.ts` |
| Organizacion por dominio | - | Archivos nuevos en `admin/features/` (subdirectorio de dominio) |

---

## Success Criteria

1. Todas las categorias de eventos GA4 (onboarding, trending, home engagement, interests, digest, offline, business, social, system, navigation) son visibles en el admin panel con cards y trend charts de 30 dias
2. FeaturesPanel.tsx no supera 200 lineas post-refactor (actualmente 313)
3. Las 7 features GA4 existentes (surprise, lists, search, share, photos, darkMode, questions) siguen funcionando identicamente
4. Ningun archivo nuevo supera 300 lineas
5. Tests cubren `buildGA4FeatureData` helper y validacion de estructura de definiciones
