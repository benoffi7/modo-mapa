# Specs: Seguir Tags — Tus Intereses

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

## Modelo de datos

### Cambios en `UserSettings`

```typescript
// src/types/index.ts — agregar a UserSettings
followedTags?: string[];      // ["pet-friendly", "vegano", "brunch"]
followedTagsUpdatedAt?: Date;
followedTagsLastSeenAt?: Date; // para detectar negocios "nuevos"
```

Máximo 20 tags por usuario. Se persiste en el doc de `userSettings` (sin sub-collection).

### Tipos nuevos

```typescript
// src/types/index.ts
interface InterestFeedItem {
  business: Business;
  matchingTags: string[];    // tags del negocio que coinciden con seguidos
  isNew: boolean;            // taggeado después de lastSeenAt
}

interface InterestFeedGroup {
  tag: string;
  businesses: InterestFeedItem[];
  newCount: number;
}
```

### Constantes

```typescript
// src/constants/interests.ts
export const MAX_FOLLOWED_TAGS = 20;
export const INTERESTS_MAX_BUSINESSES_PER_TAG = 5;
export const SUGGESTED_TAGS = ['pet-friendly', 'vegano', 'brunch', 'terraza', 'wifi', 'aire libre', 'delivery'];
```

## Firestore Rules

Sin cambios. `followedTags` se escribe en `userSettings` del propio usuario (ya permitido por rules existentes).

## Cloud Functions

Sin cambios. Matching es client-side sobre datos ya cargados.

## Componentes

### `YourInterestsSection` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/components/home/YourInterestsSection.tsx` |
| Props | Ninguna |
| Hooks | `useFollowedTags()`, `useInterestsFeed()`, `useNavigateToBusiness()` |

**Con datos (≥ 1 tag seguido):**
- Título: "Tus intereses"
- Fila de chips horizontales scrollable con tags seguidos (estilo `filled`, color primario)
- Badge numérico en chip si hay negocios nuevos con ese tag
- Al tocar chip: lista vertical de hasta 5 negocios con ese tag, ordenados por rating
- Cada negocio es una card compacta (nombre + categoría + rating)

**Sin datos (no sigue tags):**
- Icono de tags (LocalOfferIcon) + "Seguí temas que te interesan"
- Subtexto: "Te mostraremos negocios que coincidan con tus gustos"
- Chips sugeridos de `SUGGESTED_TAGS` en estilo `outlined`
- Tap en chip sugerido → follow inmediato (chip transiciona a `filled`)
- Link "Explorar más tags" → tab Buscar

### `FollowTagChip` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/components/common/FollowTagChip.tsx` |
| Props | `tag: string`, `followed: boolean`, `onToggle: (tag: string) => void`, `newCount?: number` |
| Render | Chip MUI con estilo filled (seguido) u outlined (no seguido). Badge numérico si `newCount > 0` |

### `BusinessTags` (modificar)

| Archivo | `src/components/business/BusinessTags.tsx` |
|---|---|
| Cambio | Agregar botón "Seguir" (icono +) junto a cada tag predefinido. Al tocar → `followTag(tag)`. Indicador visual si ya seguido |

### `ProfileScreen` (modificar)

| Archivo | `src/components/profile/ProfileScreen.tsx` |
|---|---|
| Cambio | Agregar sub-sección "Tus intereses" con gestión completa: lista de tags seguidos con opción de unfollow. Acceso rápido desde la Home |

### `HomeScreen` (modificar)

| Archivo | `src/components/home/HomeScreen.tsx` |
|---|---|
| Cambio | Agregar `<YourInterestsSection />` después de `TrendingNearYouSection` (o después de `SpecialsSection` si #200 no está) |

## Hooks

### `useFollowedTags()` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/hooks/useFollowedTags.ts` |
| Params | Ninguno |
| Return | `{ tags: string[], followTag: (tag: string) => void, unfollowTag: (tag: string) => void, isFollowed: (tag: string) => boolean, loading: boolean }` |
| Deps | `useUserSettings()` |

**Lógica:**
1. Lee `settings.followedTags` (default `[]`)
2. `followTag`: agrega tag al array si < 20, actualiza `followedTagsUpdatedAt`, persiste con `updateUserSettings()`
3. `unfollowTag`: remueve tag del array, persiste
4. Validación: tag debe existir en tags predefinidos o customTags del proyecto

### `useInterestsFeed()` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/hooks/useInterestsFeed.ts` |
| Params | Ninguno |
| Return | `{ groups: InterestFeedGroup[], totalNew: number, markSeen: () => void }` |
| Deps | `useFollowedTags()`, `allBusinesses` |

**Lógica:**
1. Para cada tag seguido, filtrar negocios que tienen ese tag (predefinido o custom)
2. Ordenar por rating descendente, limitar a 5 por tag
3. Marcar `isNew` si el negocio fue taggeado después de `lastSeenAt`
4. `markSeen()`: actualiza `followedTagsLastSeenAt` al timestamp actual

## Integración

| Archivo | Cambio |
|---|---|
| `src/types/index.ts` | Agregar campos a `UserSettings`, agregar `InterestFeedItem`, `InterestFeedGroup` |
| `src/constants/interests.ts` | Nuevo archivo |
| `src/components/home/HomeScreen.tsx` | Agregar `YourInterestsSection` |
| `src/components/business/BusinessTags.tsx` | Botón "Seguir" por tag |
| `src/components/profile/ProfileScreen.tsx` | Sub-sección "Tus intereses" |

## Tests

| Archivo | Casos |
|---|---|
| `src/hooks/useFollowedTags.test.ts` | Follow/unfollow, límite 20, duplicados, persistencia |
| `src/hooks/useInterestsFeed.test.ts` | Filtrado por tags, ordenamiento por rating, detección de nuevos, max 5 por tag, markSeen |
| `src/components/home/YourInterestsSection.test.tsx` | Render con tags (chips + negocios), render CTA sin tags, tap en chip sugerido → follow, badge numérico |
| `src/components/common/FollowTagChip.test.tsx` | Toggle visual, badge, callback |

**Mocks:** `useUserSettings` con followedTags, `allBusinesses` con tags variados.

## Analytics

| Evento | Params | Cuándo |
|---|---|---|
| `tag_followed` | `{ tag, source: 'home' \| 'business' \| 'search' \| 'profile' }` | Follow |
| `tag_unfollowed` | `{ tag, source }` | Unfollow |
| `interests_section_viewed` | `{ tag_count, total_new }` | Sección visible |
| `interests_business_tapped` | `{ business_id, tag }` | Tap en negocio |
| `interests_cta_tapped` | — | Tap en CTA vacío |
| `interests_suggested_tapped` | `{ tag }` | Tap en chip sugerido |

## Offline

- Tags seguidos persisten en `userSettings` (doc ya con soporte offline)
- `allBusinesses` cargado en memoria al inicio
- Follow/unfollow usa `updateUserSettings` que ya soporta offline queue
- Feed se genera client-side con datos en memoria

## Decisiones técnicas

1. **Campo en userSettings vs sub-collection**: un array de max 20 strings en el doc es más simple y eficiente que una sub-collection. No se necesita query individual por tag
2. **Matching client-side**: con el dataset de negocios ya en memoria, filtrar por tags es O(n*m) con n negocios y m tags seguidos. Con < 500 negocios y < 20 tags, es instantáneo
3. **Suggested tags hardcodeados**: en v1, los tags sugeridos son constantes. En el futuro podrían venir de analytics (tags más populares). No over-engineer ahora
4. **No fan-out a ActivityFeed**: el feed de intereses es una vista calculada, no genera actividad social. Mantener separado del ActivityFeed existente
