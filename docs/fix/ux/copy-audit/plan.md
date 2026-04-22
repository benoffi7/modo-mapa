# Plan: #270 Copy Audit — Tildes, Voseo, Terminología, Bug Anónimo

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Branch

`fix/270-copy-audit`

---

## Fases de implementacion

### Fase 1: Crear constante ANONYMOUS_DISPLAY_NAME

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/ui.ts` | Agregar `export const ANONYMOUS_DISPLAY_NAME = 'Anónimo'` |

Esta constante debe existir antes de que cualquier archivo la importe.

---

### Fase 2: Corregir bug crítico — usar la constante en los 4 archivos afectados

| Paso | Archivo | Cambio |
|------|---------|--------|
| 2 | `src/components/auth/NameDialog.tsx` | Importar `ANONYMOUS_DISPLAY_NAME`; reemplazar `'Anónimo'` literal en línea 36 |
| 3 | `src/components/home/GreetingHeader.tsx` | Importar `ANONYMOUS_DISPLAY_NAME`; reemplazar `'Anonimo'` en línea 17; corregir `'Buenos dias'` → `'Buenos días'` en línea 7 |
| 4 | `src/components/auth/EmailPasswordDialog.tsx` | Importar `ANONYMOUS_DISPLAY_NAME`; reemplazar `'Anonimo'` en líneas 92 y 173 |
| 5 | `src/components/profile/ProfileScreen.tsx` | Importar `ANONYMOUS_DISPLAY_NAME`; reemplazar `'Anonimo'` en línea 65; corregir `'Resenas'` → `'Reseñas'` y `'Estadisticas'` → `'Estadísticas'` en líneas 39-40 |

---

### Fase 3: Corregir tildes — QuickActions y StatsCards

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6 | `src/components/home/QuickActions.tsx` | Línea 44: `'Cafe'` → `'Café'`; línea 46: `'Pizzeria'` → `'Pizzería'`; línea 47: `'Rapida'` → `'Rápida'`; línea 48: `'Panaderia'` → `'Panadería'`; línea 49: `'Heladeria'` → `'Heladería'` |
| 7 | `src/components/profile/StatsCards.tsx` | Línea 48: `"Resenas"` → `"Reseñas"` |

---

### Fase 4: Corregir tildes + voseo — CommentsList, ActivityFeedView, FollowedList

| Paso | Archivo | Cambio |
|------|---------|--------|
| 8 | `src/components/profile/CommentsList.tsx` | Línea 152: `'todavia'` → `'todavía'`; línea 153: `'Toca'` → `'Tocá'`, `'opinion'` → `'opinión'` |
| 9 | `src/components/social/ActivityFeedView.tsx` | Línea 47: `'Segui'` → `'Seguí'`, agregar tilde a `'aca'` → `'acá'` |
| 10 | `src/components/social/FollowedList.tsx` | Línea 95: `'Busca'` → `'Buscá'` |

---

### Fase 5: Corregir terminología + voseo — InterestsSection, YourInterestsSection, ActivityDigestSection

| Paso | Archivo | Cambio |
|------|---------|--------|
| 11 | `src/components/profile/InterestsSection.tsx` | Línea 38: `'ningun'` → `'ningún'`, `'Agrega'` → `'Agregá'`, `'negocios'` → `'comercios'`, `'No seguis'` → `'No seguís'` |
| 12 | `src/components/home/YourInterestsSection.tsx` | Línea 59: `'negocios'` → `'comercios'`; línea 164: `'negocios'` → `'comercios'`, `'todavia'` → `'todavía'` |
| 13 | `src/components/home/ActivityDigestSection.tsx` | Línea 92: `'Califica'` → `'Calificá'`, `'comenta'` → `'comentá'`, `'negocios'` → `'comercios'`; línea 101: `'Explorar negocios'` → `'Explorar comercios'` |

---

### Fase 6: Corregir tildes restantes — SpecialsSection, PrivacyPolicy, CommentsListItem

| Paso | Archivo | Cambio |
|------|---------|--------|
| 14 | `src/components/home/SpecialsSection.tsx` | Línea 34: `'mas'` → `'más'` en subtitle del fallback |
| 15 | `src/components/profile/PrivacyPolicy.tsx` | Línea 121: `'sincronizacion'` → `'sincronización'` |
| 16 | `src/components/profile/CommentsListItem.tsx` | Línea 131: `aria-label="Guardar edicion"` → `"Guardar edición"`; línea 139: `aria-label="Cancelar edicion"` → `"Cancelar edición"` |

---

### Fase 7: Corregir voseo y capitalización restantes — RankingsEmptyState, RecentSearches, ForYouSection

| Paso | Archivo | Cambio |
|------|---------|--------|
| 17 | `src/components/social/RankingsEmptyState.tsx` | Línea 51: `'Deja'` → `'Dejá'` |
| 18 | `src/components/home/RecentSearches.tsx` | Línea 19: `'Busquedas Recientes'` → `'Búsquedas recientes'` |
| 19 | `src/components/home/ForYouSection.tsx` | Línea 42: `'Para Ti'` → `'Para vos'` |

---

## Orden de implementacion

1. `src/constants/ui.ts` — la constante debe existir primero.
2. Los 4 archivos del bug crítico (pasos 2-5) — orden indiferente entre sí, todos dependen del paso 1.
3. Pasos 6-19 — son independientes entre sí y del bug crítico.

---

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Olvidar un import de `ANONYMOUS_DISPLAY_NAME` en algún archivo | El TypeScript compiler fallará si el import falta; el lint lo detecta |
| Romper la lógica de comparación al usar la constante | El valor de la constante es `'Anónimo'`; las comparaciones que antes usaban `'Anonimo'` ahora matchearán correctamente — es el fix intencional |
| Cambio de `'Para Ti'` a `'Para vos'` puede verse extraño sin mayúscula en "vos" | Es correcto en español: "Para vos" con "vos" minúscula en el medio de una oración |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] No se crean archivos nuevos (solo se modifica `constants/ui.ts` y 18 componentes existentes)
- [x] No hay logica de negocio — son cambios de strings puros
- [x] Ningun archivo resultante supera 400 lineas (solo se cambian literales)

---

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo (Buscá, Tocá, Seguí, Dejá, Calificá, Comentá, Agregá)
- [x] Tildes correctas en todos los textos corregidos
- [x] Terminología consistente: "comercios" en todos los casos
- [x] `ANONYMOUS_DISPLAY_NAME` como constante — nunca más hardcoded

---

## Fase final: Documentacion

No aplica para este fix. No hay cambios en colecciones, reglas, features visibles nuevas ni patrones nuevos.
La constante `ANONYMOUS_DISPLAY_NAME` es un detalle de implementación, no requiere entrada en `patterns.md`.

---

## Criterios de done

- [x] Constante `ANONYMOUS_DISPLAY_NAME = 'Anónimo'` en `src/constants/ui.ts`
- [x] Los 4 archivos con comparaciones `'Anonimo'` usan la constante
- [x] Todos los 19 textos con tildes faltantes corregidos
- [x] Todos los 5 casos de voseo corregidos (incluye los combinados con tildes)
- [x] Todos los 5 casos de "negocios" reemplazados por "comercios"
- [x] Los 2 errores de capitalización corregidos
- [x] Build succeeds (`npm run build`)
- [x] Sin errores de lint (`npm run lint`)
