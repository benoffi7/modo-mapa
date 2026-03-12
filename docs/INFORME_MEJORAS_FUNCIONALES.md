# Informe de Mejoras Funcionales — Modo Mapa v2.0

**Fecha:** 2026-03-12
**Version base:** 1.5.1
**Objetivo:** Roadmap de mejoras funcionales para transformar Modo Mapa de una herramienta de consulta en una plataforma social gastronómica.

---

## Resumen ejecutivo

| # | Feature | Prioridad | Complejidad | Impacto |
|---|---------|-----------|-------------|---------|
| F1 | Comentarios 2.0 (editar, eliminar, likes, orden) | Alta | Media | Alto |
| F2 | Fotos de menú (upload + validación admin) | Alta | Alta | Alto |
| F3 | Hub social (rankings de usuarios) | Media | Media | Alto |
| F4 | Notificaciones in-app | Media | Media | Medio |
| F5 | Respuestas a comentarios (threads) | Media | Media | Medio |
| F6 | Perfil de usuario público | Baja | Baja | Medio |
| F7 | Reseñas detalladas (multi-criterio) | Baja | Media | Medio |
| F8 | Compartir comercio | Baja | Baja | Bajo |
| F9 | Historial de visitas | Baja | Baja | Bajo |
| F10 | Sugerencias personalizadas | Baja | Alta | Alto |

---

## F1 — Comentarios 2.0

**Issue existente:** [#17](https://github.com/benoffi7/modo-mapa/issues/17) (edición)

### Alcance

Transformar la sección de comentarios de "solo escribir y borrar" a una experiencia interactiva completa con edición, likes y ordenamiento.

### Sub-features

#### F1.1 — Editar comentarios propios

- Botón "Editar" (icono lápiz) visible solo en comentarios del usuario actual
- Inline editing: el texto del comentario se convierte en TextField editable
- Botones "Guardar" / "Cancelar"
- Campo `updatedAt` en Firestore para trackear ediciones
- Indicador visual "editado" (texto sutil al lado de la fecha)
- Validación: mismas reglas que creación (1-500 chars, moderación server-side)
- Firestore rules: solo el owner puede actualizar, validar `updatedAt == request.time`

**Archivos afectados:**

- `src/services/comments.ts` — nueva función `editComment(commentId, text)`
- `src/components/business/BusinessComments.tsx` — UI de edición inline
- `src/types/index.ts` — agregar `updatedAt?` al tipo `Comment`
- `firestore.rules` — regla de update para comments
- `functions/src/triggers/comments.ts` — trigger onUpdate para re-moderar

#### F1.2 — Eliminar comentarios (mejora UX)

- Actualmente funciona, pero mejorar el feedback visual
- Animación de salida (fade out) al eliminar
- Undo transitorio (snackbar "Comentario eliminado" con botón "Deshacer", 5 segundos)
- Eliminar el dialog de confirmación actual (el undo lo reemplaza)

**Archivos afectados:**

- `src/components/business/BusinessComments.tsx` — snackbar + undo logic
- `src/components/menu/CommentsList.tsx` — mismo patrón en lista del menú

#### F1.3 — Likes en comentarios

- Botón corazón/thumbs-up en cada comentario (no en los propios)
- Contador de likes visible
- Toggle: likear / deslikear
- Colección `commentLikes` en Firestore: doc ID `{userId}__{commentId}`
- Cloud Function trigger para actualizar contador `likeCount` en el comentario
- Ordenamiento por utilidad basado en likes

**Modelo de datos:**

```text
commentLikes/{userId}__{commentId}
  ├── userId: string
  ├── commentId: string
  └── createdAt: Timestamp
```

**Campos nuevos en Comment:**

```text
likeCount: number (default 0, actualizado por Cloud Function)
```

**Archivos afectados:**

- `src/types/index.ts` — agregar `likeCount` a Comment
- `src/services/comments.ts` — `likeComment(commentId)`, `unlikeComment(commentId)`
- `src/config/collections.ts` — nueva colección `commentLikes`
- `src/config/converters.ts` — converter para commentLikes
- `src/components/business/BusinessComments.tsx` — botón like + contador
- `firestore.rules` — reglas para commentLikes
- `functions/src/triggers/commentLikes.ts` — counter trigger
- `src/hooks/useBusinessData.ts` — incluir likes del usuario en la query

#### F1.4 — Ordenamiento de comentarios

- Selector de orden en la sección de comentarios del comercio:
  - **Más recientes** (default actual)
  - **Más antiguos**
  - **Más útiles** (por likeCount descendente)
- Chips o Select compacto para no ocupar mucho espacio en el bottom sheet
- El orden se aplica client-side sobre los comentarios ya cargados

**Archivos afectados:**

- `src/components/business/BusinessComments.tsx` — selector + lógica de sort

### Dependencias

- F1.3 (likes) debe implementarse antes o junto con F1.4 (ordenamiento por utilidad)
- F1.1 y F1.2 son independientes entre sí

### Estimación de complejidad

- F1.1: Baja — es una operación CRUD estándar sobre infraestructura existente
- F1.2: Baja — solo UI, sin cambios en backend
- F1.3: Media — nueva colección + trigger + UI
- F1.4: Baja — solo lógica client-side de sort

---

## F2 — Fotos de menú

### Alcance

Permitir a usuarios subir fotos del menú de un comercio. El admin valida las fotos desde el dashboard. Si se aprueba, aparece un botón "Ver menú" en el comercio.

### Flujo de usuario

```text
1. Usuario abre comercio → ve botón "Subir foto del menú" (icono cámara)
2. Selecciona imagen (máx 5 MB, JPG/PNG/WebP)
3. Preview de la imagen antes de enviar
4. Envía → Cloud Function valida tamaño/tipo, sube a Cloud Storage
5. Estado: "Pendiente de revisión" visible para el usuario que subió
6. Admin ve en dashboard → tab "Fotos" → lista de fotos pendientes con preview
7. Admin aprueba o rechaza (con motivo opcional)
8. Si aprueba → botón "Ver menú" aparece en el comercio para todos
9. Si rechaza → usuario ve estado "Rechazada" con motivo
```

### Modelo de datos

```text
menuPhotos/{autoId}
  ├── userId: string
  ├── businessId: string
  ├── storagePath: string          # ruta en Cloud Storage
  ├── thumbnailPath: string        # thumbnail generado por Cloud Function
  ├── status: 'pending' | 'approved' | 'rejected'
  ├── rejectionReason?: string
  ├── reviewedBy?: string          # admin userId
  ├── reviewedAt?: Timestamp
  ├── createdAt: Timestamp
  └── reportCount: number          # para reportes de contenido inapropiado
```

### Cloud Storage

```text
gs://modo-mapa-app.appspot.com/menus/
  ├── {businessId}/
  │   ├── {photoId}_original.jpg
  │   └── {photoId}_thumb.jpg     # 400px, generado server-side
```

### Componentes nuevos

| Componente | Ubicación | Descripción |
|-----------|-----------|-------------|
| `MenuPhotoButton` | `business/` | Botón "Ver menú" / "Subir foto" en BusinessSheet |
| `MenuPhotoUpload` | `business/` | Dialog de upload con preview + crop básico |
| `MenuPhotoViewer` | `business/` | Lightbox para ver la foto del menú aprobada |
| `PhotoReviewPanel` | `admin/` | Tab nueva en admin: lista de fotos pendientes, aprobar/rechazar |

### Cloud Functions

| Función | Tipo | Descripción |
|---------|------|-------------|
| `onMenuPhotoCreate` | trigger (onCreate) | Validar tipo/tamaño, generar thumbnail, actualizar counter |
| `approveMenuPhoto` | callable | Cambiar status a 'approved', notificar |
| `rejectMenuPhoto` | callable | Cambiar status a 'rejected' con motivo |

### Consideraciones técnicas

- **Compresión client-side**: Usar `browser-image-compression` para reducir antes de subir (max 2 MB)
- **Storage rules**: Solo el owner puede subir, nadie puede leer directamente (usar signed URLs o Cloud Function proxy)
- **Rate limit**: Max 3 fotos pendientes por usuario (evitar spam)
- **Quota Firebase Storage**: Plan Spark tiene 5 GB. Considerar limitar a 1 foto aprobada por comercio
- **Cleanup**: Cloud Function scheduled para eliminar fotos rechazadas después de 7 días

### Dependencias

- Requiere Firebase Storage (ya configurado en el proyecto pero no usado actualmente)
- Requiere agregar `firebase/storage` al frontend

### Estimación de complejidad: Alta

- Nueva infraestructura (Storage, thumbnails, signed URLs)
- Panel admin nuevo
- Flujo de moderación async

---

## F3 — Hub social (rankings de usuarios)

### Alcance

Sección nueva en el menú lateral: "Comunidad" o "Rankings". Muestra los usuarios más activos con filtros temporales.

### Diseño

```text
┌─────────────────────────────┐
│ ← Rankings                  │
│                             │
│ [Esta semana] [Este mes] [Este año]
│                             │
│ 🏆 Top contribuidores      │
│                             │
│  1. Juan P.        142 pts  │
│     ████████████████ 🥇     │
│  2. María G.       98 pts   │
│     ███████████ 🥈           │
│  3. Carlos R.      87 pts   │
│     █████████ 🥉             │
│  4. Ana L.         54 pts   │
│     ██████                   │
│  5. Pedro M.       41 pts   │
│     ████                     │
│  ...                        │
│                             │
│ 📊 Tu actividad             │
│  Comentarios: 12            │
│  Ratings: 8                 │
│  Likes dados: 23            │
│  Favoritos: 15              │
│  Tags: 5                    │
│  Posición: #7 de 45         │
│                             │
│ ──────────────────────────  │
│ Puntuación:                 │
│  Comentario = 3 pts         │
│  Rating = 2 pts             │
│  Like = 1 pt                │
│  Tag = 1 pt                 │
│  Favorito = 1 pt            │
└─────────────────────────────┘
```

### Sistema de puntos

| Acción | Puntos |
|--------|--------|
| Comentario | 3 |
| Rating | 2 |
| Like dado | 1 |
| Tag custom creado | 1 |
| Favorito | 1 |
| Foto de menú aprobada | 5 |

### Modelo de datos

Reutilizar la infraestructura existente de `dailyMetrics`. Agregar un cron semanal/mensual que calcule rankings y los guarde en una nueva colección:

```text
userRankings/{period}          # 'weekly_2026-W11', 'monthly_2026-03', 'yearly_2026'
  ├── period: string
  ├── startDate: Timestamp
  ├── endDate: Timestamp
  ├── rankings: [              # top 50
  │   { userId, displayName, score, breakdown: { comments, ratings, likes, tags, favorites, photos } }
  │ ]
  └── totalParticipants: number
```

### Componentes nuevos

| Componente | Ubicación | Descripción |
|-----------|-----------|-------------|
| `RankingsView` | `menu/` | Vista principal con tabs de período + lista de rankings |
| `UserScoreCard` | `menu/` | Card "Tu actividad" con desglose de puntos |
| `RankingItem` | `menu/` | Fila de ranking con barra de progreso y medalla |

### Cloud Functions

| Función | Tipo | Descripción |
|---------|------|-------------|
| `computeWeeklyRanking` | scheduled (lunes 4AM) | Calcula ranking semanal |
| `computeMonthlyRanking` | scheduled (1ro de cada mes, 4AM) | Calcula ranking mensual |
| `computeYearlyRanking` | scheduled (1ro de enero, 4AM) | Calcula ranking anual |

### Consideraciones

- Los rankings se calculan server-side para evitar queries costosas client-side
- Solo se guardan top 50 para limitar tamaño del documento
- El "Tu actividad" del usuario actual se puede calcular client-side sumando sus datos existentes
- Los displayNames se desnormalizan en el ranking (se actualizan en cada cálculo)

### Estimación de complejidad: Media

- La infraestructura de métricas ya existe (dailyMetrics, UsersPanel)
- Solo se necesita un cron nuevo y una UI de lista

---

## F4 — Notificaciones in-app

### Alcance

Sistema de notificaciones para mantener al usuario informado de interacciones con su contenido.

### Eventos que generan notificación

| Evento | Mensaje | Requiere F# |
|--------|---------|-------------|
| Like en tu comentario | "A Juan le gustó tu comentario en La Parrilla" | F1.3 |
| Respuesta a tu comentario | "María respondió tu comentario en Café Roma" | F5 |
| Foto de menú aprobada | "Tu foto del menú de Pizzería Banchero fue aprobada" | F2 |
| Foto de menú rechazada | "Tu foto del menú fue rechazada: imagen borrosa" | F2 |
| Llegaste al top 3 | "Subiste al puesto #2 del ranking semanal" | F3 |

### Modelo de datos

```text
notifications/{autoId}
  ├── userId: string           # destinatario
  ├── type: 'like' | 'reply' | 'photo_approved' | 'photo_rejected' | 'ranking'
  ├── actorId?: string         # quien generó la acción
  ├── actorName?: string       # desnormalizado
  ├── businessId?: string
  ├── referenceId?: string     # commentId, photoId, etc
  ├── message: string
  ├── read: boolean
  ├── createdAt: Timestamp
  └── expiresAt: Timestamp     # auto-cleanup después de 30 días
```

### UI

- Icono de campana en el header del menú lateral (o en SearchBar)
- Badge con contador de no leídas
- Lista de notificaciones con swipe-to-dismiss o mark-as-read
- Click en notificación navega al contexto (comercio, comentario, ranking)

### Estimación de complejidad: Media

- Cloud Function triggers generan las notificaciones
- UI relativamente simple (lista + badge)
- La complejidad está en la navegación contextual

---

## F5 — Respuestas a comentarios (threads)

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

- Cambio en estructura de datos es simple
- La complejidad está en la UI del threading

---

## F6 — Perfil de usuario público

### Alcance

Al tocar el nombre de un usuario (en comentarios, rankings, etc.) se abre un mini-perfil.

### Contenido del perfil

- Avatar + displayName
- Miembro desde (createdAt)
- Stats: comentarios, ratings, favoritos, likes recibidos
- Posición en ranking actual
- Badge si está en top 3 (semanal/mensual)
- Últimos 5 comentarios del usuario

### UI

- Bottom sheet o dialog modal
- No requiere nueva ruta (es un overlay)

### Estimación de complejidad: Baja

- Los datos ya existen, solo necesita una query nueva y UI

---

## F7 — Reseñas multi-criterio

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

### Diseño

- Al calificar, se muestra un panel expandible con los 5 criterios
- Cada criterio tiene estrellas 1-5 (opcional, solo el global es obligatorio)
- En el comercio se muestra el desglose promedio como barras horizontales
- Ranking de "Mejor relación precio-calidad", "Mejor atención", etc.

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

## F8 — Compartir comercio

### Alcance

Botón "Compartir" en BusinessSheet que genera un deep link al comercio.

### Implementación

- Usa Web Share API (nativa en móviles) con fallback a copiar al clipboard
- URL: `https://modo-mapa-app.web.app/?business={businessId}`
- Al abrir el link, el mapa centra y abre el bottom sheet del comercio
- Texto compartido: "Mirá {nombre} en Modo Mapa — {dirección}"

### Estimación de complejidad: Baja

- Web Share API es trivial
- El deep link requiere leer query params en AppShell y setear selectedBusiness

---

## F9 — Historial de visitas

### Alcance

Registro automático de qué comercios abrió el usuario, con fecha.

### Implementación

- Guardar en localStorage (no Firestore) para no gastar quota
- Estructura: `{ businessId, lastVisited, visitCount }[]`
- Nueva sección en menú lateral: "Visitados recientemente"
- Chip "Nuevo" en markers de comercios no visitados
- Límite: últimos 100 comercios

### Estimación de complejidad: Baja

- 100% client-side, sin backend

---

## F10 — Sugerencias personalizadas

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

## Roadmap sugerido

### Fase 1 — Interacción social (v2.0)

Objetivo: hacer la experiencia de comentarios rica e interactiva.

| Feature | Issue |
|---------|-------|
| F1.1 Editar comentarios | #17 (existente) |
| F1.2 Eliminar con undo | nuevo |
| F1.3 Likes en comentarios | nuevo |
| F1.4 Ordenamiento | nuevo |
| F8 Compartir comercio | nuevo |

### Fase 2 — Contenido visual (v2.1)

Objetivo: agregar fotos de menú y mejorar la utilidad de cada comercio.

| Feature | Issue |
|---------|-------|
| F2 Fotos de menú | nuevo |
| F9 Historial de visitas | nuevo |

### Fase 3 — Comunidad (v2.2)

Objetivo: gamificación y engagement.

| Feature | Issue |
|---------|-------|
| F3 Hub social / Rankings | nuevo |
| F4 Notificaciones in-app | nuevo |
| F6 Perfil de usuario público | nuevo |

### Fase 4 — Profundidad (v2.3)

Objetivo: más detalle en la información.

| Feature | Issue |
|---------|-------|
| F5 Threads de comentarios | nuevo |
| F7 Reseñas multi-criterio | nuevo |
| F10 Sugerencias personalizadas | nuevo |

---

## Impacto en Firestore quota

| Feature | Reads adicionales | Writes adicionales | Storage |
|---------|-------------------|--------------------| --------|
| F1 Comentarios 2.0 | +1 query (likes) por comercio | +likes (bajo, toggle) | — |
| F2 Fotos de menú | +1 query por comercio | +uploads (bajo, rate limited) | +Cloud Storage |
| F3 Rankings | +1 read por período | +cron writes (bajo) | — |
| F4 Notificaciones | +1 query por sesión | +trigger writes | — |
| F5 Threads | Sin cambio (mismo query) | Sin cambio | — |
| F6 Perfiles | +1 query por click | — | — |
| F7 Multi-criterio | Sin cambio | Sin cambio (mismo doc) | — |
| F8 Compartir | — | — | — |
| F9 Historial | — (localStorage) | — | — |
| F10 Sugerencias | — (client-side) | — | — |

**Conclusión:** La mayoría de features tienen impacto bajo en quota. F2 (fotos) es la excepción por Cloud Storage. F4 (notificaciones) puede generar más writes pero son controlables con batching.

---

## Notas técnicas

### Reutilización de infraestructura existente

- **Service layer**: Todas las features nuevas siguen el mismo patrón (`src/services/`)
- **Cloud Functions triggers**: Patrón idéntico al de comments/ratings/favorites
- **Admin panel**: `useAsyncData` + `AdminPanelWrapper` para nuevos tabs
- **Paginación**: `usePaginatedQuery` reutilizable para todas las listas nuevas
- **Cache**: `useBusinessDataCache` se extiende con nuevos campos
- **Moderación**: El moderador de contenido existente aplica a F1.1 (editar) y F5 (respuestas)

### Consideraciones de seguridad

- Todas las features de escritura pasan por el service layer con validación
- Todas necesitan Firestore rules correspondientes
- F2 requiere Storage rules específicas
- Rate limiting server-side para F1.3 (likes), F2 (uploads), F4 (notificaciones)
- F3 no necesita rate limiting (es read-only para usuarios)
