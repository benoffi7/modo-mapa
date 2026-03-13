# Specs Tecnicas: Correccion de Hallazgos Residuales

## S-B01: `console.error` sin guard DEV

### Archivos

- `src/hooks/useAsyncData.ts`
- `src/components/menu/FeedbackForm.tsx`

### Cambio

Envolver los `console.error` restantes con `if (import.meta.env.DEV)`.

**Excepcion:** `ErrorBoundary.tsx` se deja sin guard intencionalmente (error
boundary de React debe loguear siempre en produccion).

### Ejemplo

```typescript
// Antes
console.error('useAsyncData error:', err);

// Despues
if (import.meta.env.DEV) console.error('useAsyncData error:', err);
```

---

## S-B06: CI/CD sin lint antes del deploy

### Archivo

- `.github/workflows/deploy.yml`

### Cambio

Agregar paso `npm run lint` antes de `npm run test:run`.

```yaml
- run: npm run lint
- run: npm run test:run
- run: npm run build
```

### Verificar

Que exista el script `lint` en `package.json`. Si no existe, agregarlo:
`"lint": "eslint src/"`.

---

## S-N01: Capa de servicios sin validacion de entrada

### Archivos

- `src/services/comments.ts`
- `src/services/favorites.ts`
- `src/services/ratings.ts`
- `src/services/tags.ts`
- `src/services/feedback.ts`

### Cambio

Agregar validaciones basicas al inicio de cada funcion de escritura como
primera linea de defensa (defense in depth). Las Firestore rules siguen
siendo la proteccion principal.

#### Validaciones por servicio

**comments.ts** - `addComment(businessId, userId, userName, text)`:

- `text.trim().length > 0 && text.length <= 500`
- `userName.trim().length > 0 && userName.length <= 30`

**favorites.ts** - `addFavorite(businessId, userId)`:

- `businessId` y `userId` no vacios

**ratings.ts** - `submitRating(businessId, userId, score)`:

- `score >= 1 && score <= 5 && Number.isInteger(score)`

**tags.ts** - `addUserTag(businessId, userId, tagId)`:

- `tagId` en whitelist `['barato', 'apto_celiacos', 'apto_veganos', 'rapido', 'delivery', 'buena_atencion']`

**feedback.ts** - `sendFeedback(userId, message, category)`:

- `message.trim().length > 0 && message.length <= 1000`
- `category` en `['bug', 'sugerencia', 'otro']`

### Patron

```typescript
export function addComment(...) {
  if (!text.trim() || text.length > 500) {
    throw new Error('Comment text must be 1-500 characters');
  }
  // ... resto
}
```

---

## S-N02: `ratings.ts` sobreescribe `createdAt`

### Archivo

- `src/services/ratings.ts`

### Cambio

Separar create y update, similar al patron de `AuthContext.tsx`:

```typescript
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function submitRating(businessId: string, userId: string, score: number) {
  // validacion...
  const ratingRef = doc(db, COLLECTIONS.RATINGS, `${userId}_${businessId}`);
  const existing = await getDoc(ratingRef);

  if (existing.exists()) {
    await updateDoc(ratingRef, { score });
  } else {
    await setDoc(ratingRef, {
      businessId,
      userId,
      score,
      createdAt: serverTimestamp(),
    });
  }
}
```

### Nota

Verificar que las Firestore rules permitan update sin `createdAt`. Actualmente
la regla de ratings update (linea 59-64) no restringe campos adicionales, asi
que `updateDoc` con solo `score` deberia funcionar.

---

## A-P1: `services/feedback.ts` acepta `category: string`

### Archivo

- `src/services/feedback.ts`

### Cambio

```typescript
// Antes
export async function sendFeedback(userId: string, message: string, category: string)

// Despues
import type { FeedbackCategory } from '../types';
export async function sendFeedback(userId: string, message: string, category: FeedbackCategory)
```

---

## A-P2: `FeedbackForm` no usa servicio de feedback

### Archivo

- `src/components/menu/FeedbackForm.tsx`

### Cambio

Reemplazar imports directos de `firebase/firestore` por uso de
`sendFeedback` del servicio:

```typescript
// Antes
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
// ... manual addDoc

// Despues
import { sendFeedback } from '../../services/feedback';
// ... await sendFeedback(user.uid, message.trim(), category);
```

Eliminar imports no usados de `firebase/firestore` y `db`.

---

## A-P3: `converters.ts` tiene `toDate()` local duplicada

### Archivo

- `src/config/converters.ts`

### Cambio

```typescript
// Antes
function toDate(val: unknown): Date { ... } // copia local

// Despues
import { toDate } from '../utils/formatDate';
```

Eliminar la definicion local de `toDate()`.

---

## A-P5: `npm audit` ausente en CI

### Archivo

- `.github/workflows/deploy.yml`

### Cambio

Agregar paso despues de `npm ci`:

```yaml
- run: npm audit --audit-level=high
```

**Nota:** Usar `--audit-level=high` para no bloquear por vulnerabilidades
de severidad baja/moderada que no son explotables en este contexto.

---

## A-P6: Cloud Functions deploy automatico en CI

### Archivo

- `.github/workflows/deploy.yml`

### Cambio

Agregar paso de deploy de Cloud Functions despues del deploy de hosting.
Usar `firebase deploy --only functions` con el mismo token de servicio.

```yaml
- name: Deploy Functions
  run: npx firebase-tools deploy --only functions --project modo-mapa-app
```

**Prerequisito:** Verificar que el service account del CI tenga permisos
de Cloud Functions Developer. Agregar paso de `cd functions && npm ci`
antes del deploy.

---

## A-P7: `BusinessTags` descomposicion

### Archivo actual

- `src/components/business/BusinessTags.tsx` (285 lineas)

### Archivos nuevos

- `src/components/business/TagChip.tsx` - Chip individual con menu contextual
- `src/components/business/CustomTagDialog.tsx` - Dialog para agregar custom tag
- `src/components/business/businessTagsUtils.ts` - Logica de conteo y utilidades

### Patron

Seguir el mismo patron de descomposicion de `BackupsPanel`:

- Componente principal orquesta estado
- Sub-componentes reciben props minimas
- Sub-componentes envueltos en `React.memo`
- Tipos y utilidades en archivos separados

---

## D-01 y D-02: Documentacion

### Archivos

- `docs/PROJECT_REFERENCE.md`
- `docs/CODING_STANDARDS.md`
- `docs/fix-audit-residuals/changelog.md`

### Cambios

- PROJECT_REFERENCE: Agregar nuevos archivos creados, actualizar diagrama
  de arquitectura si aplica
- CODING_STANDARDS: Agregar patron de validacion en capa de servicios
- changelog: Registrar todos los archivos modificados/creados

---

## Orden de implementacion

1. Quick fixes (A-P1, A-P3, S-B01) - sin dependencias
2. FeedbackForm migration (A-P2 + A-P1 juntos)
3. Service validations (S-N01) - despues de A-P1 para usar FeedbackCategory
4. Ratings create/update split (S-N02)
5. BusinessTags decomposition (A-P7)
6. CI improvements (S-B06, A-P5, A-P6)
7. Documentation (D-01, D-02)
8. Build + test verification
