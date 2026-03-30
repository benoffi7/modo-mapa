# Specs: Docs: actualizar firestore.md + limpiar sidebar

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Alcance

Este feature es 100% documentacion. No hay cambios en codigo fuente, firestore.rules, Cloud Functions, ni componentes. Los archivos afectados son exclusivamente `.md` dentro de `docs/`.

---

## S1. Colecciones faltantes en firestore.md

8 colecciones + 1 subcollection + 1 coleccion interna faltan en la tabla principal de `docs/reference/firestore.md`.

### Colecciones a agregar

| Coleccion | Doc ID | Campos | Reglas |
|-----------|--------|--------|--------|
| `checkins` | auto-generated | userId, businessId, businessName (1-100), createdAt, location? (map: lat -90..90, lng -180..180) | Read owner+admin; create owner (hasOnly, businessId validado, createdAt==request.time); no update; delete owner |
| `follows` | `{followerId}__{followedId}` | followerId, followedId, createdAt | Read follower+followed+admin; create owner (followerId==auth.uid, followedId!=followerId, target no es privado via get userSettings); no update; delete owner |
| `recommendations` | auto-generated | senderId, senderName (1-30), recipientId, businessId, businessName (1-100), message (0-200), read (false en create), createdAt | Read recipient+admin; create sender (senderId==auth.uid, sender!=recipient, businessId validado); update recipient (solo read); no delete |
| `sharedLists` | auto-generated | ownerId, name (1-50), description (0-200), isPublic, itemCount, createdAt, updatedAt, color?, icon?, featured? (admin SDK only), editorIds? (admin SDK only) | Read auth (owner/editor/isPublic/featured/admin); create owner (hasOnly, itemCount==0); update owner (name/desc/isPublic/itemCount/updatedAt/color/icon) o editor (solo itemCount/updatedAt); delete owner |
| `listItems` | auto-generated | listId, businessId, addedBy?, createdAt | Read auth (si parent list es owner/editor/public/featured); create auth (hasOnly, addedBy==auth.uid si presente, caller es owner o editor del list); delete auth (caller es owner o editor del list) |
| `specials` | auto-generated | title, subtitle, icon, type ('featured_list'/'trending'/'custom_link'), referenceId, order, active | Read auth; write admin only |
| `achievements` | auto-generated | label, description, icon, condition (map: metric+threshold), order, active | Read auth; write admin only |
| `_ipRateLimits` | variable | (interno) | No client access; Functions write (admin SDK) |

### Subcollection a agregar

| Parent | Subcollection | Doc ID | Campos | Proposito |
|--------|---------------|--------|--------|-----------|
| `activityFeed/{userId}` | `items` | auto-generated | actorId, actorName, type ('rating'/'comment'/'favorite'), businessId, businessName, referenceId, createdAt, expiresAt | Feed de actividad de usuarios seguidos. Owner read only. Cloud Functions escribe via admin SDK (fan-out). |

### Tipos TypeScript a agregar a la seccion "Tipos principales"

```typescript
// Check-in (registro de visita)
interface CheckIn {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  createdAt: Date;
  location?: {
    lat: number;
    lng: number;
  };
}

// Follow (relacion unidireccional)
interface Follow {
  followerId: string;
  followedId: string;
  createdAt: Date;
}

// Activity feed item (subcollection activityFeed/{userId}/items)
type ActivityType = 'rating' | 'comment' | 'favorite';
interface ActivityFeedItem {
  id: string;
  actorId: string;
  actorName: string;
  type: ActivityType;
  businessId: string;
  businessName: string;
  referenceId: string;
  createdAt: Date;
  expiresAt: Date;
}

// Recommendation (recomendacion entre usuarios)
interface Recommendation {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  businessId: string;
  businessName: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

// Shared list
interface SharedList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  featured: boolean;
  editorIds: string[];
  itemCount: number;
  icon?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

// List item
interface ListItem {
  id: string;
  listId: string;
  businessId: string;
  addedBy: string;
  createdAt: Date;
}

// Special (tarjeta especial en Inicio)
interface Special {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  type: 'featured_list' | 'trending' | 'custom_link';
  referenceId: string;
  order: number;
  active: boolean;
}

// Achievement (definicion de logro)
interface AchievementCondition {
  metric: string;
  threshold: number;
}
interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string;
  condition: AchievementCondition;
  order: number;
  active: boolean;
}
```

### Converters a documentar

Agregar en la seccion "Converters" de firestore.md:

- `checkinConverter` (en `src/config/converters.ts`)
- `sharedListConverter`, `listItemConverter` (en `src/config/converters.ts`)
- `followConverter` (en `src/config/converters.ts`)
- `activityFeedConverter` (en `src/config/converters.ts`)
- `recommendationConverter` (en `src/config/converters.ts`)

Admin converters:
- `specialConverter`, `achievementConverter` (en `src/config/adminConverters.ts`)

---

## S2. Campos faltantes en colecciones existentes

### `users`

Campos a agregar en la tabla de colecciones:

| Campo actual en doc | Faltante en firestore.md | Tipo | Notas |
|---------------------|-------------------------|------|-------|
| displayNameLower | Si | string | Lowercase para busqueda case-insensitive. Solo client write (create/update). |
| avatarId | Si | string? | ID de avatar seleccionado por usuario. |
| followersCount | Si | number | Server-only (Cloud Functions via admin SDK). No en hasOnly() client. |
| followingCount | Si | number | Server-only (Cloud Functions via admin SDK). No en hasOnly() client. |

Actualizar entrada de `users` en tabla de colecciones de:
> displayName, createdAt

A:
> displayName, displayNameLower, avatarId?, createdAt, followersCount (server), followingCount (server)

Actualizar tipo `UserProfile` existente en la seccion de tipos para incluir estos campos:
```typescript
interface UserProfile {
  displayName: string;
  displayNameLower?: string;    // lowercase para busqueda
  avatarId?: string;
  createdAt: Date;
  // Server-only (Cloud Functions):
  // followersCount: number;
  // followingCount: number;
}
```

### `userSettings`

Campos a agregar:

| Campo | Faltante | Tipo | Notas |
|-------|----------|------|-------|
| notifyFollowers | Si | boolean | Notificaciones de nuevos seguidores |
| notifyRecommendations | Si | boolean | Notificaciones de recomendaciones |
| locality | Si | string? | Localidad seleccionada por usuario |
| localityLat | Si | number? | Latitud de la localidad |
| localityLng | Si | number? | Longitud de la localidad |

Actualizar entrada de `userSettings` en tabla de colecciones de:
> profilePublic, notificationsEnabled, notifyLikes, notifyPhotos, notifyRankings, notifyFeedback, notifyReplies, analyticsEnabled, updatedAt

A:
> profilePublic, notificationsEnabled, notifyLikes, notifyPhotos, notifyRankings, notifyFeedback, notifyReplies, notifyFollowers, notifyRecommendations, analyticsEnabled, locality?, localityLat?, localityLng?, updatedAt

Actualizar tipo `UserSettings` en la seccion de tipos:
```typescript
interface UserSettings {
  profilePublic: boolean;
  notificationsEnabled: boolean;
  notifyLikes: boolean;
  notifyPhotos: boolean;
  notifyRankings: boolean;
  notifyFeedback: boolean;
  notifyReplies: boolean;
  notifyFollowers: boolean;       // notificaciones de nuevos seguidores
  notifyRecommendations: boolean; // notificaciones de recomendaciones
  analyticsEnabled: boolean;
  locality?: string;              // localidad seleccionada
  localityLat?: number;           // latitud de localidad
  localityLng?: number;           // longitud de localidad
  updatedAt: Date;
}
```

### `feedback`

Campos a agregar:

| Campo | Faltante | Tipo | Notas |
|-------|----------|------|-------|
| rating | Si | number? (1-5) | Rating de la app en feedback |
| businessId | Si | string? | ID del comercio asociado |
| businessName | Si | string? (1-100) | Nombre del comercio asociado |
| mediaType 'pdf' | Parcial | 'image' \| 'pdf' | Doc actual dice 'image' \| 'video', pero rules y tipo dicen 'image' \| 'pdf' |

Actualizar entrada de `feedback` en tabla de colecciones para incluir `rating?`, `businessId?`, `businessName?`, y corregir `mediaType` de `(image/video)` a `(image/pdf)`.

Actualizar tipo `Feedback` en la seccion de tipos para agregar `rating?`:
```typescript
interface Feedback {
  // ... campos existentes ...
  rating?: number;        // 1-5, rating de la app
  businessId?: string;    // comercio asociado
  businessName?: string;  // nombre del comercio asociado
  mediaType?: 'image' | 'pdf';  // corregir: era 'video', es 'pdf'
}
```

### `comments`

Campos a agregar:

| Campo | Faltante | Tipo | Notas |
|-------|----------|------|-------|
| type | Si | 'comment' \| 'question'? | Tipo de comentario (normal o pregunta Q&A) |

Actualizar entrada de `comments` en tabla de colecciones para incluir `type? ('comment'/'question')`.

Actualizar tipo `Comment` en seccion de tipos para incluir `type?`:
```typescript
interface Comment {
  // ... campos existentes ...
  type?: 'comment' | 'question';  // tipo de comentario
}
```

---

## S3. Limpieza de sidebar

### Diagnostico

- Total links en sidebar: 406
- Links rotos (archivo no existe): 224
- Links validos: 182

### Estrategia

Eliminar todas las entradas de sidebar cuyo archivo destino no existe en disco. Mantener la estructura de secciones (Admin, Content, Infra, Security, Social, Discovery, UX, Fixes, Reports, Legacy PRDs, Tech Debt New Home) pero solo con entradas que tengan archivos existentes.

Tambien eliminar:
- **Postmortem** section completa (directorio no existe)
- **Issues** section completa (directorio no existe)
- Cualquier seccion que quede vacia despues de limpiar links rotos
- Entradas con directorio-only sin archivos (ej: `audit-residuals/` tiene links pero no existe)

### Entradas que deben permanecer

Verificado contra disco, las secciones con archivos existentes son:

**Reference**: todas las 16 entradas (OK)
**Procedures**: 2 entradas (OK)
**Admin**: ninguna entrada con archivos existentes (eliminar seccion entera)
**Content**: solo `conectar-iconpicker-listas` (3 archivos)
**Infra**: `descomponer-comments-list`, `carga-incremental-business-sheet`, `extract-business-data-service`, `coding-standards-gaps`, `data-layer-coverage`, `firebase-import-recommendations`, `offline-read-caching`, `split-large-components`, `test-coverage-gaps`, `limpiar-codigo-muerto`, `reorganizar-components-menu`, `devops-doc-update`, `tech-debt-reply-pagination-boilerplate`, `tech-debt-v2-31-0`, `240-rate-limit-userid-cleanup`, `243-service-layer-violations`, `244-docs-firestore-sidebar`, `245-performance-improvements`
**Security**: `app-check-enforcement`, `anon-auth-abuse`, `anti-scraping`, `storage-menu-photos-owner-scope`, `eliminacion-cuenta`, `rate-limit-por-destinatario`, `users-hasonly-field-injection`, `feedback-media-validation`, `npm-vulnerabilities`, `feedback-rating-validation`, `ratings-rate-limit`, `rate-limit-toggle-abuse`, `revocar-telegram-bot-token`, `usertags-rate-limit-trigger`, `241-affectedkeys-update-rules`, `242-rate-limits-field-validation`
**Social**: `conectar-listas-colaborativas-ui`, `rating-post-checkin`, `201-badges-verificacion`
**Discovery**: `200-trending-zona`, `205-seguir-tags`
**UX**: `accessibility-gaps`, `refactor-business-sheet`, `dark-mode-toggle`, `color-iconos-acciones-rapidas`, `203-notificaciones-digest`, `246-dark-mode-hardcoded-colors`
**Fixes**: `coding-standard-violations`, `docs-minor-fixes`
**Reports**: `backlog-producto`, `changelog`, `tech-debt` (todos existen)
**Legacy PRDs**: `158-rediseno-tab-navigation`, `191-force-app-update`
**Tech Debt New Home**: todos los 7 items con specs y plan

---

## S4. Datos desactualizados en reference docs

### `project-reference.md`

| Dato | Valor actual (incorrecto) | Valor correcto | Linea |
|------|--------------------------|----------------|-------|
| Version | 2.32.0 | 2.32.1 | 3 |
| Admin tabs | "11 tabs" | "16 tabs" | 71 |

### `features.md`

| Dato | Valor actual (incorrecto) | Valor correcto | Linea |
|------|--------------------------|----------------|-------|
| Admin tabs count | "13 tabs" | "16 tabs" | 197 |
| Tabs faltantes en tabla | Social, Especiales, Logros | Agregar 3 filas | despues de 213 |

Las 3 filas faltantes en la tabla de tabs admin de `features.md`:

| Tab | Descripcion |
|-----|-------------|
| **Social** | Panel de metricas sociales (follows, activity feed, recomendaciones). Stats y actividad reciente |
| **Especiales** | CRUD de tarjetas especiales para la pantalla Inicio. Campos: titulo, subtitulo, icono, tipo, referenceId, orden, activo |
| **Logros** | CRUD de definiciones de logros. Campos: label, descripcion, icono, condicion (metrica+umbral), orden, activo |

---

## Seguridad

- No se exponen secretos, API keys ni emails reales en la documentacion
- La documentacion de rules en firestore.md refleja las rules del archivo `firestore.rules` deployeado
- No se documentan detalles de implementacion de seguridad que faciliten ataques (ej: no documentar email exacto del admin)
- Campos `followersCount`/`followingCount` se documentan como "server-only" para dejar claro que no son escribibles por el cliente

---

## Tests

No hay tests automatizados para este feature (solo documentacion). Verificacion manual:

| Verificacion | Metodo |
|-------------|--------|
| Todos los links en sidebar resuelven a archivos existentes | Script bash (ver plan) |
| Las 8 colecciones + subcollection documentadas en firestore.md | Comparar tabla vs firestore.rules |
| Campos actualizados en users, userSettings, feedback, comments | Comparar vs types/index.ts y firestore.rules |
| Version correcta en project-reference.md | Comparar vs package.json |
| 16 tabs admin en features.md y project-reference.md | Comparar vs AdminLayout.tsx |

---

## Decisiones tecnicas

1. **Eliminar entradas rotas vs redirigir**: Se opto por eliminar entradas de sidebar cuyos archivos no existen en vez de crear archivos placeholder. La documentacion de features historicos que ya no tienen archivos se puede regenerar en el futuro si es necesario, pero mantener 224 links rotos es inaceptable.

2. **No agregar secciones nuevas**: Segun el PRD, no se agregan secciones nuevas a la sidebar. Solo se limpia lo existente y se agregan las entradas de specs/plan de este mismo issue (#244).

3. **Documentar `_ipRateLimits`**: Se agrega esta coleccion interna (presente en rules pero no en firestore.md) para completitud, dado que fue introducida en la misma epoca que las demas colecciones faltantes.

4. **mediaType feedback**: Se corrige de `'image' | 'video'` a `'image' | 'pdf'` para reflejar tanto las firestore.rules como el tipo TypeScript real.
