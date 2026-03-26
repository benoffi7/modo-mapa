# Technical Specs: Admin Auth Metrics & Data Coverage Gaps

**Issue:** #84
**Fecha:** 2026-03-14
**Base:** PRD aprobado (`prd.md`)

---

## 1. Scope

Cubrir los 13 gaps de visibilidad identificados en el PRD. Google Sign-In es
exclusivamente para admin y no se cuenta como metodo de usuario regular.

### Fase 1 — Critical (este PR)

- R1: Auth breakdown pie chart en Overview
- R2: Auth method + email verified en UsersPanel
- R3: Auth trends en TrendsPanel (newAccounts/dia)

### Fase 2 — Medium (este PR)

- R4: Notification stats en Overview
- R5: User settings aggregates en UsersPanel
- R6: Price levels tab en ActivityFeed
- R7: Comment likes tab en ActivityFeed

### Fase 3 — Low (fuera de scope, issue separado)

- R8: Rankings en admin
- R9: Auth events collection propia

---

## 2. Cloud Function: `getAuthStats`

### 2.1 Ubicacion

`functions/src/admin/authStats.ts`

### 2.2 Definicion

```typescript
interface AuthStatsResponse {
  byMethod: {
    anonymous: number;
    email: number;
  };
  emailVerification: {
    verified: number;
    unverified: number;
  };
  users: Array<{
    uid: string;
    displayName: string | null;
    authMethod: 'anonymous' | 'email';
    emailVerified: boolean;
    createdAt: string; // ISO date
  }>;
}
```

### 2.3 Implementacion

- Callable function con `onCall`
- Auth check: misma logica que backups (`ADMIN_EMAIL_PARAM`, `emailVerified`)
- Usa Firebase Admin SDK `getAuth().listUsers()` para iterar TODOS los users
- Clasifica cada user por `providerData`:
  - Sin providers o solo `anonymous` -> `anonymous`
  - Provider `password` -> `email`
- Retorna counts agregados + lista detallada
- `enforceAppCheck: !IS_EMULATOR`

### 2.4 Rate limiting

No se necesita rate limiting adicional (el auth check ya garantiza que solo el
admin puede llamarlo).

### 2.5 Export

Agregar en `functions/src/index.ts`:

```typescript
export { getAuthStats } from './admin/authStats';
```

---

## 3. Frontend Service: `fetchAuthStats`

### 3.1 Ubicacion

`src/services/admin.ts` (agregar al archivo existente)

### 3.2 Definicion

```typescript
import { httpsCallable } from 'firebase/firestore';
import { functions } from '../config/firebase';

interface AuthStats {
  byMethod: { anonymous: number; email: number };
  emailVerification: { verified: number; unverified: number };
  users: Array<{
    uid: string;
    displayName: string | null;
    authMethod: 'anonymous' | 'email';
    emailVerified: boolean;
    createdAt: string;
  }>;
}

export async function fetchAuthStats(): Promise<AuthStats> {
  const fn = httpsCallable<void, AuthStats>(functions, 'getAuthStats');
  const result = await fn();
  return result.data;
}
```

---

## 4. DashboardOverview — Auth Breakdown (R1)

### 4.1 Cambios

Agregar al `DashboardData` interface:

```typescript
interface DashboardData {
  counters: AdminCounters | null;
  customTagCounts: Array<{ label: string; value: number }>;
  authStats: AuthStats | null; // NEW
}
```

Llamar `fetchAuthStats()` en el fetcher junto con los otros Promise.all.

### 4.2 Nuevos elementos UI

Despues de los StatCards existentes:

1. **StatCard "Email"** — `authStats.byMethod.email`
2. **StatCard "Anónimos"** — `authStats.byMethod.anonymous`
3. **StatCard "Verificados"** — `authStats.emailVerification.verified`

Despues de los PieChartCards existentes:

4. **PieChartCard "Usuarios por método de auth"** — data:
   - `[{ name: 'Email', value: byMethod.email }, { name: 'Anónimo', value: byMethod.anonymous }]`

### 4.3 Layout

Los nuevos StatCards van en una fila separada debajo de los existentes, con
titulo de seccion "Autenticación" usando Typography variant="subtitle1".

---

## 5. UsersPanel — Auth Columns (R2)

### 5.1 Cambios

Agregar `fetchAuthStats()` al fetcher del panel. Combinar los auth data con el
processData existente.

### 5.2 Nuevos datos en ProcessedData

```typescript
interface ProcessedData {
  users: Array<{ id: string; name: string } & UserStats>;
  totalUsers: number;
  activeUsers: number;
  avgActions: number;
  // NEW
  authByMethod: { anonymous: number; email: number };
  emailVerification: { verified: number; unverified: number };
}
```

### 5.3 Nuevos StatCards

Agregar a la fila de stat cards existente:

- **StatCard "Email"** — count de users con metodo email
- **StatCard "Anónimos"** — count de users con metodo anonymous
- **StatCard "Verificados"** — count de email verificados

### 5.4 Auth info en TopLists

Agregar al label de cada user en las TopList existentes un chip/badge indicando
su auth method (icono de email o anonimo). Esto requiere enriquecer la
`UserStats` con `authMethod` y `emailVerified` del auth data.

---

## 6. TrendsPanel — Auth Trends (R3)

### 6.1 Approach

En lugar de crear una Cloud Function nueva, extender `dailyMetrics` scheduled
function para trackear `newAccounts` (users created today).

### 6.2 Cambios en dailyMetrics Cloud Function

Agregar al doc de dailyMetrics:

```typescript
// Count users created today
const usersSnap = await db
  .collection('users')
  .where('createdAt', '>=', startOfDay)
  .select('createdAt')
  .get();

const newAccounts = usersSnap.size;
```

Agregar `newAccounts` al `.set()`.

### 6.3 Cambios en tipo DailyMetrics

```typescript
export interface DailyMetrics extends PublicMetrics {
  // ... existing fields
  newAccounts?: number; // NEW — optional for backward compat with old docs
}
```

### 6.4 Cambios en TrendsPanel UI

Agregar un nuevo `LineChartCard` "Registros":

```typescript
<LineChartCard
  title="Nuevos registros"
  data={data}
  xAxisKey="label"
  lines={[{ dataKey: 'newAccounts', color: '#e91e63', label: 'Nuevas cuentas' }]}
/>
```

Agregar `newAccounts` al `AggregatedPoint` interface y al `aggregate()` function.

---

## 7. Notification Stats en Overview (R4)

### 7.1 Approach

Nueva funcion `fetchNotificationStats()` en `src/services/admin.ts` que hace
query agregado a la collection `notifications`.

### 7.2 Service

```typescript
interface NotificationStats {
  total: number;
  read: number;
  unread: number;
  byType: Record<string, number>;
}

export async function fetchNotificationStats(): Promise<NotificationStats> {
  const snap = await getDocs(collection(db, COLLECTIONS.NOTIFICATIONS));
  let read = 0;
  const byType: Record<string, number> = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.read) read++;
    const type = data.type as string;
    byType[type] = (byType[type] ?? 0) + 1;
  }
  return { total: snap.size, read, unread: snap.size - read, byType };
}
```

### 7.3 UI en DashboardOverview

Seccion "Notificaciones" con:

- StatCard "Total enviadas"
- StatCard "Leídas" (con porcentaje)
- PieChartCard "Notificaciones por tipo"

---

## 8. User Settings Aggregates en UsersPanel (R5)

### 8.1 Service

```typescript
interface SettingsAggregates {
  totalSettings: number;
  publicProfiles: number;
  notificationsEnabled: number;
  analyticsEnabled: number;
}

export async function fetchSettingsAggregates(): Promise<SettingsAggregates> {
  const snap = await getDocs(collection(db, COLLECTIONS.USER_SETTINGS));
  let publicProfiles = 0;
  let notificationsEnabled = 0;
  let analyticsEnabled = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.profilePublic) publicProfiles++;
    if (d.notificationsEnabled) notificationsEnabled++;
    if (d.analyticsEnabled) analyticsEnabled++;
  }
  return { totalSettings: snap.size, publicProfiles, notificationsEnabled, analyticsEnabled };
}
```

### 8.2 UI en UsersPanel

Seccion "Preferencias de usuarios" con 3 StatCards despues de los existentes.

---

## 9. ActivityFeed — Price Levels tab (R6)

### 9.1 Service

Agregar en `src/services/admin.ts`:

```typescript
export async function fetchRecentPriceLevels(count: number): Promise<PriceLevel[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.PRICE_LEVELS),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceLevel));
}
```

### 9.2 UI

Nuevo tab "Precios" en ActivityFeed con columnas:

- Usuario
- Comercio
- Nivel ($, $$, $$$)
- Fecha

---

## 10. ActivityFeed — Comment Likes tab (R7)

### 10.1 Service

```typescript
export async function fetchRecentCommentLikes(count: number): Promise<CommentLike[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.COMMENT_LIKES),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommentLike));
}
```

### 10.2 UI

Nuevo tab "Likes" en ActivityFeed con columnas:

- Usuario
- Comment ID (truncado)
- Fecha

---

## 11. Tipos nuevos/modificados

### 11.1 `src/types/admin.ts`

```typescript
// Agregar:
export interface AuthUserInfo {
  uid: string;
  displayName: string | null;
  authMethod: 'anonymous' | 'email';
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthStats {
  byMethod: { anonymous: number; email: number };
  emailVerification: { verified: number; unverified: number };
  users: AuthUserInfo[];
}

export interface NotificationStats {
  total: number;
  read: number;
  unread: number;
  byType: Record<string, number>;
}

export interface SettingsAggregates {
  totalSettings: number;
  publicProfiles: number;
  notificationsEnabled: number;
  analyticsEnabled: number;
}

// Modificar DailyMetrics:
export interface DailyMetrics extends PublicMetrics {
  // ... existing
  newAccounts?: number; // NEW
}
```

### 11.2 Tipos PriceLevel y CommentLike

Verificar si ya existen en `src/types/index.ts`. Si no, agregar interfaces
minimas para el admin service.

---

## 12. Archivos a crear/modificar

### Crear

| Archivo | Descripcion |
|---|---|
| `functions/src/admin/authStats.ts` | Cloud Function getAuthStats |

### Modificar

| Archivo | Cambios |
|---|---|
| `functions/src/index.ts` | Export getAuthStats |
| `functions/src/scheduled/dailyMetrics.ts` | Agregar newAccounts tracking |
| `src/types/admin.ts` | AuthStats, NotificationStats, SettingsAggregates, DailyMetrics.newAccounts |
| `src/services/admin.ts` | fetchAuthStats, fetchNotificationStats, fetchSettingsAggregates, fetchRecentPriceLevels, fetchRecentCommentLikes |
| `src/components/admin/DashboardOverview.tsx` | Auth breakdown section, notification stats section |
| `src/components/admin/UsersPanel.tsx` | Auth stat cards, settings aggregates, auth info en user labels |
| `src/components/admin/TrendsPanel.tsx` | newAccounts chart line |
| `src/components/admin/ActivityFeed.tsx` | Tabs Precios y Likes |
| `src/config/adminConverters.ts` | dailyMetrics converter update (newAccounts) |

---

## 13. Seguridad

- `getAuthStats` usa el mismo patron de auth check que las demas callables admin
- Todas las queries nuevas del frontend son read-only a collections existentes
- No se crean collections nuevas (Fase 3 queda fuera de scope)
- Firestore rules existentes ya permiten lectura desde admin (todas las
  collections tienen `allow read: if true` o similar para authenticated users)

---

## 14. Testing

### Cloud Function

- Test unitario para `getAuthStats`: mock de `getAuth().listUsers()` con users
  de distintos providers, verificar clasificacion y counts

### Frontend

- Test de DashboardOverview: verifica que auth pie chart se renderiza con datos
- Test de UsersPanel: verifica stat cards de auth
- Test de TrendsPanel: verifica que la linea newAccounts aparece
- Test de ActivityFeed: verifica tabs Precios y Likes

---

## 15. Backward Compatibility

- `DailyMetrics.newAccounts` es optional (`?`) — docs anteriores no lo tienen
- TrendsPanel maneja `newAccounts ?? 0` en la agregacion
- No se rompe ninguna interfaz existente
