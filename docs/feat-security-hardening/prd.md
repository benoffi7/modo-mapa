# PRD: Security Hardening — Rate Limiting, Moderación, Monitoreo y Dashboard Admin

## Contexto

La app tiene validaciones client-side y Firestore rules correctas, pero carece de lógica server-side y visibilidad sobre el uso. Los puntos a cubrir son:

1. **Rate limiting server-side** — Los límites son solo client-side (bypasseables)
2. **Moderación de contenido** — No hay filtro de contenido inapropiado
3. **Monitoreo y dashboard** — No hay forma de ver métricas, uso, actividad ni alertas

Actualmente no existe directorio `functions/` ni Cloud Functions configuradas.

---

## Objetivos

### 1. Rate Limiting Server-side

Enforcar límites en Firestore triggers (no depender del cliente):

| Colección | Límite | Ventana |
|-----------|--------|---------|
| `comments` | 20 creates | por día por usuario |
| `customTags` | 10 creates | por comercio por usuario |
| `feedback` | 5 creates | por día por usuario |
| `ratings` | 1 create/update | por comercio por usuario (ya enforced por doc ID compuesto) |

**Implementación**: Cloud Functions `onDocumentCreated` triggers que validan el límite. Si se excede, la función elimina el documento recién creado y loguea el intento.

### 2. Moderación de contenido

Filtrar texto inapropiado en campos de texto libre:

| Campo | Colección | Acción si se detecta |
|-------|-----------|---------------------|
| `text` | `comments` | Marcar como `flagged: true`, no mostrar en UI |
| `label` | `customTags` | Eliminar el documento |
| `message` | `feedback` | Marcar como `flagged: true` |

**Implementación**: Cloud Functions `onDocumentCreated` que ejecuta un filtro de palabras (lista configurable en Firestore `config/moderation`). No se usa IA/API externa para mantener costos en 0.

### 3. Dashboard Admin con métricas completas

Dashboard interno (ruta `/admin`) con autenticación Google, métricas de datos, uso de Firebase, actividad por sección y alertas.

---

## Autenticación del Dashboard

### Flujo de acceso

```text
Usuario navega a /admin
  → AdminGuard verifica si hay sesión Google activa
    → NO: muestra botón "Iniciar sesión con Google"
      → Google Sign-In popup
      → Verifica email == benoffi11@gmail.com
        → NO: muestra "Acceso denegado", sign out
        → SÍ: accede al dashboard
    → SÍ: verifica email
      → Accede al dashboard
```

### Verificación de identidad (2 capas)

**Capa 1 — Frontend (AdminGuard)**:

- Componente wrapper que verifica `user.email === 'benoffi11@gmail.com'`
- Si no es el email autorizado: muestra error y hace sign out automático
- Si no hay sesión Google: muestra botón de login

**Capa 2 — Firestore Rules (server-side)**:

- Las colecciones `config/*` solo permiten lectura si `request.auth.token.email == 'benoffi11@gmail.com'`
- Esto previene acceso directo a la API aunque se bypasee el frontend

### Google Sign-In vs Auth anónima

- La auth anónima sigue para usuarios normales (no cambia nada)
- El admin usa Google Sign-In solo en `/admin`
- Firebase Auth soporta múltiples providers sin conflicto

---

## Métricas del Dashboard

### Sección 1: Datos de la aplicación

Métricas de contenido actual en la app.

| Métrica | Fuente | Visualización |
|---------|--------|---------------|
| Total de comercios | JSON estático (40) | Número grande |
| Total de usuarios registrados | Counter en `config/counters` | Número grande |
| Total de comentarios | Counter en `config/counters` | Número grande |
| Total de ratings | Counter en `config/counters` | Número grande |
| Total de favoritos | Counter en `config/counters` | Número grande |
| Total de feedback | Counter en `config/counters` | Número grande |
| Distribución de ratings (1-5 estrellas) | `config/metrics` diario | **Gráfico de torta** |
| Top 10 comercios más favoriteados | `config/metrics` diario | Tabla con barras |
| Top 10 comercios más comentados | `config/metrics` diario | Tabla con barras |
| Top 10 comercios mejor calificados | `config/metrics` diario | Tabla con barras |
| Tags más usados (predefinidos) | `config/metrics` diario | **Gráfico de torta** |

### Sección 2: Uso de Firebase (cuota y costos)

Métricas de consumo de la infraestructura.

| Métrica | Fuente | Visualización |
|---------|--------|---------------|
| Reads por día | Counter incrementado por triggers | **Gráfico lineal** (últimos 30 días) |
| Writes por día | Counter incrementado por triggers | **Gráfico lineal** (últimos 30 días) |
| Deletes por día | Counter incrementado por triggers | **Gráfico lineal** (últimos 30 días) |
| Reads por colección | Desglose en `config/metrics` | **Gráfico de torta** |
| Writes por colección | Desglose en `config/metrics` | **Gráfico de torta** |
| Usuarios activos por día | Counter de sesiones únicas | **Gráfico lineal** (últimos 30 días) |
| Estimación vs cuota gratuita | Cálculo sobre counters | Barra de progreso (reads 50K/mes, writes 20K/mes) |

**Nota**: Los counters de reads/writes se incrementan desde Cloud Functions triggers. No capturan reads directos del frontend (esos requieren Firestore usage en Firebase Console). Las métricas del dashboard son una aproximación útil basada en las escrituras que pasan por triggers.

### Sección 3: Feed de actividad por sección

Actividad reciente en tiempo real (últimos 20 items por sección).

| Sección | Datos mostrados | Orden |
|---------|----------------|-------|
| Comentarios | usuario, comercio, texto (truncado), fecha | Más reciente primero |
| Ratings | usuario, comercio, score (estrellas), fecha | Más reciente primero |
| Favoritos | usuario, comercio, fecha | Más reciente primero |
| Feedback | usuario, categoría, mensaje (truncado), fecha | Más reciente primero |
| Tags | usuario, comercio, tag, tipo (predefinido/custom), fecha | Más reciente primero |

Cada sección tiene su tab/pestaña en el dashboard. Los items flaggeados se muestran con indicador visual (chip rojo).

### Sección 4: Alertas y abuso

| Alerta | Trigger | Visualización |
|--------|---------|---------------|
| Rate limit excedido | Cloud Function detecta exceso | Lista con usuario, colección, fecha |
| Contenido flaggeado | Cloud Function detecta palabras prohibidas | Lista con contenido, usuario, acción tomada |
| Usuarios con más actividad | Cron diario calcula top writers | Tabla top 10 usuarios por writes |

---

## Gráficos

| Tipo | Uso | Librería |
|------|-----|----------|
| **Torta** | Distribución de ratings, reads por colección, tags más usados | MUI + lightweight chart lib |
| **Lineal** | Reads/writes/deletes por día, usuarios activos por día | MUI + lightweight chart lib |
| **Barras** | Top comercios, estimación vs cuota | MUI `LinearProgress` |
| **Números** | Totales (usuarios, comentarios, etc.) | MUI `Card` con `Typography` |

Librería de gráficos recomendada: `recharts` (ligera, React-native, sin dependencias pesadas).

---

## Arquitectura propuesta

```text
Cloud Functions (functions/)
├── triggers/
│   ├── onCommentCreated    → rate limit + moderación + counters
│   ├── onCommentDeleted    → decrement counters
│   ├── onCustomTagCreated  → rate limit + moderación + counters
│   ├── onCustomTagDeleted  → decrement counters
│   ├── onRatingWritten     → counters + distribución
│   ├── onFavoriteCreated   → counters
│   ├── onFavoriteDeleted   → decrement counters
│   ├── onFeedbackCreated   → rate limit + moderación + counters
│   └── onUserCreated       → counters
├── scheduled/
│   └── dailyMetrics        → agregar métricas diarias (tops, distribución, totales)
└── utils/
    ├── rateLimiter         → lógica compartida de rate limiting
    ├── moderator           → filtro de palabras prohibidas
    └── counters            → helpers para incrementar/decrementar
```

```text
Frontend — /admin
├── AdminGuard              → Google Sign-In + verifica email
├── AdminLayout             → Layout con sidebar de navegación
├── pages/
│   ├── DashboardOverview   → Números grandes + gráficos principales
│   ├── ActivityFeed        → Tabs por sección (comentarios, ratings, etc.)
│   ├── FirebaseUsage       → Gráficos de reads/writes + cuota
│   └── AbuseAlerts         → Contenido flaggeado + rate limit excedido
└── components/
    ├── PieChart            → Wrapper de recharts para tortas
    ├── LineChart           → Wrapper de recharts para líneas
    ├── StatCard            → Card con número grande y label
    ├── TopList             → Tabla con barras de progreso
    └── ActivityTable       → Tabla de actividad con paginación
```

---

## Colecciones nuevas en Firestore

| Colección | Doc ID | Campos | Acceso |
|-----------|--------|--------|--------|
| `config/moderation` | (single doc) | `bannedWords: string[]` | Admin (email check) |
| `config/counters` | (single doc) | `comments`, `ratings`, `favorites`, `feedback`, `users`, `customTags`, `userTags` (numbers); `dailyReads`, `dailyWrites`, `dailyDeletes` (numbers) | Admin read, Functions write |
| `config/metrics` | `YYYY-MM-DD` | `comments`, `ratings`, `newUsers`, `favorites`, `feedback` (numbers); `ratingDistribution` (map 1-5→count); `topBusinesses` (array); `topTags` (array); `readsByCollection` (map); `writesByCollection` (map) | Admin read, Functions write |
| `config/abuse_logs` | auto | `userId`, `type` (rate_limit/flagged), `collection`, `detail` (strings), `timestamp` (Timestamp) | Admin read, Functions write |

---

## Reglas de Firestore nuevas

```text
match /config/{document=**} {
  allow read: if request.auth != null
               && request.auth.token.email == 'benoffi11@gmail.com';
  allow write: if false; // Solo Cloud Functions (admin SDK bypasea rules)
}
```

---

## Dependencias nuevas

| Paquete | Ubicación | Uso |
|---------|-----------|-----|
| `firebase-functions` | `functions/package.json` | Cloud Functions SDK |
| `firebase-admin` | `functions/package.json` | Admin SDK (Firestore desde Functions) |
| `recharts` | `package.json` (frontend) | Gráficos de torta y líneas |

---

## Impacto en el frontend

- **AuthContext**: Agregar función `signInWithGoogle()` y `signOut()` (solo usados en `/admin`)
- **Comentarios**: Agregar campo `flagged` al tipo `Comment` y filtrar en queries
- **CustomTags**: Sin cambio (eliminados server-side si inapropiados)
- **Feedback**: Agregar campo `flagged` al tipo (no visible para el usuario)
- **Router**: Agregar ruta `/admin` con lazy loading
- **Tipos**: Nuevos tipos para métricas, counters, abuse logs

---

## Fuera de alcance

- Moderación con IA/ML (mantener costos en 0)
- Notificaciones push
- Rate limiting por IP (no disponible en Firestore triggers)
- Export de datos a CSV/Excel
- Multi-admin (solo `benoffi11@gmail.com` por ahora)
- Métricas de Google Maps API (se ven en Google Cloud Console directamente)

---

## Criterios de aceptación

- [ ] Cloud Functions desplegadas y funcionales
- [ ] Rate limiting server-side enforced en comments, customTags, feedback
- [ ] Contenido inapropiado filtrado automáticamente
- [ ] Login con Google en `/admin` — solo `benoffi11@gmail.com` accede
- [ ] Verificación de email en Firestore rules (server-side, no bypasseable)
- [ ] Dashboard con métricas de datos (totales, tops, distribución)
- [ ] Gráficos de torta (ratings, tags, reads por colección)
- [ ] Gráficos lineales (reads/writes/deletes/usuarios por día, últimos 30 días)
- [ ] Feed de actividad por sección (comentarios, ratings, favoritos, feedback, tags)
- [ ] Barra de progreso de cuota Firebase (reads/writes vs free tier)
- [ ] Alertas de abuso (rate limit excedido, contenido flaggeado)
- [ ] Emulador de Functions configurado para desarrollo local
- [ ] Tests para todas las Cloud Functions
- [ ] 0 errores de lint, build y tests existentes
