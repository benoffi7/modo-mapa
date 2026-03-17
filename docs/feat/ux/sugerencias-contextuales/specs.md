# Specs: Sugerencias contextuales para usuarios nuevos

**PRD:** [PRD](./prd.md)
**Estado:** Borrador

---

## S1: Tooltip en el mapa (0 ratings)

**Componente:** `MapTooltip` (nuevo, dentro de `AppShell.tsx`)

**Condiciones para mostrar:**
- Usuario autenticado (`useAuth().user` no null)
- `profile.stats.ratings === 0` (vía `useUserProfile`)
- `localStorage` key `hint_shown_first_rating` no es `'true'`

**UI:** `Snackbar` de MUI con `Alert severity="info"`, posicionado en bottom-center (mismo estilo que `ToastContext`).

**Mensaje:** `"Toca un comercio en el mapa para calificarlo"`

**Comportamiento:**
- `autoHideDuration={5000}` (usa constante `AUTO_DISMISS_MS` de `constants/timing.ts`)
- Se cierra al tocar cualquier marker (cuando `selectedBusiness` cambia de null a un valor)
- Se cierra manualmente con botón X
- Al cerrarse (por cualquier vía), setea `localStorage.setItem('hint_shown_first_rating', 'true')`

**Decisiones de diseno:**
- NO se usa un tooltip real de Leaflet/Google Maps (complejidad innecesaria para apuntar a un marker).
- Se reutiliza el patron `Snackbar + Alert` que ya usa `ToastContext`, pero como instancia independiente para no competir con toasts del sistema.
- NO se usa `useToast()` porque el toast del sistema tiene `autoHideDuration={4000}` fijo y un solo slot — una sugerencia lo bloquearía.

---

## S2: Sugerencia post-primer-rating

**Ubicacion:** Dentro de `BusinessRating.tsx`, despues de `handleRate` exitoso.

**Condiciones:**
- `localStorage` key `hint_shown_post_first_rating` no es `'true'`
- El rating recien guardado es el primero del usuario (se detecta porque `serverMyRating` era `null` antes del `handleRate`)

**Mensaje:** `"Genial! Tambien podes dejar un comentario."`

**Mecanismo:** Llamar `toast.info(mensaje)` desde `handleRate` despues del `await upsertRating` exitoso. Setear `localStorage.setItem('hint_shown_post_first_rating', 'true')` inmediatamente.

**Por que toast y no Snackbar propio:** Aca no hay conflicto — el toast de "calificacion guardada" no existe (el rating es optimistic sin feedback textual), asi que el slot esta libre.

---

## S3: Sugerencia post-primer-comentario

**Ubicacion:** Dentro de `BusinessComments.tsx`, despues del `addComment` exitoso.

**Condiciones:**
- `localStorage` key `hint_shown_post_first_comment` no es `'true'`

**Mensaje:** `"Guarda tus favoritos tocando el corazon."`

**Mecanismo:** Igual que S2 — `toast.info(mensaje)` post-submit. No se puede saber si es el primer comentario global del usuario sin una query extra, pero el localStorage flag garantiza que se muestra como maximo una vez. Si el usuario ya comento antes, el flag ya existe y no se muestra.

**Seteo del flag:** `localStorage.setItem('hint_shown_post_first_comment', 'true')` al mostrar.

---

## Relacion con OnboardingChecklist

`OnboardingChecklist` (en `SideMenu`) es un checklist persistente visible en el menu lateral. Las sugerencias contextuales son tooltips efimeros en el mapa/sheet. No se solapan:

| Aspecto | OnboardingChecklist | Sugerencias contextuales |
|---------|-------------------|------------------------|
| Ubicacion | SideMenu (drawer) | Mapa / BusinessSheet |
| Persistencia | Visible hasta dismiss/completar | Una sola vez, auto-dismiss |
| Trigger | Abrir menu | Cargar mapa / completar accion |
| localStorage keys | `onboarding_dismissed`, `onboarding_ranking_viewed`, `onboarding_celebrated` | `hint_shown_first_rating`, `hint_shown_post_first_rating`, `hint_shown_post_first_comment` |

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AppShell.tsx` | Agregar `MapHint` (Snackbar para tooltip de 0 ratings) |
| `src/components/business/BusinessRating.tsx` | Agregar toast post-primer-rating en `handleRate` |
| `src/components/business/BusinessComments.tsx` | Agregar toast post-primer-comentario en submit handler |
| `src/constants/storage.ts` | Agregar 3 keys de localStorage |

**Archivos nuevos:** Ninguno. `MapHint` se define como componente local dentro de `AppShell.tsx` (~30 lineas).

---

## Tipos nuevos

Ninguno. Se usan tipos existentes (`UserProfileData.stats` para contadores).

---

## Dependencias nuevas

**Imports adicionales en AppShell:**
- `Snackbar`, `Alert`, `IconButton` de `@mui/material`
- `CloseIcon` de `@mui/icons-material/Close`
- `useAuth` de `AuthContext`
- `useUserProfile` de `hooks/useUserProfile`

No se agregan dependencias npm nuevas.

---

## Impacto en performance

- `useUserProfile` en `AppShell`: ya se usa en `OnboardingChecklist` (dentro de `SideMenu`). Agregar una segunda instancia en `AppShell` implica un fetch duplicado. **Mitigacion:** el fetch solo se hace si el localStorage flag no existe (short-circuit antes del hook? No, hooks no se pueden condicionar). El costo es un solo read extra de ~6 queries al montar `AppShell`, pero solo afecta a usuarios que aun no vieron el hint (nuevos).
- Toasts en S2/S3: costo zero, son llamadas a `setState` ya existentes.

---

## Tests

No se agregan tests nuevos. La logica es trivial (check localStorage + show toast). Se verifica manualmente.
