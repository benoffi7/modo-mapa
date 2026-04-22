# Specs: Tech debt architecture — prop-drilling, sabanas, console.error bypass

**PRD:** [prd.md](prd.md)
**Issue:** #306
**Fecha:** 2026-04-18

---

## Resumen tecnico

Refactor puro. Ningun cambio de datos, rules, callables, triggers ni UI visible. Elimina:

1. El ultimo `console.error` en `src/`.
2. Prop-drilling de `{ businessId, businessName }` a traves de 11 componentes del dominio Business — reemplazado por `BusinessScopeContext` local al subarbol de `BusinessSheetContent`.
3. Prop surface sobrecargada de `InfoTab` (11 → 4 props via data objects).
4. Dirty-tracking que atraviesa 4 componentes — localizado en `OpinionesTab`.
5. Tres archivos cerca del threshold 400 LOC (`AbuseAlerts`, `FeedbackList`, `BusinessQuestions`) — descompuestos.

---

## Archivo por archivo

### S1 — Logger bypass

**`src/components/admin/ModerationActions.tsx`**

Reemplazar:

```ts
} catch (err) {
  console.error('Moderation error:', err);   // LINE 68
  toast.error(MSG_ADMIN.moderateError);
```

Por:

```ts
} catch (err) {
  logger.error('Moderation error:', err);
  toast.error(MSG_ADMIN.moderateError);
```

Agregar import: `import { logger } from '../../utils/logger';`

Verificar con `grep -rn "console\.\(error\|warn\)" src/` — resultado esperado: 0 coincidencias fuera de tests.

---

### S2 — BusinessScopeContext

#### Nuevo archivo: `src/context/BusinessScopeContext.tsx`

```tsx
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface BusinessScope {
  businessId: string;
  businessName: string;
  location: { lat: number; lng: number };
}

const BusinessScopeContext = createContext<BusinessScope | null>(null);

export function BusinessScopeProvider({
  scope,
  children,
}: {
  scope: BusinessScope;
  children: ReactNode;
}) {
  const value = useMemo(() => scope, [scope.businessId, scope.businessName, scope.location.lat, scope.location.lng]);
  return (
    <BusinessScopeContext.Provider value={value}>
      {children}
    </BusinessScopeContext.Provider>
  );
}

export function useBusinessScope(): BusinessScope {
  const ctx = useContext(BusinessScopeContext);
  if (!ctx) {
    throw new Error('useBusinessScope must be used within BusinessScopeProvider');
  }
  return ctx;
}
```

Nota: El `useMemo` depende de primitivas (`businessId`, `businessName`, `lat`, `lng`) para evitar re-renders cuando el padre pasa un objeto `scope` reconstruido en cada render.

#### Modificar: `src/components/business/BusinessSheetContent.tsx`

Envolver el `Box` de fadeIn con `BusinessScopeProvider`:

```tsx
const scope = useMemo<BusinessScope>(() => ({
  businessId: business.id,
  businessName: business.name,
  location: { lat: business.lat, lng: business.lng },
}), [business.id, business.name, business.lat, business.lng]);

// ...
return (
  <BusinessScopeProvider scope={scope}>
    <Box sx={{ '@keyframes fadeIn': ... }}>
      {/* existing children */}
    </Box>
  </BusinessScopeProvider>
);
```

Simplificar los JSX de hijos que antes recibian `businessId`/`businessName`. Mantener los callbacks (`onToggle`, `onPriceLevelChange`) como props — el contexto solo reemplaza datos, no comportamiento.

#### Migrar componentes consumidores

Cada uno elimina `businessId` / `businessName` de su `Props`, y usa `useBusinessScope()` internamente.

**`src/components/business/FavoriteButton.tsx`** — 81 LOC
- Eliminar props `businessId`, `businessName`
- `const { businessId, businessName } = useBusinessScope();`

**`src/components/business/BusinessTags.tsx`** — 271 LOC
- Mismo patron

**`src/components/business/BusinessPriceLevel.tsx`** — 127 LOC
- Mismo patron
- Mantener `key={business.id}` en el padre (`InfoTab`) para preservar reset de `pendingLevel`

**`src/components/business/CheckInButton.tsx`** — 67 LOC
- Eliminar props `businessId`, `businessName`, `businessLocation`
- `const { businessId, businessName, location } = useBusinessScope();`

**`src/components/business/AddToListDialog.tsx`** — 219 LOC
- Eliminar props `businessId`, `businessName`
- `useBusinessScope()` solo si `open === true` para no romper el test de mount unitario fuera del provider. Alternativa: recibir `businessId`/`businessName` como props si se abre desde un contexto diferente en el futuro — pero actualmente solo se abre desde `BusinessSheetContent`. Decision: migrar.

**`src/components/business/RecommendDialog.tsx`** — 141 LOC
- Mismo patron que AddToListDialog. Migrar.

**`src/components/business/CommentInput.tsx`** — 80 LOC
- No recibe `businessId`/`businessName` directamente hoy. **No requiere cambios.** (El scope se usa en `BusinessComments.tsx` parent, que si se migra.)

**`src/components/business/BusinessComments.tsx`** — 330 LOC
- Eliminar props `businessId`, `businessName`
- `const { businessId, businessName } = useBusinessScope();`
- `useCommentListBase` sigue recibiendo `businessId`/`businessName` como parametros (el hook es puro y no depende del contexto).

**`src/components/business/BusinessQuestions.tsx`** — 375 LOC (tambien S5)
- Eliminar props `businessId`, `businessName`
- `const { businessId, businessName } = useBusinessScope();`

**`src/components/business/OpinionesTab.tsx`** — 66 LOC
- Eliminar props `businessId`, `businessName` (solo pasaba-through)
- No consume scope — solo deja de pasar los props a hijos

**`src/components/business/MenuPhotoUpload.tsx`** — 153 LOC
- Eliminar prop `businessId`
- `const { businessId } = useBusinessScope();`

**`src/components/business/MenuPhotoSection.tsx`** (ya existente)
- Eliminar prop `businessId`, leer de scope

**`src/components/business/BusinessSheetHeader.tsx`**
- Sigue recibiendo `business` completo como prop — **no migrar**. Es el header visible, necesita `business.name`/`category`/`address`/`phone`.

#### Total migrado

11 componentes migran a leer de contexto + 1 hook (opcional, ver S4).

---

### S3 — InfoTab slim API

#### Modificar: `src/components/business/InfoTab.tsx`

**Antes** (11 props):

```tsx
interface Props {
  business: Business;
  ratingData: UseBusinessRatingReturn;
  priceLevels: PriceLevel[];
  onPriceLevelChange: () => void;
  seedTags: string[];
  userTags: UserTag[];
  customTags: CustomTag[];
  onTagsChange: () => void;
  menuPhoto: MenuPhoto | null;
  onPhotoChange: () => void;
  isLoading: boolean;
}
```

**Despues** (5 props):

```tsx
interface PriceLevelData {
  levels: PriceLevel[];
  onChange: () => void;
}

interface TagsData {
  seed: string[];
  user: UserTag[];
  custom: CustomTag[];
  onChange: () => void;
}

interface PhotoData {
  photo: MenuPhoto | null;
  onChange: () => void;
}

interface Props {
  ratingData: UseBusinessRatingReturn;
  priceLevelData: PriceLevelData;
  tagsData: TagsData;
  photoData: PhotoData;
  isLoading: boolean;
}
```

`business` desaparece como prop: los hijos ya obtienen `businessId`/`businessName`/`location` del contexto (S2). `CriteriaSection` no necesita `business`. `BusinessPriceLevel` obtiene `businessId`/`businessName` del scope. `BusinessTags` lo mismo. `MenuPhotoSection` lo mismo.

#### Modificar: `src/components/business/BusinessSheetContent.tsx`

Cambiar llamada a `<InfoTab>`:

```tsx
<InfoTab
  ratingData={ratingData}
  priceLevelData={{ levels: data.priceLevels, onChange: () => data.refetch('priceLevels') }}
  tagsData={{ seed: business.tags, user: data.userTags, custom: data.customTags, onChange: handleTagsChange }}
  photoData={{ photo: data.menuPhoto, onChange: () => data.refetch('menuPhotos') }}
  isLoading={data.isLoading}
/>
```

Memoizar los objetos data con `useMemo` para evitar re-renders de `InfoTab` memo.

---

### S4 — Dirty-tracking localizado

**Decision tras inspeccionar `OpinionesTab.tsx`:** el dirty state ya es relativamente localizado (pasa solo a traves de `OpinionesTab → BusinessComments`). No amerita un contexto nuevo. La simplificacion se limita a:

- `InfoTab` no recibe `onDirtyChange` (correcto hoy — no lo recibe).
- `OpinionesTab` recibe `onDirtyChange` y lo pasa a `BusinessComments` (unico que genera dirty).
- `BusinessSheetContent` mantiene `const [commentsDirty, setCommentsDirty] = useState(false);` porque `BusinessSheet` necesita el flag para `useUnsavedChanges`.

**Cambio minimo:** mover `commentsDirty` state + `useEffect` de `BusinessSheetContent` a un hook `useCommentsDirtyBridge` que devuelve `{ dirty, setDirty }` y llama al parent via el callback. Esto reduce la cantidad de state/effect en el body de `BusinessSheetContent` (que ya tiene 269 LOC). Si el refactor no reduce complejidad, se **omite** (S4 es opcional).

**Descartado** crear un contexto nuevo — el prop-drilling es de solo 2 saltos y no justifica indireccion.

---

### S5 — Descomponer archivos cerca del threshold

#### `src/components/admin/AbuseAlerts.tsx` (327 → ~180 LOC)

**Nuevos archivos:**

- `src/components/admin/alerts/AlertsFilters.tsx` (~80 LOC) — grid de filtros (periodo, estado, tipo, severidad, coleccion, busqueda, export CSV). Props: `{ datePreset, setDatePreset, statusFilter, setStatusFilter, typeFilter, setTypeFilter, severityFilter, setSeverityFilter, collectionFilter, setCollectionFilter, userSearch, setUserSearch, collections, typeCounts, totalLogs, hasActiveFilters, onClear, onExport, disabled }`.
- `src/components/admin/alerts/AlertsTable.tsx` (~100 LOC) — tabla + expanded row. Props: `{ rows, expandedId, onExpand, sortField, sortDir, onSort, userAlertCounts, actionInProgress, onReview, onDismiss }`.

`AbuseAlerts.tsx` queda como orquestador: KPIs, tabs (alertas/reincidentes), toasts, useMemos, handlers — renderiza `<AlertsFilters>` y `<AlertsTable>`.

#### `src/components/admin/FeedbackList.tsx` (320 → ~200 LOC)

**Nuevos archivos:**

- `src/components/admin/feedback/FeedbackRespondForm.tsx` (~50 LOC) — textarea + botones enviar/cancelar. Props: `{ value, onChange, onSubmit, onCancel, submitting }`.
- `src/components/admin/feedback/FeedbackBusinessDialog.tsx` (~40 LOC) — dialog de detalle de comercio. Props: `{ businessDetailId, businessDetail, onClose }`.
- `src/components/admin/feedback/FeedbackMediaPreview.tsx` (~30 LOC) — logica de preview pdf/imagen/error. Props: `{ mediaUrl, mediaType, onOpenImage }`.

`FeedbackList.tsx` queda como orquestador de la tabla con sus columnas.

#### `src/components/business/BusinessQuestions.tsx` (375 → ~220 LOC)

**Nuevos archivos:**

- `src/components/business/QuestionForm.tsx` (~60 LOC) — input + limit alert. Props: `{ questionText, onChange, onSubmit, isSubmitting, userCommentsToday, maxPerDay }`.
- `src/components/business/QuestionAnswerThread.tsx` (~120 LOC) — render de un Question + respuestas colapsables + badge "Mejor respuesta" + reply form. Props: `{ question, answers, isExpanded, onToggle, isLiked, likeCount, onToggleLike, onDelete, onReply, replyingTo, ... }`.

`BusinessQuestions.tsx` queda como orquestador: hooks (`useCommentListBase`, scope), useMemos de agrupacion, map de `visibleQuestions` renderizando `<QuestionAnswerThread>`.

---

## Tests

### Nuevos archivos de test

| Archivo | Cases | Que cubrir |
|---------|-------|-----------|
| `src/context/BusinessScopeContext.test.tsx` | 4 | provider provee valor; hook fuera de provider tira error; memoizacion del value (no re-render si mismos primitivos); update cuando cambia businessId |
| `src/components/admin/alerts/AlertsFilters.test.tsx` | 3 | render de chips; onClear resetea filtros; export CSV disabled cuando no hay resultados |
| `src/components/admin/alerts/AlertsTable.test.tsx` | 3 | expansion de fila; sort cambia direccion; review/dismiss buttons visibles solo en pending |
| `src/components/admin/feedback/FeedbackRespondForm.test.tsx` | 2 | disabled cuando texto vacio; enviar llama onSubmit con trimmed |
| `src/components/business/QuestionForm.test.tsx` | 3 | disabled over limit; Enter submit; helperText muestra counter |

### Tests modificados (regression)

- `src/components/admin/ModerationActions` no tiene test hoy — tests del fix de logger se ejercen via `ModerationActions` si se agrega suite minima; bajo esfuerzo, **no bloquea** (no hay suite previa).
- Los tests de integracion de `BusinessSheet.error.test.tsx` deben seguir pasando.
- Tests de `BusinessQuestions`/`BusinessComments` si existen — revisar en implementacion.

### Mock strategy

- `BusinessScopeProvider`: envolver tests de componentes migrados con un helper `renderWithBusinessScope({ businessId, businessName, location }, <Component />)`.
- No hay mocks de servicios nuevos — los servicios existentes se preservan.

### Criterio de aceptacion

- Cobertura del contexto nuevo 100%
- Cobertura de hooks nuevos >= 80%
- Cobertura global >= 80% (igual o mejor que hoy)
- Tests de migracion de componentes migrados siguen pasando

---

## Archivos afectados

### Nuevos (5)

- `src/context/BusinessScopeContext.tsx`
- `src/context/BusinessScopeContext.test.tsx`
- `src/components/admin/alerts/AlertsFilters.tsx`
- `src/components/admin/alerts/AlertsTable.tsx`
- `src/components/admin/feedback/FeedbackRespondForm.tsx`
- `src/components/admin/feedback/FeedbackBusinessDialog.tsx`
- `src/components/admin/feedback/FeedbackMediaPreview.tsx`
- `src/components/business/QuestionForm.tsx`
- `src/components/business/QuestionAnswerThread.tsx`
- (+ 4 archivos de test mencionados arriba)

### Modificados (14)

- `src/components/admin/ModerationActions.tsx` (S1)
- `src/components/business/BusinessSheetContent.tsx` (S2 provider + S3 InfoTab call)
- `src/components/business/InfoTab.tsx` (S3)
- `src/components/business/FavoriteButton.tsx` (S2)
- `src/components/business/BusinessTags.tsx` (S2)
- `src/components/business/BusinessPriceLevel.tsx` (S2)
- `src/components/business/CheckInButton.tsx` (S2)
- `src/components/business/AddToListDialog.tsx` (S2)
- `src/components/business/RecommendDialog.tsx` (S2)
- `src/components/business/BusinessComments.tsx` (S2)
- `src/components/business/BusinessQuestions.tsx` (S2 + S5)
- `src/components/business/OpinionesTab.tsx` (S2)
- `src/components/business/MenuPhotoUpload.tsx` (S2)
- `src/components/business/MenuPhotoSection.tsx` (S2)
- `src/components/admin/AbuseAlerts.tsx` (S5)
- `src/components/admin/FeedbackList.tsx` (S5)

### Docs modificados

- `docs/reference/patterns.md` — agregar patron "BusinessScopeContext" bajo "Datos y estado"
- `docs/reference/architecture.md` — agregar `BusinessScopeContext` en tabla de Contextos (scope: Solo BusinessSheet)

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|--------|---------|-----------|
| Tests existentes de `FavoriteButton`/`BusinessComments` renderizan sin provider | Alto | Crear helper `renderWithBusinessScope` y aplicarlo a tests existentes. Verificar cada suite despues de migrar |
| `AddToListDialog`/`RecommendDialog` abiertos fuera del scope en el futuro | Medio | Documentar en JSDoc que requieren `BusinessScopeProvider`. El error thrown da mensaje claro |
| `key={business.id}` en `BusinessPriceLevel` se rompe si se mueve la prop al contexto | Bajo | Preservar `key` en el JSX del parent (`InfoTab`) |
| Re-renders por cambio de referencia en `scope` | Bajo | `useMemo` con dependencias primitivas (id, name, lat, lng) |
| Split de `AbuseAlerts` rompe toast de new alerts | Medio | Mantener `useEffect` de `newCount` en el orquestador, no en el subcomponente |
| Split de `BusinessQuestions` altera el comportamiento de reply thread | Medio | Tests de regression manual: abrir pregunta → responder → ver respuesta → eliminar |

---

## Observabilidad

- No hay eventos analytics nuevos.
- `logger.error` en ModerationActions sera capturado por Sentry en produccion (fix del bypass).

---

## Decision log

| Decision | Alternativa descartada | Razon |
|----------|-----------------------|-------|
| Contexto `BusinessScope` tiene solo datos, no handlers | Incluir `onFavoriteChange`, `onRatingChange`, etc en el contexto | Los callbacks dependen del state de `useBusinessData` en `BusinessSheetContent` — mantenerlos como props preserva la boundary |
| `InfoTab` no recibe `business` como prop | Pasar `business` completo | Los hijos migrados leen datos de scope. El header ya recibe `business` |
| `BusinessSheetHeader` sigue recibiendo `business` | Migrar header a scope | El header necesita `address`, `phone`, `category` que no estan en scope (y no valen la pena agregar) |
| S4 simplificado a revision del dirty bridge sin contexto | Crear `CommentsDirtyContext` nuevo | Solo 2 saltos de prop-drilling; no justifica indireccion |
| Split de AbuseAlerts en 2 componentes (no 3+) | Un split mas granular | Filtros y tabla son las dos unidades naturales |
| SettingsPanel "sabana" queda fuera | Convertir a tabs/accordion | Cambio visible para el usuario — amerita PRD separado con input de diseno |
