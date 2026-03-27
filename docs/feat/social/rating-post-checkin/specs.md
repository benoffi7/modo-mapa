# Specs: Rating post check-in prompt

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

No se crean colecciones nuevas. Se leen colecciones existentes:

- `checkins` -- check-ins del usuario (filtrados por `userId`, ordenados por `createdAt desc`)
- `ratings` -- para verificar si el usuario ya califico un comercio (doc ID `{userId}__{businessId}`)

**Tipos existentes reutilizados:**

```typescript
// src/types/index.ts (ya existe)
export interface CheckIn {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  createdAt: Date;
  location?: { lat: number; lng: number };
}
```

**Tipo nuevo para el prompt data:**

```typescript
// En src/hooks/useRatingPrompt.ts (inline, no necesita archivo de tipos separado)
export interface RatingPromptData {
  businessId: string;
  businessName: string;
  checkInId: string;
  hoursSinceCheckIn: number;
}
```

**Nuevas constantes en `src/constants/checkin.ts`:**

```typescript
export const RATING_PROMPT_MIN_HOURS = 2;
export const RATING_PROMPT_MAX_HOURS = 8;
export const RATING_PROMPT_MAX_PER_DAY = 3;
```

**Nueva constante en `src/constants/storage.ts`:**

```typescript
export const STORAGE_KEY_RATING_PROMPT_DISMISSED = 'rating_prompt_dismissed';
export const STORAGE_KEY_RATING_PROMPT_SHOWN_TODAY = 'rating_prompt_shown_today';
```

El valor de `STORAGE_KEY_RATING_PROMPT_DISMISSED` es un JSON array de checkInIds descartados.
El valor de `STORAGE_KEY_RATING_PROMPT_SHOWN_TODAY` es un JSON object `{ date: string, count: number }` para tracking del limite diario.

## Firestore Rules

No se necesitan cambios en reglas. Las queries usan reglas existentes.

### Rules impact analysis

| Query (archivo) | Collection | Auth context | Regla que lo permite | Cambio necesario? |
|-----------------|------------|-------------|---------------------|-------------------|
| `fetchMyCheckIns(userId, 20)` en `useRatingPrompt` | checkins | Owner reading own docs | `allow read: if auth != null && resource.data.userId == auth.uid` | No |
| `getDoc(ratings, userId__businessId)` en `useRatingPrompt` | ratings | Any authenticated user | `allow read: if request.auth != null` | No |

## Cloud Functions

No se necesitan Cloud Functions nuevas ni modificaciones.

## Componentes

### `RatingPromptBanner`

- **Archivo:** `src/components/home/RatingPromptBanner.tsx`
- **Props:**

```typescript
interface RatingPromptBannerProps {
  businessName: string;
  onRate: () => void;
  onDismiss: () => void;
}
```

- **Render:** Dentro de `HomeScreen`, entre `GreetingHeader` y `QuickActions`
- **Comportamiento:**
  - Card compacta con fondo `action.hover`, borde izquierdo `warning.main` (4px)
  - Icono `Star` + texto: "Como fue tu visita a {businessName}?"
  - Boton primario: "Calificar" -- llama `onRate`
  - IconButton X: llama `onDismiss`
  - Fade-in 200ms via MUI `Fade` component
  - Dark mode aware (tokens MUI del theme, sin colores hardcoded)
- **Patron:** Props-driven, sin imports de contextos. Similar a `ActivityReminder` que recibe `onCreateAccount` y `onDismiss` como props

## Hooks

### `useRatingPrompt`

- **Archivo:** `src/hooks/useRatingPrompt.ts`
- **Params:** ninguno (lee user de `useAuth()`)
- **Return:**

```typescript
interface UseRatingPromptReturn {
  promptData: RatingPromptData | null;
  dismiss: () => void;
  navigateToBusiness: () => void;
}
```

- **Dependencias:**
  - `useAuth()` -- para `user.uid`
  - `useNavigateToBusiness()` -- para navegar al comercio al tocar "Calificar"
  - `fetchMyCheckIns` de `services/checkins.ts`
  - `getDoc` de `firebase/firestore` para verificar rating existente
  - `allBusinesses` de `hooks/useBusinesses.ts` para validar que el comercio existe
  - `trackEvent` de `utils/analytics.ts`
- **Logica de elegibilidad (en orden, short-circuit):**
  1. Si no hay `user`, retorna `null` inmediatamente
  2. Fetch check-ins recientes: `fetchMyCheckIns(userId, 20)` -- limite 20 es suficiente para cubrir la ventana de 8h
  3. Filtrar check-ins en ventana 2-8h (`RATING_PROMPT_MIN_HOURS` a `RATING_PROMPT_MAX_HOURS`)
  4. Filtrar check-ins ya descartados (consultando localStorage `STORAGE_KEY_RATING_PROMPT_DISMISSED`)
  5. Validar que el businessId existe en `allBusinesses`
  6. Verificar limite diario de prompts mostrados (localStorage `STORAGE_KEY_RATING_PROMPT_SHOWN_TODAY`)
  7. Para cada candidato (del mas reciente al mas antiguo), verificar si existe rating via `getDoc(doc(db, COLLECTIONS.RATINGS, userId__businessId))`
  8. El primer check-in que pase todos los filtros se convierte en `promptData`
- **Caching:** No se implementa cache adicional; Firestore persistent cache en prod sirve datos cacheados. La query se ejecuta una sola vez al montar el hook
- **Dismiss handler:** Agrega `checkInId` al array de dismisses en localStorage, setea `promptData` a `null`, trackea analytics
- **Navigate handler:** Llama `navigateToBusiness(businessId)`, trackea analytics. Tambien registra el checkInId como "prompted" para que si el usuario no califica, no le vuelva a aparecer (misma logica de dismiss)
- **Auto-hide:** Escucha evento `anon-interaction` (disparado por `incrementAnonRatingCount` al calificar). Al detectarlo, re-evalua si el rating ahora existe y oculta el banner. Usa patron de refs estables como `useActivityReminder`

## Servicios

No se crean servicios nuevos. Se reutilizan:

- `fetchMyCheckIns(userId, limitCount)` de `src/services/checkins.ts` -- ya existe, soporta limit
- `getDoc` directo de `firebase/firestore` para leer un doc de ratings por ID compuesto -- patron existente en `services/ratings.ts`

## Integracion

### `src/components/home/HomeScreen.tsx`

- Importar `useRatingPrompt` y `RatingPromptBanner`
- Renderizar `RatingPromptBanner` condicionalmente entre `GreetingHeader` y `QuickActions`
- Wiring:
  - `businessName={promptData.businessName}`
  - `onRate={navigateToBusiness}` (del hook, ya trackea analytics + navega)
  - `onDismiss={dismiss}` (del hook, ya trackea analytics + persiste en localStorage)

### `src/constants/analyticsEvents.ts`

- Agregar 4 nuevas constantes: `EVT_RATING_PROMPT_SHOWN`, `EVT_RATING_PROMPT_CLICKED`, `EVT_RATING_PROMPT_DISMISSED`, `EVT_RATING_PROMPT_CONVERTED`

### `src/constants/checkin.ts`

- Agregar 3 constantes: `RATING_PROMPT_MIN_HOURS`, `RATING_PROMPT_MAX_HOURS`, `RATING_PROMPT_MAX_PER_DAY`

### `src/constants/storage.ts`

- Agregar 2 constantes: `STORAGE_KEY_RATING_PROMPT_DISMISSED`, `STORAGE_KEY_RATING_PROMPT_SHOWN_TODAY`

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useRatingPrompt.test.ts` | Ventana de tiempo, exclusion por rating existente, exclusion por dismiss, limite diario, seleccion del mas reciente, dismiss persiste en localStorage, auto-hide despues de rating, validacion businessId en allBusinesses, short-circuit sin user | Hook (renderHook) |
| `src/components/home/RatingPromptBanner.test.tsx` | Render con datos, click en calificar llama onRate, click en X llama onDismiss, no render si null | Component (render) |

### Casos a cubrir en `useRatingPrompt.test.ts` (10-12 cases)

1. Happy path: check-in de 3h atras sin rating, muestra prompt
2. Too early: check-in de 1h atras, no muestra
3. Too late: check-in de 9h atras, no muestra
4. Edge: check-in exactamente a 2h, SI muestra
5. Edge: check-in exactamente a 8h, SI muestra
6. Already rated: check-in elegible pero rating existe, no muestra
7. Already dismissed: check-in elegible pero checkInId en localStorage, no muestra
8. Max per day: ya se mostraron 3 hoy, no muestra
9. Multiple eligible: selecciona el mas reciente dentro de la ventana
10. No user: retorna null
11. No check-ins: retorna null
12. Business not in allBusinesses: skip, intenta siguiente

### Casos en `RatingPromptBanner.test.tsx` (4-5 cases)

1. Renderiza banner con businessName
2. Click en "Calificar" llama onRate
3. Click en X llama onDismiss
4. Muestra icono de estrella

### Mock strategy

- Mock `fetchMyCheckIns`: retorna arrays controlados de check-ins
- Mock `firebase/firestore` `getDoc`: controla si rating existe o no
- Mock `localStorage`: `vi.stubGlobal` o spy de `getItem`/`setItem`
- Mock `trackEvent`: verifica llamadas de analytics
- Mock `useNavigateToBusiness`: retorna `{ navigateToBusiness: vi.fn() }`
- Mock `useAuth`: retorna user controlado
- Fake timers: `vi.useFakeTimers()` + `vi.setSystemTime()` para controlar "ahora" relativo a `createdAt`
- Mock `allBusinesses`: importar y mockear con array controlado

## Analytics

| Evento | Parametros | Cuando |
|--------|-----------|--------|
| `EVT_RATING_PROMPT_SHOWN` | `business_id`, `hours_since_checkin` | Banner se monta y es visible |
| `EVT_RATING_PROMPT_CLICKED` | `business_id` | Usuario toca "Calificar" |
| `EVT_RATING_PROMPT_DISMISSED` | `business_id` | Usuario toca X |
| `EVT_RATING_PROMPT_CONVERTED` | `business_id` | Rating detectado para un business que tuvo prompt (via `anon-interaction` event) |

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Check-ins del usuario | Firestore persistent cache (IndexedDB) | Gestionado por Firebase SDK | IndexedDB |
| Rating existence check | Firestore persistent cache | Gestionado por Firebase SDK | IndexedDB |
| Dismissed check-in IDs | localStorage | Sin TTL (permanente) | localStorage |
| Prompts shown today count | localStorage | Reset diario (comparacion de fecha) | localStorage |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Dismiss prompt | localStorage.setItem | Ultimo write gana (single client) |
| Increment daily count | localStorage.setItem | Ultimo write gana (single client) |

No hay writes a Firestore en esta feature.

### Fallback UI

- Si offline y no hay datos cacheados de check-ins: no se muestra banner (silencioso)
- Si offline y hay datos cacheados: se muestra banner normalmente; la verificacion de rating puede usar cache de Firestore
- No se necesita indicador offline especifico para esta feature

---

## Decisiones tecnicas

1. **Query con limit 20 en lugar de query filtrada por tiempo:** Firestore no soporta filtros complejos con inequalities en multiples campos. Se traen los 20 mas recientes y se filtra client-side por ventana de tiempo. 20 es suficiente porque el limite diario de check-ins es 10 y la ventana es de 8h.

2. **localStorage para dismiss tracking en lugar de Firestore:** El dismiss es una preferencia local de UI, no necesita persistirse cross-device. Usar Firestore seria overengineering y agregaria writes innecesarios.

3. **`anon-interaction` event para auto-hide:** Reutiliza el patron existente de `useActivityReminder` para detectar cuando el usuario califica. Evita polling o re-fetching periodico.

4. **Hook dedicado en lugar de logica en HomeScreen:** Sigue el patron de `useActivityReminder` y `useOnboardingHint`, manteniendo HomeScreen como componente presentacional.

5. **Verificacion secuencial de rating (no batch):** Se verifica el rating solo para el primer candidato elegible, no para todos. Short-circuit reduce queries. En el peor caso se hacen N `getDoc` calls hasta encontrar uno sin rating, pero N es acotado (max 3 por limite diario).
