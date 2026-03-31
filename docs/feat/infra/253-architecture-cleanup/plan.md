# Plan: mover useBusinessDataCache + centralizar dragHandleSeen + eliminar dead export

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Mover useBusinessDataCache a services

**Branch:** `feat/253-architecture-cleanup`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/businessDataCache.ts` | Crear archivo copiando contenido de `src/hooks/useBusinessDataCache.ts` (sin cambios en logica) |
| 2 | `src/hooks/useBusinessDataCache.ts` | Eliminar archivo |
| 3 | `src/hooks/useBusinessData.ts` | Cambiar import `'./useBusinessDataCache'` a `'../services/businessDataCache'` |
| 4 | `src/services/menuPhotos.ts` | Cambiar import `'../hooks/useBusinessDataCache'` a `'./businessDataCache'` |
| 5 | `src/services/emailAuth.ts` | Cambiar import `'../hooks/useBusinessDataCache'` a `'./businessDataCache'` |
| 6 | `src/constants/cache.ts` | Actualizar comentario linea 1: `(useBusinessDataCache)` a `(businessDataCache)` |

### Fase 2: Centralizar dragHandleSeen + eliminar dead export

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/storage.ts` | Agregar `export const STORAGE_KEY_DRAG_HANDLE_SEEN = 'dragHandleSeen';` |
| 2 | `src/components/business/BusinessSheet.tsx` | Importar `STORAGE_KEY_DRAG_HANDLE_SEEN` de `constants/storage` y reemplazar las 2 ocurrencias de `'dragHandleSeen'` |
| 3 | `src/services/businessData.ts` | Quitar `export` de `interface BusinessDataResult` (linea 9) |

### Fase 3: Actualizar tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/businessDataCache.test.ts` | Crear moviendo `src/hooks/useBusinessDataCache.test.ts`. Actualizar import a `'./businessDataCache'` y describe a `'businessDataCache'` |
| 2 | `src/hooks/useBusinessDataCache.test.ts` | Eliminar archivo |
| 3 | `src/hooks/useBusinessData.test.ts` | Cambiar mock path `'./useBusinessDataCache'` a `'../services/businessDataCache'` |
| 4 | `src/services/menuPhotos.test.ts` | Cambiar mock path `'../hooks/useBusinessDataCache'` a `'./businessDataCache'` |
| 5 | `src/services/__tests__/menuPhotos.test.ts` | Cambiar mock path `'../../hooks/useBusinessDataCache'` a `'../businessDataCache'` |
| 6 | `src/services/emailAuth.test.ts` | Cambiar mock path `'../hooks/useBusinessDataCache'` a `'./businessDataCache'` |

### Fase 4: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | - | Ejecutar `npm run test:run` y verificar que todos los tests pasan |
| 2 | - | Ejecutar `npx tsc --noEmit` y verificar que no hay errores de tipos |
| 3 | - | Verificar que no quedan imports de `hooks/useBusinessDataCache` en el codebase |

### Fase 5: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Actualizar referencia `useBusinessDataCache.ts` a `businessDataCache.ts` en la fila de "Business data cache" |
| 2 | `docs/reference/tests.md` | Actualizar fila de `useBusinessDataCache.ts` / `useBusinessDataCache.test.ts` a los nuevos nombres en `services/` |

---

## Orden de implementacion

1. `src/services/businessDataCache.ts` (crear nuevo archivo)
2. Actualizar imports en `useBusinessData.ts`, `menuPhotos.ts`, `emailAuth.ts`
3. Eliminar `src/hooks/useBusinessDataCache.ts`
4. Agregar constante `STORAGE_KEY_DRAG_HANDLE_SEEN` a `constants/storage.ts`
5. Actualizar `BusinessSheet.tsx` con la constante
6. Quitar `export` de `BusinessDataResult` en `businessData.ts`
7. Mover y actualizar archivo de test
8. Actualizar mocks en 4 archivos de test
9. Verificar build + tests
10. Actualizar docs de referencia

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas resultantes | Notas |
|---------|----------------|-------------------|-------|
| `src/services/businessDataCache.ts` | nuevo | ~48 | Copia exacta del original |
| `src/services/businessData.ts` | 156 | 156 | Solo cambia `export` a privado |
| `src/constants/storage.ts` | 23 | 24 | +1 linea |
| `src/components/business/BusinessSheet.tsx` | 328 | 329 | +1 import, sin cambio neto significativo |
| `src/services/businessDataCache.test.ts` | nuevo | ~134 | Copia del test original con imports actualizados |

Ningun archivo supera 400 lineas.

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|-----------|
| Import roto no detectado | Baja | `npx tsc --noEmit` + `npm run test:run` validan todos los imports |
| Test con mock path incorrecto | Baja | Grep exhaustivo por `useBusinessDataCache` post-cambio para verificar que no queda ninguna referencia |
| Otro archivo importa `BusinessDataResult` | Muy baja | Grep confirmo que solo `businessData.ts` lo usa internamente |

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (`services/`)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (magic string, upward dep)
- [x] Ningun archivo resultante supera 400 lineas

## Criterios de done

- [x] `useBusinessDataCache.ts` ya no existe en `src/hooks/`
- [x] `src/services/businessDataCache.ts` existe y exporta la misma API
- [x] No hay imports de `hooks/useBusinessDataCache` en ningun archivo
- [x] La magic string `dragHandleSeen` no aparece fuera de `constants/storage.ts`
- [x] `BusinessDataResult` ya no es un export publico
- [x] `npm run test:run` pasa sin errores
- [x] Build sin errores de TypeScript
- [x] Docs de referencia actualizados (patterns.md, tests.md)
