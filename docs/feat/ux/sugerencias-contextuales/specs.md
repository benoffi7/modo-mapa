# Specs: Sugerencias contextuales para usuarios nuevos

**PRD:** [PRD](./prd.md)
**Estado:** Aprobado

---

## S1: Hint de calificación basado en tiempo + onboarding flag

### Modelo de datos (localStorage)

Dos keys nuevas:

| Key | Tipo | Seteado cuando | Descripción |
|-----|------|----------------|-------------|
| `onboarding_created_at` | ISO timestamp string | Usuario cierra NameDialog (omitir o guardar) | Marca el inicio de la sesión del usuario |
| `onboarding_completed` | `'true'` | Usuario califica un comercio O se le muestra el hint | Previene que el hint vuelva a aparecer |

### Lógica en `AppShell.tsx` — componente `MapHint`

```
al montar:
  si onboarding_completed === 'true' → no mostrar
  si onboarding_created_at no existe → no mostrar (usuario pre-existente)
  calcular elapsed = now - onboarding_created_at
  si elapsed < ONBOARDING_HINT_DELAY → no mostrar
  si elapsed >= ONBOARDING_HINT_DELAY → mostrar Snackbar
    al mostrarse → setear onboarding_completed = 'true'
```

### Constantes

En `constants/timing.ts`:
- `ONBOARDING_HINT_DELAY_MS`: `10_000` en staging, cambiar a `4 * 60 * 60 * 1000` (4 horas) antes del merge a main

### Snackbar UI

- `Snackbar` propio (no `useToast`) — bottom-center
- `Alert severity="info" variant="filled"`: "Tocá un comercio en el mapa para calificarlo"
- `autoHideDuration={5000}` — auto-dismiss en 5 segundos
- Botón X para cerrar manualmente
- Se cierra también al seleccionar un marker (`selectedBusiness` cambia)

### Seteo de `onboarding_created_at`

En `NameDialog.tsx` — al hacer click en "Omitir" o "Guardar":
- Si `onboarding_created_at` no existe en localStorage → setearlo a `new Date().toISOString()`
- No sobreescribir si ya existe (usuario que reabre el dialog)

### Seteo de `onboarding_completed` por rating

En `BusinessRating.tsx` — en `handleRate` después de `upsertRating` exitoso:
- Si `onboarding_completed` no es `'true'` → setearlo a `'true'`

---

## S2: Sugerencia post-primer-rating

**Ubicación:** `BusinessRating.tsx`, después de `handleRate` exitoso.

**Condiciones:**
- `localStorage` key `hint_shown_post_first_rating` no es `'true'`
- `serverMyRating` era `null` antes del rating (es el primer rating del usuario para este comercio)

**Mensaje:** `"¡Genial! También podés dejar un comentario."`

**Mecanismo:** `toast.info(mensaje)` + setear `localStorage.setItem('hint_shown_post_first_rating', 'true')`

---

## S3: Sugerencia post-primer-comentario

**Ubicación:** `BusinessComments.tsx`, después de `addComment` exitoso.

**Condiciones:**
- `localStorage` key `hint_shown_post_first_comment` no es `'true'`

**Mensaje:** `"Guardá tus favoritos tocando el ♡"`

**Mecanismo:** `toast.info(mensaje)` + setear `localStorage.setItem('hint_shown_post_first_comment', 'true')`

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AppShell.tsx` | Reescribir `MapHint` con lógica de timestamp + onboarding flag |
| `src/components/auth/NameDialog.tsx` | Setear `onboarding_created_at` al omitir/guardar |
| `src/components/business/BusinessRating.tsx` | Setear `onboarding_completed` al calificar + toast post-primer-rating |
| `src/components/business/BusinessComments.tsx` | Toast post-primer-comentario |
| `src/constants/storage.ts` | Reemplazar keys por `ONBOARDING_CREATED_AT`, `ONBOARDING_COMPLETED` |
| `src/constants/timing.ts` | Agregar `ONBOARDING_HINT_DELAY_MS` |

---

## Eliminaciones

- Eliminar `useUserProfile` y `useAuth` de `MapHint` — ya no se necesita consultar Firestore
- Eliminar `STORAGE_KEY_HINT_FIRST_RATING` de `storage.ts` (reemplazada por `ONBOARDING_COMPLETED`)

---

## Impacto en performance

- Cero queries a Firestore — todo basado en localStorage
- Un `setInterval` o check en mount para comparar timestamps — negligible
