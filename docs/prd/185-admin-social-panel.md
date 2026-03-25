# PRD #185 — Admin: Panel Social (Follows, Activity Feed, Recomendaciones)

## Contexto

Las features sociales (follows #129, activity feed #129, recommendations #135) escriben datos en 3 colecciones sin ninguna visibilidad en el admin dashboard. Son features con interaccion entre usuarios que requieren monitoreo.

## Requisitos

### Nuevo tab "Social" en AdminLayout
- Nuevo tab entre "Usuarios" y "Uso Firebase" (posicion 5)
- Componente: `SocialPanel.tsx`
- Sub-tabs internas: Follows, Recomendaciones, Activity Feed

### Sub-tab Follows
- Stats: total follows, follows hoy (ultimas 24h)
- Top 10 usuarios mas seguidos (por cantidad de followers)
- Top 10 usuarios que mas siguen (por cantidad de following)
- Actividad reciente: tabla con Seguidor, Seguido, Fecha

### Sub-tab Recomendaciones
- Stats: total recomendaciones, enviadas hoy, tasa de lectura (% leidas)
- Top 10 remitentes (quienes mas recomiendan)
- Actividad reciente: tabla con Remitente, Destinatario, Comercio, Leida (si/no), Fecha

### Sub-tab Activity Feed
- Stats: total items generados (estimado), items hoy
- Solo informativo — el activity feed es per-user subcollection, listar items directamente seria costoso
- Alternativa: mostrar stats derivadas de follows (si hay N follows, se generan ~M items/dia)

### Integracion con paneles existentes
- DashboardOverview: agregar StatCards "Follows" y "Recomendaciones"
- TrendsPanel: agregar lineas follows y recommendations al chart de actividad
- FeaturesPanel: agregar cards Firestore para follows y recommendations

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/components/admin/SocialPanel.tsx` | Nuevo — panel con 3 sub-tabs |
| `src/components/admin/AdminLayout.tsx` | Agregar tab "Social" e import |
| `src/services/admin.ts` | Agregar `fetchRecentFollows()`, `fetchRecentRecommendations()`, `fetchFollowStats()`, `fetchRecommendationStats()` |
| `src/types/admin.ts` | Agregar `FollowStats`, `RecommendationStats` a tipos, agregar `follows`/`recommendations` a `AdminCounters` |
| `src/components/admin/DashboardOverview.tsx` | Agregar StatCards follows y recomendaciones |
| `src/components/admin/TrendsPanel.tsx` | Agregar lineas follows/recommendations |
| `src/components/admin/FeaturesPanel.tsx` | Agregar cards follows y recommendations |
| `functions/src/` | Verificar/agregar tracking de follows y recommendations en dailyMetrics |

## Patron a seguir

- Services: mismo patron que `fetchRecentComments` para actividad reciente
- Stats: similar a `fetchNotificationStats` — query + aggregacion client-side
- Panel: similar a `ActivityFeed.tsx` con sub-tabs internas
- Activity Feed sub-tab: dado que es subcollection per-user, NO hacer collectionGroup query (costoso). Mostrar stats derivadas o usar datos de dailyMetrics

## Tests

- `fetchRecentFollows` retorna follows ordenados
- `fetchRecentRecommendations` retorna recomendaciones ordenadas
- `fetchFollowStats` retorna top seguidos correctamente
- `fetchRecommendationStats` calcula tasa de lectura
- SocialPanel renderiza las 3 sub-tabs
- AdminLayout incluye tab Social

## Seguridad

- No exponer grafo social completo — solo top 10 y stats agregadas
- No mostrar contenido de mensajes de recomendacion (solo metadata)
- Lectura solo para admin (AdminGuard)

## Fuera de scope

- Bloquear/suspender usuarios desde el panel social
- Visualizacion de grafo de conexiones
- Moderacion de contenido de recomendaciones
