# Plan: #291 Performance Optimizations

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-01

---

## Fases de implementación

### Fase 1: Correcciones de performance

**Branch:** `fix/291-performance-optimizations`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/ratings.ts` | Reemplazar el `for` loop con `await getDocs` secuencial por `Promise.all` sobre un array de batches. Early-return explícito para `businessIds.length === 0`. Ver código exacto en specs.md sección "Servicios". |
| 2 | `src/services/follows.ts` | Reemplazar `getDocs(query(...))` + `.size` por `getCountOfflineSafe(query(...))` en `followUser`. Verificar si `getDocs` sigue siendo utilizado en el módulo; si no, remover del import. |
| 3 | `src/components/search/SearchListView.tsx` | Importar `useMemo` desde `'react'`. Envolver la expresión `[...businesses].sort(...)` en `useMemo` con dependencias `[businesses, sortLocation]`. |
| 4 | `src/hooks/useProfileStats.ts` | Cambiar `[user]` a `[user?.uid]` en el array de dependencias del `useEffect` (línea 33). Sin otros cambios — `uid` ya está capturado en el cuerpo del efecto. |
| 5 | `src/components/social/SocialScreen.tsx` | Importar `useCallback` desde `'react'`. Envolver `handleChipClick` con `useCallback([setSocialSubTab])` y `handleSelectBusiness` con `useCallback([navigateToBusiness])`. |

### Fase 2: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/follows.test.ts` | Agregar mock de `getCountOfflineSafe` (`vi.mock('./getCountOfflineSafe', ...)`). Actualizar el test "throws when max follows limit is reached" para usar `vi.mocked(getCountOfflineSafe).mockResolvedValue(200)` en vez de `mockGetDocs.mockResolvedValueOnce({ size: 200 })`. Agregar test "succeeds when count is below limit" con valor `5`. |
| 2 | `src/services/ratings.test.ts` | Agregar test que verifica que para 15 IDs, ambas llamadas a `getDocs` son invocadas antes de que la primera resuelva (comportamiento paralelo). Implementación: usar `mockGetDocs` que registra timestamps de invocación y no resuelve hasta que ambas sean llamadas. Alternativamente, verificar que `getDocs` es invocado sincrónicamente antes del `await Promise.all`. |

### Fase final: Documentación

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar en la tabla "Queries y cache": fila "Parallel batch queries" — `fetchRatingsByBusinessIds` usa `Promise.all` sobre batches para minimizar round-trips. |
| 2 | `docs/reference/project-reference.md` | Actualizar versión y fecha; agregar en el resumen que se resolvió #291. |

---

## Orden de implementación

1. `src/services/ratings.ts` — cambio de lógica pura sin dependencias externas nuevas.
2. `src/services/follows.ts` — usa import ya existente de `getCountOfflineSafe`.
3. `src/hooks/useProfileStats.ts` — cambio de una línea, sin imports nuevos.
4. `src/components/search/SearchListView.tsx` — import `useMemo` + wrap.
5. `src/components/social/SocialScreen.tsx` — import `useCallback` + wrap.
6. `src/services/follows.test.ts` — actualizar tests para el cambio de `getDocs` a `getCountOfflineSafe`.
7. `src/services/ratings.test.ts` — agregar test de paralelismo.
8. Documentación.

---

## Estimación de tamaño de archivos resultantes

| Archivo | Líneas actuales | Líneas estimadas | Variación |
|---------|----------------|-----------------|-----------|
| `src/services/ratings.ts` | 141 | ~143 | +2 (refactor del loop) |
| `src/services/follows.ts` | 97 | ~97 | 0 (swap en misma línea) |
| `src/hooks/useProfileStats.ts` | 39 | 39 | 0 (1 char: `?.uid`) |
| `src/components/search/SearchListView.tsx` | 83 | ~86 | +3 (useMemo wrap) |
| `src/components/social/SocialScreen.tsx` | 88 | ~93 | +5 (useCallback wraps) |
| `src/services/follows.test.ts` | 135 | ~150 | +15 (mock + 2 tests nuevos) |
| `src/services/ratings.test.ts` | 198 | ~215 | +17 (test de paralelismo) |

Ningún archivo supera 400 líneas. No se requiere decomposición.

---

## Riesgos

1. **Test de paralelismo en ratings.ts:** testear que `Promise.all` realmente ejecuta en paralelo
   es difícil con mocks síncronos. Si el test resulta frágil, documentar el comportamiento con un
   comentario en el código y cubrir solo el conteo de llamadas (que ya existe).

2. **Remove de `getDocs` import en follows.ts:** `getDocs` se usa en `fetchFollowing` (línea 81).
   No debe removerse. Solo se elimina del path de `followUser`. Verificar antes de commit.

3. **`user?.uid` como dep de useEffect:** si `user` llega a ser `null` y luego `undefined` (o
   viceversa), `user?.uid` retorna `undefined` en ambos casos, lo que evita re-ejecuciones
   innecesarias. El comportamiento con `user === null` (no logueado) ya está controlado por el
   guard `if (!user) return` dentro del efecto.

---

## Guardrails de modularidad

- [x] Ningún componente nuevo importa `firebase/firestore` directamente
- [x] Archivos modificados en sus carpetas de dominio correctas
- [x] Lógica de negocio en hooks/services, no en componentes
- [x] Si se toca un archivo con deuda técnica, se incluye el fix en el plan
- [x] Ningún archivo resultante supera 400 líneas

## Guardrails de seguridad

- [x] No se agregan colecciones nuevas — no aplica `hasOnly()`
- [x] No hay secrets ni credenciales en archivos commiteados
- [x] `getCountOfflineSafe` es el wrapper correcto (ya lo usa `fetchFollowersCount` en el mismo archivo)

## Guardrails de accesibilidad y UI

- [x] No se agregan elementos interactivos nuevos
- [x] No hay `<Typography onClick>` nuevos
- [x] `useMemo`/`useCallback` no afectan la estructura DOM

## Guardrails de copy

- [x] Sin textos nuevos visibles al usuario

---

## Criterios de done

- [ ] Los 5 cambios de código implementados y compilando sin errores de TypeScript
- [ ] `npm run lint` sin errores ni warnings nuevos
- [ ] `npm run test:run` pasa — incluyendo los tests actualizados de `follows.test.ts` y `ratings.test.ts`
- [ ] `npm run build` exitoso
- [ ] Referencia a #291 en el commit message
- [ ] `docs/reference/patterns.md` actualizado con el patrón de `Promise.all` batches
- [ ] `docs/reference/project-reference.md` actualizado con la versión y fecha
