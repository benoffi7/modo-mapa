# Plan: Seguir Tags — Tus Intereses

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

## Fases de implementación

### Fase 1 — Tipos + constantes

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/types/index.ts` | Agregar `followedTags`, `followedTagsUpdatedAt`, `followedTagsLastSeenAt` a `UserSettings`. Agregar `InterestFeedItem` e `InterestFeedGroup` |
| 2 | `src/constants/interests.ts` | Crear con `MAX_FOLLOWED_TAGS`, `INTERESTS_MAX_BUSINESSES_PER_TAG`, `SUGGESTED_TAGS` |

### Fase 2 — Hook `useFollowedTags`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/hooks/useFollowedTags.ts` | Crear hook CRUD: lee de userSettings, follow/unfollow con validación de límite y duplicados, persiste via updateUserSettings |
| 2 | `src/hooks/useFollowedTags.test.ts` | Tests: follow/unfollow, límite 20, duplicados, persistencia |

### Fase 3 — Hook `useInterestsFeed`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/hooks/useInterestsFeed.ts` | Crear hook: filtra allBusinesses por tags seguidos, agrupa por tag, ordena por rating, detecta nuevos, markSeen |
| 2 | `src/hooks/useInterestsFeed.test.ts` | Tests: filtrado, ordenamiento, nuevos, markSeen |

### Fase 4 — Componentes nuevos

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/common/FollowTagChip.tsx` | Crear chip con toggle visual (filled/outlined), badge numérico, callback onToggle |
| 2 | `src/components/common/FollowTagChip.test.tsx` | Tests: toggle, badge, render |
| 3 | `src/components/home/YourInterestsSection.tsx` | Crear sección con estado con datos (chips + lista negocios) y estado vacío (CTA con sugeridos) |
| 4 | `src/components/home/YourInterestsSection.test.tsx` | Tests: render con tags, CTA, tap sugerido, badge |

### Fase 5 — Integración en componentes existentes

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/home/HomeScreen.tsx` | Import + agregar `<YourInterestsSection />` |
| 2 | `src/components/business/BusinessTags.tsx` | Agregar botón "Seguir" (icono +) junto a tags predefinidos. Indicador si ya seguido |
| 3 | `src/components/profile/ProfileScreen.tsx` | Agregar sub-sección "Tus intereses" con lista de tags y unfollow |

### Fase 6 — Analytics + lint + commit

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/constants/analyticsEvents.ts` | Agregar eventos `tag_followed`, `tag_unfollowed`, `interests_*` |
| 2 | — | Correr lint, fix, tests |
| 3 | — | Commit |

## Orden de implementación

1. `src/types/index.ts` (types)
2. `src/constants/interests.ts` (nuevo)
3. `src/hooks/useFollowedTags.ts` + test
4. `src/hooks/useInterestsFeed.ts` + test
5. `src/components/common/FollowTagChip.tsx` + test
6. `src/components/home/YourInterestsSection.tsx` + test
7. `src/components/home/HomeScreen.tsx` (modificar)
8. `src/components/business/BusinessTags.tsx` (modificar)
9. `src/components/profile/ProfileScreen.tsx` (modificar)
10. `src/constants/analyticsEvents.ts` (agregar)

## Riesgos

- **Tags inconsistentes**: los tags predefinidos (`PREDEFINED_TAGS`) y custom tags tienen formatos distintos. Normalizar a lowercase para matching
- **allBusinesses sin tags**: algunos negocios podrían no tener tags asignados → filtrarlos sin error
- **Suggested tags no existen**: si ningún negocio tiene un tag sugerido, el chip no mostrará resultados al seguirlo → aceptable, el usuario descubrirá negocios cuando se taggeen
- **BusinessTags ya complejo**: el componente tiene lógica de predefined + custom + context menu. El botón "Seguir" debe ser sutil para no sobrecargar la UI

## Criterios de done

- [ ] `useFollowedTags` CRUD funciona con límite de 20
- [ ] `useInterestsFeed` filtra y agrupa correctamente
- [ ] `YourInterestsSection` renderiza chips con negocios o CTA con sugeridos
- [ ] `FollowTagChip` toggle visual funciona
- [ ] Botón "Seguir" en `BusinessTags` funcional
- [ ] Sub-sección "Tus intereses" en ProfileScreen con gestión
- [ ] Tests pasan para hooks y componentes
- [ ] Analytics trackeados con source correcto
- [ ] Lint sin errores
