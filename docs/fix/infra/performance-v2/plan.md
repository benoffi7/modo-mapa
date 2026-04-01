# Plan: #283 Performance Fixes v2

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Fases de implementacion

### Fase 1: BusinessSheet — estabilizar deps de useCallback

**Branch:** `fix/283-performance-v2`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/BusinessSheet.tsx` | Linea 53: destructurar `refetch` de `data` — `const data = useBusinessData(businessId); const { refetch } = data;` |
| 2 | `src/components/business/BusinessSheet.tsx` | Linea 96: cambiar dep de `[data]` a `[refetch]` en `handleRatingChange` — `useCallback(() => refetch('ratings'), [refetch])` |
| 3 | `src/components/business/BusinessSheet.tsx` | Lineas 97-100: cambiar dep de `[data]` a `[refetch]` en `handleTagsChange` — `useCallback(() => { refetch('userTags'); refetch('customTags'); }, [refetch])` |

### Fase 2: Cloud Functions — paralelizar writes

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `functions/src/triggers/comments.ts` | Lineas 68-72 (`onCommentCreated`): envolver `incrementCounter`, `trackWrite`, `incrementBusinessCount` en `Promise.all([...])` con ternario para `businessId` |
| 5 | `functions/src/triggers/comments.ts` | Lineas 178-182 (`onCommentDeleted`): misma parallelizacion para el path de delete |
| 6 | `functions/src/triggers/ratings.ts` | Lineas 35-37 (`onRatingWritten`, create branch): `Promise.all([incrementCounter, trackWrite, updateRatingAggregates])` |
| 7 | `functions/src/triggers/ratings.ts` | Lineas 64-66 (`onRatingWritten`, delete branch): `Promise.all([incrementCounter, trackDelete, updateRatingAggregates])` |

### Fase 3: useCommentListBase — handleSubmitReply con useCallback

| Paso | Archivo | Cambio |
|------|---------|--------|
| 8 | `src/hooks/useCommentListBase.ts` | Linea 141: convertir `handleSubmitReply` de funcion anonima a `useCallback` con deps `[user, replyingTo, replyText, userCommentsToday, isOffline, businessId, businessName, displayName, onCommentsChange, toast]` |

### Fase 4: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 9 | `src/__tests__/hooks/useCommentListBase.test.ts` | Verificar que `handleSubmitReply` llama `addComment` con args correctos; testear el path de error; testear el guard de daily limit |
| 10 | `functions/src/__tests__/triggers/comments.test.ts` | Verificar que `onCommentCreated` y `onCommentDeleted` llaman los 3 writes (spies sobre `incrementCounter`, `trackWrite`, `incrementBusinessCount`) — no necesariamente testeando paralelismo, sino que todos se llaman |
| 11 | `functions/src/__tests__/triggers/ratings.test.ts` | Verificar create/delete paths llaman `incrementCounter`, `trackWrite`/`trackDelete`, y `updateRatingAggregates` |

### Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 12 | `docs/reference/patterns.md` | Agregar nota en seccion "Queries y cache" sobre el patron de destructurar `refetch` para deps estables de `useCallback` |
| 13 | `docs/reference/project-reference.md` | Actualizar fecha y resumen |

---

## Orden de implementacion

1. **Fase 1** (pasos 1-3) — sin dependencias externas, cambio de 3 lineas en un solo archivo.
2. **Fase 2** (pasos 4-7) — independiente de Fase 1. Puede hacerse en paralelo con Fase 1 si hay dos pares de ojos, pero por seguridad hacerla secuencial.
3. **Fase 3** (paso 8) — independiente de Fases 1 y 2.
4. **Fase 4** (pasos 9-11) — depende de Fases 1-3 completadas.
5. **Fase final** (pasos 12-13) — depende de todo lo anterior.

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Delta |
|---------|----------------|-----------------|-------|
| `BusinessSheet.tsx` | ~380 | ~381 | +1 (linea de destructuring) |
| `comments.ts` | 184 | ~180 | -4 (menos `await` sueltos, mismo contenido) |
| `ratings.ts` | 71 | ~69 | -2 |
| `useCommentListBase.ts` | 197 | ~200 | +3 (wrapper `useCallback` + deps) |

Ningun archivo supera 400 lineas. Sin decomposicion necesaria.

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|-----------|
| `Promise.all` en CF oculta el error individual cuando uno falla | Baja | `Promise.all` rechaza con el primer error, igual que antes con `await` secuencial. El error se propaga al caller y aparece en Cloud Functions logs. Comportamiento identico al actual. |
| `useCallback` con deps completas en `handleSubmitReply` no reduce re-renders cuando usuario tipea | Confirmada (LOW severity) | Documentada en specs. El beneficio es para renders no relacionados con el tipeo. Aceptable. |
| Destructurar `refetch` en `BusinessSheet` podria quedar stale si `useBusinessData` cambia su interfaz | Muy baja | `refetch` es parte del contrato publico del hook (tipado en `UseBusinessDataReturn`). Un cambio de nombre romperia TypeScript en toda la codebase. |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] No se crean archivos nuevos — todos los cambios son edits en archivos existentes
- [x] Logica de negocio permanece en hooks/services, no en componentes
- [x] Ningun archivo resultante supera 400 lineas

## Guardrails de seguridad

- [x] Sin colecciones nuevas — no aplican checks de `hasOnly()`
- [x] Sin campos nuevos — no aplican checks de field whitelist
- [x] Sin nuevos secrets ni credenciales
- [x] `Promise.all` no cambia el comportamiento de rate limiting (rate limit se verifica antes, con `await` independiente)

## Guardrails de accesibilidad y UI

- [x] Sin componentes nuevos — no aplican checks de `aria-label` ni touch targets
- [x] Sin cambios a JSX

## Guardrails de copy

- [x] Sin textos nuevos visibles al usuario

---

## Criterios de done

- [ ] `handleRatingChange` y `handleTagsChange` en `BusinessSheet` tienen dep `[refetch]` (no `[data]`)
- [ ] Los 4 bloques de writes en CF usan `Promise.all`
- [ ] `handleSubmitReply` en `useCommentListBase` es `useCallback`
- [ ] Tests pasan (pasos 9-11)
- [ ] No lint errors (`npm run lint` en root y en `functions/`)
- [ ] Build succeeds (`npm run build`)
- [ ] `docs/reference/patterns.md` actualizado con el patron de destructuring de `refetch`
