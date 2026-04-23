# Specs: measureAsync instrumentation en fetchAppVersionConfig

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-23

---

## Modelo de datos

Sin cambios en Firestore. El documento `config/appVersion` ya existe y no se modifica.
No se agregan colecciones, campos ni índices.

## Firestore Rules

Sin cambios. El read de `config/appVersion` es existente y las rules actuales lo permiten.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio requerido? |
|---------------------|------------|-------------|---------------------|------------------|
| `fetchAppVersionConfig` (config.ts) | config | Cualquier auth (anon + registrado) | `allow read: if true` (doc de config público) | No |

### Field whitelist check

No aplica — no se agregan ni modifican campos en documentos de Firestore.

## Cloud Functions

No aplica.

## Seed Data

No aplica — no se agregan ni modifican colecciones ni campos.

## Componentes

No aplica. El cambio es exclusivamente en la capa de servicios.

### Mutable prop audit

No aplica.

## Textos de usuario

No aplica. Cambio interno de instrumentación sin textos visibles al usuario.

## Hooks

No aplica. `useForceUpdate` (el consumidor de `fetchAppVersionConfig`) no se modifica.

## Servicios

### `fetchAppVersionConfig` en `src/services/config.ts`

**Cambio S1 — reemplazar `getDoc` por `measuredGetDoc` en el fallback de cache**

El servicio actualmente usa:
- `getDocFromServer(ref)` en el loop de reintentos (3 intentos)
- `getDoc(ref)` como fallback de cache (línea 65)

`measuredGetDoc` de `src/utils/perfMetrics` es un thin wrapper sobre `measureAsync(name, () => getDoc(ref))`. Corresponde instrumentar el fallback de cache (`getDoc`) con `measuredGetDoc('appVersionConfig', ref)`.

El loop de reintentos usa `getDocFromServer`, que fuerza red y no pasa por la cache de Firestore. `measuredGetDoc` internamente llama a `getDoc` (no a `getDocFromServer`), por lo que no aplica al loop de reintentos. La instrumentación correcta es solo en el path de cache.

> **Nota de diseño:** `measuredGetDoc` wrappea `getDoc`, no `getDocFromServer`. Si en el futuro se quiere instrumentar también los reintentos de servidor, habría que usar `measureAsync('appVersionConfig_server', () => getDocFromServer(ref))` directamente — pero eso queda fuera del scope de este issue.

**Cambio S2 — eliminar import de `getDoc` de `firebase/firestore`**

Tras reemplazar `getDoc` por `measuredGetDoc`, el import de `getDoc` desde `firebase/firestore` queda sin usos directos en `config.ts`. Se debe eliminar para mantener la boundary del service layer (ningún service importa Firebase SDK directamente cuando existe wrapper).

`getDocFromServer` continúa importado desde `firebase/firestore` porque no existe wrapper equivalente en `perfMetrics.ts` para forzar read desde servidor.

**Cambio S3 (bonus — alineado con issue #314) — importar `RETRY_DELAYS_MS` desde `timing.ts`**

La constante local `RETRY_DELAYS_MS = [500, 1500]` en `config.ts` duplica `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` que ya existe en `src/constants/timing.ts`. El PRD menciona que este fix puede incluirse en el mismo PR para minimizar toques al archivo.

- Renombrar el import como `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` desde `../constants/timing`
- Eliminar la declaración local `const RETRY_DELAYS_MS = [500, 1500]`
- Actualizar la referencia en el loop: `RETRY_DELAYS_MS[attempt]` → `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS[attempt]`
- Esto resuelve el issue #314 sin costo adicional de PR

**Firma resultante de la función:** sin cambios — `Promise<AppVersionConfig>` idéntico.

**Imports resultantes de `config.ts`:**

```typescript
// Antes:
import { doc, getDoc, getDocFromServer, FirestoreError, type Timestamp } from 'firebase/firestore';

// Después:
import { doc, getDocFromServer, FirestoreError, type Timestamp } from 'firebase/firestore';
import { measuredGetDoc } from '../utils/perfMetrics';
import { FORCE_UPDATE_FETCH_RETRY_DELAYS_MS } from '../constants/timing';
```

## Integración

No se modifican otros archivos fuera de `config.ts` y `config.test.ts`. El hook consumidor `useForceUpdate` llama a `fetchAppVersionConfig()` con la misma firma y no requiere cambios.

### Preventive checklist

- [x] **Service layer**: No hay componentes importando `firebase/firestore` — el cambio reduce acoplamiento al eliminar `getDoc` directo.
- [x] **Duplicated constants**: `RETRY_DELAYS_MS` local queda reemplazado por la constante canónica en `timing.ts` (fix incluido de #314).
- [x] **Context-first data**: No aplica.
- [x] **Silent .catch**: No hay `.catch(() => {})` nuevos — el manejo de errores existente con `logger.warn` se mantiene intacto.
- [x] **Stale props**: No aplica — cambio en service puro.

## Tests

### Estrategia de mock

El test actual mockea `getDoc` directamente desde `firebase/firestore`. Tras el cambio, `getDoc` ya no es importado por `config.ts`, por lo que el mock de `firebase/firestore` puede dejar de exponer `getDoc`. En su lugar, se mockea `../utils/perfMetrics` con un pass-through que permite verificar invocaciones.

**Patrón de mock (idéntico a `userSettings.test.ts`):**

```typescript
const mockMeasuredGetDoc = vi.fn();
vi.mock('../utils/perfMetrics', () => ({
  measuredGetDoc: (name: string, ref: unknown) => mockMeasuredGetDoc(name, ref),
}));
```

En los tests existentes, `mockMeasuredGetDoc` debe delegar a `mockGetDoc` para preservar el comportamiento:

```typescript
// Setup en beforeEach:
mockMeasuredGetDoc.mockImplementation((_name: string, ref: unknown) => mockGetDoc(ref));
```

Esto mantiene transparencia: los 4+ casos existentes verifican el resultado de `fetchAppVersionConfig` sin cambiar sus aserciones.

**Nuevo test de instrumentación:**

```typescript
it('g) measuredGetDoc es llamado con "appVersionConfig" cuando cae al cache', async () => {
  mockGetDocFromServer.mockRejectedValueOnce(makeFirestoreError('permission-denied'));
  mockGetDoc.mockResolvedValue(makeSnap(true, { minVersion: '1.0.0' }));

  await fetchAppVersionConfig();

  expect(mockMeasuredGetDoc).toHaveBeenCalledOnce();
  expect(mockMeasuredGetDoc).toHaveBeenCalledWith('appVersionConfig', expect.anything());
});
```

### Si S3 (RETRY_DELAYS_MS → timing.ts) se incluye:

Agregar mock de `../constants/timing`:

```typescript
vi.mock('../constants/timing', () => ({
  FORCE_UPDATE_FETCH_RETRY_DELAYS_MS: [500, 1500],
}));
```

Los tests de retry (b, c) no necesitan cambiar en sus aserciones.

| Archivo test | Qué testear | Tipo |
|-------------|-------------|------|
| `src/services/config.test.ts` | Mock de `measuredGetDoc`; 7+ casos existentes pasan; nuevo caso g) verifica nombre `'appVersionConfig'` | Unit |

## Analytics

No aplica. `measuredGetDoc` registra timing en `queryTimings` internamente. No se agrega `trackEvent` ni entrada en `GA4_EVENT_NAMES`.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `config/appVersion` | Sin cache offline propio — comportamiento existente no cambia | N/A | N/A |

### Writes offline

No aplica — solo lectura.

### Fallback UI

No aplica. `useForceUpdate` ya maneja el error con retry propio.

---

## Accesibilidad y UI mobile

No aplica — cambio en service puro, sin componentes UI.

## Textos y copy

No aplica — sin textos visibles al usuario.

---

## Decisiones técnicas

### Por qué instrumentar solo el path de cache y no el loop de servidor

`measuredGetDoc` wrappea `getDoc` (cache-first), no `getDocFromServer` (network-forced). Aplicar `measuredGetDoc` al loop de reintentos requeriría `measureAsync('appVersionConfig_server', () => getDocFromServer(ref))` con un nombre de métrica distinto, lo que aumenta la complejidad y crea dos entradas en `queryTimings`. El PRD prioriza consistencia mínima: que el timing de `config/appVersion` aparezca en los percentiles. El path de cache es suficiente para ese objetivo.

### Por qué incluir el fix de #314 en el mismo PR

Ambos cambios tocan exactamente el mismo archivo (`config.ts`). Separarlos implica dos PRs con riesgo de conflicto y doble overhead de review. El PRD lo menciona explícitamente como recomendación. El esfuerzo incremental es mínimo (cambiar 1 string + 1 import).

### Por qué `measuredGetDoc` y no `measureAsync` directo

`measuredGetDoc` es el wrapper idiomático para `getDoc` con `DocumentReference` tipado. Usar `measureAsync` directamente requeriría importar también `getDoc` desde `firebase/firestore`, contradiciendo el objetivo S2 de eliminar imports directos del SDK.

---

## Hardening de seguridad

No aplica. Cambio de instrumentación interna sin nuevas superficies de ataque.

### Vectores de ataque mitigados

| Ataque | Mitigación | Archivo |
|--------|-----------|---------|
| Scraping de `config/appVersion` | App Check en prod + documento sin datos sensibles (ya mitigado) | firestore.rules (existente) |

---

## Deuda técnica: mitigación incorporada

| Issue | Qué se resuelve | Paso del plan |
|-------|----------------|---------------|
| #314 tech-debt: import RETRY_DELAYS_MS from timing.ts in config.ts | Eliminar constante local duplicada; usar `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` de `timing.ts` | Fase 1, paso 2 |
