# Specs: #270 Copy Audit — Tildes, Voseo, Terminología, Bug Anónimo

**Issue:** #270
**Fecha:** 2026-03-31

---

## Resumen

Pure string-fix branch. No hay cambios de modelo de datos, reglas de Firestore, hooks, servicios, ni tests.
Cubre:

1. **Bug crítico:** `ANONYMOUS_DISPLAY_NAME` — la constante faltaba, causando que las comparaciones con `'Anonimo'` (sin tilde) nunca igualaran al valor `'Anónimo'` seteado en `NameDialog`.
2. 19 tildes faltantes.
3. 5 inconsistencias de voseo.
4. 5 usos de "negocios" donde debe decir "comercios".
5. 2 errores de capitalización.

---

## Cambio de constante

### Nueva constante en `src/constants/ui.ts`

```ts
export const ANONYMOUS_DISPLAY_NAME = 'Anónimo';
```

Esta constante reemplaza todos los literales `'Anonimo'` y `'Anónimo'` dispersos en el código.

---

## Tabla de cambios por archivo

### src/constants/ui.ts

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 1 | (nueva) | — | `export const ANONYMOUS_DISPLAY_NAME = 'Anónimo'` | Nueva constante |

---

### src/components/auth/NameDialog.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 2 | 36 | `await setDisplayName('Anónimo')` | `await setDisplayName(ANONYMOUS_DISPLAY_NAME)` | Usar constante |

Nota: el valor `'Anónimo'` ya era correcto en este archivo, pero debe reemplazarse por la constante para centralizar el control.

---

### src/components/home/GreetingHeader.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 3 | 7 | `'Buenos dias'` | `'Buenos días'` | Tilde |
| 4 | 17 | `displayName !== 'Anonimo'` | `displayName !== ANONYMOUS_DISPLAY_NAME` | Bug crítico |

---

### src/components/auth/EmailPasswordDialog.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 5 | 92 | `displayName === 'Anonimo'` | `displayName === ANONYMOUS_DISPLAY_NAME` | Bug crítico |
| 6 | 173 | `displayName === 'Anonimo'` | `displayName === ANONYMOUS_DISPLAY_NAME` | Bug crítico |

---

### src/components/profile/ProfileScreen.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 7 | 39 | `reviews: 'Resenas'` | `reviews: 'Reseñas'` | Tilde |
| 8 | 40 | `stats: 'Estadisticas'` | `stats: 'Estadísticas'` | Tilde |
| 9 | 65 | `displayName \|\| 'Anonimo'` | `displayName \|\| ANONYMOUS_DISPLAY_NAME` | Bug crítico |

---

### src/components/home/QuickActions.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 10 | 44 | `label: 'Cafe'` | `label: 'Café'` | Tilde |
| 11 | 46 | `label: 'Pizzeria'` | `label: 'Pizzería'` | Tilde |
| 12 | 47 | `label: 'Rapida'` | `label: 'Rápida'` | Tilde |
| 13 | 48 | `label: 'Panaderia'` | `label: 'Panadería'` | Tilde |
| 14 | 49 | `label: 'Heladeria'` | `label: 'Heladería'` | Tilde |

---

### src/components/profile/StatsCards.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 15 | 48 | `label="Resenas"` | `label="Reseñas"` | Tilde |

---

### src/components/profile/CommentsList.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 16 | 152 | `"No dejaste comentarios todavia"` | `"No dejaste comentarios todavía"` | Tilde |
| 17 | 153 | `"Toca un comercio en el mapa para dejar tu opinion"` | `"Tocá un comercio en el mapa para dejar tu opinión"` | Tilde + voseo |

---

### src/components/social/ActivityFeedView.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 18 | 47 | `"Segui a otros usuarios para ver su actividad aca"` | `"Seguí a otros usuarios para ver su actividad acá"` | Tilde + voseo |

---

### src/components/social/FollowedList.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 19 | 95 | `"Busca usuarios arriba para empezar"` | `"Buscá usuarios arriba para empezar"` | Voseo |

---

### src/components/profile/InterestsSection.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 20 | 38 | `"No seguis ningun tag. Agrega algunos para descubrir negocios."` | `"No seguís ningún tag. Agregá algunos para descubrir comercios."` | Tilde + voseo + terminología |

---

### src/components/home/SpecialsSection.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 21 | 34 | `subtitle: 'Los comercios mas populares'` | `subtitle: 'Los comercios más populares'` | Tilde |

---

### src/components/profile/PrivacyPolicy.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 22 | 121 | `eventos de sincronizacion offline` | `eventos de sincronización offline` | Tilde |

---

### src/components/profile/CommentsListItem.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 23 | 131 | `aria-label="Guardar edicion"` | `aria-label="Guardar edición"` | Tilde (aria-label) |
| 24 | 139 | `aria-label="Cancelar edicion"` | `aria-label="Cancelar edición"` | Tilde (aria-label) |

---

### src/components/social/RankingsEmptyState.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 25 | 51 | `{ action: 'Deja un like, etiqueta o favorito', pts: 1 }` | `{ action: 'Dejá un like, etiqueta o favorito', pts: 1 }` | Voseo |

---

### src/components/home/ActivityDigestSection.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 26 | 92 | `'Califica y comenta negocios para recibir actividad'` | `'Calificá y comentá comercios para recibir actividad'` | Voseo + terminología |
| 27 | 101 | `'Explorar negocios'` (Button label) | `'Explorar comercios'` | Terminología |

---

### src/components/home/YourInterestsSection.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 28 | 59 | `'Te mostraremos negocios que coincidan con tus gustos'` | `'Te mostraremos comercios que coincidan con tus gustos'` | Terminología |
| 29 | 164 | `'No hay negocios con este tag todavia'` | `'No hay comercios con este tag todavía'` | Tilde + terminología |

---

### src/components/home/RecentSearches.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 30 | 19 | `'Busquedas Recientes'` | `'Búsquedas recientes'` | Tilde + capitalización |

---

### src/components/home/ForYouSection.tsx

| # | Línea actual | Texto actual | Texto correcto | Tipo |
|---|-------------|-------------|----------------|------|
| 31 | 42 | `'Para Ti'` | `'Para vos'` | Capitalización + voseo |

---

## Resumen de errores por categoría

| Categoría | Cantidad |
|-----------|---------|
| Bug crítico (Anonimo/Anónimo + constante) | 4 instancias en 4 archivos |
| Tildes faltantes | 19 |
| Voseo inconsistente | 6 (incluyendo las combinadas con tildes) |
| Terminología "negocios" → "comercios" | 5 |
| Capitalización | 2 |
| **Total de cambios** | **32** |

---

## Impacto del bug crítico

La falta de la constante `ANONYMOUS_DISPLAY_NAME` causaba que:

- `GreetingHeader` nunca mostrara el nombre del usuario anónimo correctamente — `hasName` siempre era `false` si el usuario había seteado `'Anónimo'` (con tilde) porque comparaba contra `'Anonimo'` (sin tilde).
- `EmailPasswordDialog` siempre mostraba el campo "Tu nombre" al registrarse, incluso para usuarios con nombre real, porque `displayName === 'Anonimo'` nunca era `true`.
- `ProfileScreen` mostraba `'Anonimo'` (sin tilde) como fallback visible en el avatar y encabezado.

---

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/constants/ui.ts` | Agregar `ANONYMOUS_DISPLAY_NAME` |
| `src/components/auth/NameDialog.tsx` | Usar constante |
| `src/components/home/GreetingHeader.tsx` | Tilde + usar constante |
| `src/components/auth/EmailPasswordDialog.tsx` | Usar constante (x2) |
| `src/components/profile/ProfileScreen.tsx` | Tildes (x2) + usar constante |
| `src/components/home/QuickActions.tsx` | Tildes (x5) |
| `src/components/profile/StatsCards.tsx` | Tilde |
| `src/components/profile/CommentsList.tsx` | Tilde + voseo (x2) |
| `src/components/social/ActivityFeedView.tsx` | Tilde + voseo |
| `src/components/social/FollowedList.tsx` | Voseo |
| `src/components/profile/InterestsSection.tsx` | Tilde + voseo + terminología |
| `src/components/home/SpecialsSection.tsx` | Tilde |
| `src/components/profile/PrivacyPolicy.tsx` | Tilde |
| `src/components/profile/CommentsListItem.tsx` | Tildes en aria-labels (x2) |
| `src/components/social/RankingsEmptyState.tsx` | Voseo |
| `src/components/home/ActivityDigestSection.tsx` | Voseo + terminología (x2) |
| `src/components/home/YourInterestsSection.tsx` | Tilde + terminología (x2) |
| `src/components/home/RecentSearches.tsx` | Tilde + capitalización |
| `src/components/home/ForYouSection.tsx` | Capitalización + voseo |
