# Plan: Refactor: splitear converters.ts

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Crear directorio converters/ con archivos por dominio + barrel

**Branch:** `refactor/249-split-converters`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/config/converters/userConverters.ts` | Crear con `userProfileConverter` y `userSettingsConverter`. Imports: `FirestoreDataConverter`, `QueryDocumentSnapshot`, `SnapshotOptions` de `firebase/firestore` (import type), tipos de `../../types`, `toDate` de `../../utils/formatDate`. |
| 2 | `src/config/converters/businessConverters.ts` | Crear con `ratingConverter`, `commentConverter`, `commentLikeConverter`, `userTagConverter`, `customTagConverter`, `favoriteConverter`, `menuPhotoConverter`, `priceLevelConverter`. Mismos imports pattern. |
| 3 | `src/config/converters/socialConverters.ts` | Crear con `followConverter`, `activityFeedItemConverter`, `recommendationConverter`, `checkinConverter`. |
| 4 | `src/config/converters/listConverters.ts` | Crear con `sharedListConverter`, `listItemConverter`. |
| 5 | `src/config/converters/rankingConverters.ts` | Crear con `userRankingConverter`, `notificationConverter`, `trendingDataConverter`. |
| 6 | `src/config/converters/feedbackConverters.ts` | Crear con `feedbackConverter`. |
| 7 | `src/config/converters/index.ts` | Crear barrel re-export de los 18 converters desde los 6 archivos de dominio. |
| 8 | `src/config/converters.ts` | Eliminar archivo original (505 lineas). |

### Fase 2: Splitear tests + agregar tests faltantes

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/config/converters/userConverters.test.ts` | Migrar tests de `userProfileConverter` (2 cases) y `userSettingsConverter` (3 cases). Incluir mock de `toDate` y helper `mockSnapshot`. |
| 2 | `src/config/converters/businessConverters.test.ts` | Migrar tests de `ratingConverter` (4), `commentConverter` (10), `commentLikeConverter` (1), `userTagConverter` (1), `customTagConverter` (2), `favoriteConverter` (1), `menuPhotoConverter` (3), `priceLevelConverter` (1). Total: 23 cases. |
| 3 | `src/config/converters/socialConverters.test.ts` | Migrar 0 cases existentes. Crear tests nuevos: `followConverter` round-trip (1), `activityFeedItemConverter` toFirestore + fromFirestore con referenceId default (2), `checkinConverter` con/sin location (3), `recommendationConverter` con defaults (2). Total: ~8 cases nuevos. |
| 4 | `src/config/converters/listConverters.test.ts` | Migrar tests de `sharedListConverter` (3) y `listItemConverter` (3). Total: 6 cases. |
| 5 | `src/config/converters/rankingConverters.test.ts` | Migrar tests de `userRankingConverter` (3) y `notificationConverter` (3). Crear tests nuevos: `trendingDataConverter` toFirestore, fromFirestore con businesses, fromFirestore con array vacio (3). Total: 9 cases. |
| 6 | `src/config/converters/feedbackConverters.test.ts` | Migrar tests de `feedbackConverter` (6 cases). |
| 7 | `src/config/converters.test.ts` | Eliminar archivo original (516 lineas). |

### Fase 3: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | — | Ejecutar `npm run lint` — verificar 0 errores. |
| 2 | — | Ejecutar `npm run test:run` — verificar que todos los tests pasan (42 existentes + ~8 nuevos). |
| 3 | — | Ejecutar `npm run build` — verificar que el build compila sin errores. |
| 4 | — | Verificar que ningun archivo en `src/config/converters/` supere 200 lineas. |

### Fase 4: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Actualizar seccion "Converters" — cambiar referencia de `src/config/converters.ts` a `src/config/converters/` (directorio con 6 archivos por dominio + barrel). |
| 2 | `docs/reference/patterns.md` | Actualizar referencia a converters si menciona el archivo monolitico (seccion `withConverter<T>()`). |

---

## Orden de implementacion

1. Crear los 6 archivos de dominio (pasos 1-6 de Fase 1) — sin dependencias entre si
2. Crear barrel `index.ts` (paso 7) — depende de que los 6 archivos existan
3. Eliminar `converters.ts` original (paso 8) — depende del barrel
4. Crear los 6 archivos de test por dominio (Fase 2, pasos 1-6) — sin dependencias entre si
5. Eliminar `converters.test.ts` original (paso 7 de Fase 2) — depende de los test files nuevos
6. Ejecutar lint, tests, build (Fase 3)
7. Actualizar docs (Fase 4)

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| Algun consumidor importa con extension `.ts` explicita (`from '../config/converters.ts'`) | Baja (grep no muestra ninguno) | Verificar con grep antes de eliminar el archivo original |
| Mock de `toDate` en tests necesita path relativo diferente | Media | Cada test file ajusta el path del mock: `vi.mock('../../utils/formatDate', ...)` |
| Vite no resuelve el directorio correctamente en dev | Baja (comportamiento estandar de Node/TS) | Probar con `npm run dev` antes de commit |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (los converters usan `import type` como antes)
- [x] Archivos nuevos en carpeta de dominio correcta (`src/config/converters/`)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (converters.test.ts tambien se splitea)
- [x] Ningun archivo resultante supera 400 lineas (maximo estimado: ~170 lineas)

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas estimadas |
|---------|-----------------|
| `src/config/converters/index.ts` | ~20 |
| `src/config/converters/userConverters.ts` | ~70 |
| `src/config/converters/businessConverters.ts` | ~170 |
| `src/config/converters/socialConverters.ts` | ~105 |
| `src/config/converters/listConverters.ts` | ~60 |
| `src/config/converters/rankingConverters.ts` | ~90 |
| `src/config/converters/feedbackConverters.ts` | ~45 |
| `src/config/converters/userConverters.test.ts` | ~60 |
| `src/config/converters/businessConverters.test.ts` | ~200 |
| `src/config/converters/socialConverters.test.ts` | ~90 |
| `src/config/converters/listConverters.test.ts` | ~60 |
| `src/config/converters/rankingConverters.test.ts` | ~100 |
| `src/config/converters/feedbackConverters.test.ts` | ~80 |

Todos dentro del limite de 400 lineas. El mas grande (businessConverters.test.ts) se estima en ~200.

---

## Criterios de done

- [x] `src/config/converters.ts` ya no existe
- [x] `src/config/converters/index.ts` re-exporta los 18 converters
- [x] 6 archivos de dominio, ninguno supera 200 lineas
- [x] Los 42 test cases existentes pasan sin modificacion de assertions
- [x] 5 converters sin tests ahora tienen cobertura (follow, activityFeedItem, checkin, recommendation, trendingData)
- [x] `src/config/converters.test.ts` ya no existe — splitado en 6 archivos
- [x] Los 23 consumidores no requieren cambios de import
- [x] `npm run lint` pasa sin errores
- [x] `npm run build` compila sin errores
- [x] `docs/reference/firestore.md` actualizado
- [x] `docs/reference/patterns.md` actualizado si aplica
