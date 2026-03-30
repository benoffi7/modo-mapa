# Plan: exhaustive-deps fix + useVerificationBadges split

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Fix exhaustive-deps en useFollowedTags

**Branch:** `fix/247-exhaustive-deps-badges`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useFollowedTags.ts` | Importar `useMemo` de React. Envolver `serverTags` en `useMemo(() => settings?.followedTags ?? [], [settings?.followedTags])` |
| 2 | `src/hooks/useFollowedTags.ts` | Eliminar `// eslint-disable-next-line react-hooks/exhaustive-deps` de linea 36. Agregar `optimisticTags` al array de dependencias del `useEffect` de sincronizacion |
| 3 | `src/hooks/useFollowedTags.test.ts` | Agregar test: leer archivo fuente y verificar que no contiene `eslint-disable`. Agregar test: verificar que el useEffect de sincronizacion resetea optimisticTags cuando settings cambia |

### Fase 2: Servicios + split de useVerificationBadges

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/ratings.ts` | Agregar `fetchUserRatings(userId: string): Promise<Rating[]>` — query con `where('userId', '==', userId)` usando `ratingConverter`. Agregar `fetchRatingsByBusinessIds(businessIds: string[]): Promise<Rating[]>` — queries en batches de 10 con `where('businessId', 'in', batch)` |
| 2 | `src/services/checkins.ts` | Crear archivo nuevo. Exportar `fetchUserCheckIns(userId: string): Promise<CheckIn[]>` — query con `where('userId', '==', userId)` usando `checkinConverter`. Importar `db`, `COLLECTIONS`, `checkinConverter` |
| 3 | `src/hooks/useLocalGuideBadge.ts` | Crear archivo. Exportar `calcLocalGuide(userRatings: Rating[], userLocality: string | undefined): { current: number; target: number }`. Mover `extractLocality` y `buildBusinessLocalityMap` desde useVerificationBadges |
| 4 | `src/hooks/useVerifiedVisitorBadge.ts` | Crear archivo. Exportar `calcVerifiedVisitor(userCheckIns: CheckIn[]): { current: number; target: number }`. Mover `buildBusinessCoordsMap` desde useVerificationBadges |
| 5 | `src/hooks/useTrustedReviewerBadge.ts` | Crear archivo. Exportar `calcTrustedReviewer(userRatings: Rating[]): Promise<{ current: number; target: number }>`. Usar `fetchRatingsByBusinessIds` de `services/ratings.ts` en vez de queries directas. Mover constante `BATCH_SIZE` |
| 6 | `src/hooks/useVerificationBadges.ts` | Refactorizar como orquestador: eliminar imports de `firebase/firestore`, `db`, `COLLECTIONS`, converters. Importar `fetchUserRatings` de `services/ratings.ts`, `fetchUserCheckIns` de `services/checkins.ts`, y los 3 calculadores. Mantener `getCached`, `setCache`, `buildBadge`, `UseVerificationBadgesReturn`, analytics. Eliminar funciones movidas |

### Fase 3: Tests de nuevos archivos

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/checkins.test.ts` | Tests para `fetchUserCheckIns`: retorna check-ins, retorna vacio, maneja error |
| 2 | `src/services/ratings.test.ts` | Agregar tests para `fetchUserRatings` y `fetchRatingsByBusinessIds`: retorna ratings, batching >10, retorna vacio |
| 3 | `src/hooks/useLocalGuideBadge.test.ts` | Tests: 0 ratings, sin localidad, ratings en otra localidad, ratings en localidad correcta, threshold exacto (50), >50 |
| 4 | `src/hooks/useVerifiedVisitorBadge.test.ts` | Tests: 0 check-ins, check-in lejano, check-in cercano, sin location, threshold exacto (5), business no encontrado |
| 5 | `src/hooks/useTrustedReviewerBadge.test.ts` | Tests: 0 ratings, 100% consistentes, 0% consistentes, mix, threshold 80%, batching >10, error en fetch |
| 6 | `src/hooks/useVerificationBadges.test.ts` | Actualizar mocks: reemplazar mocks de `firebase/firestore` por mocks de `services/ratings.ts` y `services/checkins.ts`. Verificar delegacion a calculadores. Mantener tests de cache y edge cases |

### Fase 4: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | — | Ejecutar `npm run lint` y verificar 0 warnings de exhaustive-deps |
| 2 | — | Ejecutar `npm run test:run` y verificar todos los tests pasan |
| 3 | — | Verificar que `useVerificationBadges.ts` tiene < 100 lineas |
| 4 | — | Verificar que ningun archivo nuevo supera 400 lineas |

### Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Actualizar entrada de "Verification badges cache" para mencionar el patron orquestador + calculadores separados. Agregar `fetchUserRatings`, `fetchRatingsByBusinessIds` y `fetchUserCheckIns` como servicios conocidos |
| 2 | `docs/reference/tests.md` | Agregar los nuevos archivos de test al inventario (hooks y services) |
| 3 | `docs/reference/firestore.md` | Agregar mencion de `services/checkins.ts` como servicio para la coleccion `checkins` |

---

## Orden de implementacion

1. `src/hooks/useFollowedTags.ts` — fix de useMemo + eliminar eslint-disable (sin dependencias)
2. `src/services/ratings.ts` — agregar `fetchUserRatings` y `fetchRatingsByBusinessIds` (base para paso 5)
3. `src/services/checkins.ts` — crear con `fetchUserCheckIns` (base para paso 6)
4. `src/hooks/useLocalGuideBadge.ts` — extraer calculador (base para paso 7)
5. `src/hooks/useVerifiedVisitorBadge.ts` — extraer calculador (base para paso 7)
6. `src/hooks/useTrustedReviewerBadge.ts` — extraer calculador, depende de paso 2 (base para paso 7)
7. `src/hooks/useVerificationBadges.ts` — refactorizar como orquestador, depende de pasos 2-6
8. Tests de todos los archivos nuevos y modificados
9. Verificacion lint + test + line count
10. Actualizacion de docs

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio |
|---------|----------------|------------------------------|
| `src/hooks/useFollowedTags.ts` | 95 | ~96 |
| `src/hooks/useVerificationBadges.ts` | 250 | ~80 |
| `src/hooks/useLocalGuideBadge.ts` | (nuevo) | ~35 |
| `src/hooks/useVerifiedVisitorBadge.ts` | (nuevo) | ~30 |
| `src/hooks/useTrustedReviewerBadge.ts` | (nuevo) | ~45 |
| `src/services/checkins.ts` | (nuevo) | ~25 |
| `src/services/ratings.ts` | existente + ~25 | +25 lineas (~total < 100) |

Ningun archivo supera 400 lineas.

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| Regresion en badges: calculo distinto tras split | Baja | Los tests existentes validan los mismos resultados. Las funciones se copian literalmente antes de refactorizar imports |
| Cache de localStorage incompatible tras refactor | Nula | La estructura de cache no cambia (mismo key, mismo formato `CacheEntry`) |
| `useMemo` en serverTags no estabiliza correctamente | Baja | La dependencia `settings?.followedTags` es un array que cambia de referencia solo cuando el doc de Firestore cambia. Test cubre el caso |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (los nuevos archivos en `hooks/` usan servicios)
- [x] Archivos nuevos en carpeta de dominio correcta (`src/hooks/` para calculadores, `src/services/` para queries)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Se corrige deuda tecnica existente: se elimina import de `firebase/firestore` en `useVerificationBadges.ts`
- [x] Ningun archivo resultante supera 400 lineas

---

## Criterios de done

- [ ] `useFollowedTags.ts` no tiene ningun `eslint-disable` comment
- [ ] `useVerificationBadges.ts` queda por debajo de 100 lineas como orquestador
- [ ] `useVerificationBadges.ts` no importa de `firebase/firestore` (usa service layer)
- [ ] Los 3 nuevos calculadores de badges tienen tests con >= 80% cobertura
- [ ] `services/checkins.ts` creado con test
- [ ] `services/ratings.ts` ampliado con 2 funciones nuevas y tests
- [ ] No hay regresiones en el comportamiento de followed tags ni badges de verificacion
- [ ] `npm run lint` pasa sin warnings nuevos de exhaustive-deps
- [ ] `npm run test:run` pasa
- [ ] Build succeeds
- [ ] Reference docs actualizados (patterns.md, tests.md, firestore.md)
