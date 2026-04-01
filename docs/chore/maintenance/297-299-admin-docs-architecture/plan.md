# Plan: Admin + Docs + Architecture Maintenance (Issues #297–#299)

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-01

---

## Fases de implementacion

### Fase 1: Analytics — server-side event list (#297)

**Branch:** `chore/297-299-admin-docs-architecture`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/admin/analyticsReport.ts` | Agregar 28 eventos al array `GA4_EVENT_NAMES`. Eliminar `'question_answered'`. Mantener bloques de comentario por categoria. Ver lista exacta en specs.md §"Cambios en GA4_EVENT_NAMES". |

### Fase 2: Analytics — frontend feature definitions (#297)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/features/ga4FeatureDefinitions.ts` | Agregar imports de 6 nuevos iconos MUI: `AccountCircleOutlinedIcon`, `PlaceOutlinedIcon`, `VerifiedOutlinedIcon`, `ChatBubbleOutlineIcon`, `StarBorderIcon`, `FeedbackOutlinedIcon`. |
| 2 | `src/components/admin/features/ga4FeatureDefinitions.ts` | Agregar 5 nuevas categorias al array `GA4_FEATURE_CATEGORIES`: `auth`, `checkin`, `verification_badges`, `core_actions`, `search`. Ver estructuras exactas en specs.md §"Nuevas categorias". |
| 3 | `src/components/admin/features/ga4FeatureDefinitions.ts` | Modificar features existentes: (a) `lists` — agregar `'list_deleted'`, `'list_item_removed'` a eventNames; (b) `quick_action` — agregar `'quick_actions_edited'`; (c) `questions` — reemplazar `'question_answered'` por `'question_viewed'`; (d) categoria `system` — agregar feature `perf_page_screen` con eventos `['perf_vitals_captured', 'page_view', 'screen_view']`. |

### Fase 3: Arquitectura — hooks y tipos (#299)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useCommentsListFilters.ts` | Crear nuevo archivo. Contenido identico al actual `src/components/profile/useCommentsListFilters.ts`. |
| 2 | `src/hooks/useVirtualizedList.ts` | Crear nuevo archivo. Contenido identico al actual `src/components/profile/useVirtualizedList.ts`. |
| 3 | `src/components/profile/CommentsList.tsx` | Actualizar imports: `useCommentsListFilters` y `useVirtualizedList` desde `../../hooks/` en lugar de `./`. |
| 4 | `src/components/profile/CommentsToolbar.tsx` | Actualizar import de `SortMode` y `useCommentsListFilters` a `../../hooks/useCommentsListFilters`. |
| 5 | `src/components/business/BusinessComments.tsx` | Eliminar `type SortMode = 'recent' \| 'oldest' \| 'useful'` (linea 25). Agregar import `import type { SortMode } from '../../hooks/useCommentsListFilters'`. |
| 6 | `src/hooks/useDeepLinks.ts` | Eliminar `const VALID_TABS: TabId[] = [...]`. Agregar import `import { ALL_TAB_IDS } from '../types/navigation'`. Reemplazar `VALID_TABS` por `ALL_TAB_IDS` en la condicion de validacion del tab. |
| 7 | `src/components/profile/useCommentsListFilters.ts` | Eliminar archivo (ahora vive en `src/hooks/`). |
| 8 | `src/components/profile/useVirtualizedList.ts` | Eliminar archivo (ahora vive en `src/hooks/`). |

### Fase 4: Docs — HelpSection (#298)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/HelpSection.tsx` | Actualizar descripcion del item `inicio`: separar "Especiales" (promos del dia) de la seccion Digest (novedades personalizadas). Mencionar sección "Primeros pasos" y ActivityDigestSection. |
| 2 | `src/components/profile/HelpSection.tsx` | Actualizar descripcion del item `checkin`: corregir ubicacion del historial a "pestaña Listas, sección Recientes". |
| 3 | `src/components/profile/HelpSection.tsx` | Actualizar descripcion del item `logros`: actualizar a 11 logros (verificar lista exacta en features.md). Aclarar que los badges de verificacion de usuarios es un sistema separado (iconos de perfil verificado). |
| 4 | `src/components/profile/HelpSection.tsx` | Actualizar descripcion del item `listas`: aclarar que Recientes muestra historial de comercios visitados/vistos, separado de check-ins. |
| 5 | `src/components/profile/HelpSection.tsx` | Actualizar descripcion del item `configuracion`: agregar "modo oscuro (switch en menu lateral)" y "frecuencia del digest (tiempo real, diaria o semanal)". |
| 6 | `src/components/profile/HelpSection.tsx` | Agregar nuevo `HelpItem` con id `'primeros_pasos'` en el grupo `Inicio`. Titulo: "Primeros pasos". Icono: `SchoolOutlinedIcon` (ya importado). Descripcion: "Tocá el card de Primeros pasos en la pantalla de inicio para ver acciones sugeridas según tu nivel de uso. A medida que completás acciones (primera calificación, primer favorito, primer check-in), el card avanza y muestra los próximos pasos." |

### Fase 5: Docs — PrivacyPolicy (#298)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/PrivacyPolicy.tsx` | En la seccion "Datos de uso", eliminar `question_answered` del listado de eventos. El texto dice "eventos de preguntas y respuestas (question_created, question_answered, question_viewed)" — cambiar a "eventos de preguntas (question_created, question_viewed)". |
| 2 | `src/components/profile/PrivacyPolicy.tsx` | En la seccion "Almacenamiento > localStorage", al final del listado de preferencias locales, agregar: "caché de verificación de usuarios (badges de verificación de otros usuarios con clave mm_verification_badges_u{uid})". |
| 3 | `src/components/profile/PrivacyPolicy.tsx` | Actualizar fecha en el header: "Ultima actualizacion: abril 2026". |

### Fase 6: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/__tests__/hooks/useCommentsListFilters.test.ts` | Crear test. Verificar sort modes (recent/oldest/useful). Verificar filter por search. Verificar filter por business. Verificar que `SortMode` se exporta. |
| 2 | `src/__tests__/hooks/useVirtualizedList.test.ts` | Crear test. Verificar que `shouldVirtualize` es false si itemCount < 20. Verificar que `VIRTUALIZE_THRESHOLD` se exporta con valor 20. |
| 3 | `src/__tests__/hooks/useDeepLinks.test.ts` (crear si no existe) | Verificar que tabs validos en `ALL_TAB_IDS` son aceptados. Verificar que tabs invalidos son ignorados. |

### Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Verificar que los 11 logros listados coinciden con el conteo actualizado en HelpSection. |
| 2 | `docs/reference/patterns.md` | Agregar `useCommentsListFilters` y `useVirtualizedList` a la lista de hooks en `src/hooks/`. Documentar que `SortMode` se importa desde `useCommentsListFilters`. |
| 3 | `docs/reference/project-reference.md` | Actualizar fecha y mencionar resolucion de issues #297-#299. |
| 4 | `docs/reports/tech-debt.md` | Agregar item sobre visibilidad de `_rateLimits` (issue #297 LOW, fuera de scope de este bundle). |
| 5 | `docs/_sidebar.md` | Agregar entrada en seccion "Chore" para este bundle. |

---

## Orden de implementacion

1. Fase 1: `analyticsReport.ts` — no tiene dependencias, puede hacerse primero.
2. Fase 2: `ga4FeatureDefinitions.ts` — independiente de Fase 1 en runtime (ambos son paralelos en produccion), pero conviene hacerlos juntos para consistencia.
3. Fase 3: hooks move — antes de Fase 4/5 para que no haya cruces. Pasos 1-2 (crear nuevos) antes de pasos 7-8 (eliminar viejos). Pasos 3-6 (actualizar imports) entre medio.
4. Fase 4 y 5: cambios de texto, completamente independientes. Pueden hacerse en cualquier orden despues de Fase 3.
5. Fase 6: tests — despues de Fase 3 (los tests importan desde la nueva ubicacion).
6. Fase final: documentacion — ultima siempre.

---

## Riesgos

1. **Import roto tras move de hooks.** Si hay algun consumidor de `useCommentsListFilters` o `useVirtualizedList` no detectado en la auditoria (ej: en un test existente), el build fallara. Mitigacion: ejecutar `grep -r "useCommentsListFilters\|useVirtualizedList" src/` antes del paso de eliminacion para confirmar que todos los imports estan actualizados.

2. **`ALL_TAB_IDS` y `VALID_TABS` en perfecto sync.** La refactorizacion asume que `ALL_TAB_IDS` tiene exactamente los mismos valores que el `VALID_TABS` local. La auditoria confirma que si (`['inicio', 'social', 'buscar', 'listas', 'perfil']`). No hay riesgo de regresion.

3. **HelpSection: conteo de logros.** El issue indica que features.md lista 11 badges pero HelpSection dice 8. Antes de actualizar el numero, el implementador debe leer `docs/reference/features.md` para confirmar el conteo exacto y los nombres correctos. No asumir 11 sin verificar.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos van en carpetas de dominio correctas (`src/hooks/` para hooks)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Se resuelve deuda tecnica en archivos tocados (SortMode duplicado, VALID_TABS duplicado)
- [x] Ningun archivo resultante supera 400 lineas (estimados en specs.md)

## Guardrails de seguridad

- [x] No hay nuevas colecciones ni escrituras Firestore
- [x] No hay nuevos campos en rules
- [x] No hay secrets en archivos commiteados
- [x] No aplica `getCountFromServer` en este bundle

## Guardrails de accesibilidad y UI

- [x] No hay `<IconButton>` nuevos — HelpSection usa Accordions existentes
- [x] No hay `<Typography onClick>` nuevos
- [x] No hay touch targets nuevos
- [x] No hay componentes con fetch nuevos

## Guardrails de copy

- [x] "Tocá" (voseo) en nuevo item Primeros pasos
- [x] "sección" con tilde en descripcion de checkin
- [x] "próximas" con tilde en descripcion de Primeros pasos
- [x] "caché" con tilde en PrivacyPolicy
- [x] "verificación" con tilde en PrivacyPolicy
- [x] Terminologia: "comercios" no "negocios" — verificar en todo texto nuevo

---

## Criterios de done

- [ ] `GA4_EVENT_NAMES` tiene 28 eventos nuevos y no tiene `question_answered`
- [ ] `ga4FeatureDefinitions.ts` tiene 5 nuevas categorias y features existentes actualizadas
- [ ] `useCommentsListFilters.ts` y `useVirtualizedList.ts` viven en `src/hooks/`
- [ ] Los archivos en `src/components/profile/` estan eliminados
- [ ] Todos los imports en CommentsList, CommentsToolbar, BusinessComments actualizados
- [ ] `BusinessComments.tsx` no tiene `type SortMode` local
- [ ] `useDeepLinks.ts` usa `ALL_TAB_IDS` en lugar de `VALID_TABS`
- [ ] HelpSection: 5 descripciones corregidas + 1 item nuevo agregado
- [ ] PrivacyPolicy: `question_answered` eliminado + localStorage actualizado con nota de badges
- [ ] Tests creados para `useCommentsListFilters` y `useVirtualizedList` en nueva ubicacion
- [ ] Build succeeds (`npm run build` en root y `functions/`)
- [ ] No lint errors
- [ ] `_sidebar.md` actualizado
- [ ] `docs/reference/patterns.md` actualizado con nueva ubicacion de hooks
