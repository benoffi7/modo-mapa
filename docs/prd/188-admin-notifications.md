# PRD #188 — Admin: Gestion de Notificaciones

## Contexto

Las notificaciones tienen stats agregadas en DashboardOverview (total, leidas, pie por tipo) pero no hay gestion detallada. Hay 8 tipos de notificacion generados por Cloud Functions. No hay forma de diagnosticar problemas (tipos que nadie lee, acumulacion de no leidas, etc).

## Requisitos

### Ampliar stats existentes con panel dedicado
- Opcion: crear sub-seccion dentro del tab existente de DashboardOverview, o agregar un panel ligero
- Recomendacion: panel ligero nuevo "Notificaciones" para no sobrecargar DashboardOverview

### Metricas por tipo
- Tabla con cada tipo de notificacion: total enviadas, leidas, tasa de lectura (%)
- Tipos: `like`, `photo_approved`, `photo_rejected`, `ranking`, `feedback_response`, `comment_reply`, `new_follower`, `recommendation`
- Highlight en rojo si tasa de lectura < 20% (posible problema)

### Acumulacion
- Total notificaciones no leidas globales
- Distribucion: cuantos usuarios tienen >10 no leidas, >50, >100 (indicador de usuarios inactivos)

### Tendencia
- Chart de notificaciones generadas por dia (ultimos 30 dias)
- Fuente: `dailyMetrics.writesByCollection.notifications` o query directa

### Purge (opcional, baja prioridad)
- Boton para purgar notificaciones >90 dias
- Requiere Cloud Function callable
- Confirmar con dialog

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/services/admin.ts` | Agregar `fetchNotificationDetails()` — stats detalladas por tipo con tasa de lectura |
| `src/types/admin.ts` | Agregar `NotificationDetails` interface (extiende `NotificationStats` con breakdown por tipo) |
| `src/components/admin/NotificationsPanel.tsx` | Nuevo — panel con tabla por tipo + acumulacion + tendencia |
| `src/components/admin/AdminLayout.tsx` | Agregar tab "Notificaciones" (o reemplazar stats de DashboardOverview) |

## Patron a seguir

- Stats por tipo: extender `fetchNotificationStats` existente, agregar `read` count por tipo ademas del total
- Tabla: usar `ActivityTable` existente o tabla MUI directa
- Chart: reusar `LineChartCard` con datos de dailyMetrics
- Purge: mismo patron que `createBackup` en BackupsPanel (callable + confirm dialog)

## Tests

- `fetchNotificationDetails` retorna breakdown correcto por tipo
- Tasa de lectura calculada correctamente
- Panel renderiza tabla con 8 tipos
- Highlight funciona cuando tasa < 20%

## Seguridad

- Solo lectura + purge (admin-only)
- Purge requiere confirmacion explicita
- No mostrar contenido de notificaciones individuales

## Fuera de scope

- Enviar notificaciones manuales desde admin
- Editar notificaciones individuales
- Push notifications (solo in-app)
