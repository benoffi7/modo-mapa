# Informe de Mejoras Funcionales — Modo Mapa v2.3

**Fecha:** 2026-03-13
**Version actual:** 2.3.0
**Objetivo:** Roadmap de mejoras funcionales para transformar Modo Mapa de una herramienta de consulta en una plataforma social gastronómica.

---

## Resumen ejecutivo

| # | Feature | Prioridad | Complejidad | Impacto | Estado |
|---|---------|-----------|-------------|---------|--------|
| F1 | Comentarios 2.0 (editar, eliminar, likes, orden) | Alta | Media | Alto | IMPLEMENTADO |
| F2 | Fotos de menú (upload + validación admin) | Alta | Alta | Alto | IMPLEMENTADO |
| F3 | Hub social (rankings de usuarios) | Media | Media | Alto | IMPLEMENTADO |
| F4 | Notificaciones in-app | Media | Media | Medio | IMPLEMENTADO |
| F5 | Respuestas a comentarios (threads) | Media | Media | Medio | PENDIENTE |
| F6 | Perfil de usuario público | Baja | Baja | Medio | PARCIAL |
| F7 | Reseñas detalladas (multi-criterio) | Baja | Media | Medio | PENDIENTE |
| F8 | Compartir comercio | Baja | Baja | Bajo | IMPLEMENTADO |
| F9 | Historial de visitas | Baja | Baja | Bajo | IMPLEMENTADO |
| F10 | Sugerencias personalizadas | Baja | Alta | Alto | PENDIENTE |

Progreso global: 7/10 features implementadas (+ 1 parcial)

---

## Mejoras adicionales implementadas (fuera del roadmap original)

| Mejora | Descripción | Version |
|--------|-------------|---------|
| Centralización de constantes | Todas las constantes agrupadas en `src/constants/` (11 módulos) | 2.3.0 |
| Constants Dashboard | Panel dev-only en `/dev/constants` con edición inline, validación, color swatches, hints de ms | 2.3.0 |
| Abuse alerts (admin) | Panel de alertas de abuso con colores y labels por tipo | 2.2.0 |
| Firebase usage monitor | Monitor de reads/writes del free tier en admin | 2.2.0 |
| Backups panel (admin) | Panel de backups con auto-dismiss y paginación | 2.2.0 |
| Theme playground | Panel dev-only para probar el tema en `/dev/theme` | 2.1.0 |
| Dark mode | Soporte completo de modo oscuro con persistencia en localStorage | 2.0.0 |
| PWA | Service worker, offline indicator, installable | 2.0.0 |
| Sentry | Error tracking y performance monitoring | 2.0.0 |

---

## F1 — Comentarios 2.0 — IMPLEMENTADO

**Issue:** [#17](https://github.com/benoffi7/modo-mapa/issues/17)

### F1.1 — Editar comentarios propios — IMPLEMENTADO

- Función `editComment()` en `src/services/comments.ts`
- Edición inline con TextField, botones Guardar/Cancelar
- Campo `updatedAt` en tipo Comment
- Indicador visual "editado"
- Validación server-side con Firestore rules

### F1.2 — Eliminar con undo — IMPLEMENTADO

- Snackbar "Comentario eliminado" con botón "Deshacer" (5 segundos)
- Animación de salida
- Dialog de confirmación eliminado, reemplazado por undo

### F1.3 — Likes en comentarios — IMPLEMENTADO

- Funciones `likeComment()` / `unlikeComment()` en services
- Colección `commentLikes` en Firestore
- Botón like con contador, optimistic UI updates
- Cloud Function trigger para actualizar `likeCount`

### F1.4 — Ordenamiento de comentarios — IMPLEMENTADO

- Selector de orden con Chips: Más recientes, Más antiguos, Más útiles
- Ordenamiento client-side sobre comentarios cargados

---

## F2 — Fotos de menú — IMPLEMENTADO

### Componentes implementados

| Componente | Ubicación | Estado |
|-----------|-----------|--------|
| `MenuPhotoSection` | `business/` | Implementado |
| `MenuPhotoUpload` | `business/` | Implementado |
| `MenuPhotoViewer` | `business/` | Implementado |
| `PhotoReviewPanel` | `admin/` | Implementado |
| `PhotoReviewCard` | `admin/` | Implementado |

### Flujo completo

- Upload con preview y compresión client-side
- Status tracking: pending → approved/rejected
- Panel admin de revisión con aprobar/rechazar
- Botón "Ver menú" en comercios con foto aprobada
- Validación de antigüedad (6 meses) via `SIX_MONTHS_MS`

---

## F3 — Hub social (rankings) — IMPLEMENTADO

### Componentes implementados

| Componente | Ubicación | Estado |
|-----------|-----------|--------|
| `RankingsView` | `menu/` | Implementado |
| `UserScoreCard` | `menu/` | Implementado |
| `RankingItem` | `menu/` | Implementado |

### Funcionalidad

- Períodos: semanal, mensual, anual
- Hook `useRankings()` con `fetchRanking()` y `fetchLatestRanking()`
- Live score calculation via `fetchUserLiveScore()`
- Constantes centralizadas en `src/constants/rankings.ts` (SCORING, MEDALS, ACTION_LABELS, PERIOD_OPTIONS)

---

## F4 — Notificaciones in-app — IMPLEMENTADO

### Componentes implementados

| Componente | Ubicación | Estado |
|-----------|-----------|--------|
| `NotificationBell` | `layout/` | Implementado |
| `NotificationList` | `layout/` | Implementado |
| `NotificationItem` | `layout/` | Implementado |

### Funcionalidad

- Hook `useNotifications()` con polling via `POLL_INTERVAL_MS` (60s)
- Badge con contador de no leídas
- Mark as read
- Navegación contextual al hacer click

---

## F5 — Respuestas a comentarios (threads) — PENDIENTE

### Alcance

Permitir responder a un comentario existente, creando un hilo de conversación.

### Diseño

```text
Juan P. — 12/03, 14:30
  "Las milanesas son espectaculares"
  ♡ 5    💬 2    Responder

    └─ María G. — 12/03, 15:00
       "Totalmente! Probaste la napolitana?"
       ♡ 1

    └─ Pedro M. — 12/03, 16:20
       "Yo recomiendo la de pollo"
       ♡ 0
```

### Modelo de datos

Agregar campo opcional al Comment existente:

```text
parentId?: string     # ID del comentario padre (null = top-level)
```

### Consideraciones

- Máximo 1 nivel de anidamiento (respuestas a respuestas se muestran planas)
- Las respuestas heredan el businessId del padre
- Eliminar un padre no elimina las respuestas (quedan como "comentario eliminado")
- Mostrar respuestas colapsadas por default, expandir con "Ver 2 respuestas"

### Estimación de complejidad: Media

---

## F6 — Perfil de usuario público — PARCIAL

### Implementado

- `UserProfileSheet.tsx` — bottom sheet con perfil del usuario
- Hook `useUserProfile()` con stats, actividad, comentarios recientes
- Accesible al tocar nombre de usuario en comentarios/rankings

### Pendiente

- No existe como ruta pública (`/user/:id`)
- Es un overlay (bottom sheet), no una página standalone
- Falta badge de top 3 del ranking

---

## F7 — Reseñas multi-criterio — PENDIENTE

### Alcance

Extender el sistema de rating actual (1-5 estrellas global) con criterios específicos.

### Criterios propuestos

| Criterio | Icono |
|----------|-------|
| Comida | 🍽️ |
| Atención | 👋 |
| Precio | 💰 |
| Ambiente | 🏠 |
| Rapidez | ⚡ |

### Modelo de datos

Agregar al Rating existente:

```text
criteria?: {
  food?: number        # 1-5
  service?: number     # 1-5
  price?: number       # 1-5
  ambiance?: number    # 1-5
  speed?: number       # 1-5
}
```

### Estimación de complejidad: Media

- Backwards compatible (criteria es opcional)
- La complejidad está en calcular promedios por criterio server-side

---

## F8 — Compartir comercio — IMPLEMENTADO

### Implementado

- `ShareButton.tsx` con Web Share API + fallback a clipboard
- URL con deep link al comercio
- Analytics tracking de shares

---

## F9 — Historial de visitas — IMPLEMENTADO

### Implementado

- Hook `useVisitHistory()` con localStorage
- Tracks `businessId`, `lastVisited`, `visitCount`
- Componente `RecentVisits.tsx` en menú lateral
- Límite configurable via `MAX_VISIT_HISTORY` (constante centralizada)
- Storage key centralizado via `STORAGE_KEY_VISITS`

---

## F10 — Sugerencias personalizadas — PENDIENTE

### Alcance

"Para vos" — lista de comercios sugeridos basados en el comportamiento del usuario.

### Algoritmo (heurístico simple)

```text
score(business) =
  + 3 si la categoría coincide con las más favoriteadas del usuario
  + 2 si tiene tags que el usuario suele votar
  + 1 si está cerca de la ubicación actual
  - 5 si ya es favorito (no sugerir lo que ya conoce)
  - 3 si ya tiene rating del usuario
```

### Implementación

- 100% client-side usando datos ya disponibles (favorites, ratings, userTags, location)
- Sección "Sugeridos para vos" en el menú lateral o como cards horizontales sobre el mapa
- Se recalcula cada vez que se abre (no persiste)

### Estimación de complejidad: Alta (por la lógica de scoring)

- Pero sin costo de Firestore, todo es client-side

---

## Roadmap actualizado

### Fase 1 — Interacción social (v2.0) — COMPLETADA

| Feature | Estado |
|---------|--------|
| F1.1 Editar comentarios | Implementado |
| F1.2 Eliminar con undo | Implementado |
| F1.3 Likes en comentarios | Implementado |
| F1.4 Ordenamiento | Implementado |
| F8 Compartir comercio | Implementado |

### Fase 2 — Contenido visual (v2.1) — COMPLETADA

| Feature | Estado |
|---------|--------|
| F2 Fotos de menú | Implementado |
| F9 Historial de visitas | Implementado |

### Fase 3 — Comunidad (v2.2) — COMPLETADA

| Feature | Estado |
|---------|--------|
| F3 Hub social / Rankings | Implementado |
| F4 Notificaciones in-app | Implementado |
| F6 Perfil de usuario público | Parcial (sheet, no ruta) |

### Fase 4 — Profundidad (v2.3+) — PENDIENTE

| Feature | Estado |
|---------|--------|
| F5 Threads de comentarios | Pendiente |
| F7 Reseñas multi-criterio | Pendiente |
| F10 Sugerencias personalizadas | Pendiente |

---

## Impacto en Firestore quota

| Feature | Reads adicionales | Writes adicionales | Storage | Estado |
|---------|-------------------|--------------------| --------|--------|
| F1 Comentarios 2.0 | +1 query (likes) por comercio | +likes (bajo, toggle) | — | Implementado |
| F2 Fotos de menú | +1 query por comercio | +uploads (bajo, rate limited) | +Cloud Storage | Implementado |
| F3 Rankings | +1 read por período | +cron writes (bajo) | — | Implementado |
| F4 Notificaciones | +1 query por sesión | +trigger writes | — | Implementado |
| F5 Threads | Sin cambio (mismo query) | Sin cambio | — | Pendiente |
| F6 Perfiles | +1 query por click | — | — | Parcial |
| F7 Multi-criterio | Sin cambio | Sin cambio (mismo doc) | — | Pendiente |
| F8 Compartir | — | — | — | Implementado |
| F9 Historial | — (localStorage) | — | — | Implementado |
| F10 Sugerencias | — (client-side) | — | — | Pendiente |

---

## Notas técnicas

### Reutilización de infraestructura existente

- **Service layer**: Todas las features siguen el patrón `src/services/`
- **Cloud Functions triggers**: Patrón idéntico al de comments/ratings/favorites
- **Admin panel**: `useAsyncData` + `AdminPanelWrapper` para tabs
- **Paginación**: `usePaginatedQuery` reutilizable para listas
- **Cache**: `useBusinessDataCache` extendido con TTL centralizado (`BUSINESS_CACHE_TTL_MS`)
- **Moderación**: Moderador de contenido aplica a edición y futuros threads
- **Constantes**: Todas centralizadas en `src/constants/` (11 módulos, barrel export)

### Consideraciones de seguridad

- Todas las features de escritura pasan por el service layer con validación
- Todas necesitan Firestore rules correspondientes
- F2 requiere Storage rules específicas
- Rate limiting server-side para likes, uploads, notificaciones
- Constantes de validación centralizadas (MAX_COMMENT_LENGTH, MAX_COMMENTS_PER_DAY, etc.)
