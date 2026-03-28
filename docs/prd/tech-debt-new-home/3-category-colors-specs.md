# Specs: Centralize CATEGORY_COLORS

**PRD:** [3-category-colors.md](3-category-colors.md)
**Fecha:** 2026-03-27

---

## Problema identificado

Existen **dos** mapas `CATEGORY_COLORS` con valores diferentes:

| Categoria | `constants/map.ts` (markers) | `ForYouSection.tsx` (cards) |
|-----------|-----------------------------|-----------------------------|
| restaurant | `#ea4335` | `#e65100` |
| cafe | `#795548` | `#4e342e` |
| bakery | `#ff9800` | `#f9a825` |
| bar | `#9c27b0` | `#1565c0` |
| fastfood | `#f44336` | `#d32f2f` |
| icecream | `#e91e63` | `#ec407a` |
| pizza | `#ff5722` | `#ff6f00` |

La version de `constants/map.ts` ya esta tipada como `Record<BusinessCategory, string>` y es usada por `BusinessMarker.tsx`. La version inline en `ForYouSection.tsx` usa `Record<string, string>` (mas debil).

## Modelo de datos

Sin cambios. No hay cambios en Firestore.

## Firestore Rules

Sin cambios.

## Cloud Functions

Sin cambios.

## Componentes

### ForYouSection (modificacion)

**Archivo:** `src/components/home/ForYouSection.tsx`

Cambios:

- Eliminar la constante inline `CATEGORY_COLORS`
- Importar `CATEGORY_COLORS` desde `../../constants/business` (nueva ubicacion)
- El resto del componente no cambia

## Hooks

Sin cambios.

## Servicios

Sin cambios.

## Constantes

### `src/constants/business.ts` (modificacion)

Agregar `CATEGORY_COLORS` junto a `CATEGORY_LABELS`, ya que ambas definen metadata por categoria de negocio. Usar el tipo `Record<BusinessCategory, string>` para consistencia.

```typescript
export const CATEGORY_COLORS: Record<BusinessCategory, string> = {
  restaurant: '#ea4335',
  cafe: '#795548',
  bakery: '#ff9800',
  bar: '#9c27b0',
  fastfood: '#f44336',
  icecream: '#e91e63',
  pizza: '#ff5722',
};
```

Se adoptan los colores de `constants/map.ts` porque:

1. Ya estan tipados con `BusinessCategory` (type-safe)
2. Son los que el usuario ve en los markers del mapa (consistencia visual)
3. `ForYouSection` usaba colores ligeramente diferentes sin razon documentada

### `src/constants/map.ts` (modificacion)

Eliminar `CATEGORY_COLORS` de este archivo. Mantener solo `BUENOS_AIRES_CENTER` y `OFFICE_LOCATION` (constantes geograficas).

### `src/components/map/BusinessMarker.tsx` (modificacion)

Actualizar el import de `CATEGORY_COLORS` para apuntar a `../../constants/business` en vez de `../../constants/map`.

## Integracion

| Archivo | Cambio | Motivo |
|---------|--------|--------|
| `src/constants/business.ts` | Agregar `CATEGORY_COLORS` | Centralizar junto a `CATEGORY_LABELS` |
| `src/constants/map.ts` | Eliminar `CATEGORY_COLORS` + import de `BusinessCategory` | Ya no define colores por categoria |
| `src/components/home/ForYouSection.tsx` | Eliminar inline `CATEGORY_COLORS`, importar desde constants | Usar fuente centralizada |
| `src/components/map/BusinessMarker.tsx` | Cambiar import path | Apuntar a nueva ubicacion |

**Nota sobre barrel export:** `constants/index.ts` re-exporta `constants/business.ts` (linea 5: `export * from './business'`). Actualmente tambien re-exporta `constants/map.ts` (linea 4: `export * from './map'`). Al mover `CATEGORY_COLORS` de `map.ts` a `business.ts`, la re-exportacion via barrel se mantiene sin cambios -- el simbolo sigue disponible como `import { CATEGORY_COLORS } from '../../constants'`. Ningun consumidor actual usa el barrel para este import, asi que no hay riesgo.

## Tests

Este cambio es una reorganizacion de constantes sin logica nueva. Segun la politica de tests, las constantes sin logica son excepcion y no requieren tests unitarios.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | Sin logica nueva | N/A |

**Verificacion:** confirmar que la app compila sin errores y que los colores se renderizan correctamente en ForYouSection y BusinessMarker.

## Analytics

Sin cambios.

---

## Offline

Sin impacto. Este cambio es puramente de organizacion de codigo frontend.

---

## Decisiones tecnicas

1. **Mover a `business.ts` en vez de dejar en `map.ts`:** Los colores por categoria son metadata de negocio, no del mapa. `CATEGORY_LABELS` ya vive en `business.ts`. Agrupar ambas constantes mejora la discoverability. `map.ts` queda para constantes puramente geograficas.

2. **Adoptar colores de `map.ts` sobre los de `ForYouSection`:** Los colores de `map.ts` son los que el usuario asocia con cada categoria (los ve en los markers). Cambiar los colores de ForYouSection para que coincidan mejora la consistencia visual. La diferencia original no tenia justificacion documentada.

3. **No crear un archivo `constants/categoryColors.ts` separado:** Seria over-engineering para 7 lineas. El patron del proyecto es agrupar por dominio (`business.ts` para todo lo de categorias de negocio).
