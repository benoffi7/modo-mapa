# PRD: Centralize CATEGORY_COLORS

**Issue:** #206 item 3
**Priority:** Low
**Effort:** Small (<1h)

## Problema

`ForYouSection.tsx` tiene un mapa inline `CATEGORY_COLORS` que asigna colores por categoria de comercio. Si se agregan categorias o cambia el design system, este mapa queda desactualizado.

## Archivos afectados

- `src/components/home/ForYouSection.tsx`
- Potencialmente otros componentes que usen colores por categoria

## Solucion propuesta

1. Mover `CATEGORY_COLORS` a `src/constants/business.ts` junto a `CATEGORY_LABELS`
2. Importar desde ahi en todos los componentes que lo usen

## Criterios de aceptacion

- [ ] Un solo archivo define la relacion categoria-color
- [ ] ForYouSection usa la constante centralizada
