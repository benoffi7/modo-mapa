# PRD: Badges de Verificación de Usuario

**Issue:** #201
**Fecha:** 2026-03-30
**Estado:** Draft

## Problema

Los usuarios generan contenido (reviews, ratings, check-ins) pero no hay indicadores de confiabilidad. Un usuario con 100 reviews en la misma ciudad no se distingue de uno con 2 reviews. Esto reduce la confianza en el contenido y no incentiva participación de calidad.

## Propuesta

Agregar 3 badges de verificación que se muestran en el perfil del usuario y junto a sus reviews/comentarios. Estos badges se integran al sistema de achievements existente (8 badges ya implementados en `AchievementsGrid`).

### Nuevos Badges

| Badge | Criterio | Icono |
|---|---|---|
| **Local Guide** | 50+ ratings en negocios de la misma ciudad/localidad | Shield con estrella |
| **Verified Visitor** | 5+ check-ins desde la ubicación del negocio (< 100m) | Pin verificado |
| **Trusted Reviewer** | Ratings consistentes con promedio comunidad (±0.5 pts en 80%+ de sus ratings) | Check doble |

### Dónde se muestran

1. **Perfil propio** (`ProfileScreen` > `AchievementsSection`): junto a los badges existentes
2. **Perfil de otros** (`UserProfileModal`): en la sección de badges (`BadgesList`)
3. **Junto a reviews**: chip pequeño al lado del nombre del autor en comentarios

### Cálculo

- Se calculan client-side al cargar el perfil, usando datos ya disponibles:
  - Local Guide: contar ratings agrupados por ciudad del negocio
  - Verified Visitor: contar check-ins con `distance < 100m` del negocio
  - Trusted Reviewer: comparar ratings del usuario vs promedio del negocio
- Cache en `localStorage` con TTL de 24h para evitar recálculos

## Datos disponibles

- Ratings con `businessId` y `score` → calcular consistencia y contar por ciudad
- Check-ins con coordenadas y `businessId` → verificar proximidad
- `userSettings.locality` → ciudad principal del usuario
- `allBusinesses` → coordenadas y ciudad de cada negocio
- Sistema de achievements existente: `src/services/achievements.ts`, `AchievementsGrid`, `BadgesList`

## Componentes

| Componente | Tipo | Ubicación |
|---|---|---|
| `VerificationBadge` | Nuevo | `src/components/social/` |
| `useVerificationBadges` | Nuevo hook | `src/hooks/` |
| `BadgesList` | Modificar | Agregar badges de verificación |
| `AchievementsGrid` | Modificar | Integrar nuevos badges |
| `UserProfileModal` | Modificar | Mostrar badges de verificación |
| `CommentItem` | Modificar | Chip de badge junto al autor |

## Diseño UX

- Badges de verificación se distinguen visualmente de achievements: borde dorado y tooltip explicativo
- En comentarios: chip compacto (icono 16px + texto truncado) al lado del nombre
- En perfil: card con progreso hacia el badge si aún no se alcanzó (ej: "32/50 ratings en tu ciudad")
- Progreso incentiva al usuario a completar el badge

## Analytics

| Evento | Cuándo |
|---|---|
| `verification_badge_earned` | Usuario alcanza criterio de un badge nuevo |
| `verification_badge_viewed` | Badge visible en perfil propio o ajeno |
| `verification_badge_tooltip` | Tap en badge para ver explicación |

## Tests

- `useVerificationBadges`: cálculo correcto de cada badge, edge cases (0 ratings, sin check-ins)
- `VerificationBadge`: render con/sin badge, tooltip
- `BadgesList`: integración con badges de verificación + achievements existentes

## Seguridad

- Badges se calculan client-side: un usuario podría manipular localStorage para mostrar badges falsos
- Mitigación: los badges son informativos, no otorgan permisos. Validación server-side es mejora futura
- No se exponen ratings individuales de otros usuarios; solo el badge resultante

## Fuera de alcance

- Validación server-side de badges (Cloud Function)
- Badges con niveles (bronce/plata/oro)
- Badges por categoría específica ("Experto en cafés")
