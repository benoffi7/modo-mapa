# PRD #184 — Admin: Panel de Check-ins

## Contexto

La coleccion `checkins` (feature de check-in en comercios con cooldown 4h, limite 10/dia, validacion de proximidad) no tiene ninguna visibilidad en el admin dashboard. No hay forma de monitorear adopcion ni detectar abusos.

## Requisitos

### Stats en DashboardOverview
- Agregar StatCard "Check-ins" con total de check-ins (nuevo counter en `AdminCounters`)
- Agregar al fetcher de counters el conteo de `checkins`

### Sub-tab en ActivityFeed
- Nueva sub-tab "Check-ins" con actividad reciente
- Columnas: Usuario, Comercio, Fecha, Ubicacion (si/no)
- Nuevo service `fetchRecentCheckins(count)` en `admin.ts`

### Tendencias
- Agregar linea `checkins` al chart de "Actividad por tipo" en TrendsPanel
- Requiere que `dailyMetrics.writesByCollection` ya registre checkins (verificar Cloud Function `trackDailyMetrics`)

### Card en FeaturesPanel
- Nueva card Firestore "Check-ins" con icono `PlaceOutlined` o `LocationOnOutlined`
- collectionKey: `checkins`, color: teal o similar

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/types/admin.ts` | Agregar `checkins` a `AdminCounters` |
| `src/services/admin.ts` | Agregar `fetchRecentCheckins()`, actualizar `fetchCounters()` |
| `src/components/admin/DashboardOverview.tsx` | Agregar StatCard check-ins |
| `src/components/admin/ActivityFeed.tsx` | Agregar sub-tab Check-ins |
| `src/components/admin/TrendsPanel.tsx` | Agregar linea checkins al chart |
| `src/components/admin/FeaturesPanel.tsx` | Agregar card Check-ins |
| `functions/src/` | Verificar/agregar tracking de checkins en dailyMetrics |

## Patron a seguir

- Service: mismo patron que `fetchRecentComments` — query con `orderBy('createdAt', 'desc')` + `limit(count)`
- ActivityFeed: mismo patron que las otras sub-tabs con `ActivityTable`
- FeaturesPanel: misma estructura que las cards existentes en `FEATURES[]`

## Tests

- `fetchRecentCheckins` retorna check-ins ordenados por fecha
- StatCard de check-ins renderiza con valor correcto
- ActivityFeed muestra sub-tab Check-ins
- FeaturesPanel incluye card Check-ins

## Seguridad

- Lectura de `checkins` solo para admin (ya cubierto por `AdminGuard`)
- No exponer datos de ubicacion exacta del usuario (solo mostrar si tiene o no ubicacion)

## Fuera de scope

- Mapa de calor de check-ins (futuro)
- Gestion/moderacion de check-ins individuales
