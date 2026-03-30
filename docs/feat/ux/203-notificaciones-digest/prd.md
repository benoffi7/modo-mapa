# PRD: Notificaciones Digest — Sección Home

**Issue:** #203
**Fecha:** 2026-03-30
**Estado:** Draft

## Problema

`NotificationsContext` hace polling cada 60s a Firestore, generando muchas lecturas innecesarias. No hay resumen de actividad en la Home: el usuario tiene que ir a Perfil > Notificaciones para ver qué pasó. Esto consume batería y genera costos de Firestore sin aportar visibilidad.

## Propuesta

Dos cambios complementarios:

### 1. Sección en Home: `ActivityDigestSection`

Nueva sección en la Home que muestra un resumen compacto de actividad reciente, ubicada después de `ForYouSection`.

**Con datos (hay notificaciones no leídas o actividad reciente):**
- Título: "Tu actividad"
- Lista compacta de las últimas 3 notificaciones agrupadas por tipo:
  - "3 nuevos comentarios en tus reviews"
  - "Te mencionaron en 2 lugares"
  - "Subiste 5 posiciones en el ranking"
- Link "Ver todas" → navega a Perfil > Notificaciones

**Sin datos (sin notificaciones recientes):**
- Icono de campana + texto "No hay novedades recientes"
- Subtexto: "Calificá y comentá negocios para recibir actividad"
- Botón CTA: "Explorar negocios" → navega a tab Buscar

### 2. Reducir polling + modo digest

- Reducir `POLL_INTERVAL_MS` de 60s a 300s (5 min)
- Agregar opción en Settings > Notificaciones:
  - **Tiempo real** (default actual, con polling reducido a 5min)
  - **Resumen diario** (una consulta por día al abrir la app)
  - **Resumen semanal** (una consulta semanal)
- Persistir preferencia en `userSettings.notificationDigest: 'realtime' | 'daily' | 'weekly'`

### Lógica de agrupación para digest

```
Agrupar notificaciones por tipo:
- 'comment_reply' → "X respuestas a tus comentarios"
- 'rating_like' → "A X personas les gustó tu calificación"
- 'follower' → "X nuevos seguidores"
- 'ranking_change' → "Subiste/bajaste X posiciones"
- 'achievement' → "Desbloqueaste X logros"
```

## Datos disponibles

- `NotificationsContext` — notificaciones con tipo, fecha, leído/no leído
- `POLL_INTERVAL_MS` en `src/constants/timing.ts`
- `userSettings` — para persistir preferencia de digest
- Tipos de notificación ya definidos en `AppNotification`

## Componentes

| Componente | Tipo | Ubicación |
|---|---|---|
| `ActivityDigestSection` | Nuevo | `src/components/home/` |
| `HomeScreen` | Modificar | Agregar sección después de ForYouSection |
| `useNotificationDigest` | Nuevo hook | `src/hooks/` — agrupa notificaciones |
| `NotificationsContext` | Modificar | Respetar preferencia de digest |
| `SettingsMenu` | Modificar | Agregar selector de frecuencia |
| `POLL_INTERVAL_MS` | Modificar | Cambiar de 60000 a 300000 |

## Diseño UX

- Sección compacta: máximo 3 líneas de resumen con iconos por tipo
- No repite el listado completo de notificaciones (eso ya existe en Perfil)
- Estado vacío visible (no se oculta) con CTA contextual
- Selector de frecuencia en Settings usa chips: `Tiempo real | Diario | Semanal`

## Analytics

| Evento | Cuándo |
|---|---|
| `digest_section_viewed` | Sección visible en Home |
| `digest_item_tapped` | Tap en un resumen de actividad |
| `digest_cta_tapped` | Tap en CTA de estado vacío |
| `digest_frequency_changed` | Cambio de preferencia en Settings |

## Impacto en costos

- Polling actual: ~1440 reads/usuario/día (cada 60s)
- Con 5min: ~288 reads/usuario/día (−80%)
- Con digest diario: 1 read/usuario/día (−99.9%)
- Ahorro significativo en costos de Firestore a escala

## Tests

- `ActivityDigestSection`: render con notificaciones, render CTA vacío
- `useNotificationDigest`: agrupación correcta por tipo, límite de 3 items
- `NotificationsContext`: polling respeta preferencia de digest
- Settings: selector de frecuencia persiste en userSettings

## Seguridad

- Sin cambios en modelo de datos de notificaciones
- Preferencia de digest se guarda en `userSettings` (doc propio del usuario)
- Sin nuevas Cloud Functions

## Fuera de alcance

- Push notifications nativas (requiere service worker / FCM)
- Email digest
- Notificaciones por canal (solo comentarios, solo rankings, etc.)
