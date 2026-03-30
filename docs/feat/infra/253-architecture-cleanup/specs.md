# Specs: mover useBusinessDataCache + centralizar dragHandleSeen + eliminar dead export

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No hay cambios en colecciones de Firestore ni en tipos de datos. Este feature es un refactor de organizacion de archivos.

## Firestore Rules

No se requieren cambios en Firestore rules.

### Rules impact analysis

No hay queries nuevas. Todas las queries existentes permanecen iguales, solo cambia la ubicacion del archivo de cache.

### Field whitelist check

No aplica. No se agregan ni modifican campos en ninguna coleccion.

## Cloud Functions

No aplica. No hay cambios en Cloud Functions.

## Componentes

### BusinessSheet.tsx (modificacion)

Reemplazar las 2 ocurrencias de la magic string `'dragHandleSeen'` por la constante `STORAGE_KEY_DRAG_HANDLE_SEEN` importada de `constants/storage`.

- **Linea 62**: `!localStorage.getItem('dragHandleSeen')` --> `!localStorage.getItem(STORAGE_KEY_DRAG_HANDLE_SEEN)`
- **Linea 91**: `localStorage.setItem('dragHandleSeen', '1')` --> `localStorage.setItem(STORAGE_KEY_DRAG_HANDLE_SEEN, '1')`

### Mutable prop audit

No aplica. No hay componentes nuevos ni edicion de datos via props.

## Textos de usuario

No aplica. No hay textos nuevos visibles al usuario.

## Hooks

### useBusinessData.ts (modificacion de import)

Cambiar import de `./useBusinessDataCache` a `../services/businessDataCache`:

```typescript
// Antes
import { getBusinessCache, setBusinessCache, invalidateBusinessCache, patchBusinessCache } from './useBusinessDataCache';

// Despues
import { getBusinessCache, setBusinessCache, invalidateBusinessCache, patchBusinessCache } from '../services/businessDataCache';
```

## Servicios

### src/services/businessDataCache.ts (nuevo archivo, movido desde src/hooks/useBusinessDataCache.ts)

Archivo identico al original. No contiene hooks de React (ni `useState`, `useEffect`, etc.). Exporta las mismas 5 funciones + 1 interfaz:

- `getBusinessCache(businessId: string): BusinessCacheEntry | null`
- `setBusinessCache(businessId: string, data: Omit<BusinessCacheEntry, 'timestamp'>): void`
- `invalidateBusinessCache(businessId: string): void`
- `patchBusinessCache(businessId: string, patch: Partial<Omit<BusinessCacheEntry, 'timestamp'>>): void`
- `clearAllBusinessCache(): void`
- `export interface BusinessCacheEntry`

### src/services/menuPhotos.ts (modificacion de import)

```typescript
// Antes
import { invalidateBusinessCache } from '../hooks/useBusinessDataCache';

// Despues
import { invalidateBusinessCache } from './businessDataCache';
```

### src/services/emailAuth.ts (modificacion de import)

```typescript
// Antes
import { clearAllBusinessCache } from '../hooks/useBusinessDataCache';

// Despues
import { clearAllBusinessCache } from './businessDataCache';
```

### src/services/businessData.ts (eliminar export de BusinessDataResult)

La interfaz `BusinessDataResult` (linea 9) esta exportada pero no es importada por ningun archivo externo. Se usa unicamente como return type de `fetchBusinessData` en el mismo archivo. Eliminar el `export` keyword para que sea interna.

```typescript
// Antes
export interface BusinessDataResult {

// Despues
interface BusinessDataResult {
```

## Integracion

### Archivos que cambian imports

| Archivo | Import viejo | Import nuevo |
|---------|-------------|-------------|
| `src/hooks/useBusinessData.ts` | `'./useBusinessDataCache'` | `'../services/businessDataCache'` |
| `src/services/menuPhotos.ts` | `'../hooks/useBusinessDataCache'` | `'./businessDataCache'` |
| `src/services/emailAuth.ts` | `'../hooks/useBusinessDataCache'` | `'./businessDataCache'` |

### Archivos de test que cambian mocks

| Archivo test | Mock viejo | Mock nuevo |
|-------------|-----------|-----------|
| `src/hooks/useBusinessData.test.ts` | `'./useBusinessDataCache'` | `'../services/businessDataCache'` |
| `src/services/menuPhotos.test.ts` | `'../hooks/useBusinessDataCache'` | `'./businessDataCache'` |
| `src/services/__tests__/menuPhotos.test.ts` | `'../../hooks/useBusinessDataCache'` | `'../businessDataCache'` |
| `src/services/emailAuth.test.ts` | `'../hooks/useBusinessDataCache'` | `'./businessDataCache'` |

### Archivo de test que se mueve

| Archivo viejo | Archivo nuevo |
|--------------|--------------|
| `src/hooks/useBusinessDataCache.test.ts` | `src/services/businessDataCache.test.ts` |

El test file necesita actualizar sus imports internos:

```typescript
// Antes
import { ... } from './useBusinessDataCache';

// Despues
import { ... } from './businessDataCache';
```

Y el nombre del `describe`:

```typescript
// Antes
describe('useBusinessDataCache', () => {

// Despues
describe('businessDataCache', () => {
```

### Preventive checklist

- [x] **Service layer**: No hay componentes importando `firebase/firestore` para writes. El movimiento corrige una dependencia upward (services --> hooks).
- [x] **Duplicated constants**: La magic string `dragHandleSeen` se centraliza en `constants/storage.ts`.
- [x] **Context-first data**: No aplica.
- [x] **Silent .catch**: No aplica (no se agrega codigo nuevo).
- [x] **Stale props**: No aplica.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/businessDataCache.test.ts` | Los 9 tests existentes, solo adaptando imports | Service |

No se requieren tests nuevos. La logica no cambia.

### Criterio de aceptacion

- Los 9 tests existentes pasan tras el rename/move.
- `npm run test:run` pasa sin errores.
- No hay imports rotos.

## Analytics

No aplica. No hay eventos nuevos.

---

## Offline

No aplica. Este feature es un refactor de organizacion sin cambios funcionales.

---

## Decisiones tecnicas

| Decision | Justificacion | Alternativa descartada |
|----------|---------------|----------------------|
| Mover a `services/` en vez de crear carpeta `cache/` | El archivo ya es importado por 2 servicios. Ponerlo en `services/` elimina la dependencia upward sin crear una capa nueva. | Carpeta `src/cache/` -- agrega un nivel de abstracci que no aporta valor para un solo archivo. |
| Quitar `export` de `BusinessDataResult` en vez de eliminar la interfaz | La interfaz se usa como return type de `fetchBusinessData`. Eliminar el export la hace interna sin romper nada. | Eliminar la interfaz y usar inline type -- hace menos legible `fetchBusinessData`. |
| Nombre `businessDataCache.ts` sin prefijo `use` | El archivo no contiene hooks de React. El prefijo `use` esta reservado para hooks segun convenciones de React y del proyecto. | Mantener nombre `useBusinessDataCache.ts` -- viola la convencion. |

---

## Hardening de seguridad

No aplica. Este feature no introduce superficies nuevas de seguridad. Es un refactor de organizacion de archivos.

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #253 (este issue) | Dependencia upward services --> hooks | Fase 1, paso 1-4 |
| #253 | Magic string no centralizada | Fase 2, paso 1-2 |
| #254 | `BusinessDataResult` dead export (mencionado en PRD de #254 como complementario) | Fase 2, paso 3 |

El comentario en `src/constants/cache.ts` linea 1 (`/** Business data cache TTL (useBusinessDataCache) */`) debe actualizarse para reflejar el nuevo nombre del archivo.
