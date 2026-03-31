# PRD: Seguir Tags — Sección Home "Tus Intereses"

**Issue:** #205
**Fecha:** 2026-03-30
**Estado:** Draft

## Problema

El usuario solo puede descubrir negocios buscando activamente o viendo rankings globales. No hay forma de suscribirse a intereses específicos ("pet-friendly", "vegano", "brunch", "terraza") y recibir descubrimiento pasivo basado en esos intereses.

## Propuesta

Permitir al usuario seguir tags/categorías y mostrar una sección personalizada en la Home con negocios relevantes.

### Sección en Home: `YourInterestsSection`

Ubicada después de `TrendingNearYouSection` (o después de `SpecialsSection` si #200 no está implementado).

**Con datos (usuario sigue al menos 1 tag):**
- Título: "Tus intereses"
- Chips horizontales con los tags seguidos (scrollable)
- Al tocar un chip: lista vertical de negocios con ese tag, ordenados por rating
- Máximo 5 negocios por tag visible
- Si hay negocios nuevos con un tag seguido (desde última visita): badge numérico en el chip

**Sin datos (no sigue ningún tag):**
- Icono de tags + texto "Seguí temas que te interesan"
- Subtexto: "Te mostraremos negocios que coincidan con tus gustos"
- Chips sugeridos basados en tags populares: "pet-friendly", "vegano", "brunch", "terraza", "wifi"
- Tap en chip sugerido → sigue el tag inmediatamente (feedback haptic + chip cambia a estilo "seguido")
- Botón secundario: "Explorar más tags" → navega a tab Buscar con filtros abiertos

### Seguir/dejar de seguir desde otros lugares

- En `BusinessTags` (ficha del negocio): botón "+" junto a cada tag → seguir
- En filtros de búsqueda: botón "Seguir este filtro" para tags activos
- En Perfil: nueva sub-sección "Tus intereses" con gestión completa (seguir/dejar de seguir)

## Modelo de datos

```typescript
// Nuevo documento en userSettings o sub-collection
interface FollowedTags {
  tags: string[];           // ["pet-friendly", "vegano", "brunch"]
  updatedAt: Timestamp;
  lastSeenAt: Timestamp;    // Para calcular "nuevos" negocios
}
```

- Persistencia: campo `followedTags` en `userSettings` (simple, sin sub-collection)
- Máximo 20 tags seguidos por usuario

## Datos disponibles

- `customTags` y `userTags` collections — tags por negocio
- `BusinessTags` component — ya muestra tags en la ficha
- `allBusinesses` — para filtrar por tags
- `ActivityFeed` infrastructure — potencial para fan-out (fuera de alcance v1)

## Lógica de matching

1. Cargar `userSettings.followedTags`
2. De `allBusinesses`, filtrar los que tienen al menos un tag seguido
3. Ordenar por: tags que coinciden (más = mejor) → rating → distancia (si hay localidad)
4. Agrupar resultados por tag para el display en chips
5. "Nuevos": negocios taggeados después de `lastSeenAt`

## Componentes

| Componente | Tipo | Ubicación |
|---|---|---|
| `YourInterestsSection` | Nuevo | `src/components/home/` |
| `HomeScreen` | Modificar | Agregar sección |
| `useFollowedTags` | Nuevo hook | `src/hooks/` — CRUD de tags seguidos |
| `useInterestsFeed` | Nuevo hook | `src/hooks/` — negocios por tags seguidos |
| `BusinessTags` | Modificar | Agregar botón "seguir" |
| `ProfileScreen` | Modificar | Sub-sección "Tus intereses" |
| `FollowTagChip` | Nuevo | `src/components/common/` — chip follow/unfollow |

## Diseño UX

- Chips seguidos usan estilo `filled` (color primario); sugeridos usan `outlined`
- Animación sutil al seguir: chip transiciona de outlined a filled con scale bounce
- En la Home, cada chip tiene badge numérico si hay negocios nuevos
- Estado vacío invita a la acción con chips pre-renderizados (no es un panel vacío frío)
- Máximo 2 filas de chips visibles; "ver más" si hay > 8 tags

## Analytics

| Evento | Cuándo |
|---|---|
| `tag_followed` | Usuario sigue un tag (source: home/business/search) |
| `tag_unfollowed` | Usuario deja de seguir |
| `interests_section_viewed` | Sección visible en Home |
| `interests_business_tapped` | Tap en negocio desde sección intereses |
| `interests_cta_tapped` | Tap en CTA de estado vacío |
| `interests_suggested_tapped` | Tap en chip sugerido (onboarding) |

## Tests

- `YourInterestsSection`: render con tags seguidos, render CTA sin tags, render con "nuevos"
- `useFollowedTags`: follow/unfollow, persistencia, límite 20
- `useInterestsFeed`: filtrado por tags, ordenamiento, detección de nuevos
- `FollowTagChip`: toggle visual, integración con hook
- `BusinessTags`: botón seguir visible y funcional

## Seguridad

- Tags seguidos se guardan en `userSettings` (doc propio del usuario, protegido por rules)
- No se exponen tags seguidos de otros usuarios
- Tags se validan contra lista de tags existentes (no se pueden seguir tags arbitrarios)

## Fuera de alcance

- Notificaciones push cuando hay negocio nuevo con tag seguido
- Fan-out a ActivityFeed por tags
- Tags personalizados creados por el usuario (solo sigue tags existentes)
- Recomendación de tags basada en historial
