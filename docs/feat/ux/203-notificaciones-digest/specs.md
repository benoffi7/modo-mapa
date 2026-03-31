# Specs: Notificaciones Digest

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

## Modelo de datos

### Cambios en `UserSettings`

```typescript
// src/types/index.ts — agregar a UserSettings
notificationDigest?: 'realtime' | 'daily' | 'weekly';
```

Default: `'realtime'` (comportamiento actual pero con polling reducido).

### Tipos nuevos

```typescript
// src/types/index.ts
interface DigestGroup {
  type: AppNotification['type'];
  count: number;
  label: string;          // "3 respuestas a tus comentarios"
  icon: string;           // MUI icon name
  latestAt: Date;         // fecha más reciente del grupo
  notifications: AppNotification[]; // las notificaciones del grupo
}
```

### Constantes

```typescript
// src/constants/notifications.ts
export const DIGEST_LABELS: Record<AppNotification['type'], {
  singular: string;
  plural: string;
  icon: string;
}> = {
  comment_reply: { singular: 'respuesta a tu comentario', plural: 'respuestas a tus comentarios', icon: 'ChatBubble' },
  like: { singular: 'me gusta en tu calificación', plural: 'me gusta en tus calificaciones', icon: 'ThumbUp' },
  new_follower: { singular: 'nuevo seguidor', plural: 'nuevos seguidores', icon: 'PersonAdd' },
  ranking: { singular: 'cambio en el ranking', plural: 'cambios en el ranking', icon: 'EmojiEvents' },
  recommendation: { singular: 'nueva recomendación', plural: 'nuevas recomendaciones', icon: 'CardGiftcard' },
  photo_approved: { singular: 'foto aprobada', plural: 'fotos aprobadas', icon: 'CheckCircle' },
  photo_rejected: { singular: 'foto rechazada', plural: 'fotos rechazadas', icon: 'Cancel' },
  feedback_response: { singular: 'respuesta a tu feedback', plural: 'respuestas a tu feedback', icon: 'Feedback' },
};

export const DIGEST_MAX_GROUPS = 3;
```

## Firestore Rules

Sin cambios. `notificationDigest` se escribe en el doc de `userSettings` del propio usuario (ya permitido).

## Cloud Functions

Sin cambios. No se necesita Cloud Function para digest — el agrupamiento es client-side.

## Componentes

### `ActivityDigestSection` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/components/home/ActivityDigestSection.tsx` |
| Props | Ninguna |
| Hooks | `useNotificationDigest()`, `useTabNavigation()` |

**Con datos (≥ 1 notificación no leída):**
- Título: "Tu actividad"
- Lista de hasta 3 `DigestGroup` items, cada uno con icono + label ("3 respuestas a tus comentarios")
- Link "Ver todas" → navega a Perfil > Notificaciones

**Sin datos:**
- Icono campana (NotificationsNoneIcon) + "No hay novedades recientes"
- Subtexto: "Calificá y comentá negocios para recibir actividad"
- Botón outlined CTA: "Explorar negocios" → tab Buscar

### `HomeScreen` (modificar)

| Archivo | `src/components/home/HomeScreen.tsx` |
|---|---|
| Cambio | Agregar `<ActivityDigestSection />` después de `<ForYouSection />` |

### `SettingsMenu` (modificar)

| Archivo | `src/components/profile/SettingsMenu.tsx` |
|---|---|
| Cambio | Agregar selector de frecuencia de notificaciones con 3 chips |

**Selector:**
- Label: "Frecuencia de notificaciones"
- Chips: `Tiempo real` | `Diario` | `Semanal`
- Persiste en `userSettings.notificationDigest`

### `NotificationsContext` (modificar)

| Archivo | `src/context/NotificationsContext.tsx` |
|---|---|
| Cambio | Leer `notificationDigest` de settings. Ajustar intervalo de polling según preferencia |

**Lógica de polling por preferencia:**
- `'realtime'`: polling cada 300s (5 min, antes era 60s)
- `'daily'`: una sola carga al montar el contexto, sin polling
- `'weekly'`: una sola carga al montar el contexto, sin polling

## Hooks

### `useNotificationDigest()` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/hooks/useNotificationDigest.ts` |
| Params | Ninguno |
| Return | `{ groups: DigestGroup[], hasActivity: boolean, loading: boolean }` |
| Deps | `useNotifications()` (del contexto existente) |

**Lógica:**
1. Obtiene `notifications` del contexto
2. Filtra solo no leídas (`read === false`)
3. Agrupa por `type`
4. Para cada grupo: genera label con singular/plural de `DIGEST_LABELS`
5. Ordena por `latestAt` descendente
6. Retorna máximo `DIGEST_MAX_GROUPS` (3)

## Integración

| Archivo | Cambio |
|---|---|
| `src/types/index.ts` | Agregar `notificationDigest` a `UserSettings`, agregar `DigestGroup` |
| `src/constants/notifications.ts` | Nuevo archivo con `DIGEST_LABELS` y `DIGEST_MAX_GROUPS` |
| `src/constants/timing.ts` | Cambiar `POLL_INTERVAL_MS` de 60000 a 300000 |
| `src/context/NotificationsContext.tsx` | Leer digest preference, ajustar polling |
| `src/components/home/HomeScreen.tsx` | Agregar `ActivityDigestSection` |
| `src/components/profile/SettingsMenu.tsx` | Agregar selector de frecuencia |

## Tests

| Archivo | Casos |
|---|---|
| `src/hooks/useNotificationDigest.test.ts` | Agrupación por tipo, máximo 3 grupos, sin notificaciones → hasActivity false, mix de leídas/no leídas |
| `src/components/home/ActivityDigestSection.test.tsx` | Render con actividad (muestra grupos), render sin actividad (muestra CTA), link "Ver todas" |
| `src/context/NotificationsContext.test.tsx` | Polling a 300s en realtime, sin polling en daily/weekly |
| `src/components/profile/SettingsMenu.test.tsx` | Selector de frecuencia persiste preferencia |

**Mocks:** `useNotifications` mockeado con array de notificaciones variadas.

## Analytics

| Evento | Params | Cuándo |
|---|---|---|
| `digest_section_viewed` | `{ group_count, has_activity }` | Sección visible |
| `digest_item_tapped` | `{ type, count }` | Tap en un grupo |
| `digest_cta_tapped` | — | Tap en CTA vacío |
| `digest_frequency_changed` | `{ from, to }` | Cambio en Settings |

## Offline

- Notificaciones ya cacheadas en memoria por el contexto
- La sección digest funciona con datos en memoria
- Sin writes adicionales (la preferencia se escribe via `updateUserSettings` que ya soporta offline)

## Decisiones técnicas

1. **Reducir polling de 60s a 300s**: el polling actual es excesivo. 5 min es suficiente para "tiempo real" en una app de descubrimiento (no es chat)
2. **Agrupación client-side**: con < 100 notificaciones por usuario, agrupar en el cliente es trivial. No justifica una Cloud Function
3. **Digest diario/semanal sin cron**: no se necesita un cron para el digest. Simplemente se deja de hacer polling y se carga una vez al abrir. El agrupamiento es el mismo
4. **Max 3 grupos en Home**: la Home ya tiene muchas secciones. 3 líneas de resumen dan suficiente información sin ocupar demasiado espacio
