# Technical Specs: Security Hardening — Rate Limiting, Moderación, Monitoreo y Dashboard Admin

## 1. Cloud Functions — Setup

### Inicialización del proyecto

```text
functions/
├── src/
│   ├── index.ts              → exports de todas las functions
│   ├── triggers/
│   │   ├── comments.ts       → onCommentCreated, onCommentDeleted
│   │   ├── customTags.ts     → onCustomTagCreated, onCustomTagDeleted
│   │   ├── feedback.ts       → onFeedbackCreated
│   │   ├── ratings.ts        → onRatingWritten
│   │   ├── favorites.ts      → onFavoriteCreated, onFavoriteDeleted
│   │   └── users.ts          → onUserCreated
│   ├── scheduled/
│   │   └── dailyMetrics.ts   → onSchedule (cada 24h)
│   └── utils/
│       ├── rateLimiter.ts    → lógica de rate limiting
│       ├── moderator.ts      → filtro de palabras prohibidas
│       └── counters.ts       → helpers para incrementar/decrementar
├── package.json
├── tsconfig.json
└── .eslintrc.js
```

### Dependencias (`functions/package.json`)

```json
{
  "name": "modo-mapa-functions",
  "main": "lib/index.js",
  "engines": { "node": "22" },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.3.0"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "firebase-functions-test": "^3.4.0",
    "vitest": "^4.0.18"
  }
}
```

### Firebase config (`firebase.json` — agregar sección functions)

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs22",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
  },
  "emulators": {
    "functions": { "port": 5001 }
  }
}
```

---

## 2. Rate Limiting Server-side

### Interfaz `rateLimiter.ts`

```typescript
interface RateLimitConfig {
  collection: string;    // colección a limitar
  field: string;         // campo para agrupar (ej: 'userId')
  limit: number;         // máximo de documentos
  windowField?: string;  // campo adicional para ventana (ej: 'businessId')
  windowType: 'daily' | 'per_entity';
}

async function checkRateLimit(
  config: RateLimitConfig,
  userId: string,
  entityId?: string
): Promise<boolean>
// Retorna true si EXCEDE el límite (debe eliminar doc)
```

### Configuración de límites

| Colección | Campo agrupador | Límite | Ventana | Query |
|-----------|----------------|--------|---------|-------|
| `comments` | `userId` | 20 | daily | `where('userId', '==', uid)` + `where('createdAt', '>=', startOfDay)` |
| `customTags` | `userId` + `businessId` | 10 | per_entity | `where('userId', '==', uid)` + `where('businessId', '==', bid)` |
| `feedback` | `userId` | 5 | daily | `where('userId', '==', uid)` + `where('createdAt', '>=', startOfDay)` |
| `ratings` | — | — | — | Ya enforced por doc ID compuesto (`{userId}_{businessId}`) |

### Lógica del trigger (ejemplo `comments.ts`)

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { checkRateLimit } from '../utils/rateLimiter';
import { checkModeration } from '../utils/moderator';
import { incrementCounter, trackWrite } from '../utils/counters';

export const onCommentCreated = onDocumentCreated(
  'comments/{commentId}',
  async (event) => {
    const db = getFirestore();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;

    // 1. Rate limit check
    const exceeded = await checkRateLimit({
      collection: 'comments',
      field: 'userId',
      limit: 20,
      windowType: 'daily',
    }, userId);

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'comments',
        detail: 'Exceeded 20 comments/day',
      });
      return;
    }

    // 2. Moderation check
    const flagged = await checkModeration(data.text as string);
    if (flagged) {
      await snap.ref.update({ flagged: true });
      await logAbuse(db, {
        userId,
        type: 'flagged',
        collection: 'comments',
        detail: `Flagged text: "${(data.text as string).slice(0, 100)}"`,
      });
    }

    // 3. Increment counters
    await incrementCounter(db, 'comments', 1);
    await trackWrite(db, 'comments');
  }
);
```

### `startOfDay` — cálculo de ventana diaria

```typescript
function getStartOfDay(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}
```

---

## 3. Moderación de contenido

### Interfaz `moderator.ts`

```typescript
async function checkModeration(text: string): Promise<boolean>
// Retorna true si el texto contiene palabras prohibidas
```

### Fuente de palabras prohibidas

- Doc `config/moderation` en Firestore con campo `bannedWords: string[]`
- La function lee el doc en cada invocación (con caché en memoria por cold start)
- Matching: lowercase + normalización de acentos + word boundary check

```typescript
let cachedWords: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getBannedWords(db: FirebaseFirestore.Firestore): Promise<string[]> {
  const now = Date.now();
  if (cachedWords && now - cacheTimestamp < CACHE_TTL) {
    return cachedWords;
  }
  const doc = await db.doc('config/moderation').get();
  cachedWords = (doc.data()?.bannedWords as string[]) ?? [];
  cacheTimestamp = now;
  return cachedWords;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function checkModeration(
  db: FirebaseFirestore.Firestore,
  text: string
): Promise<boolean> {
  const words = await getBannedWords(db);
  const normalized = normalize(text);
  return words.some((word) => {
    const pattern = new RegExp(`\\b${normalize(word)}\\b`);
    return pattern.test(normalized);
  });
}
```

### Acciones por colección

| Colección | Campo evaluado | Acción si flagged |
|-----------|---------------|-------------------|
| `comments` | `text` | `snap.ref.update({ flagged: true })` |
| `customTags` | `label` | `snap.ref.delete()` |
| `feedback` | `message` | `snap.ref.update({ flagged: true })` |

### Impacto en frontend — campo `flagged`

Agregar a tipos existentes:

```typescript
// src/types/index.ts
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  businessId: string;
  text: string;
  createdAt: Date;
  flagged?: boolean;  // agregado
}
```

Filtrar en queries de frontend:

```typescript
// En BusinessComments.tsx — agregar where clause
const q = query(
  collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
  where('businessId', '==', businessId),
  where('flagged', '!=', true)  // excluir flaggeados
);
```

**Nota**: El `where('flagged', '!=', true)` requiere un índice compuesto en Firestore. Alternativa más simple: filtrar client-side después del fetch:

```typescript
const loaded = snapshot.docs
  .map((d) => d.data())
  .filter((c) => !c.flagged);
```

Se usará filtrado client-side para evitar índices compuestos adicionales y porque el volumen es bajo (40 comercios).

---

## 4. Counters y métricas

### Documento `config/counters`

```typescript
interface Counters {
  comments: number;
  ratings: number;
  favorites: number;
  feedback: number;
  users: number;
  customTags: number;
  userTags: number;
  dailyReads: number;    // reset diario por scheduled function
  dailyWrites: number;   // reset diario por scheduled function
  dailyDeletes: number;  // reset diario por scheduled function
}
```

### Helper `counters.ts`

```typescript
import { FieldValue } from 'firebase-admin/firestore';

const COUNTERS_DOC = 'config/counters';

async function incrementCounter(
  db: FirebaseFirestore.Firestore,
  field: string,
  delta: number
): Promise<void> {
  await db.doc(COUNTERS_DOC).set(
    { [field]: FieldValue.increment(delta) },
    { merge: true }
  );
}

async function trackWrite(
  db: FirebaseFirestore.Firestore,
  collectionName: string
): Promise<void> {
  await db.doc(COUNTERS_DOC).set(
    {
      dailyWrites: FieldValue.increment(1),
    },
    { merge: true }
  );

  // También trackear por colección en métricas del día
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await db.doc(`config/metrics/${today}`).set(
    {
      [`writesByCollection.${collectionName}`]: FieldValue.increment(1),
    },
    { merge: true }
  );
}

async function trackDelete(
  db: FirebaseFirestore.Firestore,
  collectionName: string
): Promise<void> {
  await db.doc(COUNTERS_DOC).set(
    { dailyDeletes: FieldValue.increment(1) },
    { merge: true }
  );
}
```

### Cada trigger incrementa/decrementa

| Trigger | Counter | Delta |
|---------|---------|-------|
| `onCommentCreated` | `comments` | +1 |
| `onCommentDeleted` | `comments` | -1 |
| `onCustomTagCreated` | `customTags` | +1 |
| `onCustomTagDeleted` | `customTags` | -1 |
| `onRatingWritten` | `ratings` | +1 (solo create, no update) |
| `onFavoriteCreated` | `favorites` | +1 |
| `onFavoriteDeleted` | `favorites` | -1 |
| `onFeedbackCreated` | `feedback` | +1 |
| `onUserCreated` | `users` | +1 |

---

## 5. Scheduled function — `dailyMetrics`

### Trigger

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const dailyMetrics = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => { /* ... */ }
);
```

### Lógica

Se ejecuta a las 3:00 AM (Argentina) y calcula:

1. **Distribución de ratings (1-5)**:
   - Query: `collection('ratings')` → count por score
   - Guarda: `ratingDistribution: { '1': n, '2': n, '3': n, '4': n, '5': n }`

2. **Top 10 comercios más favoriteados**:
   - Query: `collection('favorites')` → group by `businessId` → sort desc → top 10
   - Guarda: `topFavorited: [{ businessId, count }]`

3. **Top 10 comercios más comentados**:
   - Query: `collection('comments')` → group by `businessId` → sort desc → top 10
   - Guarda: `topCommented: [{ businessId, count }]`

4. **Top 10 comercios mejor calificados**:
   - Query: `collection('ratings')` → group by `businessId` → avg score → sort desc → top 10
   - Guarda: `topRated: [{ businessId, avgScore, count }]`

5. **Tags más usados**:
   - Query: `collection('userTags')` → group by `tagId` → sort desc
   - Guarda: `topTags: [{ tagId, count }]`

6. **Usuarios activos (top writers)**:
   - Query: todas las colecciones de escritura del día → group by `userId` → sort desc → top 10
   - Guarda en `config/abuse_logs` como tipo `top_writers`

7. **Snapshot de counters diarios**:
   - Copia `dailyReads`, `dailyWrites`, `dailyDeletes` al doc del día
   - Resetea los counters diarios a 0

### Documento de salida `config/metrics/{YYYY-MM-DD}`

```typescript
interface DailyMetrics {
  date: string;
  ratingDistribution: Record<string, number>;  // '1'→n, '2'→n, etc.
  topFavorited: Array<{ businessId: string; count: number }>;
  topCommented: Array<{ businessId: string; count: number }>;
  topRated: Array<{ businessId: string; avgScore: number; count: number }>;
  topTags: Array<{ tagId: string; count: number }>;
  dailyReads: number;
  dailyWrites: number;
  dailyDeletes: number;
  writesByCollection: Record<string, number>;
  readsByCollection: Record<string, number>;
  activeUsers: number;
}
```

---

## 6. Abuse logging

### Documento `config/abuse_logs/{autoId}`

```typescript
interface AbuseLog {
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers';
  collection: string;
  detail: string;
  timestamp: FirebaseFirestore.Timestamp;
}
```

### Helper `logAbuse`

```typescript
async function logAbuse(
  db: FirebaseFirestore.Firestore,
  entry: Omit<AbuseLog, 'timestamp'>
): Promise<void> {
  await db.collection('config/abuse_logs').add({
    ...entry,
    timestamp: FieldValue.serverTimestamp(),
  });
}
```

**Nota sobre path**: `config/abuse_logs` es una subcollection del doc `config`. Path completo: `config/abuse_logs/{autoId}`. Esto permite que las Firestore rules de `config/{document=**}` cubran también estos docs.

**Corrección**: Firestore no permite subcollections bajo un doc path como `config/abuse_logs` directamente. Se usará una collection top-level `abuse_logs` con reglas propias, o bien se creará un doc placeholder `config/abuse` y la subcollection será `config/abuse/logs/{autoId}`.

Opción elegida: **collection top-level `abuseLogs`** para simplificar.

```text
match /abuseLogs/{docId} {
  allow read: if request.auth != null
               && request.auth.token.email == 'benoffi11@gmail.com';
  allow write: if false;
}
```

---

## 7. Firestore Rules — nuevas reglas

### Reglas para `config/*`

```text
match /config/{document=**} {
  allow read: if request.auth != null
               && request.auth.token.email == 'benoffi11@gmail.com';
  allow write: if false; // Solo Cloud Functions (admin SDK bypasea rules)
}
```

### Reglas para `abuseLogs`

```text
match /abuseLogs/{docId} {
  allow read: if request.auth != null
               && request.auth.token.email == 'benoffi11@gmail.com';
  allow write: if false;
}
```

### Actualizar `COLLECTIONS` en frontend

```typescript
// src/config/collections.ts
export const COLLECTIONS = {
  USERS: 'users',
  FAVORITES: 'favorites',
  RATINGS: 'ratings',
  COMMENTS: 'comments',
  USER_TAGS: 'userTags',
  FEEDBACK: 'feedback',
  CUSTOM_TAGS: 'customTags',
  CONFIG: 'config',           // nuevo
  ABUSE_LOGS: 'abuseLogs',   // nuevo
} as const;
```

---

## 8. Autenticación del Dashboard — Google Sign-In

### Modificar `AuthContext.tsx`

Agregar funciones para Google Sign-In (solo usadas en `/admin`):

```typescript
import {
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  displayName: string | null;
  setDisplayName: (name: string) => Promise<void>;
  isLoading: boolean;
  signInWithGoogle: () => Promise<User | null>;  // nuevo
  signOut: () => Promise<void>;                   // nuevo
}
```

### Implementación `signInWithGoogle`

```typescript
const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    return null;
  }
};

const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
  }
};
```

### Habilitar Google Sign-In en Firebase Console

- Firebase Console → Authentication → Sign-in method → Google → Enable
- El provider ya está soportado por Firebase Auth, solo requiere habilitarlo

### CSP — agregar dominios para Google Sign-In popup

Verificar que `firebase.json` CSP ya incluye:

- `frame-src`: `https://www.google.com`, `*.firebaseapp.com` — ya presentes
- `script-src`: `https://apis.google.com`, `https://www.google.com` — ya presentes
- `connect-src`: `*.google.com` — ya presente

No se requieren cambios en CSP.

---

## 9. AdminGuard — componente de protección

### Ubicación: `src/components/admin/AdminGuard.tsx`

```typescript
import { useAuth } from '../../context/AuthContext';

const ADMIN_EMAIL = 'benoffi11@gmail.com';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();

  if (isLoading) {
    return <CircularProgress />;
  }

  // No hay sesión o es anónima → mostrar login
  if (!user || user.isAnonymous) {
    return (
      <Box sx={{ /* centered */ }}>
        <Typography>Panel de Administración</Typography>
        <Button onClick={signInWithGoogle} variant="contained">
          Iniciar sesión con Google
        </Button>
      </Box>
    );
  }

  // Sesión Google pero email incorrecto → denegar
  if (user.email !== ADMIN_EMAIL) {
    // Sign out automático
    signOut();
    return (
      <Box sx={{ /* centered */ }}>
        <Alert severity="error">
          Acceso denegado. Solo {ADMIN_EMAIL} puede acceder.
        </Alert>
      </Box>
    );
  }

  // Email correcto → renderizar dashboard
  return <>{children}</>;
}
```

---

## 10. Routing — ruta `/admin`

### Opción: React Router NO está instalado

El proyecto actualmente no usa React Router. `AppShell` renderiza todo directamente. Para agregar `/admin` sin instalar react-router:

**Opción elegida**: Usar `window.location.pathname` con lazy loading manual.

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');

  if (isAdmin) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <AuthProvider>
            <Suspense fallback={<CircularProgress />}>
              <AdminDashboard />
            </Suspense>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <MapProvider>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <AppShell />
            </APIProvider>
          </MapProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
```

**Nota**: No se carga `MapProvider` ni `APIProvider` en `/admin` — reduce bundle del admin.

---

## 11. Dashboard — estructura de páginas

### Ubicación: `src/pages/AdminDashboard.tsx`

```typescript
import AdminGuard from '../components/admin/AdminGuard';
import AdminLayout from '../components/admin/AdminLayout';

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <AdminLayout />
    </AdminGuard>
  );
}
```

### `AdminLayout.tsx` — layout con tabs

```typescript
import { useState } from 'react';
import { Box, Tabs, Tab, AppBar, Toolbar, Typography, Button } from '@mui/material';
import DashboardOverview from './DashboardOverview';
import ActivityFeed from './ActivityFeed';
import FirebaseUsage from './FirebaseUsage';
import AbuseAlerts from './AbuseAlerts';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const [tab, setTab] = useState(0);
  const { signOut } = useAuth();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography sx={{ flexGrow: 1 }}>Modo Mapa — Admin</Typography>
          <Button color="inherit" onClick={signOut}>Cerrar sesión</Button>
        </Toolbar>
      </AppBar>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Overview" />
        <Tab label="Actividad" />
        <Tab label="Firebase Usage" />
        <Tab label="Alertas" />
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {tab === 0 && <DashboardOverview />}
        {tab === 1 && <ActivityFeed />}
        {tab === 2 && <FirebaseUsage />}
        {tab === 3 && <AbuseAlerts />}
      </Box>
    </Box>
  );
}
```

---

## 12. Dashboard — Sección Overview

### Componentes

#### `StatCard` — número grande con label

```typescript
interface StatCardProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
}
```

Usa MUI `Card` + `Typography` variant `h3` para el número.

#### `DashboardOverview` — composición

```text
Grid container (12 cols)
├── StatCard: Total comercios (40, hardcoded del JSON)
├── StatCard: Total usuarios
├── StatCard: Total comentarios
├── StatCard: Total ratings
├── StatCard: Total favoritos
├── StatCard: Total feedback
├── PieChart: Distribución de ratings (1-5 estrellas)
├── PieChart: Tags más usados
├── TopList: Top 10 comercios más favoriteados
├── TopList: Top 10 comercios más comentados
└── TopList: Top 10 comercios mejor calificados
```

### Data fetching

```typescript
// Lee config/counters para totales
const countersDoc = await getDoc(doc(db, 'config', 'counters'));

// Lee config/metrics/{hoy} para distribución y tops
const today = new Date().toISOString().slice(0, 10);
const metricsDoc = await getDoc(doc(db, 'config/metrics', today));
```

---

## 13. Dashboard — Sección Activity Feed

### Tabs por colección

| Tab | Query | Campos mostrados | Limit |
|-----|-------|------------------|-------|
| Comentarios | `comments` orderBy `createdAt` desc | userName, businessId, text (truncado 50ch), createdAt, flagged | 20 |
| Ratings | `ratings` orderBy `createdAt` desc | userId, businessId, score (estrellas), createdAt | 20 |
| Favoritos | `favorites` orderBy `createdAt` desc | userId, businessId, createdAt | 20 |
| Feedback | `feedback` orderBy `createdAt` desc | userId, message (truncado 100ch), createdAt, flagged | 20 |
| Tags | `userTags` + `customTags` orderBy `createdAt` desc | userId, businessId, tagId/label, tipo, createdAt | 20 |

### Componente `ActivityTable`

```typescript
interface ActivityTableProps<T> {
  items: T[];
  columns: Array<{
    label: string;
    render: (item: T) => React.ReactNode;
  }>;
}
```

Items con `flagged: true` se muestran con un `Chip` color `error` ("Flagged").

### Lectura de datos (admin tiene acceso a todas las colecciones)

**Importante**: Las Firestore rules actuales requieren `request.auth != null` para read en `comments`, `ratings`, `favorites`, `userTags`, `customTags`. El admin con Google Sign-In cumple esta condición (está autenticado). Sin embargo, `feedback` solo permite read al owner (`resource.data.userId == request.auth.uid`).

**Solución**: Agregar regla de read para admin en `feedback`:

```text
match /feedback/{docId} {
  allow read: if (request.auth != null && resource.data.userId == request.auth.uid)
               || (request.auth != null && request.auth.token.email == 'benoffi11@gmail.com');
  allow create: if /* ... existing ... */;
  allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
}
```

Mismo patrón para `users` (admin necesita ver displayNames):

```text
match /users/{userId} {
  allow read: if (request.auth != null && request.auth.uid == userId)
               || (request.auth != null && request.auth.token.email == 'benoffi11@gmail.com');
  allow write: if /* ... existing ... */;
}
```

---

## 14. Dashboard — Sección Firebase Usage

### Gráfico lineal: reads/writes/deletes por día (últimos 30 días)

```typescript
// Query: últimos 30 docs de config/metrics ordenados por ID (YYYY-MM-DD)
const metricsQuery = query(
  collection(db, 'config', 'metrics'),
  orderBy('__name__', 'desc'),
  limit(30)
);
```

**Nota sobre subcollection**: `config/metrics` en el PRD usa doc IDs con fecha. El path real será `config/metrics/{YYYY-MM-DD}`. Pero `config` es un doc, no una collection. Hay dos opciones:

1. **Subcollection**: `config/counters` es un doc → `config` es una collection con docs `counters`, `moderation`. Para métricas diarias: doc `config/metrics` como placeholder y subcollection `config/metrics/daily/{YYYY-MM-DD}`.
2. **Collection separada**: `dailyMetrics/{YYYY-MM-DD}` como collection top-level.

**Opción elegida**: Collection top-level `dailyMetrics/{YYYY-MM-DD}` para simplificar queries y rules.

```text
match /dailyMetrics/{docId} {
  allow read: if request.auth != null
               && request.auth.token.email == 'benoffi11@gmail.com';
  allow write: if false;
}
```

Actualizar `COLLECTIONS`:

```typescript
export const COLLECTIONS = {
  // ... existentes ...
  CONFIG: 'config',
  ABUSE_LOGS: 'abuseLogs',
  DAILY_METRICS: 'dailyMetrics',  // nuevo
} as const;
```

### Datos del gráfico

```typescript
interface DailyMetricsChart {
  date: string;         // YYYY-MM-DD
  reads: number;        // dailyReads
  writes: number;       // dailyWrites
  deletes: number;      // dailyDeletes
}
// Array de 30 items → recharts LineChart
```

### Gráfico de torta: reads/writes por colección

Datos del doc `dailyMetrics/{hoy}`:

- `readsByCollection: { comments: n, ratings: n, ... }`
- `writesByCollection: { comments: n, ratings: n, ... }`

### Barra de progreso: estimación vs cuota gratuita

```typescript
// Cuota gratuita Spark plan:
const FREE_TIER = {
  readsPerDay: 50_000 / 30,   // ~1,667/día
  writesPerDay: 20_000 / 30,  // ~667/día
};

// Mostrar: LinearProgress value={dailyWrites / FREE_TIER.writesPerDay * 100}
```

### Gráfico lineal: usuarios activos por día

El campo `activeUsers` en `dailyMetrics/{YYYY-MM-DD}` contiene el count de usuarios únicos que escribieron ese día (calculado por `dailyMetrics` scheduled function).

---

## 15. Dashboard — Sección Alertas

### Datos

Query `abuseLogs` ordenados por `timestamp` desc, limit 50.

### Visualización

Tabla con columnas: tipo (chip color), usuario, colección, detalle, fecha.

- `rate_limit` → Chip amarillo "Rate Limit"
- `flagged` → Chip rojo "Contenido Flaggeado"
- `top_writers` → Chip azul "Top Writer"

---

## 16. Gráficos — recharts

### Dependencia nueva (frontend)

```bash
npm install recharts
```

### Componentes wrapper

#### `src/components/admin/charts/PieChartCard.tsx`

```typescript
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PieChartCardProps {
  title: string;
  data: Array<{ name: string; value: number }>;
}
```

#### `src/components/admin/charts/LineChartCard.tsx`

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LineChartCardProps {
  title: string;
  data: Array<Record<string, string | number>>;
  lines: Array<{ dataKey: string; color: string; label: string }>;
}
```

---

## 17. Tipos nuevos

### `src/types/admin.ts`

```typescript
export interface AdminCounters {
  comments: number;
  ratings: number;
  favorites: number;
  feedback: number;
  users: number;
  customTags: number;
  userTags: number;
  dailyReads: number;
  dailyWrites: number;
  dailyDeletes: number;
}

export interface DailyMetrics {
  date: string;
  ratingDistribution: Record<string, number>;
  topFavorited: Array<{ businessId: string; count: number }>;
  topCommented: Array<{ businessId: string; count: number }>;
  topRated: Array<{ businessId: string; avgScore: number; count: number }>;
  topTags: Array<{ tagId: string; count: number }>;
  dailyReads: number;
  dailyWrites: number;
  dailyDeletes: number;
  writesByCollection: Record<string, number>;
  readsByCollection: Record<string, number>;
  activeUsers: number;
}

export interface AbuseLog {
  id: string;
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers';
  collection: string;
  detail: string;
  timestamp: Date;
}
```

---

## 18. Converters nuevos

### `src/config/adminConverters.ts`

```typescript
import type { FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';
import type { AdminCounters, DailyMetrics, AbuseLog } from '../types/admin';

export const countersConverter: FirestoreDataConverter<AdminCounters> = {
  toFirestore(data: AdminCounters) { return { ...data }; },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): AdminCounters {
    const d = snap.data(options);
    return {
      comments: d.comments ?? 0,
      ratings: d.ratings ?? 0,
      favorites: d.favorites ?? 0,
      feedback: d.feedback ?? 0,
      users: d.users ?? 0,
      customTags: d.customTags ?? 0,
      userTags: d.userTags ?? 0,
      dailyReads: d.dailyReads ?? 0,
      dailyWrites: d.dailyWrites ?? 0,
      dailyDeletes: d.dailyDeletes ?? 0,
    };
  },
};

export const dailyMetricsConverter: FirestoreDataConverter<DailyMetrics> = {
  toFirestore(data: DailyMetrics) { return { ...data }; },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): DailyMetrics {
    const d = snap.data(options);
    return {
      date: snap.id,
      ratingDistribution: d.ratingDistribution ?? {},
      topFavorited: d.topFavorited ?? [],
      topCommented: d.topCommented ?? [],
      topRated: d.topRated ?? [],
      topTags: d.topTags ?? [],
      dailyReads: d.dailyReads ?? 0,
      dailyWrites: d.dailyWrites ?? 0,
      dailyDeletes: d.dailyDeletes ?? 0,
      writesByCollection: d.writesByCollection ?? {},
      readsByCollection: d.readsByCollection ?? {},
      activeUsers: d.activeUsers ?? 0,
    };
  },
};

export const abuseLogConverter: FirestoreDataConverter<AbuseLog> = {
  toFirestore(data: AbuseLog) { return { ...data }; },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): AbuseLog {
    const d = snap.data(options);
    return {
      id: snap.id,
      userId: d.userId,
      type: d.type,
      collection: d.collection,
      detail: d.detail,
      timestamp: d.timestamp?.toDate?.() ?? new Date(),
    };
  },
};
```

---

## 19. Estructura de archivos nuevos — resumen

```text
functions/
├── src/
│   ├── index.ts
│   ├── triggers/
│   │   ├── comments.ts
│   │   ├── customTags.ts
│   │   ├── feedback.ts
│   │   ├── ratings.ts
│   │   ├── favorites.ts
│   │   └── users.ts
│   ├── scheduled/
│   │   └── dailyMetrics.ts
│   └── utils/
│       ├── rateLimiter.ts
│       ├── moderator.ts
│       ├── counters.ts
│       └── abuseLogger.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts

src/
├── types/
│   └── admin.ts                         (nuevo)
├── config/
│   ├── collections.ts                   (modificado)
│   └── adminConverters.ts              (nuevo)
├── pages/
│   └── AdminDashboard.tsx              (nuevo)
├── components/admin/
│   ├── AdminGuard.tsx                  (nuevo)
│   ├── AdminLayout.tsx                 (nuevo)
│   ├── DashboardOverview.tsx           (nuevo)
│   ├── ActivityFeed.tsx                (nuevo)
│   ├── FirebaseUsage.tsx               (nuevo)
│   ├── AbuseAlerts.tsx                 (nuevo)
│   ├── StatCard.tsx                    (nuevo)
│   ├── TopList.tsx                     (nuevo)
│   ├── ActivityTable.tsx               (nuevo)
│   └── charts/
│       ├── PieChartCard.tsx            (nuevo)
│       └── LineChartCard.tsx           (nuevo)
├── context/
│   └── AuthContext.tsx                 (modificado)
└── App.tsx                             (modificado)

firestore.rules                          (modificado)
firebase.json                            (modificado)
```

---

## 20. Archivos modificados — detalle de cambios

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Agregar `flagged?: boolean` a `Comment` |
| `src/config/collections.ts` | Agregar `CONFIG`, `ABUSE_LOGS`, `DAILY_METRICS` |
| `src/config/converters.ts` | Agregar `flagged` al `commentConverter.fromFirestore` |
| `src/context/AuthContext.tsx` | Agregar `signInWithGoogle`, `signOut`, `GoogleAuthProvider` |
| `src/App.tsx` | Agregar ruta `/admin` con lazy loading |
| `src/components/business/BusinessComments.tsx` | Filtrar `flagged` comments client-side |
| `firestore.rules` | Agregar rules para `config/*`, `abuseLogs`, `dailyMetrics`, admin read en `feedback` y `users` |
| `firebase.json` | Agregar sección `functions` y emulador de functions |
| `package.json` | Agregar `recharts` a dependencies |

---

## 21. Testing

### Cloud Functions tests (`functions/src/__tests__/`)

- **`rateLimiter.test.ts`**: Mock Firestore, verificar que exceder límite retorna true
- **`moderator.test.ts`**: Test normalización, matching de palabras, caché
- **`counters.test.ts`**: Test increment/decrement con mock
- **`triggers/*.test.ts`**: Test cada trigger con firebase-functions-test
  - Verificar que rate limit elimina el doc
  - Verificar que moderación flaggea el doc
  - Verificar que counters se incrementan

### Frontend tests

- **`AdminGuard.test.tsx`**: Test login flow, access denied, authorized access
- **`StatCard.test.tsx`**: Render con props
- **Tipos admin**: Verificar que converters manejan datos incompletos (defaults)

### Emulador local

```bash
# Terminal 1: emuladores (auth + firestore + functions)
firebase emulators:start --only auth,firestore,functions

# Terminal 2: frontend
npm run dev
```

Agregar script en `package.json`:

```json
"dev:full": "firebase emulators:exec --only auth,firestore,functions 'npm run dev'"
```

---

## 22. Orden de implementación

1. **Functions setup**: Inicializar `functions/`, configurar TypeScript, package.json
2. **Utils**: `rateLimiter.ts`, `moderator.ts`, `counters.ts`, `abuseLogger.ts`
3. **Triggers**: Todos los `onDocumentCreated`/`onDocumentDeleted` + tests
4. **Scheduled**: `dailyMetrics.ts` + test
5. **Firestore rules**: Agregar reglas para admin, config, abuseLogs, dailyMetrics
6. **Frontend tipos**: `admin.ts`, actualizar `Comment`, `collections.ts`
7. **AuthContext**: Agregar Google Sign-In + signOut
8. **Routing**: Modificar `App.tsx` para ruta `/admin`
9. **AdminGuard**: Componente de protección
10. **Dashboard layout**: `AdminLayout.tsx` con tabs
11. **Charts**: `PieChartCard.tsx`, `LineChartCard.tsx`
12. **Dashboard pages**: Overview, ActivityFeed, FirebaseUsage, AbuseAlerts
13. **Frontend filter**: Filtrar comments flaggeados
14. **Testing**: Todos los tests
15. **firebase.json**: Configurar functions + emulador
16. **Verificación final**: build, lint, test, emulador local
