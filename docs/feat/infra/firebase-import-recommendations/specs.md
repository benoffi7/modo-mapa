# Specs: Mover import de firebase/firestore fuera de ReceivedRecommendations.tsx

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

Sin cambios. No se agregan ni modifican colecciones, documentos ni campos.

## Firestore Rules

Sin cambios.

### Rules impact analysis

No hay queries nuevas. La query existente (`where('recipientId', '==', userId)`) se sigue construyendo con los mismos constraints, solo que ahora desde el service layer en vez de inline en el componente.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `getReceivedRecommendationsConstraints(userId)` | recommendations | Authenticated user reading own recs | `allow read: if auth != null` | No |

### Field whitelist check

Sin campos nuevos ni modificados.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

Sin cambios.

## Componentes

### ReceivedRecommendations.tsx (modificado)

- **Cambio:** Eliminar los imports `where` y `QueryConstraint` de `firebase/firestore`
- **Reemplazo:** Importar `getReceivedRecommendationsConstraints` desde `src/services/recommendations.ts`
- **Comportamiento:** Identico al actual. El `useMemo` de constraints llama a la nueva funcion del servicio en vez de construir el `where()` inline

### Mutable prop audit

No aplica. `ReceivedRecommendations` no modifica los datos que recibe como props.

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| ReceivedRecommendations | onSelectBusiness | Ninguno | No | N/A |

## Textos de usuario

Sin textos nuevos ni modificados.

## Hooks

Sin cambios en hooks.

## Servicios

### `src/services/recommendations.ts` (modificado)

**Nueva funcion:**

```typescript
import type { QueryConstraint } from 'firebase/firestore';

export function getReceivedRecommendationsConstraints(userId: string | undefined): QueryConstraint[] {
  if (!userId) return [];
  return [where('recipientId', '==', userId)];
}
```

- **Params:** `userId: string | undefined`
- **Return:** `QueryConstraint[]`
- **Operaciones Firestore:** Ninguna (solo construye constraints, no ejecuta queries)
- **Nota:** El servicio ya importa `where` de `firebase/firestore` (linea 6), por lo que no se agrega ninguna dependencia nueva

## Integracion

### Archivos afectados

1. **`src/services/recommendations.ts`** - Agregar `getReceivedRecommendationsConstraints`
2. **`src/components/menu/ReceivedRecommendations.tsx`** - Reemplazar imports de `firebase/firestore` por llamada al servicio

### Componentes con imports residuales

La auditoria de `src/components/` revela un segundo archivo con import de `firebase/firestore`:

- **`src/components/menu/FollowedList.tsx`** (linea 15): `import type { QueryDocumentSnapshot } from 'firebase/firestore'`
  - Este es un `import type` que no crea acoplamiento en runtime
  - Sin embargo, la convencion del proyecto prefiere que componentes no referencien el SDK, ni siquiera como tipo
  - **Recomendacion:** Fuera de scope para este issue. Crear un issue separado si se quiere re-exportar `QueryDocumentSnapshot` desde un hook o servicio

### Preventive checklist

- [x] **Service layer**: `ReceivedRecommendations.tsx` actualmente importa `where` de `firebase/firestore` para construir constraints -- este es el bug que se corrige
- [x] **Duplicated constants**: No aplica
- [x] **Context-first data**: No aplica, la query requiere Firestore
- [x] **Silent .catch**: No hay cambios en .catch
- [x] **Stale props**: No aplica, el componente no muta props

## Tests

### Archivos a testear

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/recommendations.test.ts` | `getReceivedRecommendationsConstraints` retorna constraints correctos | Service |

### Casos a cubrir

- `getReceivedRecommendationsConstraints('u1')` retorna `[where('recipientId', '==', 'u1')]`
- `getReceivedRecommendationsConstraints(undefined)` retorna `[]`
- `getReceivedRecommendationsConstraints('')` retorna `[]` (si userId es falsy)

### Mock strategy

Ya existe en el test file actual. El mock de `firebase/firestore` ya incluye `where: vi.fn()`. Solo agregar un nuevo `describe` block.

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo (la funcion tiene 2 paths: con userId y sin userId)

## Analytics

Sin cambios.

---

## Offline

Sin cambios en comportamiento offline. La query sigue usando Firestore persistent cache.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Recomendaciones recibidas | Firestore persistent cache (sin cambio) | Manejado por Firestore SDK | IndexedDB |

### Writes offline

Sin writes nuevos.

### Fallback UI

Sin cambios.

---

## Decisiones tecnicas

1. **Funcion pura vs. hook:** Se elige una funcion simple en el service (`getReceivedRecommendationsConstraints`) en vez de un hook, porque la logica es trivial y no necesita estado reactivo. El componente ya la envuelve en `useMemo`.

2. **Tipo de retorno `QueryConstraint[]`:** El servicio ya importa y usa este tipo internamente. Exponerlo en el return type es consistente con la convencion de que solo `services/`, `config/`, `context/` y `hooks/` pueden importar del SDK. El componente no necesita importar el tipo porque TypeScript lo infiere.

3. **FollowedList.tsx fuera de scope:** El `import type { QueryDocumentSnapshot }` en FollowedList no crea acoplamiento en runtime y resolverlo requiere cambiar la firma de un callback que viene de `usePaginatedQuery`. Se recomienda un issue separado.
