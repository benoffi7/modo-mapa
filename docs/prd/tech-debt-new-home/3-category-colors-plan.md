# Plan: Centralize CATEGORY_COLORS

**Specs:** [3-category-colors-specs.md](3-category-colors-specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Mover constante y actualizar imports

**Branch:** `feat/centralize-category-colors`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/business.ts` | Agregar `CATEGORY_COLORS: Record<BusinessCategory, string>` con los 7 colores (adoptados de `constants/map.ts`). Colocarlo despues de `CATEGORY_LABELS` |
| 2 | `src/constants/map.ts` | Eliminar `CATEGORY_COLORS` y el `import type { BusinessCategory }` (ya no necesario si solo quedan coordenadas) |
| 3 | `src/components/map/BusinessMarker.tsx` | Cambiar `import { CATEGORY_COLORS } from '../../constants/map'` a `import { CATEGORY_COLORS } from '../../constants/business'` |
| 4 | `src/components/home/ForYouSection.tsx` | Eliminar la constante inline `CATEGORY_COLORS` (lineas 15-23). Agregar `CATEGORY_COLORS` al import existente de `../../constants/business` (linea 11) |
| 5 | Ejecutar `npm run lint` | Verificar que no hay errores de lint |
| 6 | Ejecutar `npm run build` | Verificar que compila sin errores de TypeScript |
| 7 | Commit con mensaje descriptivo | `refactor: centralize CATEGORY_COLORS in constants/business.ts` |

---

## Orden de implementacion

1. `src/constants/business.ts` -- agregar la constante (los consumidores la necesitan antes de que se elimine de otros archivos)
2. `src/constants/map.ts` -- eliminar la constante original
3. `src/components/map/BusinessMarker.tsx` -- actualizar import
4. `src/components/home/ForYouSection.tsx` -- eliminar inline y actualizar import

## Riesgos

1. **Cambio visual en ForYouSection:** Los colores de las cards van a cambiar ligeramente (ej: bar pasa de azul `#1565c0` a violeta `#9c27b0`). Mitigacion: esto es intencional para unificar con los markers del mapa. Verificar visualmente que los nuevos colores se ven bien en las cards.

2. **Import circular potencial:** `business.ts` importa `BusinessCategory` de `types/`. Esto ya funciona (el import ya existe en linea 1). Sin riesgo adicional.

## Criterios de done

- [ ] Un solo archivo (`src/constants/business.ts`) define `CATEGORY_COLORS`
- [ ] `ForYouSection.tsx` importa y usa la constante centralizada
- [ ] `BusinessMarker.tsx` importa de la nueva ubicacion
- [ ] `constants/map.ts` ya no contiene `CATEGORY_COLORS`
- [ ] No hay errores de lint (`npm run lint`)
- [ ] Build exitoso (`npm run build`)
- [ ] Colores consistentes entre markers del mapa y cards de ForYouSection
