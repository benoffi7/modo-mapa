# Plan: Extract shared achievement definitions

**Specs:** [2-achievements-constants-specs.md](2-achievements-constants-specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Crear constante compartida

**Branch:** `feat/achievements-constants`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/achievements.ts` | Crear archivo con interfaz `AchievementDefinition` y array `ACHIEVEMENT_DEFINITIONS` con las 8 definiciones (explorador, social, critico, viajero, coleccionista, fotografo, embajador, racha). Campos: `id`, `label`, `description`, `icon` (string), `iconColor`, `target`. |
| 2 | `src/constants/index.ts` | Agregar `export * from './achievements';` al barrel re-export. |

### Fase 2: Migrar componentes

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `src/components/profile/AchievementsGrid.tsx` | (a) Importar `ACHIEVEMENT_DEFINITIONS` y `AchievementDefinition` desde `../../constants/achievements`. (b) Crear map `ACHIEVEMENT_ICONS: Record<string, React.ComponentType<SvgIconProps>>` con las 8 entradas (ExploreOutlined, PeopleOutlined, RateReviewOutlined, FlightOutlined, BookmarkBorder, CameraAltOutlined, EmojiEventsOutlined, LocalFireDepartment). (c) Reemplazar array hardcodeado `achievements` por `ACHIEVEMENT_DEFINITIONS.map(def => ({ ...def, icon: <Icon color={def.iconColor} />, current: resolveProgress(def.id) }))` donde `resolveProgress` usa `stats.uniqueBusinesses` para `explorador` y `0` para el resto (igual que hoy). (d) Eliminar imports de iconos MUI individuales que ya estan en el map. (e) Mantener interfaz local `Achievement` con `current` y `icon: React.ReactElement`. |
| 4 | `src/components/profile/AchievementsSection.tsx` | (a) Importar `ACHIEVEMENT_DEFINITIONS` y `AchievementDefinition` desde `../../constants/achievements`. (b) Crear map `ACHIEVEMENT_ICONS` con las 4 entradas que usa (ExploreOutlined, PeopleOutlined, RateReviewOutlined, FlightOutlined). (c) Reemplazar array hardcodeado por `ACHIEVEMENT_DEFINITIONS.slice(0, 4).map(def => ({ ...def, icon: <Icon color={def.iconColor} />, current: resolveProgress(def.id) }))`. (d) Eliminar imports de iconos individuales que ya estan en el map. (e) Mantener interfaz local `Achievement`. |

### Fase 3: Verificar y commit

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | N/A | Ejecutar `npx eslint src/constants/achievements.ts src/components/profile/AchievementsGrid.tsx src/components/profile/AchievementsSection.tsx` — corregir errores si los hay. |
| 6 | N/A | Ejecutar `npx tsc --noEmit` — verificar que no hay errores de tipos. |
| 7 | N/A | Ejecutar `npm run test:run` — verificar que tests existentes siguen pasando. |
| 8 | N/A | Ejecutar `npm run build` — verificar que el build pasa limpio. |
| 9 | N/A | Commit: `refactor: extract shared achievement definitions to constants` |

---

## Orden de implementacion

1. `src/constants/achievements.ts` — la constante compartida (sin dependencias)
2. `src/constants/index.ts` — barrel re-export
3. `src/components/profile/AchievementsGrid.tsx` — migrar a import compartido
4. `src/components/profile/AchievementsSection.tsx` — migrar a import compartido
5. Lint + typecheck + tests + build

## Riesgos

1. **Iconos rotos por typo en string.** Si el string del icono en la constante no coincide con la key del map en el componente, el icono no se renderiza. Mitigacion: TypeScript inferira el tipo del map y el compilador detectara keys faltantes si se usa `satisfies Record<string, ...>` o se accede con bracket notation.

2. **AchievementsSection muestra achievements distintos post-refactor.** Si el orden del array cambia, `slice(0, 4)` mostraria otros achievements. Mitigacion: el array `ACHIEVEMENT_DEFINITIONS` se define con el mismo orden que el array original de `AchievementsGrid` (explorador, social, critico, viajero primero), que coincide con lo que `AchievementsSection` mostraba.

## Criterios de done

- [ ] Un solo source of truth para definiciones de achievements (`src/constants/achievements.ts`)
- [ ] `AchievementsGrid` importa desde constantes compartidas
- [ ] `AchievementsSection` importa desde constantes compartidas
- [ ] Ambos componentes renderizan identico a antes del refactor
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Tests existentes pasan
