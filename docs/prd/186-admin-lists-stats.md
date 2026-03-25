# PRD #186 — Admin: Stats globales de Listas

## Contexto

El FeaturedListsPanel actual solo muestra listas publicas para togglear destacadas. No hay visibilidad sobre la adopcion general del feature de listas (publicas, privadas, colaborativas, items).

## Requisitos

### Ampliar FeaturedListsPanel con seccion de stats
- Mantener la funcionalidad actual de toggle destacadas
- Agregar seccion superior con stats globales antes de la lista de toggle

### Stats globales
- Total listas creadas
- Distribucion: publicas vs privadas
- Listas colaborativas (con editorIds.length > 0)
- Total items across all lists
- Promedio items por lista
- Top 10 listas mas grandes (por itemCount)
- Top 10 creadores de listas (por cantidad de listas)

### Card en FeaturesPanel
- Nueva card Firestore "Listas" con icono `BookmarkBorderIcon` (ya existe en GA4_FEATURES pero solo trackea eventos GA4, no Firestore)
- collectionKey: `sharedLists` o combinar con `listItems`

### Integracion con DashboardOverview
- Agregar StatCard "Listas" con total

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/services/admin.ts` | Agregar `fetchListStats()` — query sharedLists para stats |
| `src/types/admin.ts` | Agregar `ListStats` interface |
| `src/components/admin/FeaturedListsPanel.tsx` | Agregar seccion de stats arriba del toggle |
| `src/components/admin/DashboardOverview.tsx` | Agregar StatCard listas |
| `src/types/admin.ts` | Agregar `lists` a `AdminCounters` |
| `src/components/admin/FeaturesPanel.tsx` | Agregar card Firestore para listas |

## Patron a seguir

- Stats: usar `getPublicLists` Cloud Function existente para publicas, agregar nueva query para todas las listas (requiere callable admin o query directa con admin check)
- Alternativa eficiente: agregar counter de listas al documento `config/counters` via Cloud Function `onSharedListCreated/Deleted`
- Top listas: query `sharedLists` ordenada por `itemCount` desc, limit 10
- Layout: Grid de StatCards arriba, luego TopList, luego la lista de toggle existente

## Tests

- `fetchListStats` retorna stats correctas
- FeaturedListsPanel muestra seccion de stats
- StatCards muestran valores correctos
- Top listas ordenadas por itemCount

## Seguridad

- No mostrar contenido de listas privadas — solo metadata (nombre, itemCount, ownerId)
- No exponer editorIds completos, solo count

## Fuera de scope

- Gestionar/eliminar listas desde admin
- Ver items de listas privadas
- Moderacion de contenido de listas
