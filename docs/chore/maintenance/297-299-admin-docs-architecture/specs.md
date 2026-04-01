# Specs: Admin + Docs + Architecture Maintenance (Issues #297–#299)

**Fecha:** 2026-04-01

---

## Alcance del bundle

| Issue | Categoria | Titulo |
|-------|-----------|--------|
| #297 | Admin | 28 analytics events invisibles en dashboard + coleccion `_rateLimits` |
| #298 | Docs | HelpSection desactualizada + gaps en politica de privacidad |
| #299 | Architecture | Hooks mal ubicados + tipos duplicados |

---

## Issue #297 — Analytics events faltantes

### Contexto

`getAnalyticsReport` en `functions/src/admin/analyticsReport.ts` consulta GA4 usando un filtro `inListFilter` sobre `GA4_EVENT_NAMES`. Todo evento que no aparezca en esa lista queda invisible en el FeaturesPanel del admin dashboard. El mismo problema afecta `ga4FeatureDefinitions.ts` en el frontend: eventos no listados en ninguna `GA4FeatureDef.eventNames` no aparecen agrupados en el panel.

### Eventos faltantes (28 reales + `test_event` excluido)

Auditoria ejecutada comparando `trackEvent(` calls en `src/` contra `GA4_EVENT_NAMES`. `page_view` y `screen_view` son eventos automaticos de GA4 — se incluyen en la lista server-side para captura pero se agrupan bajo una feature "Sistema" genérica en el frontend.

| Evento | Categoria actual sugerida | Nota |
|--------|--------------------------|------|
| `account_created` | Auth (nueva) | Junto con email_sign_in, sign_out, password_changed |
| `email_sign_in` | Auth (nueva) | |
| `sign_out` | Auth (nueva) | |
| `password_changed` | Auth (nueva) | |
| `checkin_created` | Check-in (nueva) | |
| `checkin_deleted` | Check-in (nueva) | |
| `checkin_cooldown_blocked` | Check-in (nueva) | |
| `checkin_proximity_warning` | Check-in (nueva) | |
| `verification_badge_earned` | Verification badges (nueva) | |
| `verification_badge_viewed` | Verification badges (nueva) | |
| `verification_badge_tooltip` | Verification badges (nueva) | |
| `comment_submit` | Core actions (nueva) | |
| `comment_like` | Core actions (nueva) | |
| `rating_submit` | Core actions (nueva) | |
| `criteria_rating_submit` | Core actions (nueva) | |
| `favorite_toggle` | Core actions (nueva) | |
| `feedback_submit` | Core actions (nueva) | |
| `price_level_vote` | Core actions (nueva) | |
| `tag_vote` | Core actions (nueva) | |
| `custom_tag_create` | Core actions (nueva) | |
| `list_deleted` | Listas (existente: ampliar) | Agregar a feature `lists` |
| `list_item_removed` | Listas (existente: ampliar) | Agregar a feature `lists` |
| `business_filter_price` | Buscar (nueva) | |
| `business_filter_tag` | Buscar (nueva) | |
| `search_view_toggled` | Buscar (nueva) | |
| `search_list_item_clicked` | Buscar (nueva) | |
| `quick_actions_edited` | Home engagement (existente: ampliar) | Agregar a feature `quick_action` |
| `perf_vitals_captured` | System (existente: ampliar) | Agregar a feature `system` |
| `question_viewed` | Questions (existente: ampliar) | Agregar a `questions` feature |
| `page_view` | System (existente) | Auto-event GA4, solo server-side |
| `screen_view` | System (existente) | Auto-event GA4, solo server-side |

**Eventos a eliminar de `GA4_EVENT_NAMES` (dead, nunca llamados):**
- `question_answered` — no existe en codigo (confirma issue #298 privacy policy)

**Nota sobre `question_answered`:** el evento esta en `GA4_EVENT_NAMES`, en `ga4FeatureDefinitions.ts` (feature `questions`), y en la politica de privacidad — pero no existe ningun `trackEvent('question_answered'` en el codigo. Se elimina de los tres lugares.

### Cambios en `GA4_EVENT_NAMES` (analyticsReport.ts)

Agregar al array (orden sugerido por bloque logico):

```typescript
// Auth
'account_created',
'email_sign_in',
'sign_out',
'password_changed',
// Check-in
'checkin_created',
'checkin_deleted',
'checkin_cooldown_blocked',
'checkin_proximity_warning',
// Verification badges
'verification_badge_earned',
'verification_badge_viewed',
'verification_badge_tooltip',
// Core actions
'comment_submit',
'comment_like',
'rating_submit',
'criteria_rating_submit',
'favorite_toggle',
'feedback_submit',
'price_level_vote',
'tag_vote',
'custom_tag_create',
// Lists (additions to existing group)
'list_deleted',
'list_item_removed',
// Search
'business_filter_price',
'business_filter_tag',
'search_view_toggled',
'search_list_item_clicked',
// System/GA4 auto
'page_view',
'screen_view',
```

Eliminar del array:
- `'question_answered'`

### Cambios en `ga4FeatureDefinitions.ts`

**Nuevas categorias:**

```typescript
{
  id: 'auth',
  label: 'Auth',
  features: [
    { key: 'auth_actions', name: 'Acciones de cuenta', icon: icon(AccountCircleOutlinedIcon), eventNames: ['account_created', 'email_sign_in', 'sign_out', 'password_changed'], color: '#E91E63' },
  ],
},
{
  id: 'checkin',
  label: 'Check-in',
  features: [
    { key: 'checkin_flow', name: 'Flujo check-in', icon: icon(PlaceOutlinedIcon), eventNames: ['checkin_created', 'checkin_deleted'], color: '#4CAF50' },
    { key: 'checkin_blocks', name: 'Bloqueos check-in', icon: icon(PlaceOutlinedIcon), eventNames: ['checkin_cooldown_blocked', 'checkin_proximity_warning'], color: '#81C784' },
  ],
},
{
  id: 'verification_badges',
  label: 'Verification Badges',
  features: [
    { key: 'badge_engagement', name: 'Engagement badges', icon: icon(VerifiedOutlinedIcon), eventNames: ['verification_badge_earned', 'verification_badge_viewed', 'verification_badge_tooltip'], color: '#FF9800' },
  ],
},
{
  id: 'core_actions',
  label: 'Acciones principales',
  features: [
    { key: 'comments', name: 'Comentarios', icon: icon(ChatBubbleOutlineIcon), eventNames: ['comment_submit', 'comment_like'], color: '#2196F3' },
    { key: 'ratings', name: 'Calificaciones', icon: icon(StarBorderIcon), eventNames: ['rating_submit', 'criteria_rating_submit'], color: '#FFC107' },
    { key: 'favorites', name: 'Favoritos', icon: icon(BookmarkBorderIcon), eventNames: ['favorite_toggle'], color: '#E91E63' },
    { key: 'feedback_action', name: 'Feedback enviado', icon: icon(FeedbackOutlinedIcon), eventNames: ['feedback_submit'], color: '#9C27B0' },
    { key: 'price_tag', name: 'Nivel precio / Tag', icon: icon(LocalOfferOutlinedIcon), eventNames: ['price_level_vote', 'tag_vote', 'custom_tag_create'], color: '#607D8B' },
  ],
},
{
  id: 'search',
  label: 'Buscar',
  features: [
    { key: 'search_filters', name: 'Filtros busqueda', icon: icon(SearchIcon), eventNames: ['business_filter_price', 'business_filter_tag'], color: '#00BCD4' },
    { key: 'search_nav', name: 'Navegacion busqueda', icon: icon(SearchIcon), eventNames: ['search_view_toggled', 'search_list_item_clicked'], color: '#26C6DA' },
  ],
},
```

**Modificaciones a features existentes:**

- `lists` feature: agregar `'list_deleted'`, `'list_item_removed'` a `eventNames`
- `quick_action` feature: agregar `'quick_actions_edited'` a `eventNames`
- `force_update` / `account_deleted` system features: agregar `'perf_vitals_captured'`, `'page_view'`, `'screen_view'` a la categoria `system`
- `questions` feature: reemplazar `['question_created', 'question_answered']` por `['question_created', 'question_viewed']`

**Iconos nuevos requeridos** (imports a agregar en `ga4FeatureDefinitions.ts`):
- `AccountCircleOutlinedIcon` from `@mui/icons-material/AccountCircleOutlined`
- `PlaceOutlinedIcon` from `@mui/icons-material/PlaceOutlined`
- `VerifiedOutlinedIcon` from `@mui/icons-material/VerifiedOutlined`
- `ChatBubbleOutlineIcon` from `@mui/icons-material/ChatBubbleOutline`
- `StarBorderIcon` from `@mui/icons-material/StarBorder`
- `FeedbackOutlinedIcon` from `@mui/icons-material/FeedbackOutlined`

### Issue #297 LOW: visibilidad `_rateLimits`

La coleccion `_rateLimits` existe en Firestore (escrita por Cloud Functions triggers) pero no tiene UI de admin. El issue marca esto como LOW y no pide implementacion de un panel completo — se agrega como item informativo al FeaturesPanel con un link al emulador Firestore o un contador simple. Queda fuera del scope de este bundle (no hay PRD aprobado para un RateLimitsPanel). Se documenta como backlog en `reports/tech-debt.md`.

---

## Issue #298 — HelpSection + PrivacyPolicy

### HelpSection: 6 features faltantes

| Feature faltante | Donde agregar | Grupo sugerido |
|-----------------|---------------|----------------|
| Toggle mapa/lista | Descripcion de "Mapa y busqueda" (ya existe, falta detalle) | Buscar |
| ActivityDigestSection en Home | Nuevo item o ampliar "Pantalla principal" | Inicio |
| Foto de menu (upload/view/report) | Ampliar "Detalle de comercio" | Buscar |
| Notificaciones — frecuencia digest (realtime/diario/semanal) | Ampliar "Notificaciones" | Perfil |
| Onboarding gamificado (Primeros pasos card) | Nuevo item "Primeros pasos" | Inicio |
| Account nudges / conversion flow | Ampliar "Cuenta" | Ajustes |

### HelpSection: 5 descripciones incorrectas

| Item id | Problema | Correccion requerida |
|---------|----------|---------------------|
| `inicio` | Mezcla "Especiales" con "Listas destacadas" — son sistemas distintos. Omite ActivityDigestSection. | Separar Especiales (promos del dia) del Digest (novedades personalizadas basadas en seguidos). Mencionar Primeros pasos. |
| `checkin` | "Tu historial de check-ins aparece en Listas > Recientes" — incorrecto, los check-ins tienen su propia seccion en Perfil > Estadisticas y en Listas > Recientes como parte del historial unificado. Verificar ubicacion exacta. | Corregir a "en la pestaña Listas, sección Recientes" |
| `logros` | Lista 8 logros pero features.md tiene 11 badges (sistemas distintos). | Actualizar conteo y nombres segun features.md actual. Aclarar que los badges de verificacion de usuarios son un sistema separado. |
| `listas` | "Recientes (historial unificado de visitas y check-ins)" — mezcla incorrectamente visitas con check-ins. | Aclarar que Recientes muestra historial de navegacion (comercios vistos), separado de los check-ins. |
| `configuracion` | Omite: dark mode toggle, frecuencia de digest. | Agregar ambos items. |

### PrivacyPolicy: 2 cambios requeridos

**1. Eliminar `question_answered`**

En la seccion "Datos de uso", el texto menciona:
```
eventos de preguntas y respuestas (question_created, question_answered, question_viewed)
```
Cambiar a:
```
eventos de preguntas (question_created, question_viewed)
```

**2. Agregar nota sobre `mm_verification_badges_u{uid}` en localStorage**

La seccion `localStorage` actualmente lista preferencias locales del usuario. Sin embargo, `mm_verification_badges_u{uid}` almacena datos de verificacion de OTROS usuarios (cache de badges), lo que es relevante desde el punto de vista de privacidad. Agregar:

```
verificación de usuarios (caché local de badges de verificación de otros usuarios,
con clave mm_verification_badges_u{uid})
```

Al final del parrafo de localStorage, despues de "avatar seleccionado".

### Textos de usuario (copy verificado)

| Texto nuevo/modificado | Donde | Regla |
|-----------------------|-------|-------|
| "Sección Digest con novedades de comercios y usuarios que seguís" | HelpSection item `inicio` | voseo: seguís |
| "Primeros pasos" | HelpSection nuevo item titulo | sin tilde |
| "Tocá el card de Primeros pasos para ver tus próximas acciones sugeridas" | HelpSection nuevo item desc | voseo: Tocá; tilde: próximas |
| "Tu historial de check-ins aparece en la pestaña Listas, sección Recientes" | HelpSection item `checkin` | tilde: sección |
| "Hay 11 logros disponibles..." | HelpSection item `logros` | actualizar numero |
| "frecuencia del digest (tiempo real, diaria o semanal)" | HelpSection item `configuracion` | tilde: tiempo |
| "caché local de badges de verificación de otros usuarios" | PrivacyPolicy localStorage | tildes: caché, verificación |

---

## Issue #299 — Arquitectura: hooks mal ubicados + tipos duplicados

### Hooks a mover

| Archivo origen | Archivo destino | Razon |
|---------------|-----------------|-------|
| `src/components/profile/useCommentsListFilters.ts` | `src/hooks/useCommentsListFilters.ts` | Convencion: hooks custom reutilizables van en `src/hooks/` |
| `src/components/profile/useVirtualizedList.ts` | `src/hooks/useVirtualizedList.ts` | Idem; ya importado potencialmente desde otros contexts |

Los archivos origen se reemplazan con re-exports para compatibilidad durante la transicion, pero dado que este bundle es el unico consumidor conocido, se puede hacer el move directo actualizando todos los imports.

**Consumidores actuales:**

| Hook | Importado en |
|------|-------------|
| `useCommentsListFilters` | `src/components/profile/CommentsList.tsx`, `src/components/profile/CommentsToolbar.tsx` |
| `useVirtualizedList` | `src/components/profile/CommentsList.tsx` |

### Tipo `SortMode` duplicado

`type SortMode = 'recent' | 'oldest' | 'useful'` esta definido en:
- `src/components/profile/useCommentsListFilters.ts` (exportado)
- `src/components/business/BusinessComments.tsx` (local, linea 25)

Despues del move, `SortMode` queda canonicamente en `src/hooks/useCommentsListFilters.ts`. `BusinessComments.tsx` debe importarlo desde ahi en lugar de redefinirlo.

### `VALID_TABS` duplicado

`useDeepLinks.ts` define `const VALID_TABS: TabId[] = ['inicio', 'social', 'buscar', 'listas', 'perfil']` que es identico a `ALL_TAB_IDS` en `src/types/navigation.ts`. Reemplazar con import de `ALL_TAB_IDS`.

### Tipos de interfaces afectados

No hay cambios al modelo de datos de Firestore. No se agregan/quitan colecciones.

---

## Modelo de datos

No hay cambios al esquema de Firestore en este bundle.

## Firestore Rules

No hay cambios a reglas de Firestore en este bundle.

### Rules impact analysis

No hay nuevas queries de Firestore en este bundle.

### Field whitelist check

No hay nuevos campos en este bundle.

## Cloud Functions

No hay cambios a Cloud Functions en este bundle.

## Seed Data

No aplica — no hay cambios de esquema.

---

## Componentes

### `functions/src/admin/analyticsReport.ts`
- **Cambio:** ampliar `GA4_EVENT_NAMES` con 28 eventos nuevos. Eliminar `'question_answered'`. Agregar `'page_view'` y `'screen_view'` (GA4 auto-events, utiles para contexto de volumen).
- **Impacto:** el filtro `inListFilter` de la query GA4 pasa de ~60 a ~90 eventos. Sin impacto en latencia perceptible.

### `src/components/admin/features/ga4FeatureDefinitions.ts`
- **Cambio:** agregar 5 nuevas categorias (`auth`, `checkin`, `verification_badges`, `core_actions`, `search`). Modificar features existentes (`lists`, `quick_action`, `questions`, `system`). Eliminar `question_answered` de feature `questions`. Agregar 6 nuevos imports de iconos MUI.
- **Estimacion de lineas:** 151 actuales + ~80 nuevas = ~230 lineas. Dentro del limite de 400.

### `src/components/profile/HelpSection.tsx`
- **Cambio:** actualizar 5 descripciones existentes en `HELP_GROUPS`. Agregar 1 nuevo `HelpItem` ("Primeros pasos"). Agregar descripcion de ActivityDigest en item `inicio`.
- **Sin cambios estructurales** — el componente renderiza `HELP_GROUPS` dinamicamente, no requiere modificaciones al JSX.
- **Estimacion de lineas:** 235 actuales, estimado final ~270. Dentro del limite.

### `src/components/profile/PrivacyPolicy.tsx`
- **Cambio:** 2 ediciones de texto en el JSX de la seccion "Datos de uso" y la seccion "Almacenamiento > localStorage".
- **Sin cambios estructurales.**

### `src/hooks/useCommentsListFilters.ts` (nuevo — movido)
- **Contenido:** identico al actual `src/components/profile/useCommentsListFilters.ts`.
- **Exporta:** `useCommentsListFilters`, `CommentEntry`, `SortMode`.

### `src/hooks/useVirtualizedList.ts` (nuevo — movido)
- **Contenido:** identico al actual `src/components/profile/useVirtualizedList.ts`.
- **Exporta:** `useVirtualizedList`, `VIRTUALIZE_THRESHOLD`.

### `src/components/profile/useCommentsListFilters.ts` (eliminado)
### `src/components/profile/useVirtualizedList.ts` (eliminado)

### `src/components/profile/CommentsList.tsx`
- **Cambio:** actualizar imports de ambos hooks a `../../hooks/`.

### `src/components/profile/CommentsToolbar.tsx`
- **Cambio:** actualizar import de `SortMode` y `useCommentsListFilters` a `../../hooks/useCommentsListFilters`.

### `src/components/business/BusinessComments.tsx`
- **Cambio:** eliminar definicion local `type SortMode`. Importar desde `../../hooks/useCommentsListFilters`.

### `src/hooks/useDeepLinks.ts`
- **Cambio:** eliminar `const VALID_TABS`. Importar `ALL_TAB_IDS` desde `../types/navigation`. Reemplazar `VALID_TABS` por `ALL_TAB_IDS` en la validacion.

---

## Mutable prop audit

No aplica — ninguno de los componentes modificados tiene edicion de props mutables.

---

## Hooks

### `useCommentsListFilters` (movido a `src/hooks/`)
- Sin cambios de interfaz o logica.
- Exportaciones: `useCommentsListFilters`, `CommentEntry`, `SortMode`.

### `useVirtualizedList` (movido a `src/hooks/`)
- Sin cambios de interfaz o logica.
- Exportaciones: `useVirtualizedList`, `VIRTUALIZE_THRESHOLD`.

---

## Servicios

No hay cambios a servicios en este bundle.

---

## Integracion

### #297
- `analyticsReport.ts` es standalone. El cambio en `GA4_EVENT_NAMES` no afecta la firma publica de la function ni requiere cambios en el hook `useAnalyticsReport` del frontend.
- `ga4FeatureDefinitions.ts` es consumido por `FeaturesPanel` via import directo. Al agregar nuevas categorias y modificar features existentes, el panel renderiza automaticamente las nuevas features sin cambios adicionales (el componente itera `GA4_FEATURE_CATEGORIES` dinamicamente).

### #298
- `HelpSection.tsx` y `PrivacyPolicy.tsx` son componentes de solo-texto. No tienen dependencias externas que cambien.

### #299
- El move de hooks requiere actualizar imports en 3 archivos: `CommentsList.tsx`, `CommentsToolbar.tsx`, `BusinessComments.tsx`.
- El fix de `VALID_TABS` en `useDeepLinks.ts` es autocontenido.

### Preventive checklist

- [x] **Service layer**: Ningun componente modificado importa `firebase/firestore` directamente.
- [x] **Duplicated constants**: `VALID_TABS` eliminado en favor de `ALL_TAB_IDS`.
- [x] **Context-first data**: No aplica.
- [x] **Silent .catch**: No se agrega ningun `.catch`.
- [x] **Stale props**: No aplica.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/__tests__/hooks/useCommentsListFilters.test.ts` | Verificar que el hook es importable desde nueva ubicacion. Comportamiento de sort, filter por search, filter por business. | Unit |
| `src/__tests__/hooks/useVirtualizedList.test.ts` | Verificar importacion desde nueva ubicacion. shouldVirtualize threshold. Auto-loadMore trigger. | Unit |
| `src/__tests__/hooks/useDeepLinks.test.ts` (existente si aplica) | Verificar que `ALL_TAB_IDS` reemplaza correctamente a `VALID_TABS` — mismos valores. | Unit |

**Nota:** si ya existen tests en `src/__tests__/components/profile/` para estos hooks, actualizar los imports en esos tests tambien.

---

## Analytics

No hay nuevos `logEvent` en este bundle — el bundle trata de registrar eventos existentes que ya se llaman, no de agregar nuevos.

---

## Offline

No aplica — ningun cambio en este bundle tiene comportamiento offline.

---

## Accesibilidad y UI mobile

No hay componentes nuevos con elementos interactivos en este bundle. Los cambios a `HelpSection.tsx` son de texto solamente.

---

## Decisiones tecnicas

### Por que agregar `page_view` y `screen_view` a GA4_EVENT_NAMES

Aunque son eventos automaticos de GA4 (no llamados via `trackEvent`), incluirlos en la lista server-side permite que aparezcan en el reporte de volumen del admin dashboard. Esto da contexto de sesiones activas junto a los eventos de feature.

### Por que no agregar `test_event`

`test_event` es un evento de desarrollo usado para verificar integraciones. Nunca debe aparecer en dashboards de produccion. Se excluye deliberadamente.

### Por que mover hooks y no crear re-exports

El scope es pequeño (2 hooks, 3 consumidores). Los re-exports agregarian una capa de indirecion sin beneficio. Un move directo con actualizacion de imports es mas limpio.

### Por que `SortMode` va en `useCommentsListFilters.ts` y no en `src/types/`

`SortMode` es especifico del dominio de lista de comentarios — no es un tipo de navegacion, UI global, ni Firestore. Colocarlo junto al hook que lo define es mas cohesivo que agregarlo a `src/types/`.

---

## Hardening de seguridad

No aplica — este bundle no introduce nuevas superficies de escritura ni lectura en Firestore.

---

## Deuda tecnica: mitigacion incorporada

```bash
gh issue list --label "tech debt" --state open --json number,title
```

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #299 | `useCommentsListFilters` y `useVirtualizedList` mal ubicados | Fase 3, pasos 1-3 |
| #299 | `SortMode` duplicado en `BusinessComments.tsx` | Fase 3, paso 4 |
| #299 | `VALID_TABS` duplicado en `useDeepLinks.ts` | Fase 3, paso 5 |

### Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Estado |
|---------|----------------|-----------------|--------|
| `functions/src/admin/analyticsReport.ts` | 171 | ~200 | OK |
| `src/components/admin/features/ga4FeatureDefinitions.ts` | 151 | ~250 | OK |
| `src/components/profile/HelpSection.tsx` | 235 | ~270 | OK |
| `src/components/profile/PrivacyPolicy.tsx` | 277 | ~280 | OK |
| `src/hooks/useCommentsListFilters.ts` | 0 (nuevo) | ~124 | OK |
| `src/hooks/useVirtualizedList.ts` | 0 (nuevo) | ~50 | OK |
| `src/components/business/BusinessComments.tsx` | 329 | ~329 | OK (sin lineas nuevas) |
| `src/hooks/useDeepLinks.ts` | 50 | ~50 | OK |
