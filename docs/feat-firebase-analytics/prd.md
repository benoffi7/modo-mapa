# PRD — Firebase Analytics

**Issue:** [#57](https://github.com/benoffi7/modo-mapa/issues/57)
**Version objetivo:** 2.2.0
**Fecha:** 2026-03-13

---

## Objetivo

Integrar Firebase Analytics para obtener métricas de producto (retención, flujos de usuario, dispositivos, eventos de interacción) sin modificar el admin dashboard existente, que sigue siendo la fuente de métricas de negocio.

---

## Problema

Hoy no hay visibilidad sobre:

- Cuántos usuarios activos hay por día/semana/mes (DAU/WAU/MAU)
- Retención: cuántos vuelven después de N días
- Flujos: qué camino siguen los usuarios (abren mapa → buscan → abren comercio → comentan)
- Dispositivos/navegadores: qué usan los empleados
- Qué features se usan más y cuáles se ignoran

El admin dashboard tiene counters de negocio (total comentarios, ratings, favoritos), pero no responde preguntas de producto.

---

## Solución

Usar Firebase Analytics (gratis e ilimitado) con:

1. **Eventos automáticos**: `page_view`, `session_start`, `first_visit`, `user_engagement`
2. **Screen tracking**: integrado con React Router para trackear navegación
3. **Eventos custom**: acciones clave del usuario con parámetros relevantes
4. **User properties**: rol (anon vs google), tema (light/dark)

---

## Eventos custom

### Interacción con comercios

| Evento | Parámetros | Cuándo |
|--------|-----------|--------|
| `business_view` | `business_id`, `business_name`, `category` | Abrir BusinessSheet |
| `business_search` | `query`, `results_count` | Ejecutar búsqueda |
| `business_filter_tag` | `tag_name`, `active` | Toggle filtro por tag |
| `business_filter_price` | `price_level`, `active` | Toggle filtro por precio |
| `business_share` | `business_id`, `method` (share_api / clipboard) | Compartir comercio |
| `business_directions` | `business_id` | Click en "Cómo llegar" |

### Engagement

| Evento | Parámetros | Cuándo |
|--------|-----------|--------|
| `rating_submit` | `business_id`, `score` | Calificar |
| `comment_submit` | `business_id`, `is_edit` | Comentar o editar |
| `comment_like` | `business_id`, `comment_id` | Likear comentario |
| `favorite_toggle` | `business_id`, `action` (add / remove) | Toggle favorito |
| `tag_vote` | `business_id`, `tag_name` | Votar tag predefinido |
| `custom_tag_create` | `business_id` | Crear tag custom |
| `price_level_vote` | `business_id`, `level` (1/2/3) | Votar nivel de gasto |
| `menu_photo_upload` | `business_id` | Subir foto de menú |

### Navegación

| Evento | Parámetros | Cuándo |
|--------|-----------|--------|
| `side_menu_open` | — | Abrir menú lateral |
| `side_menu_section` | `section` (recientes/favoritos/comentarios/calificaciones/feedback/estadisticas) | Click en sección |
| `feedback_submit` | `category` (bug/sugerencia/otro) | Enviar feedback |
| `dark_mode_toggle` | `enabled` | Cambiar tema |

### Admin (opcional, baja prioridad)

| Evento | Parámetros | Cuándo |
|--------|-----------|--------|
| `admin_tab_view` | `tab_name` | Cambiar tab en admin |
| `admin_photo_action` | `action` (approve/reject/delete) | Acción en foto |
| `admin_backup_action` | `action` (create/restore/delete) | Acción en backup |

---

## User properties

| Propiedad | Valores | Descripción |
|-----------|---------|-------------|
| `auth_type` | `anonymous` / `google` | Tipo de autenticación |
| `theme` | `light` / `dark` | Tema activo |
| `app_version` | `2.2.0` | Versión de la app |

---

## Reglas

1. **Solo producción**: Analytics se inicializa únicamente cuando `import.meta.env.PROD`
2. **No en emuladores**: no existe emulador de Analytics; en DEV los calls son no-op
3. **No bloquea UI**: todos los `logEvent` son fire-and-forget, nunca en await
4. **Sin PII**: nunca loggear email, nombre, o datos identificables en parámetros de eventos
5. **Nombres de evento**: snake_case, max 40 caracteres (límite de Firebase)
6. **Parámetros**: max 25 por evento, strings max 100 caracteres (límites de Firebase)
7. **Admin dashboard intacto**: no se modifica el admin panel ni los triggers/counters existentes

---

## Arquitectura

```text
src/config/firebase.ts          ← getAnalytics(app) solo en PROD
src/utils/analytics.ts          ← helper con logEvent() wrapper + no-op en DEV
src/components/AnalyticsProvider ← screen tracking con React Router useLocation
src/services/*.ts               ← logEvent calls en funciones de servicio
src/components/*.tsx             ← logEvent calls en interacciones de UI
```

### Helper `analytics.ts`

```typescript
// Wrapper seguro — no-op en DEV, no bloquea UI
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void

// User properties
export function setAnalyticsUserProperty(name: string, value: string): void
```

---

## Impacto en bundle

- `firebase/analytics` agrega ~12-15 KB gzip
- Es aceptable dado que el SDK de Firebase ya está incluido (~80 KB gzip)
- Se puede verificar con `npm run analyze`

---

## Fuera de scope

- Modificar el admin dashboard o sus métricas
- Google Analytics 4 web (Firebase Analytics ES GA4 por detrás, se accede desde Firebase Console)
- Política de privacidad (ver [#56](https://github.com/benoffi7/modo-mapa/issues/56))
- Consent banner (se evalúa en #56)
- BigQuery export (futuro, si se necesita análisis avanzado)
- A/B testing / Remote Config

---

## Métricas de éxito

Verificables en Firebase Console después de 1 semana:

- DAU/MAU visibles en el dashboard de Analytics
- Top 10 eventos custom con datos
- Funnel: `session_start` → `business_view` → `rating_submit` medible
- Retención día 1 y día 7 con datos
