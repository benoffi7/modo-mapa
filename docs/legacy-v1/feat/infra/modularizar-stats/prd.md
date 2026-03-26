# PRD — Modularización de componentes de estadísticas

## Problema

Los componentes de estadísticas (distribución de ratings, tags más usados, y los tres
tops de comercios) viven actualmente acoplados al dashboard admin en
`DashboardOverview.tsx`. Esto impide reutilizarlos en la app pública sin duplicar código.

## Objetivo

Crear componentes de estadísticas desacoplados de la fuente de datos que puedan
renderizarse tanto en el panel admin como en la app pública de modo-mapa.

## Alcance

### En scope

- Extraer `PieChartCard` y `TopList` a `src/components/stats/`
- Crear un hook `usePublicMetrics()` que obtenga los datos de métricas sin requerir
  autenticación admin
- Refactorizar `DashboardOverview` para consumir los nuevos componentes compartidos
- Mantener backward compatibility total: el admin debe funcionar exactamente igual
- Agregar sección "Estadísticas" en el menú lateral de la app pública

### Fuera de scope

- Cambiar el diseño visual de los componentes
- Agregar nuevas métricas o gráficos
- Custom Tags (se queda solo en admin)

## Usuarios

- **Admin**: sigue usando el dashboard sin cambios visibles
- **App pública**: muestra estadísticas de la comunidad (ratings, tags, tops) en una
  nueva sección del menú lateral

## Requisitos funcionales

| # | Requisito |
|---|-----------|
| RF-1 | Los componentes `PieChartCard` y `TopList` deben funcionar recibiendo solo props (sin fetching interno) |
| RF-2 | Un hook `usePublicMetrics()` debe exponer `ratingDistribution`, `topTags`, `topFavorited`, `topCommented`, `topRated` |
| RF-3 | El hook debe leer de la colección `dailyMetrics` con el documento del día actual |
| RF-4 | El hook debe manejar estados de loading, error y data vacía |
| RF-5 | `DashboardOverview` debe refactorizarse para usar los componentes y hook compartidos |
| RF-6 | El menú lateral debe incluir una sección "Estadísticas" que muestre los gráficos públicos |

## Requisitos no funcionales

| # | Requisito |
|---|-----------|
| RNF-1 | Sin regresiones en el dashboard admin |
| RNF-2 | Los componentes no deben importar nada de `src/components/admin/` |
| RNF-3 | Respetar `verbatimModuleSyntax` (`import type` para tipos) |

## Métricas de éxito

- Los 5 componentes se renderizan correctamente desde `src/components/stats/`
- `DashboardOverview` usa los componentes de `stats/` sin duplicación
- El hook `usePublicMetrics()` es importable desde cualquier parte de la app
- La sección "Estadísticas" del menú lateral muestra los datos correctamente
