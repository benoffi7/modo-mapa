# Specs: Badges de Verificación

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

## Modelo de datos

No se crean nuevas collections. Los badges se calculan client-side y se cachean en localStorage.

### Tipos nuevos

```typescript
// src/types/index.ts
type VerificationBadgeId = 'local_guide' | 'verified_visitor' | 'trusted_reviewer';

interface VerificationBadge {
  id: VerificationBadgeId;
  name: string;
  description: string;
  icon: string;         // emoji o MUI icon name
  earned: boolean;
  progress: number;     // 0-100
  current: number;      // valor actual (ej: 32 ratings)
  target: number;       // meta (ej: 50 ratings)
}
```

### Constantes

```typescript
// src/constants/verificationBadges.ts
export const VERIFICATION_BADGES: Record<VerificationBadgeId, {
  name: string;
  description: string;
  icon: string;
  target: number;
}> = {
  local_guide: {
    name: 'Local Guide',
    description: '50+ calificaciones en tu ciudad',
    icon: '🛡️',
    target: 50,
  },
  verified_visitor: {
    name: 'Visitante Verificado',
    description: '5+ check-ins desde el negocio',
    icon: '📍',
    target: 5,
  },
  trusted_reviewer: {
    name: 'Opinión Confiable',
    description: 'Ratings consistentes con la comunidad',
    icon: '✅',
    target: 80, // 80% de ratings dentro de ±0.5 del promedio
  },
};

export const VERIFICATION_CACHE_KEY = 'mm_verification_badges';
export const VERIFICATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
```

## Firestore Rules

Sin cambios. No hay nuevas queries: se usan datos ya cargados (ratings del usuario, check-ins, allBusinesses).

## Cloud Functions

Sin cambios. Cálculo 100% client-side.

## Componentes

### `VerificationBadge` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/components/social/VerificationBadge.tsx` |
| Props | `badge: VerificationBadge`, `compact?: boolean` |
| Render compacto | Chip con icono 16px + tooltip con nombre y progreso |
| Render normal | Card con icono, nombre, descripción, barra de progreso |

**Visual:**
- Badges earned: borde dorado (`#FFD700`), fondo sutil dorado
- Badges no earned: borde gris, fondo transparente, progreso visible
- Tooltip: `"${name}: ${current}/${target} — ${description}"`

### `BadgesList` (modificar)

| Archivo | `src/components/social/BadgesList.tsx` |
|---|---|
| Cambio | Agregar sección "Verificación" antes de los badges de actividad. Renderizar `VerificationBadge` para cada badge del hook. Separador visual entre verificación y actividad |

### `AchievementsGrid` (modificar)

| Archivo | `src/components/profile/AchievementsGrid.tsx` |
|---|---|
| Cambio | Agregar fila superior con badges de verificación (earned + en progreso). Título "Verificación" sobre la fila |

### `UserProfileModal` (modificar)

| Archivo | `src/components/social/UserProfileModal.tsx` |
|---|---|
| Cambio | Evaluar badges de verificación para el usuario del perfil y mostrarlos en `BadgesList` |

## Hooks

### `useVerificationBadges(userId)` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/hooks/useVerificationBadges.ts` |
| Params | `userId: string` |
| Return | `{ badges: VerificationBadge[], loading: boolean }` |
| Deps | `useUserSettings()`, ratings y check-ins del usuario |

**Lógica de cálculo:**

1. **Local Guide**: contar ratings del usuario donde `business.locality === userSettings.locality`. Si ≥ 50 → earned
2. **Verified Visitor**: contar check-ins donde distancia entre check-in coords y business coords < 100m. Si ≥ 5 → earned
3. **Trusted Reviewer**: para cada rating del usuario, comparar score vs promedio del negocio. Si ≥ 80% están dentro de ±0.5 → earned

**Cache:** resultado se guarda en localStorage con key `${VERIFICATION_CACHE_KEY}_${userId}` y TTL 24h. Al cargar, si cache es válido se usa directamente.

## Integración

| Archivo | Cambio |
|---|---|
| `src/types/index.ts` | Agregar `VerificationBadgeId`, `VerificationBadge` |
| `src/constants/verificationBadges.ts` | Nuevo archivo |
| `src/components/social/BadgesList.tsx` | Integrar badges de verificación |
| `src/components/profile/AchievementsGrid.tsx` | Fila de verificación |
| `src/components/social/UserProfileModal.tsx` | Evaluar y pasar badges |

## Tests

| Archivo | Casos |
|---|---|
| `src/hooks/useVerificationBadges.test.ts` | Local Guide: 0 ratings, 49 ratings (no earned), 50 ratings (earned). Verified Visitor: check-in lejos (no), check-in cerca (sí). Trusted Reviewer: ratings consistentes vs inconsistentes. Cache hit/miss/expired |
| `src/components/social/VerificationBadge.test.tsx` | Render earned vs not earned, compact mode, tooltip content, progreso visual |
| `src/components/social/BadgesList.test.tsx` | Integración: muestra sección verificación + actividad |

## Analytics

| Evento | Params | Cuándo |
|---|---|---|
| `verification_badge_earned` | `{ badge_id, user_id }` | Badge pasa de not earned a earned (primera vez) |
| `verification_badge_viewed` | `{ badge_id, context: 'profile' \| 'modal' }` | Badge visible en perfil |
| `verification_badge_tooltip` | `{ badge_id }` | Tap/hover en badge |

## Offline

- Cálculo usa datos ya cacheados (ratings, check-ins, allBusinesses)
- Cache de badges en localStorage persiste offline
- Sin writes a Firestore

## Decisiones técnicas

1. **Client-side vs server-side**: client-side es suficiente para v1. Los badges son informativos, no otorgan permisos. Server-side sería necesario si se usan para moderación o confianza real
2. **Cache 24h**: evita recalcular en cada visita al perfil. Los datos subyacentes (ratings, check-ins) no cambian con tanta frecuencia
3. **Integrar en BadgesList existente**: no crear un componente de lista separado. Agregar sección dentro del existente para mantener consistencia visual
4. **Progreso visible**: mostrar badges no ganados con progreso incentiva al usuario. Patrón validado por gamification (Google Maps Local Guide)
