# PRD — Fase 2: Fotos de menú + Historial de visitas + Nivel de gasto

**Issues:** [#48](https://github.com/benoffi7/modo-mapa/issues/48), [#49](https://github.com/benoffi7/modo-mapa/issues/49), [#50](https://github.com/benoffi7/modo-mapa/issues/50)
**Version objetivo:** 2.1.0
**Fecha:** 2026-03-12

---

## Objetivo

Agregar contenido visual a los comercios (fotos de menú con validación admin), un historial de visitas client-side, y un sistema de calificación de nivel de gasto para mejorar la utilidad, la información disponible y el engagement.

---

## F2 — Fotos de menú

### Problema

Los usuarios no tienen forma de ver el menú de un comercio antes de ir. La única información disponible es nombre, dirección, categoría y comentarios.

### Solución

Permitir a cualquier usuario subir una foto del menú. El admin la revisa desde el dashboard. Si se aprueba, todos los usuarios ven un botón "Ver menú" en el comercio con la fecha de aprobación visible.

### Flujo de usuario

```text
1. Usuario abre comercio → ve botón "Subir foto del menú" (ícono cámara)
2. Selecciona imagen (máx 5 MB, JPG/PNG/WebP)
3. Preview de la imagen antes de enviar
4. Compresión client-side (max 2 MB con browser-image-compression)
5. Envía → se sube a Cloud Storage → doc en Firestore con status 'pending'
6. Usuario ve estado "Pendiente de revisión" en el comercio
7. Admin ve en dashboard → tab "Fotos" → lista de fotos pendientes con preview
8. Admin aprueba o rechaza (con motivo opcional)
9. Si aprueba → botón "Ver menú" aparece para todos con fecha de aprobación
10. Si rechaza → el usuario que subió ve estado "Rechazada" (con motivo)
```

### Reglas de negocio

- Máximo 1 foto aprobada por comercio (la más reciente aprobada reemplaza la anterior)
- Máximo 3 fotos pendientes por usuario (rate limit para evitar spam)
- Formatos aceptados: JPG, PNG, WebP
- Tamaño máximo: 5 MB (antes de compresión client-side)
- Tamaño post-compresión: max 2 MB
- Thumbnail generado server-side: 400px de ancho
- Fotos rechazadas se eliminan automáticamente después de 7 días
- Cualquier usuario autenticado puede subir
- Solo el admin puede aprobar/rechazar
- El usuario puede ver el estado de sus fotos subidas
- **Fecha de aprobación visible**: tanto en la app pública como en el admin, porque los menús cambian con el tiempo. Permite al usuario evaluar qué tan actualizada está la foto

### Modelo de datos — Firestore

```text
menuPhotos/{autoId}
  ├── userId: string
  ├── businessId: string
  ├── storagePath: string          # ruta en Cloud Storage (original)
  ├── thumbnailPath: string        # thumbnail generado por Cloud Function
  ├── status: 'pending' | 'approved' | 'rejected'
  ├── rejectionReason?: string
  ├── reviewedBy?: string          # admin userId
  ├── reviewedAt?: Timestamp       # fecha de aprobación/rechazo (visible en UI)
  ├── createdAt: Timestamp
  └── reportCount: number          # para reportes futuros
```

### UI — Fecha de aprobación

- **En el comercio (app pública)**: debajo del botón "Ver menú" se muestra "Menú actualizado: 12 mar 2026" usando `reviewedAt`
- **En el admin**: la tabla de fotos muestra `createdAt` (cuándo se subió) y `reviewedAt` (cuándo se revisó)
- Si la foto tiene más de 6 meses se muestra un indicador sutil "Menú posiblemente desactualizado"

### Cloud Storage

```text
gs://modo-mapa-app.appspot.com/menus/
  ├── {businessId}/
  │   ├── {photoId}_original.jpg
  │   └── {photoId}_thumb.jpg     # 400px, generado server-side
```

### Componentes UI

| Componente | Ubicación | Descripción |
|-----------|-----------|-------------|
| `MenuPhotoSection` | `business/` | Sección en BusinessSheet: "Ver menú" (con fecha) si hay foto aprobada, "Subir foto" si no |
| `MenuPhotoUpload` | `business/` | Dialog de upload con preview + barra de progreso |
| `MenuPhotoViewer` | `business/` | Dialog fullscreen/lightbox para ver la foto aprobada |
| `PhotoReviewPanel` | `admin/` | Tab nueva en AdminLayout: lista de fotos pendientes |
| `PhotoReviewCard` | `admin/` | Card individual con preview, info del usuario, fechas, botones aprobar/rechazar |

### Cloud Functions

| Función | Tipo | Descripción |
|---------|------|-------------|
| `onMenuPhotoCreated` | trigger (onCreate) | Genera thumbnail con sharp, actualiza contador |
| `approveMenuPhoto` | callable | Cambia status a 'approved', marca anteriores como reemplazadas |
| `rejectMenuPhoto` | callable | Cambia status a 'rejected' con motivo, programa cleanup |
| `cleanupRejectedPhotos` | scheduled (diario) | Elimina fotos rechazadas con más de 7 días |

### Firestore Rules

- `menuPhotos`: read auth, create owner (max 3 pending), admin update (status changes)
- Storage rules: upload solo auth + carpeta correcta, read público para aprobadas

### Dependencias nuevas

- `browser-image-compression` — compresión client-side antes de upload
- `sharp` — generación de thumbnails en Cloud Functions (ya disponible en Node runtime)

---

## F9 — Historial de visitas

### Problema

Los usuarios no tienen forma de recordar qué comercios visitaron recientemente en la app.

### Solución

Registro automático en localStorage cada vez que un usuario abre un comercio (bottom sheet). Sección "Recientes" en el menú lateral.

### Reglas de negocio

- Se guarda automáticamente al abrir un comercio (setSelectedBusiness)
- Máximo 50 entradas (las más antiguas se descartan)
- Se actualiza la fecha si el comercio ya estaba en la lista
- Datos en localStorage, NO en Firestore (zero cost)
- Sección nueva "Recientes" en el menú lateral (entre Favoritos y Comentarios)
- Click en un item navega al comercio en el mapa

### Modelo de datos — localStorage

```typescript
interface VisitEntry {
  businessId: string;
  lastVisited: string;  // ISO date string
  visitCount: number;
}

// Key: 'modo-mapa-visits'
// Value: VisitEntry[] (max 50, sorted by lastVisited desc)
```

### Componentes UI

| Componente | Ubicación | Descripción |
|-----------|-----------|-------------|
| `RecentVisits` | `menu/` | Lista de comercios visitados recientemente |

### Hook

| Hook | Descripción |
|------|-------------|
| `useVisitHistory` | Lee/escribe localStorage, expone `visits`, `recordVisit(businessId)`, `clearHistory()` |

### Integración

- `BusinessSheet.tsx` llama `recordVisit(business.id)` cuando se abre un comercio
- `SideMenu.tsx` agrega sección "Recientes" con ícono de historial

---

## F10b — Nivel de gasto

### Problema

Los usuarios no tienen información sobre el rango de precios de un comercio. El tag "barato" es binario y subjetivo.

### Solución

Sistema de calificación de nivel de gasto con 3 niveles representados por el emoji de $. Los usuarios votan el nivel que les parece y se muestra el promedio.

### Niveles

| Nivel | Emoji | Significado |
|-------|-------|-------------|
| 1 | $ | Económico |
| 2 | $$ | Moderado |
| 3 | $$$ | Caro |

### Flujo de usuario

```text
1. Usuario abre comercio → ve sección "Nivel de gasto" debajo del rating
2. Muestra el promedio actual: "$$" con texto "Moderado" y cantidad de votos
3. Si el usuario no votó, los $ son clickeables (como las estrellas del rating)
4. Al tocar un nivel, se guarda el voto y se muestra el nuevo promedio
5. El usuario puede cambiar su voto (update, no crear nuevo)
```

### Reglas de negocio

- Cada usuario puede votar 1 vez por comercio (igual que rating)
- El voto es editable (se puede cambiar de $ a $$$ en cualquier momento)
- Se muestra el promedio redondeado al nivel más cercano
- Texto descriptivo: "$" → "Económico", "$$" → "Moderado", "$$$" → "Caro"
- Mínimo 1 voto para mostrar el promedio (si no hay votos, mostrar "Sin votos aún")

### Modelo de datos — Firestore

Reutilizar el patrón de doc ID compuesto:

```text
priceLevels/{userId}__{businessId}
  ├── userId: string
  ├── businessId: string
  ├── level: number              # 1, 2, o 3
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp
```

### Datos agregados

Para evitar queries de todos los votos al abrir un comercio, usar un campo agregado. Dos opciones:

**Opción A — Campo en businessData (Cloud Function trigger):** Un trigger en `priceLevels` actualiza un doc en `businessStats/{businessId}` con `{ avgPriceLevel, priceLevelCount }`. El hook `useBusinessData` lo lee.

**Opción B — Leer todos los votos client-side:** Similar a como se leen los ratings. El hook `useBusinessData` agrega una query más para `priceLevels` filtrada por `businessId`.

Dado que el patrón ya existe para ratings (se leen todos y se calcula promedio client-side), se recomienda **Opción B** para consistencia.

### Componentes UI

| Componente | Ubicación | Descripción |
|-----------|-----------|-------------|
| `BusinessPriceLevel` | `business/` | Sección "$  $$  $$$" con promedio + voto del usuario |

### Integración con filtros y ordenamiento

- **FilterChips**: agregar chip de filtro por nivel de gasto (como los tags predefinidos)
- **Mapa**: filtrar comercios por nivel de gasto seleccionado
- **FavoritesList / RatingsList**: agregar opción de ordenar por nivel de gasto
- **ListFilters**: agregar selector de nivel de gasto mínimo/máximo

### Service layer

| Función | Descripción |
|---------|-------------|
| `upsertPriceLevel(userId, businessId, level)` | Crea o actualiza el voto de nivel de gasto |
| `getPriceLevelsCollection()` | Retorna collection ref para queries |

### Firestore Rules

- `priceLevels`: read auth, create/update owner, level 1-3, timestamps server-side
- Mismo patrón que `ratings`

### Cloud Functions

| Función | Tipo | Descripción |
|---------|------|-------------|
| `onPriceLevelCreated` | trigger (onCreate) | Counters |
| `onPriceLevelUpdated` | trigger (onUpdate) | (solo counters si cambia) |

---

## Fuera de alcance

- Múltiples fotos por comercio (solo 1 aprobada)
- Crop/rotate de imagen (solo preview)
- Notificaciones al usuario cuando su foto es revisada (viene en Fase 3)
- Reportar foto inapropiada (futuro)
- Sync del historial entre dispositivos (es localStorage only)
- Nivel de gasto con decimales (solo 3 niveles discretos)

---

## Impacto en quota Firebase

| Feature | Reads | Writes | Storage |
|---------|-------|--------|---------|
| Fotos de menú | +1 query por comercio (foto aprobada) | +upload (bajo, rate limited) | +Cloud Storage (~2 MB/foto) |
| Historial visitas | 0 (localStorage) | 0 | 0 |
| Nivel de gasto | +1 query por comercio (priceLevels) | +1 write por voto (bajo, toggle) | 0 |

**Storage estimado:** Con 40 comercios y 1 foto aprobada cada uno = ~80 MB. Bien dentro del free tier de 5 GB.

---

## Métricas de éxito

- % de comercios con foto de menú aprobada
- Tiempo promedio de revisión (pendiente → aprobada/rechazada)
- Clicks en "Ver menú"
- Uso de la sección "Recientes" en el menú lateral
- % de comercios con al menos 1 voto de nivel de gasto
- Uso de filtros por nivel de gasto
