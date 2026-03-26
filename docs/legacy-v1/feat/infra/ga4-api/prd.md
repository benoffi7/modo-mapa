# PRD: Integración GA4 Data API para métricas de features

**Feature:** ga4-api
**Categoria:** infra
**Fecha:** 2026-03-16
**Prioridad:** Alta

---

## Contexto

El panel admin tiene un tab "Features" que muestra métricas por funcionalidad. Actualmente solo muestra datos de colecciones Firestore (ratings, comments, favorites, etc.). Hay 6 features que solo se trackean via Firebase Analytics (GA4) sin agregación server-side: Sorpréndeme, Listas, Búsqueda, Compartir, Fotos y Dark Mode.

Además, `writesByCollection` en `dailyMetrics` está definido en el tipo pero nunca se computa, dejando los gráficos de tendencia vacíos.

## Problema

1. Las métricas de features client-only (Sorpréndeme, búsqueda, compartir, etc.) no son visibles en el panel admin
2. Los gráficos de tendencia de 30 días muestran 0 porque `writesByCollection` nunca se calcula
3. No hay visibilidad de eventos de analytics desde el panel admin

## Solución

### S1: Cloud Function para consultar GA4 Data API

- Crear callable `getAnalyticsReport` que consulta la Google Analytics Data API v1beta
- Requiere: `propertyId` de GA4 (derivar de `FIREBASE_MEASUREMENT_ID`) y service account con rol "Analytics Viewer"
- Query: eventos por nombre, agrupados por fecha, últimos 30 días
- Caché: guardar resultado en `config/analyticsCache` con TTL 1 hora (evitar hits excesivos a la API)

### S2: Computar writesByCollection en dailyMetrics

- Actualizar `dailyMetrics` scheduled function para contar writes por colección del día
- Fuente: `config/counters` ya tiene contadores por colección que se resetean diariamente
- Guardar en `dailyMetrics.writesByCollection`

### S3: Integrar GA4 data en FeaturesPanel

- Llamar `getAnalyticsReport` desde FeaturesPanel
- Mostrar las métricas GA4 con el mismo formato de card + gráfico expandible
- Quitar el badge "Solo GA4" y la sección separada — unificar todas las métricas

### S4: Service account setup

- Agregar rol "Analytics Viewer" al service account de Firebase
- Verificar que el propertyId de GA4 está accesible desde el proyecto

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Computar writesByCollection en dailyMetrics | Alta | S |
| Cloud Function getAnalyticsReport | Alta | M |
| Caché de analytics en Firestore | Alta | S |
| Integrar GA4 data en FeaturesPanel | Alta | S |
| Setup service account con Analytics Viewer | Alta | XS |

**Esfuerzo total estimado:** M

---

## Eventos GA4 a consultar

| Evento | Feature | Tipo |
|--------|---------|------|
| `surprise_me` | Sorpréndeme | Acción |
| `list_created` | Listas | Acción |
| `list_item_added` | Listas | Acción |
| `business_search` | Búsqueda | Interacción |
| `business_share` | Compartir | Acción |
| `menu_photo_upload` | Fotos | Acción |
| `dark_mode_toggle` | Dark Mode | Preferencia |
| `side_menu_section` | Navegación menú | Interacción |
| `business_view` | Vista de comercio | Interacción |
| `business_filter_tag` | Filtros | Interacción |

---

## Dependencias

- Google Analytics Data API v1beta (`@google-analytics/data`)
- Service account con rol Analytics Viewer
- Property ID de GA4 (secret `GA4_PROPERTY_ID`)

---

## Out of Scope

- Dashboards custom en GA4 (usar directamente la consola de GA4 para eso)
- Eventos nuevos (los 27 existentes cubren todas las features)
- Realtime analytics (solo agregación diaria/bajo demanda)
- Funnels complejos (conversión anónimo → email → verificado se queda en GA4 console)

---

## Success Criteria

1. writesByCollection se computa diariamente y los gráficos de tendencia muestran datos reales
2. Las 6 features GA4-only aparecen en FeaturesPanel con datos reales
3. Todas las features tienen la misma visualización (cards + gráfico 30 días)
4. La Cloud Function cachea resultados para no exceder la cuota de GA4 API
