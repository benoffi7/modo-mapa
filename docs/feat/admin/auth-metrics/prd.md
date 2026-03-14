# PRD: Admin Auth Metrics & Data Coverage Gaps

**Issue:** Audit de cobertura admin dashboard
**Fecha:** 2026-03-14
**Version:** 2.3.0

---

## 1. Contexto

Con la incorporacion de email/password auth (issue #80), el sistema ahora maneja
tres metodos de autenticacion (anonymous, email, google), verificacion de email,
y nuevos eventos de analytics. Este documento audita la cobertura completa del
Admin Dashboard versus todos los datos que la app recolecta.

---

## 2. Inventario completo de datos

### 2.1 Firestore Collections (16)

| Collection | Datos clave |
|---|---|
| `users` | displayName, createdAt |
| `favorites` | userId, businessId, createdAt |
| `ratings` | userId, businessId, score, criteria, createdAt |
| `comments` | userId, businessId, text, flagged, likeCount, createdAt |
| `userTags` | userId, businessId, tagId, createdAt |
| `customTags` | userId, businessId, label, createdAt |
| `feedback` | userId, category, message, status, adminResponse, mediaUrl, githubIssueUrl |
| `config` | counters (users/comments/ratings/favorites/feedback/dailyReads/Writes/Deletes), aggregates |
| `dailyMetrics` | date, ratingDistribution, topFavorited/Commented/Rated, topTags, activeUsers, reads/writes/deletes, writesByCollection |
| `abuseLogs` | userId, type, collection, detail, timestamp |
| `commentLikes` | userId, commentId, createdAt |
| `menuPhotos` | userId, businessId, url, status (pending/approved/rejected), createdAt |
| `priceLevels` | userId, businessId, level, createdAt |
| `userRankings` | period, rankings[], computedAt |
| `notifications` | userId, type, message, read, createdAt |
| `userSettings` | profilePublic, notificationsEnabled, notifyLikes/Photos/Rankings/Feedback, analyticsEnabled |

### 2.2 Firebase Analytics Events (24)

| Evento | Parametros |
|---|---|
| `business_view` | business_id, business_name |
| `business_search` | query |
| `business_filter_tag` | tag_name, active |
| `business_filter_price` | price_level, active |
| `business_directions` | business_id |
| `business_share` | business_id, method |
| `comment_submit` | business_id, is_edit, is_reply |
| `comment_like` | comment_id |
| `rating_submit` | business_id, score |
| `criteria_rating_submit` | business_id |
| `favorite_toggle` | business_id, action |
| `tag_vote` | business_id, tag_name |
| `custom_tag_create` | business_id |
| `price_level_vote` | business_id, level |
| `menu_photo_upload` | business_id |
| `feedback_submit` | category |
| `side_menu_open` | - |
| `side_menu_section` | section |
| `dark_mode_toggle` | enabled |
| `screen_view` | screen_name |
| `account_created` | method (NEW #80) |
| `email_sign_in` | - (NEW #80) |
| `sign_out` | method (NEW #80) |
| `password_changed` | - (NEW #80) |

### 2.3 Firebase Auth User Properties

| Propiedad | Fuente |
|---|---|
| `auth_type` | setUserProperty en AuthContext (anonymous/email/google) |

### 2.4 Cloud Functions (30)

- 14 triggers (comments x3, commentLikes x2, customTags x2, feedback, ratings, favorites x2, users, menuPhotos, priceLevels x2)
- 5 scheduled (dailyMetrics, cleanupPhotos, rankings x2, cleanupNotifications)
- 11 callable (backups x4, menuPhotos x4, feedback x3)

---

## 3. Matriz de cobertura: Admin Dashboard

### 3.1 Admin Tabs (9)

| Tab | Componente | Datos que muestra |
|---|---|---|
| Overview | DashboardOverview | Counters (users/comments/ratings/favorites/feedback), rating distribution pie, top tags pie, top 10 favorited/commented/rated, custom tag candidates |
| Actividad | ActivityFeed | Recent comments/ratings/favorites/tags (20 each) |
| Feedback | FeedbackList | All feedback with status filters, respond/resolve/create GitHub issue |
| Tendencias | TrendsPanel | Daily metrics charts: activity by type, active users, total writes (day/week/month/year) |
| Usuarios | UsersPanel | Total/active users, avg actions, top users by comments/ratings/favorites/tags/feedback/total |
| Firebase Usage | FirebaseUsage | Reads/writes/deletes per day (30d), active users per day, writes/deletes by collection, quota estimation |
| Alertas | AbuseAlerts | Abuse logs (rate_limit, flagged, top_writers) |
| Backups | BackupsPanel | Create/list/restore/delete backups |
| Fotos | PhotoReviewPanel | All menu photos with status filter, approve/reject/delete |

### 3.2 Full data-point matrix

| # | Data/Metric | Source | Visible in Admin? | Admin Location | Gap? |
|---|---|---|---|---|---|
| 1 | Total users count | config/counters.users | YES | Overview > StatCard "Usuarios" | - |
| 2 | Total comments count | config/counters.comments | YES | Overview > StatCard "Comentarios" | - |
| 3 | Total ratings count | config/counters.ratings | YES | Overview > StatCard "Ratings" | - |
| 4 | Total favorites count | config/counters.favorites | YES | Overview > StatCard "Favoritos" | - |
| 5 | Total feedback count | config/counters.feedback | YES | Overview > StatCard "Feedback" | - |
| 6 | Total businesses count | allBusinesses static list | YES | Overview > StatCard "Comercios" | - |
| 7 | Rating distribution (1-5) | config/aggregates | YES | Overview > PieChart | - |
| 8 | Top tags usage | config/aggregates | YES | Overview > PieChart | - |
| 9 | Top 10 most favorited | config/aggregates | YES | Overview > TopList | - |
| 10 | Top 10 most commented | config/aggregates | YES | Overview > TopList | - |
| 11 | Top 10 best rated | config/aggregates | YES | Overview > TopList | - |
| 12 | Custom tag candidates | customTags collection | YES | Overview > TopList | - |
| 13 | Recent comments | comments collection | YES | Activity > Comentarios tab | - |
| 14 | Recent ratings | ratings collection | YES | Activity > Ratings tab | - |
| 15 | Recent favorites | favorites collection | YES | Activity > Favoritos tab | - |
| 16 | Recent user tags | userTags collection | YES | Activity > Tags tab | - |
| 17 | Recent custom tags | customTags collection | YES | Activity > Tags tab | - |
| 18 | Feedback list + status | feedback collection | YES | Feedback tab | - |
| 19 | Feedback admin response | feedback.adminResponse | YES | Feedback tab > Acciones | - |
| 20 | Feedback GitHub issue link | feedback.githubIssueUrl | YES | Feedback tab > Ver Issue | - |
| 21 | Daily writes by type | dailyMetrics.writesByCollection | YES | Trends > Actividad por tipo | - |
| 22 | Daily active users | dailyMetrics.activeUsers | YES | Trends > Usuarios activos | - |
| 23 | Daily total writes | dailyMetrics.dailyWrites | YES | Trends > Total escrituras | - |
| 24 | User activity rankings | comments/ratings/favorites/tags/feedback | YES | Users tab > TopLists | - |
| 25 | Total / active users | users + activity collections | YES | Users tab > StatCards | - |
| 26 | Daily reads/writes/deletes | dailyMetrics | YES | Firebase Usage > Line chart | - |
| 27 | Writes by collection (today) | dailyMetrics.writesByCollection | YES | Firebase Usage > Pie chart | - |
| 28 | Deletes by collection (today) | dailyMetrics.deletesByCollection | YES | Firebase Usage > Pie chart | - |
| 29 | Monthly quota estimation | dailyMetrics (30d sum) | YES | Firebase Usage > QuotaBars | - |
| 30 | Abuse logs | abuseLogs collection | YES | Alerts tab | - |
| 31 | Menu photos (all statuses) | menuPhotos collection | YES | Photos tab | - |
| 32 | Backups CRUD | Cloud Storage via callable | YES | Backups tab | - |
| 33 | **Auth method per user** | Firebase Auth providerData | **NO** | - | **GAP** |
| 34 | **Email verified status per user** | Firebase Auth emailVerified | **NO** | - | **GAP** |
| 35 | **Users by auth method breakdown** | Firebase Auth (aggregate) | **NO** | - | **GAP** |
| 36 | **account_created events** | GA4 analytics | **NO** | - | **GAP** |
| 37 | **email_sign_in events** | GA4 analytics | **NO** | - | **GAP** |
| 38 | **sign_out events** | GA4 analytics | **NO** | - | **GAP** |
| 39 | **password_changed events** | GA4 analytics | **NO** | - | **GAP** |
| 40 | **Registration/login activity over time** | GA4 / not tracked in Firestore | **NO** | - | **GAP** |
| 41 | **Notifications (global stats)** | notifications collection | **NO** | - | **GAP** |
| 42 | **User settings (aggregate preferences)** | userSettings collection | **NO** | - | **GAP** |
| 43 | **Price levels (aggregate/activity)** | priceLevels collection | **NO** | - | **GAP** |
| 44 | **Comment likes (aggregate/activity)** | commentLikes collection | **NO** | - | **GAP** |
| 45 | **User rankings (weekly/monthly)** | userRankings collection | **NO** | - | **GAP** |

---

## 4. Coverage Summary

- **32 / 45** data points have admin visibility (71%)
- **13 gaps** found
- **7 gaps** are auth-related (from issue #80)
- **6 gaps** are pre-existing data not surfaced in admin

---

## 5. Gaps Found

### 5.1 Auth-related gaps (NEW from #80)

| Gap | Description | Impact |
|---|---|---|
| Auth method per user | UsersPanel no muestra si un user es anonymous/email/google | No se puede saber cuantos users migraron de anonymous a email/google |
| Email verification status | No hay forma de ver que users verificaron su email | No se puede detectar cuentas email sin verificar |
| Auth method breakdown | No hay pie chart ni counter de users por metodo | No hay visibilidad del adoption rate de email auth |
| Auth analytics events | account_created, email_sign_in, sign_out, password_changed solo van a GA4 | Admin tiene que ir a Firebase Console para ver auth activity |
| Registration/login trends | No se trackea en dailyMetrics | No hay historico de registros/logins en el admin propio |

### 5.2 Pre-existing gaps

| Gap | Description | Impact |
|---|---|---|
| Notifications stats | No hay panel con total notifications, unread rate, tipos mas frecuentes | No hay visibilidad de si las notificaciones funcionan bien |
| User settings aggregates | No hay vista de cuantos users tienen perfil publico, notificaciones activas, analytics activo | No se sabe el engagement con los settings |
| Price levels activity | ActivityFeed no incluye tab de price levels, no hay stats | Votos de nivel de gasto son invisibles en admin |
| Comment likes activity | ActivityFeed no incluye likes, no hay stats de likes/dia | No se puede ver engagement via likes |
| User rankings | Rankings computados weekly/monthly no son visibles en admin | Solo el usuario ve su ranking; admin no tiene vista global |

---

## 6. Recomendaciones

### Priority: Critical

**R1 — Auth method breakdown en Overview**

Agregar al DashboardOverview un PieChartCard con la distribucion de usuarios por
auth method (anonymous vs email vs google). Requiere que el `users` doc en
Firestore almacene el `authMethod` y `emailVerified`, o que se consulte Firebase
Auth Admin SDK via Cloud Function.

**Opcion recomendada:** Cloud Function `getAuthStats` que use Admin SDK
`auth().listUsers()` y retorne counts por provider + verified status. Se llama
una vez al cargar el Overview.

### Priority: Critical

**R2 — Auth method + email verified en UsersPanel**

En la tabla/ranking de usuarios, agregar columnas para auth method y email
verified. Misma Cloud Function de R1 puede retornar el detalle por user.

### Priority: Critical

**R3 — Auth activity en Trends**

Extender `dailyMetrics` Cloud Function para trackear:

- `newAccountsToday` (count de users docs created hoy)
- `emailSignInsToday` (requiere log en Firestore o evento custom)
- `signOutsToday` (requiere log en Firestore o evento custom)

Alternativa: agregar un nuevo chart en TrendsPanel que consuma los counters de
`config/counters` para auth events.

### Priority: Medium

**R4 — Notifications stats en Overview o tab dedicado**

Agregar stat cards: total notifications enviadas, % leidas, breakdown por tipo.
Query a `notifications` collection con aggregation.

### Priority: Medium

**R5 — User settings aggregates en UsersPanel**

Agregar stat cards en UsersPanel: "Perfiles publicos", "Notificaciones activas",
"Analytics activo". Query a `userSettings` collection.

### Priority: Medium

**R6 — Price levels en ActivityFeed**

Agregar tab "Precios" en ActivityFeed mostrando votos de nivel de gasto
recientes. La collection `priceLevels` ya tiene createdAt y los datos necesarios.

### Priority: Medium

**R7 — Comment likes en ActivityFeed**

Agregar tab "Likes" en ActivityFeed mostrando likes recientes. La collection
`commentLikes` ya tiene createdAt, userId, commentId.

### Priority: Low

**R8 — User rankings en admin**

Mostrar el ranking semanal y mensual completo en una nueva seccion del
UsersPanel o en un tab aparte. La collection `userRankings` ya tiene los datos.

### Priority: Low

**R9 — Password changed / sign_out tracking**

Para tener historial propio (sin depender de GA4), crear una collection
`authEvents` que loguee account_created, email_sign_in, sign_out,
password_changed con userId + timestamp. Un trigger o callable lo registraria.

---

## 7. Arquitectura propuesta para R1 + R2

```text
Cloud Function (callable):
  getAuthStats() -> {
    byMethod: { anonymous: N, email: N, google: N },
    emailVerified: { verified: N, unverified: N },
    users: [{ uid, displayName, authMethod, emailVerified, createdAt }]
  }

Admin Frontend:
  DashboardOverview -> PieChartCard "Usuarios por metodo de auth"
                    -> StatCard "Email verificados" / "Sin verificar"
  UsersPanel        -> Columnas authMethod + emailVerified en user list
```

---

## 8. Scope recomendado para implementacion

### Fase 1 (con issue #80 o inmediato despues)

- R1: Auth breakdown pie chart en Overview
- R2: Auth method + verified en UsersPanel
- R3: Auth activity en Trends (al menos newAccounts/dia)

### Fase 2 (mejora incremental)

- R4: Notifications stats
- R5: User settings aggregates
- R6: Price levels en ActivityFeed
- R7: Comment likes en ActivityFeed

### Fase 3 (nice to have)

- R8: Rankings en admin
- R9: Auth events collection propia
