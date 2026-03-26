# Specs: Onboarding gamificado — Primeros pasos

**Feature:** onboarding-gamificado
**Issue:** #145
**Fecha:** 2026-03-16

---

## Estado actual

- `useUserProfile` ya provee stats: `comments`, `ratings`, `favorites`, `customTags`, `photos`.
- Cloud Functions ya incrementan contadores globales y por usuario.
- SideMenu tiene sección de navegación con header de usuario.
- No existe lógica de onboarding ni checklist.
- `localStorage` se usa para flags como visitHistory.

---

## Cambios

### 1. Definir tareas del onboarding

5 tareas basadas en stats existentes del perfil:

| Tarea | Condición completada | Icono |
|-------|---------------------|-------|
| Calificá tu primer comercio | `stats.ratings >= 1` | Star |
| Dejá un comentario | `stats.comments >= 1` | Chat |
| Guardá un favorito | `stats.favorites >= 1` | Favorite |
| Agregá un tag | `stats.customTags >= 1` | Label |
| Explorá el ranking | Flag en localStorage `onboarding_ranking_viewed` | EmojiEvents |

### 2. Crear componente OnboardingChecklist

**Archivo nuevo:** `src/components/menu/OnboardingChecklist.tsx`

- Card compacta que muestra progreso: "3/5 completadas".
- Lista de tareas con checkbox visual (CheckCircle / RadioButtonUnchecked).
- Tareas completadas en verde con tachado sutil.
- LinearProgress bar mostrando progreso total.
- Botón "Cerrar" que guarda flag `onboarding_dismissed` en localStorage.
- No se muestra si todas completadas o si fue dismisseado.

### 3. Integrar en SideMenu

**Archivo:** `src/components/layout/SideMenu.tsx`

- Importar OnboardingChecklist.
- Renderizar después del header de usuario (después de línea 214), antes del Divider.
- Solo mostrar si el usuario está autenticado (no anónimo).
- Solo mostrar si no fue dismisseado y hay tareas pendientes.

### 4. Marcar "Explorá el ranking" como completada

**Archivo:** `src/components/menu/RankingsView.tsx`

- Al montar RankingsView, guardar `onboarding_ranking_viewed: true` en localStorage.

### 5. Animación de celebración

- Al completar todas las tareas, mostrar confetti simple (emoji-based, no librería).
- Toast de éxito: "¡Completaste todos los primeros pasos!".

---

## Datos necesarios

- `useUserProfile()` para stats (ratings, comments, favorites, customTags).
- `localStorage` para `onboarding_dismissed` y `onboarding_ranking_viewed`.
- No se necesitan cambios en Firestore, Cloud Functions ni tipos.

---

## Archivos

| Archivo | Acción |
|---------|--------|
| `src/components/menu/OnboardingChecklist.tsx` | **Nuevo** |
| `src/components/layout/SideMenu.tsx` | Integrar checklist |
| `src/components/menu/RankingsView.tsx` | Flag de ranking viewed |

---

## Decisiones

1. **localStorage para flags** — no Firestore. El onboarding es efímero y por dispositivo.
2. **Stats del perfil** — ya existen server-side, no crear nuevos contadores.
3. **Sin badge en perfil** — lo dejamos para una iteración futura si hay interés.
4. **Dismiss permanente** — si el usuario cierra, no vuelve a aparecer.
5. **Solo usuarios autenticados** — anónimos no tienen stats.
