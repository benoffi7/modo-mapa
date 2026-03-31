# Plan: Badges de Verificación

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

## Fases de implementación

### Fase 1 — Tipos + constantes

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/types/index.ts` | Agregar `VerificationBadgeId` y `VerificationBadge` interface |
| 2 | `src/constants/verificationBadges.ts` | Crear con definiciones de los 3 badges, cache key y TTL |

### Fase 2 — Hook `useVerificationBadges`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/hooks/useVerificationBadges.ts` | Crear hook con lógica de cálculo para Local Guide, Verified Visitor, Trusted Reviewer. Cache en localStorage con TTL 24h |
| 2 | `src/hooks/useVerificationBadges.test.ts` | Tests para cada badge: earned/not earned, edge cases, cache hit/miss/expired |

El hook necesita acceso a:
- Ratings del usuario (ya disponible via servicios existentes)
- Check-ins del usuario (ya disponible)
- `allBusinesses` para coordenadas y localidad
- `userSettings` para la localidad del usuario

### Fase 3 — Componente `VerificationBadge`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/social/VerificationBadge.tsx` | Crear componente con modo normal (card con progreso) y compact (chip con tooltip). Estilo dorado para earned, gris para no earned |
| 2 | `src/components/social/VerificationBadge.test.tsx` | Tests: render earned/not earned, compact, tooltip |

### Fase 4 — Integración en componentes existentes

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/social/BadgesList.tsx` | Agregar sección "Verificación" con separador, renderizar `VerificationBadge` compact para cada badge |
| 2 | `src/components/profile/AchievementsGrid.tsx` | Agregar fila superior de verificación con título |
| 3 | `src/components/social/UserProfileModal.tsx` | Llamar `useVerificationBadges(entry.userId)` y pasar badges a `BadgesList` |

### Fase 5 — Analytics + lint + commit

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/constants/analyticsEvents.ts` | Agregar eventos `verification_badge_*` |
| 2 | — | Correr lint, fix, tests |
| 3 | — | Commit |

## Orden de implementación

1. `src/types/index.ts` (types)
2. `src/constants/verificationBadges.ts`
3. `src/hooks/useVerificationBadges.ts` + test
4. `src/components/social/VerificationBadge.tsx` + test
5. `src/components/social/BadgesList.tsx` (modificar)
6. `src/components/profile/AchievementsGrid.tsx` (modificar)
7. `src/components/social/UserProfileModal.tsx` (modificar)
8. `src/constants/analyticsEvents.ts` (agregar)

## Riesgos

- **Datos de ratings de otros usuarios**: para Trusted Reviewer se necesita el promedio del negocio. Verificar si `allBusinesses` ya incluye `averageRating` o si hay que calcularlo
- **Check-ins sin coordenadas**: algunos check-ins legacy podrían no tener coords → filtrarlos sin crashear
- **Performance en perfiles ajenos**: calcular badges de otro usuario requiere cargar sus ratings/check-ins. Considerar loading state visible
- **Cache stale**: si usuario gana un badge pero el cache de 24h no expiró, no lo verá hasta mañana. Aceptable para v1

## Criterios de done

- [ ] Hook calcula correctamente los 3 badges con progreso
- [ ] Cache localStorage funciona con TTL 24h
- [ ] `VerificationBadge` renderiza earned (dorado) y not earned (gris con progreso)
- [ ] `BadgesList` muestra sección de verificación separada
- [ ] `AchievementsGrid` muestra fila de verificación
- [ ] `UserProfileModal` evalúa badges del usuario visitado
- [ ] Tests pasan para hook y componentes
- [ ] Analytics trackeados
- [ ] Lint sin errores
