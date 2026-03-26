# Plan: Trending — comercios populares esta semana

**Feature:** trending
**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-20

---

## Dependencias

Ninguna dependencia con otros issues. Se puede implementar de forma independiente.

---

## Pasos de implementacion

### Paso 1: Data model y constantes

**Archivos:**

- `src/types/index.ts` — agregar `TrendingBusiness`, `TrendingBusinessBreakdown`, `TrendingData`
- `src/constants/trending.ts` — crear con `TRENDING_WINDOW_DAYS`, `TRENDING_MAX_BUSINESSES`, `TRENDING_SCORING`
- `src/config/collections.ts` — agregar `TRENDING_BUSINESSES: 'trendingBusinesses'`

**Verificacion:** tipos compilan sin errores.

### Paso 2: Cloud Function + tests

**Archivos:**

- `functions/src/scheduled/trending.ts` — crear `computeTrendingBusinesses`
- `functions/src/index.ts` — exportar la nueva funcion
- `functions/src/__tests__/trending.test.ts` — tests unitarios

**Verificacion:** `cd functions && npm test` pasa con >= 80% cobertura en `trending.ts`.

### Paso 3: Firestore rules

**Archivos:**

- `firestore.rules` — agregar regla para `trendingBusinesses/{docId}`

**Verificacion:** rules compilan y tests de rules pasan (si existen).

### Paso 4: Service + hook + tests

**Archivos:**

- `src/services/trending.ts` — crear `fetchTrending()`
- `src/hooks/useTrending.ts` — crear hook
- `src/__tests__/services/trending.test.ts` — test del servicio
- `src/__tests__/hooks/useTrending.test.ts` — test del hook

**Verificacion:** `npm test` pasa con >= 80% cobertura en archivos nuevos.

### Paso 5: UI — Tab en Sugeridos + TrendingList

**Archivos:**

- `src/components/menu/TrendingList.tsx` — crear componente
- `src/components/menu/TrendingBusinessCard.tsx` — crear componente
- `src/components/menu/SuggestionsView.tsx` — agregar tabs para alternar entre "Para vos" y "Tendencia"
- `src/__tests__/components/TrendingList.test.ts` — test del componente

**Verificacion:** la app renderiza el tab "Tendencia" en Sugeridos y muestra la lista al seleccionarlo.

### Paso 6: Badge en BusinessSheet (opcional, baja prioridad)

**Archivos:**

- `src/context/TrendingContext.tsx` — crear contexto con `isTrending(businessId)`
- `src/components/business/BusinessSheet.tsx` (o header) — mostrar chip "Tendencia"

**Verificacion:** comercios en la lista trending muestran el badge.

### Paso 7: Analytics events

**Archivos:**

- `src/components/menu/TrendingList.tsx` — `trending_viewed` al montar
- `src/components/menu/TrendingBusinessCard.tsx` — `trending_business_clicked` al click

**Verificacion:** eventos aparecen en Firebase Analytics debug.

---

## Checklist de verificacion final

- [ ] `npm run lint` pasa sin errores
- [ ] `npm run build` compila exitosamente
- [ ] `cd functions && npm run build` compila exitosamente
- [ ] `npm test` pasa con cobertura >= 80% en archivos nuevos
- [ ] `cd functions && npm test` pasa con cobertura >= 80% en trending.ts
- [ ] Tab "Tendencia" aparece en Sugeridos y funciona
- [ ] Cloud Function deployable (build exitoso)
- [ ] Firestore rules actualizadas
- [ ] Privacy policy: no aplica (no se recopilan datos nuevos del usuario)
- [ ] Staging deploy y verificacion antes de merge
