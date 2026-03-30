# Firestore — Colecciones y tipos

## Colecciones

| Coleccion | Doc ID | Campos | Reglas |
|-----------|--------|--------|--------|
| `users` | `{userId}` | displayName, displayNameLower, avatarId?, createdAt, followersCount (server), followingCount (server) | R/W owner; admin read |
| `favorites` | `{userId}__{businessId}` | userId, businessId, createdAt | Read auth; create/delete owner |
| `ratings` | `{userId}__{businessId}` | userId, businessId, score (1-5), criteria? (food/service/price/ambiance/speed, each 1-5), createdAt, updatedAt | Read auth; create/update owner, score 1-5, isValidCriteria validation |
| `comments` | auto-generated | userId, userName, businessId, text (1-500), createdAt, updatedAt?, likeCount, flagged?, parentId?, replyCount?, type? ('comment'/'question') | Read auth; create owner (`keys().hasOnly`, no replyCount); update owner (`affectedKeys` text+updatedAt only); delete owner. replyCount managed by Cloud Functions. |
| `commentLikes` | `{userId}__{commentId}` | userId, commentId, createdAt | Read auth; create/delete owner |
| `userTags` | `{userId}__{businessId}__{tagId}` | userId, businessId, tagId, createdAt | Read auth; create/delete owner |
| `customTags` | auto-generated | userId, businessId, label (1-30), createdAt | Read auth; create/update/delete owner |
| `feedback` | auto-generated | userId, message (1-1000), category (bug/sugerencia/datos_usuario/datos_comercio/otro), status (pending/viewed/responded/resolved), createdAt, flagged?, adminResponse?, respondedAt?, respondedBy?, viewedByUser?, mediaUrl?, mediaType? (image/pdf), githubIssueUrl?, rating? (1-5), businessId?, businessName? (1-100) | Create auth+owner; read/delete owner; admin read+update (respond/resolve); user update (viewedByUser) |
| `config` | `counters`, `moderation`, `perfCounters`, `appVersion` | counters: totales + daily reads/writes/deletes; moderation: bannedWords; perfCounters: Cloud Function timings (array union per function name, reset daily); appVersion: minVersion (semver string), updatedAt (timestamp) — force-update check (#191) | appVersion: public read, Admin SDK write; others: admin read, Functions write |
| `dailyMetrics` | `YYYY-MM-DD` | ratingDistribution, tops, activeUsers, newAccounts, daily ops, byCollection, performance? (vitals/queries/functions/sampleCount) | Auth read; Functions write |
| `abuseLogs` | auto-generated | userId, type, collection, detail, timestamp | Admin read; Functions write |
| `menuPhotos` | auto-generated | userId, businessId, storagePath, thumbnailPath, status, rejectionReason?, reviewedBy?, reviewedAt?, createdAt, reportCount | Read auth; create owner (pending only); update/delete: Functions only |
| `priceLevels` | `{userId}__{businessId}` | userId, businessId, level (1-3), createdAt, updatedAt | Read auth; create/update owner, level 1-3; delete owner |
| `userSettings` | `{userId}` | profilePublic, notificationsEnabled, notifyLikes, notifyPhotos, notifyRankings, notifyFeedback, notifyReplies, notifyFollowers, notifyRecommendations, analyticsEnabled, locality?, localityLat?, localityLng?, updatedAt | Read auth; write owner (`keys().hasOnly`) |
| `userRankings` | auto-generated | userId, displayName, score, rank, badge?, period, periodStart | Read auth; write Functions only |
| `notifications` | auto-generated | userId, type, title, body, read, relatedId?, createdAt | Read owner; update owner (read only); create/delete Functions only |
| `perfMetrics` | auto-generated | sessionId, userId?, timestamp, vitals (lcp/inp/cls/ttfb), queries (Record name→{p50,p95,count}), device ({type,connection}), appVersion | Create/update/delete: false (no client writes); read admin. Writes only via `writePerfMetrics` callable (Admin SDK). Functions read (dailyMetrics aggregation) |
| `trendingBusinesses` | `current` | businesses (array: businessId, name, category, score, breakdown, rank), computedAt, periodStart, periodEnd | Read auth; write false (Functions only) |
| `_rateLimits` | `backup_{userId}`, `perf_{userId}`, `delete_{userId}`, `clean_{userId}`, `editors_invite_{userId}`, `editors_remove_{userId}` | count, resetAt, userId | No client access; Functions write (admin SDK). Campo `userId` permite cleanup en account deletion via `deleteAllUserData`. Usado por backups (5/min), perfMetrics (5/dia), deleteUserAccount (1/min), cleanAnonymousData (1/min), inviteListEditor (10/dia), removeListEditor (10/dia) |
| `checkins` | auto-generated | userId, businessId, businessName (1-100), createdAt, location? (map: lat -90..90, lng -180..180) | Read owner+admin; create owner (`keys().hasOnly`, businessId validado, createdAt==request.time); no update; delete owner. Service: `services/checkins.ts` (`createCheckIn`, `fetchMyCheckIns`, `fetchCheckInsForBusiness`, `deleteCheckIn`, `fetchUserCheckIns`) |
| `follows` | `{followerId}__{followedId}` | followerId, followedId, createdAt | Read follower+followed+admin; create owner (followerId==auth.uid, followedId!=followerId, target no es privado via get userSettings); no update; delete owner |
| `recommendations` | auto-generated | senderId, senderName (1-30), recipientId, businessId, businessName (1-100), message (0-200), read (false en create), createdAt | Read recipient+admin; create sender (senderId==auth.uid, sender!=recipient, businessId validado); update recipient (solo read); no delete |
| `sharedLists` | auto-generated | ownerId, name (1-50), description (0-200), isPublic, itemCount, createdAt, updatedAt, color?, icon?, featured? (admin SDK only), editorIds? (admin SDK only) | Read auth (owner/editor/isPublic/featured/admin); create owner (`keys().hasOnly`, itemCount==0); update owner (name/desc/isPublic/itemCount/updatedAt/color/icon) o editor (solo itemCount/updatedAt); delete owner |
| `listItems` | auto-generated | listId, businessId, addedBy?, createdAt | Read auth (si parent list es owner/editor/public/featured); create auth (`keys().hasOnly`, addedBy==auth.uid si presente, caller es owner o editor del list); delete auth (caller es owner o editor del list) |
| `specials` | auto-generated | title, subtitle, icon, type ('featured_list'/'trending'/'custom_link'), referenceId, order, active | Read auth; write admin only |
| `achievements` | auto-generated | label, description, icon, condition (map: metric+threshold), order, active | Read auth; write admin only |
| `_ipRateLimits` | variable | (interno — rate limits por IP) | No client access; Functions write (admin SDK) |

### Subcollections

| Parent | Subcollection | Doc ID | Campos | Proposito |
|--------|---------------|--------|--------|-----------|
| `menuPhotos/{photoId}` | `reports` | `{userId}` | createdAt | Previene reportes duplicados por usuario. `reportCount` en doc padre se incrementa atomicamente. |
| `activityFeed/{userId}` | `items` | auto-generated | actorId, actorName, type ('rating'/'comment'/'favorite'), businessId, businessName, referenceId, createdAt, expiresAt | Feed de actividad de usuarios seguidos. Owner read only. Cloud Functions escribe via admin SDK (fan-out). |

---

## Tipos principales

```typescript
// Business (datos estaticos del JSON)
interface Business {
  id: string;             // "biz_001"
  name: string;           // "La Parrilla de Juan"
  address: string;        // "Av. Corrientes 1234, CABA"
  category: BusinessCategory;
  lat: number;
  lng: number;
  tags: string[];         // ["barato", "buena_atencion"]
  phone: string | null;
}

type BusinessCategory = 'restaurant' | 'cafe' | 'bakery' | 'bar' | 'fastfood' | 'icecream' | 'pizza';

// Tags predefinidos (6)
PREDEFINED_TAGS: barato, apto_celiacos, apto_veganos, rapido, delivery, buena_atencion

// Categorias con labels en espanol (7)
CATEGORY_LABELS: restaurant→Restaurante, cafe→Cafe, bakery→Panaderia, bar→Bar,
                 fastfood→Comida rapida, icecream→Heladeria, pizza→Pizzeria

// Rating with optional multi-criteria
interface RatingCriteria {
  food?: number;      // 1-5
  service?: number;   // 1-5
  price?: number;     // 1-5
  ambiance?: number;  // 1-5
  speed?: number;     // 1-5
}

interface Rating {
  userId: string;
  businessId: string;
  score: number;       // 1-5 (global)
  criteria?: RatingCriteria;
  createdAt: Date;
  updatedAt: Date;
}

// Comment with thread support
interface Comment {
  id: string;
  userId: string;
  userName: string;
  businessId: string;
  text: string;
  createdAt: Date;
  updatedAt?: Date;
  likeCount: number;
  flagged?: boolean;
  parentId?: string;    // ID del comentario padre (threads, 1 nivel)
  replyCount?: number;  // Cantidad de respuestas (solo en root comments)
  type?: 'comment' | 'question';  // tipo de comentario (normal o pregunta Q&A)
}

// Suggestion types
type SuggestionReason = 'category' | 'tags' | 'nearby';
interface SuggestedBusiness {
  business: Business;
  score: number;
  reasons: SuggestionReason[];
}

// Menu Photos & Price Levels
type MenuPhotoStatus = 'pending' | 'approved' | 'rejected';
interface MenuPhoto {
  id: string;
  userId: string;
  businessId: string;
  storagePath: string;
  thumbnailPath: string;
  status: MenuPhotoStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  reportCount: number;
}

interface PriceLevel {
  userId: string;
  businessId: string;
  level: 1 | 2 | 3;      // 1=Economico, 2=Moderado, 3=Caro
  createdAt: Date;
  updatedAt: Date;
}

PRICE_LEVEL_LABELS: 1→Economico ($), 2→Moderado ($$), 3→Caro ($$$)

// Feedback with status tracking
type FeedbackCategory = 'bug' | 'sugerencia' | 'datos_usuario' | 'datos_comercio' | 'otro';
type FeedbackStatus = 'pending' | 'viewed' | 'responded' | 'resolved';

interface Feedback {
  id: string;
  userId: string;
  message: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  createdAt: Date;
  flagged?: boolean;
  adminResponse?: string;
  respondedAt?: Date;
  respondedBy?: string;
  viewedByUser?: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'pdf';
  githubIssueUrl?: string;
  rating?: number;        // 1-5, rating de la app
  businessId?: string;    // comercio asociado
  businessName?: string;  // nombre del comercio asociado
}

// Feedback status colors (constants/feedback.ts)
// pending=warning, viewed=info, responded=success, resolved=secondary

// Notification types
type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking' | 'feedback_response' | 'comment_reply';

// User profile
interface UserProfile {
  displayName: string;
  displayNameLower?: string;    // lowercase para busqueda case-insensitive
  avatarId?: string;            // ID de avatar seleccionado
  createdAt: Date;
  // Server-only (Cloud Functions via admin SDK):
  // followersCount: number;
  // followingCount: number;
}

// User settings (includes notifyFeedback)
interface UserSettings {
  profilePublic: boolean;
  notificationsEnabled: boolean;
  notifyLikes: boolean;
  notifyPhotos: boolean;
  notifyRankings: boolean;
  notifyFeedback: boolean;
  notifyReplies: boolean;           // default true — notificaciones cuando responden a tus comentarios
  notifyFollowers: boolean;         // notificaciones de nuevos seguidores
  notifyRecommendations: boolean;   // notificaciones de recomendaciones
  analyticsEnabled: boolean;
  locality?: string;                // localidad seleccionada
  localityLat?: number;             // latitud de localidad
  localityLng?: number;             // longitud de localidad
  updatedAt: Date;
}

// Admin types
interface AdminCounters {
  comments, ratings, favorites, feedback, users, customTags, userTags,
  commentLikes, priceLevels, menuPhotos,
  dailyReads, dailyWrites, dailyDeletes
}

interface DailyMetrics {
  date, ratingDistribution, topFavorited, topCommented, topRated, topTags,
  dailyReads, dailyWrites, dailyDeletes, byCollection, activeUsers, newAccounts,
  performance?: {
    vitals: Record<string, { p50, p75, p95 }>;
    queries: Record<string, { p50, p95 }>;
    functions: Record<string, { p50, p95, count }>;
    sampleCount: number;
  }
}

// Auth metrics (from getAuthStats callable)
interface AuthStats {
  total: number;
  anonymous: number;
  email: number;
  emailVerified: number;
  emailUnverified: number;
}

// Notification stats (from fetchNotificationStats)
interface NotificationStats {
  total: number;
  read: number;
  unread: number;
  readRate: number;
}

// Settings aggregates (from fetchSettingsAggregates)
interface SettingsAggregates {
  total: number;
  profilePublic: number;
  notificationsEnabled: number;
  analyticsEnabled: number;
}

// Price level stats (from fetchPriceLevelStats)
interface PriceLevelStats {
  total: number;
  byLevel: Record<number, number>;
}

// Comment like stats (from fetchCommentLikeStats)
interface CommentLikeStats {
  total: number;
  recent: Array<{ id: string; userId: string; commentId: string; createdAt: Date }>;
}

interface AbuseLog { id, userId, type, collection, detail, timestamp }

// Performance metrics (captured per session)
interface PerfVitals { lcp: number | null; inp: number | null; cls: number | null; ttfb: number | null }
interface QueryTiming { p50: number; p95: number; count: number }
interface DeviceInfo { type: 'mobile' | 'desktop'; connection: string }
interface PerfMetricsDoc {
  sessionId: string;
  userId: string | null;
  timestamp: Timestamp;
  vitals: PerfVitals;
  queries: Record<string, QueryTiming>;
  device: DeviceInfo;
  appVersion: string;
}

// Storage stats (from getStorageStats callable)
interface StorageStats { totalBytes: number; fileCount: number; updatedAt: string }

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

---

## Converters (`src/config/converters/`)

Todos los tipos tienen un `FirestoreDataConverter<T>` centralizado. Las lecturas usan `withConverter<T>()` para tipado seguro. Las escrituras **no** usan converter (necesitan `serverTimestamp()` que no es compatible con los tipos del converter).

Converters disponibles:

- `ratingConverter`, `commentConverter`, `commentLikeConverter`
- `favoriteConverter`, `userTagConverter`, `customTagConverter`
- `feedbackConverter`, `menuPhotoConverter`, `priceLevelConverter`
- `checkinConverter`, `followConverter`, `activityFeedConverter`
- `sharedListConverter`, `listItemConverter`, `recommendationConverter`

Admin converters (`src/config/adminConverters.ts`):

- `adminCountersConverter`, `dailyMetricsConverter` (includes `newAccounts` field), `abuseLogConverter`
- `specialConverter`, `achievementConverter`

Metrics converter (`src/config/metricsConverter.ts`):

- `publicMetricsConverter`

---

## Cloud Storage — Fotos de menu

### Estructura

```text
menu-photos/
└── {userId}/
    └── {timestamp}_{businessId}.jpg    # Original
    └── thumb_{timestamp}_{businessId}.jpg  # Thumbnail (generado por Cloud Function)
```

### Reglas (`storage.rules`)

- **Upload**: solo usuarios autenticados, a su propio path (`menu-photos/{userId}/`), maximo 5MB, solo imagenes (`image/*`).
- **Read**: cualquier usuario autenticado puede leer.
- **Delete**: solo Cloud Functions (admin SDK).

---

## Cloud Storage — Feedback media

### Estructura

```text
feedback-media/
└── {feedbackId}/
    └── {fileName}    # Imagen adjunta al feedback
```

### Reglas (`storage.rules`)

- **Upload**: usuarios autenticados, maximo 10MB, solo imagenes (`image/jpeg`, `image/png`, `image/webp`).
- **Read**: cualquier usuario autenticado.
- **Delete**: cualquier usuario autenticado.

---

## Cloud Storage — Backups

### Bucket

- **Nombre**: `modo-mapa-app-backups`
- **Region**: `southamerica-east1`
- **Estructura**: `gs://modo-mapa-app-backups/backups/{timestamp}/`
- **Formato timestamp**: ISO 8601 con `:` y `.` reemplazados por `-` (ej: `2026-03-12T14-30-00-000Z`)

### Lifecycle policy

- **Retencion**: 90 dias. Los backups mas antiguos se eliminan automaticamente via lifecycle rule del bucket.
- **Eliminacion manual**: disponible via `deleteBackup` Cloud Function.

### Backups de seguridad pre-restore

Antes de cada restore, se crea automaticamente un backup con prefijo `pre-restore-` para poder revertir si algo sale mal.
