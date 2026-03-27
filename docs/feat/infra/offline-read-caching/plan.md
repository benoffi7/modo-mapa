# Plan: Offline read caching

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Constantes y tipos

**Branch:** `feat/offline-read-cache`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/cache.ts` | Agregar `READ_CACHE_DB_NAME = 'modo-mapa-read-cache'`, `READ_CACHE_DB_VERSION = 1`, `READ_CACHE_STORE_NAME = 'businessData'`, `READ_CACHE_TTL_MS = 24 * 60 * 60 * 1000` (24h), `READ_CACHE_MAX_ENTRIES = 20` |
| 2 | `src/constants/analyticsEvents.ts` | Agregar `EVT_READ_CACHE_HIT`, `EVT_READ_CACHE_MISS`, `EVT_READ_CACHE_FALLBACK` |
| 3 | `src/types/readCache.ts` | Crear interfaces `ReadCacheEntry` y `ReadCacheResult` con los campos definidos en specs |
| 4 | `src/types/index.ts` | Agregar `export type { ReadCacheEntry, ReadCacheResult } from './readCache'` |

### Fase 2: Servicio readCache

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/readCache.ts` | Crear servicio completo: `openReadCacheDb`, `getReadCacheEntry`, `setReadCacheEntry`, `getCachedBusinessIds`, `clearReadCache`, `_resetForTest`. Seguir patron de `offlineQueue.ts` (singleton DB, IndexedDB nativa). Implementar LRU eviction via cursor en index `accessedAt` ascending. Serializar `Set<string>` como `string[]` en writes, reconstruir con `new Set()` en reads. |
| 2 | `src/services/readCache.test.ts` | Crear tests con `fake-indexeddb/auto`. Cubrir: open DB, get miss, get hit fresh, get hit stale (fake timers), accessedAt update, Set serialization, LRU eviction (setear MAX_ENTRIES entries + 1, verificar que el menos reciente fue eliminado), getCachedBusinessIds, clearReadCache. Usar `_resetForTest` y `indexedDB.deleteDatabase` en beforeEach (mismo patron que `offlineQueue.test.ts`). |

### Fase 3: Integracion en hooks

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useBusinessDataCache.ts` | Importar `clearReadCache` de `../services/readCache`. En `clearAllBusinessCache()`, agregar `clearReadCache().catch(() => {})` despues de `cache.clear()`. El catch silencioso es porque la limpieza de IndexedDB es best-effort (puede fallar si DB no fue inicializada). |
| 2 | `src/hooks/useBusinessDataCache.test.ts` | Agregar mock de `../services/readCache` con `clearReadCache: vi.fn()`. Agregar test: `clearAllBusinessCache calls clearReadCache`. |
| 3 | `src/hooks/useBusinessData.ts` | Importar `getReadCacheEntry`, `setReadCacheEntry` de `../services/readCache`. Importar `trackEvent` de `../utils/analytics`. Importar `EVT_READ_CACHE_HIT`, `EVT_READ_CACHE_MISS`, `EVT_READ_CACHE_FALLBACK` de `../constants/analyticsEvents`. Agregar `stale` al state (inicializado `false`). Modificar `load()`: (a) Despues del check in-memory cache, intentar `getReadCacheEntry(bId)`. Si hit, setear datos con `stale: true` y trackear `EVT_READ_CACHE_HIT`. (b) Continuar con fetch a Firestore independientemente del resultado de IndexedDB (el fetch en background refresca datos). (c) Al completar fetch exitoso, llamar `setReadCacheEntry(bId, result).catch(() => {})` y setear `stale: false`. (d) En catch: si IndexedDB tenia datos, mantenerlos con `stale: true` y trackear `EVT_READ_CACHE_FALLBACK` en vez de setear `error: true`. Si no habia datos en IndexedDB, mantener `error: true` y trackear `EVT_READ_CACHE_MISS`. Agregar `stale` al return type y al objeto retornado. Agregar `stale: false` a `EMPTY`. |

### Fase 4: Componentes UI

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/StaleBanner.tsx` | Crear componente: recibe `stale: boolean` y `onDismiss: () => void`. Renderiza `Alert` severity="info" variant="outlined" con texto "Datos pueden no estar actualizados", icono de info, boton cerrar que llama `onDismiss`. `role="status"` y `aria-live="polite"`. Retorna `null` si `stale === false`. Estilo compacto: `py: 0.5`, `mx: 2`, `mb: 1`. |
| 2 | `src/components/business/StaleBanner.test.tsx` | Tests: (a) no renderiza cuando `stale=false`, (b) renderiza Alert cuando `stale=true`, (c) llama `onDismiss` al clickear boton cerrar. Usar `@testing-library/react` + `renderWithTheme` helper. |
| 3 | `src/components/business/BusinessSheet.tsx` | Importar `StaleBanner`. Agregar estado `const [staleDismissed, setStaleDismissed] = useState(false)`. Agregar `useEffect` que resetea `staleDismissed` a `false` cuando cambia `businessId`. Renderizar `<StaleBanner stale={data.stale && !staleDismissed} onDismiss={() => setStaleDismissed(true)} />` debajo del header, antes del contenido principal (antes del `Divider` o `Tabs`). |
| 4 | `src/components/search/SearchListView.tsx` | Importar `useConnectivity` de `../../hooks/useConnectivity` y `Chip` de MUI. Obtener `isOffline` de `useConnectivity()`. Renderizar `{isOffline && <Chip label="Resultados offline" color="warning" size="small" sx={{ mb: 1 }} />}` encima de la lista de resultados. |

### Fase 5: Cleanup en logout/delete

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/emailAuth.ts` | Importar `clearReadCache` de `./readCache`. En `signOutAndReset()`: agregar `clearReadCache().catch(() => {})` despues de `localStorage.removeItem(STORAGE_KEY_VISITS)`. En `deleteAccount()` y `cleanAnonymousData()`: agregar `clearReadCache().catch(() => {})` despues de `clearAllBusinessCache()` (nota: `clearAllBusinessCache` ya llama `clearReadCache` internamente por Fase 3 paso 1, pero el llamado explicito es un safety net para el caso donde `clearAllBusinessCache` cambie en el futuro). |

---

## Orden de implementacion

1. `src/constants/cache.ts` -- constantes (sin dependencias)
2. `src/constants/analyticsEvents.ts` -- event names (sin dependencias)
3. `src/types/readCache.ts` -- interfaces (depende de tipos existentes)
4. `src/types/index.ts` -- re-export (depende de paso 3)
5. `src/services/readCache.ts` -- servicio core (depende de paso 1, 3)
6. `src/services/readCache.test.ts` -- tests del servicio (depende de paso 5)
7. `src/hooks/useBusinessDataCache.ts` -- integracion clearReadCache (depende de paso 5)
8. `src/hooks/useBusinessDataCache.test.ts` -- tests extendidos (depende de paso 7)
9. `src/hooks/useBusinessData.ts` -- integracion read-through (depende de paso 5, 2)
10. `src/components/business/StaleBanner.tsx` -- componente UI (sin dependencias de servicio)
11. `src/components/business/StaleBanner.test.tsx` -- tests UI (depende de paso 10)
12. `src/components/business/BusinessSheet.tsx` -- wiring StaleBanner (depende de paso 9, 10)
13. `src/components/search/SearchListView.tsx` -- chip offline (sin dependencias de read cache)
14. `src/services/emailAuth.ts` -- cleanup paths (depende de paso 5)

## Riesgos

1. **IndexedDB no disponible en algunos contextos (private browsing, storage pressure)**
   - Mitigacion: Todos los llamados a `readCache` usan `.catch(() => {})`. El cache es best-effort. Si IndexedDB falla, el flujo degrada al comportamiento actual (solo in-memory + Firestore). `openReadCacheDb` retorna rejection que se propaga como null en `getReadCacheEntry`.

2. **Serialization de Dates en IndexedDB**
   - Mitigacion: Los objetos `Rating`, `Comment`, etc. contienen `Date` objects. IndexedDB usa el structured clone algorithm que soporta `Date` nativamente. No se requiere serialization manual de fechas. Verificar en tests con `fake-indexeddb` que los objetos `Date` sobreviven el round-trip.

3. **Stale data confusa para el usuario**
   - Mitigacion: `StaleBanner` es visible y claro. Los datos se refrescan automaticamente en background cuando hay conexion. El banner desaparece cuando llegan datos frescos (porque `stale` pasa a `false` tras fetch exitoso).

## Criterios de done

- [ ] All items from PRD scope implemented (S1, S2, S3, S4)
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] `readCache.test.ts` cubre: open, get miss, get hit fresh, get hit stale, LRU eviction, serialization, clear
- [ ] `StaleBanner.test.tsx` cubre: render/no-render/dismiss
- [ ] `useBusinessDataCache.test.ts` cubre: clearAllBusinessCache llama clearReadCache
- [ ] Privacy policy reviewed (IndexedDB almacena datos de negocios visitados)
- [ ] Cache se limpia en logout (`signOutAndReset`) y delete account (`deleteAccount`, `cleanAnonymousData`)
