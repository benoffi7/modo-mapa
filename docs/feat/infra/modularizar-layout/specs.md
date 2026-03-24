# Specs: Modularizar AppShell y SideMenu

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-24

---

## Modelo de datos

No hay cambios en Firestore. Este refactor es puramente frontend.

## Firestore Rules

Sin cambios.

## Cloud Functions

Sin cambios.

---

## Hooks

### `useOnboardingFlow` (nuevo)

**Archivo:** `src/hooks/useOnboardingFlow.ts`

Extrae los 4 `useState` y 3 callbacks de onboarding que hoy viven en AppShell (lineas 103-127).

```typescript
import type { useCallback } from 'react';

type BenefitsSource = 'banner' | 'menu' | 'settings';
type EmailDialogTab = 'register' | 'login';

interface UseOnboardingFlowReturn {
  benefitsOpen: boolean;
  benefitsSource: BenefitsSource;
  emailDialogOpen: boolean;
  emailDialogTab: EmailDialogTab;
  handleCreateAccount: (source?: BenefitsSource) => void;
  handleLogin: () => void;
  handleBenefitsContinue: () => void;
  closeBenefits: () => void;
  closeEmailDialog: () => void;
}

export function useOnboardingFlow(): UseOnboardingFlowReturn;
```

**Logica interna:**

- 4 `useState`: `benefitsOpen`, `benefitsSource`, `emailDialogOpen`, `emailDialogTab`
- `handleCreateAccount(source)`: si `STORAGE_KEY_BENEFITS_SHOWN` en localStorage es `'true'`, abre email dialog directo; sino abre benefits dialog con el source indicado. Siempre setea tab a `'register'`.
- `handleLogin()`: setea tab a `'login'`, abre email dialog.
- `handleBenefitsContinue()`: cierra benefits, abre email dialog.
- `closeBenefits()`: `setBenefitsOpen(false)`.
- `closeEmailDialog()`: `setEmailDialogOpen(false)`.

**Dependencias:** `STORAGE_KEY_BENEFITS_SHOWN` de `constants/storage`.

---

### `useOnboardingHint` (mover)

**Archivo:** `src/hooks/useOnboardingHint.ts`

Mover la funcion `useOnboardingHint` actualmente definida inline en `AppShell.tsx` (lineas 24-58) a su propio archivo. Sin cambios en la logica.

```typescript
interface UseOnboardingHintReturn {
  show: boolean;
  dismiss: () => void;
}

export function useOnboardingHint(): UseOnboardingHintReturn;
```

**Logica:** Identica a la actual:

- Estado inicial calculado desde localStorage (`STORAGE_KEY_ONBOARDING_COMPLETED`, `STORAGE_KEY_ONBOARDING_CREATED_AT`) y `ONBOARDING_HINT_DELAY_MS`.
- `useEffect` que programa un timeout si el hint aun no se mostro.
- `dismiss()` marca `STORAGE_KEY_ONBOARDING_COMPLETED` como `'true'` y oculta.

**Dependencias:** `STORAGE_KEY_ONBOARDING_COMPLETED`, `STORAGE_KEY_ONBOARDING_CREATED_AT` de `constants/storage`; `ONBOARDING_HINT_DELAY_MS` de `constants/timing`.

---

### `useSurpriseMe` (nuevo)

**Archivo:** `src/hooks/useSurpriseMe.ts`

Extrae la logica de "sorprendeme" de SideMenu (lineas 150-173).

```typescript
import type { Business } from '../types';

interface UseSurpriseMeParams {
  onSelect: (business: Business) => void;
  onClose: () => void;
}

interface UseSurpriseMeReturn {
  handleSurprise: () => void;
}

export function useSurpriseMe(params: UseSurpriseMeParams): UseSurpriseMeReturn;
```

**Logica interna:**

- Usa `useVisitHistory()` para obtener `visits`.
- Usa `useSortLocation()` para obtener la ubicacion de referencia.
- Usa `useToast()` para mostrar mensajes.
- Importa `allBusinesses` de `hooks/useBusinesses`.
- Importa `distanceKm` de `utils/distance`.
- Filtra comercios no visitados, prefiere cercanos (<=5km), elige al azar.
- Llama `params.onSelect(pick)` y `params.onClose()`.
- Si todos visitados: `toast.info('Ya visitaste todos! Te sorprendemos con uno al azar.')`.
- Sino: `toast.success('Sorpresa! Descubri ${pick.name}')`.
- Llama `trackEvent('surprise_me', { business_id: pick.id })`.

**Dependencias:** `useVisitHistory`, `useSortLocation`, `useToast`, `allBusinesses`, `distanceKm`, `trackEvent`.

---

## Componentes

### `EditDisplayNameDialog` (nuevo)

**Archivo:** `src/components/menu/EditDisplayNameDialog.tsx`

Extrae el dialog de editar nombre que hoy esta inline en SideMenu (lineas 176-205 state + 416-445 JSX).

```typescript
interface EditDisplayNameDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function EditDisplayNameDialog(props: EditDisplayNameDialogProps): JSX.Element;
```

**Comportamiento:**

- Usa `useAuth()` internamente para obtener `displayName` y `setDisplayName`.
- Estado local: `nameValue` (string), `isSaving` (boolean).
- Al abrir (`open` pasa a true): inicializa `nameValue` con `displayName || ''`.
- Validacion: boton Guardar disabled si `isSaving` o `!nameValue.trim()`.
- Submit: trima el valor, llama `setDisplayName(trimmed)`, cierra.
- Enter en TextField ejecuta submit.
- `inputProps.maxLength` = `MAX_DISPLAY_NAME_LENGTH` (30).
- Cancel cierra sin guardar.

**Dependencias:** `useAuth` de `context/AuthContext`, `MAX_DISPLAY_NAME_LENGTH` de `constants/validation`.

---

### Cambio de firma: `onNavigate` a `onSelectBusiness`

**Componentes afectados (9):**

| Componente | Archivo | Cambio |
|-----------|---------|--------|
| FavoritesList | `src/components/menu/FavoritesList.tsx` | `onNavigate: () => void` a `onSelectBusiness: (business: Business) => void` |
| RecentVisits | `src/components/menu/RecentVisits.tsx` | Idem |
| CommentsList | `src/components/menu/CommentsList.tsx` | Idem |
| RatingsList | `src/components/menu/RatingsList.tsx` | Idem |
| SharedListsView | `src/components/menu/SharedListsView.tsx` | Idem |
| CheckInsView | `src/components/menu/CheckInsView.tsx` | Idem |
| SuggestionsView | `src/components/menu/SuggestionsView.tsx` | Idem |
| TrendingList | `src/components/menu/TrendingList.tsx` | Idem |
| TrendingBusinessCard | `src/components/menu/TrendingBusinessCard.tsx` | Idem |

**Patron actual en cada componente:**

```typescript
// Antes (acoplado al drawer)
const handleSelectBusiness = (business: Business) => {
  setSelectedBusiness(business);
  onNavigate(); // "cerrar drawer"
};
```

**Patron nuevo:**

```typescript
// Despues (desacoplado)
const handleSelectBusiness = (business: Business) => {
  onSelectBusiness(business);
};
```

Cada componente ya no necesita importar `useSelection` de MapContext para llamar `setSelectedBusiness`. Esa responsabilidad se mueve al padre (SideMenu), que en su `handleSelectBusiness` hace:

```typescript
const handleSelectBusiness = useCallback((business: Business) => {
  setSelectedBusiness(business);
  handleClose();
}, [setSelectedBusiness, handleClose]);
```

**Excepcion:** `CommentsList` usa `onNavigate` dentro de un callback que tambien llama `markRead` y `setSelectedBusiness`. Ahi se reemplaza el par `setSelectedBusiness(biz); onNavigate()` por `onSelectBusiness(biz)`.

---

## Integracion

### AppShell.tsx

**Cambios:**

1. Eliminar el hook inline `useOnboardingHint` (lineas 24-58) -- importar desde `src/hooks/useOnboardingHint`.
2. Eliminar los 4 useState de onboarding (lineas 103-106) y los 3 callbacks (109-127) -- reemplazar con `useOnboardingFlow()`.
3. Actualizar props pasadas a SideMenu y BenefitsDialog para usar el return del hook.
4. `MapHint` se queda en AppShell (usa `useSelection` local) pero importa `useOnboardingHint` del nuevo archivo.

**Resultado:** AppShell pasa de 5 useState propios a 3 (`menuOpen`, `menuInitialSection`, `sharedListId`). Cumple success criteria #1.

### SideMenu.tsx

**Cambios:**

1. Eliminar `handleSurprise` (lineas 150-173) -- importar `useSurpriseMe`.
2. Eliminar estado del edit name dialog (lineas 176-205) -- usar `EditDisplayNameDialog` con estado propio.
3. Eliminar imports de `useVisitHistory`, `allBusinesses`, `distanceKm`, `useSortLocation` (ya no necesarios tras extraer surprise).
4. Agregar `handleSelectBusiness` callback que llama `setSelectedBusiness` + `handleClose`.
5. Pasar `onSelectBusiness={handleSelectBusiness}` en vez de `onNavigate={handleClose}` a los 9 componentes.
6. Agregar state `nameDialogOpen` simple (boolean) para abrir/cerrar `EditDisplayNameDialog`.

**Resultado:** SideMenu baja de ~450 lineas a ~350. Cumple success criteria #2.

### RecentVisits.tsx

**Cambios adicionales:**

1. Eliminar la funcion local `formatRelativeTime` (lineas 12-23).
2. Importar `formatRelativeTime` desde `src/utils/formatDate.ts`.
3. Nota: la version local usa `'Hace un momento'` (mayuscula) y `'Hace mas de un mes'`. La version de `formatDate.ts` usa `'hace un momento'` (minuscula) y formatea con fecha corta despues de 7 dias. Se usara la version de `formatDate.ts` (mas consistente con el resto de la app). El cambio visual es menor.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useOnboardingFlow.test.ts` | State transitions: create account con/sin benefits shown, login, benefitsContinue, close handlers | Hook |
| `src/hooks/useOnboardingHint.test.ts` | localStorage read/write, timing (4h threshold), dismiss, ya completado | Hook |
| `src/hooks/useSurpriseMe.test.ts` | Filtrado por distancia, fallback todos visitados, caso sin candidatos cercanos, analytics event | Hook |
| `src/components/menu/EditDisplayNameDialog.test.tsx` | Open/close, validacion nombre vacio, maxLength, submit exitoso, Enter shortcut, cancel | Component |

### Mock strategy

- **useOnboardingFlow:** mock `localStorage` (getItem/setItem).
- **useOnboardingHint:** mock `localStorage`, `vi.useFakeTimers()` para timing.
- **useSurpriseMe:** mock `useVisitHistory`, `useSortLocation`, `useToast`, `trackEvent`. Mock `allBusinesses` con array de test.
- **EditDisplayNameDialog:** mock `useAuth` (displayName, setDisplayName). Render con `@testing-library/react`.

### Criterio de aceptacion

- Cobertura >= 80% en los 4 archivos nuevos.
- Todos los paths condicionales cubiertos.
- Side effects verificados (localStorage, toast, analytics).

---

## Analytics

Sin nuevos eventos. Los eventos existentes (`side_menu_open`, `side_menu_section`, `surprise_me`, `dark_mode_toggle`) se mantienen sin cambio, solo se mueven de archivo.

---

## Offline

### Impacto

Ninguno. Este refactor mueve codigo existente sin alterar data flows. Las estrategias offline existentes se mantienen intactas:

- "Sorprendeme" funciona offline (usa `allBusinesses` JSON + localStorage).
- Edit display name usa el mismo `setDisplayName` de AuthContext.
- Onboarding flow es 100% localStorage.

---

## Decisiones tecnicas

### 1. `onSelectBusiness` recibe `Business` completo (no solo `id`)

Los componentes de menu ya tienen la referencia al `Business` object (lo usan para mostrar nombre, categoria, etc.). Pasar el objeto completo evita un lookup adicional y es consistente con el patron de `setSelectedBusiness` de MapContext.

### 2. `EditDisplayNameDialog` usa `useAuth` internamente

Alternativa considerada: recibir `displayName` y `setDisplayName` como props. Rechazada porque el dialog tiene una unica responsabilidad (editar el nombre del usuario actual) y acoplar a AuthContext es aceptable para un componente tan especifico.

### 3. `useSurpriseMe` recibe callbacks en vez de usar contextos directamente

El hook recibe `onSelect` y `onClose` como parametros para mantener la separacion entre la logica de seleccion (que es del hook) y la accion de cierre (que es del layout). Esto permite reusar el hook en otros layouts futuros.

### 4. No se modifica `SideMenuNav`

`SideMenuNav` recibe `onNavigate: (section: Section) => void` que es una firma distinta -- navega entre secciones del menu, no selecciona un comercio. Se mantiene sin cambio.
