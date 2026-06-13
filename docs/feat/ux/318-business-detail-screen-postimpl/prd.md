# PRD: tech-debt: business-detail-screen post-implementation review (PRD/specs/plan gaps)

**Feature:** 318-business-detail-screen-postimpl
**Categoria:** ux / infra
**Fecha:** 2026-04-23
**Issue:** #318
**Prioridad:** Alta

---

## Contexto

La rama `feat/business-detail-screen` (commits `2157cb8`, `c0c6b1a`, `d7b1d5a`) implementó el refactor del detalle de comercio: sheet compacto `BusinessSheetCompactContent` + pantalla full `BusinessDetailScreen` en `/comercio/:id` con chip tabs sticky. Una revisión post-implementación realizada el 2026-04-23 identificó 17 gaps entre lo prometido en PRD/specs/plan y lo efectivamente entregado. Este issue consolida todos esos gaps para atacarlos en orden de prioridad.

## Problema

- El comportamiento offline de la pantalla full diverge del diseño: usuarios que abren un deep link sin conexión ven `BusinessNotFound` en lugar del header estático bundled + empty states por sección dinámica.
- Los 3 eventos analytics nuevos (`business_detail_opened`, `business_detail_tab_changed`, `business_detail_cta_clicked`) no están registrados en el panel admin ni en el reporte diario GA4, y el evento `sub_tab_switched` prometido en el specs nunca se disparó.
- Cuatro archivos de tests especificados en el plan (pasos 21, 23, 25, 27-28) no fueron creados, dejando sin cobertura el deep link legacy `?business=`, la navegación `/comercio/:id`, y el comportamiento del sheet compacto.
- Strings de UI hardcodeados en 3 componentes, `InfoTab.tsx` zombi con tipos extraviados, docs de referencia desincronizados, y 8 issues adicionales de cleanup estructural y menor completan el cuadro.

## Solucion

### S1 — P1: UX y observabilidad (bloquea merge de próximas features)

**S1.1 — Fix offline: deep link sin cache**

Modificar `BusinessDetailScreen.tsx` para que cuando `data.error && isOffline` NO se renderice `BusinessNotFound`. En su lugar renderizar `BusinessSheetHeader` + chip bar + tabs con empty states para secciones dinámicas (opiniones vacías, sin photoURL, sin ratings). `BusinessNotFound` solo se dispara cuando el `businessId` no existe en `allBusinesses` (datos bundled).

**S1.2 — Analytics: registrar 3 eventos en admin + reporte**

- Registrar feature entry `business_detail` con los 3 event names en `src/components/admin/features/ga4FeatureDefinitions.ts`.
- Sumar los 3 a `GA4_EVENT_NAMES` en `functions/src/admin/analyticsReport.ts`.
- Agregar llamada a `trackEvent('sub_tab_switched', { parent: 'comercio', tab })` en `handleChipChange` de `BusinessDetailScreen` — o eliminar explícitamente esa promesa del specs con nota de "wontfix".
- Tests en `ga4FeatureDefinitions.test.ts` que verifiquen los 3 eventos.

**S1.3 — Centralizar strings: crear `MSG_BUSINESS_DETAIL`**

Crear `src/constants/messages/businessDetail.ts` con `MSG_BUSINESS_DETAIL = { notFound, invalidId, offlineNoCache, backToMap, viewDetails, chipLabels: { criterios, precio, tags, foto, opiniones } }`. Reemplazar usos hardcodeados en `BusinessNotFound.tsx`, `BusinessDetailScreen.tsx` y `BusinessSheetCompactContent.tsx`. Seguir convención `MSG_*` existente (mismo patrón de `MSG_BIZ`, `MSG_LIST`, etc.).

**S1.4 — Sync rating sheet ↔ detail: decisión + test**

Tomar decisión explícita entre:
- (a) Mantener sheet ultra-compacto sin widget de rating → actualizar PRD y specs para remover esa promesa.
- (b) Agregar `BusinessRating` al `BusinessSheetCompactContent` con el mismo hook `useBusinessRating`.

Independientemente del camino, agregar test en `BusinessDetailScreen.test.tsx` que mockee `useBusinessData` con ratings iniciales vs actualizados entre renders y verifique que `BusinessRating` refleja el nuevo valor. Y test de integración navegación: `/` → `/comercio/biz_001` → back → sheet restaurado.

**S1.5 — Sync docs de referencia**

Actualizar los 4 docs que el issue identifica como desincronizados:
- `docs/reference/features.md` — sección "Comercio": chip tabs, deprecar `?sheetTab=`.
- `docs/reference/architecture.md` — árbol de rutas: `/comercio/:id` → `BusinessDetailPage` (lazy).
- `docs/reference/patterns.md` — sección "Deep linking": URL canónica `/comercio/:id`; `?business=` backward compat vía `useDeepLinks`.
- `docs/reference/project-reference.md` — fecha correcta + línea en summary.

---

### S2 — P2: Cleanup estructural

**S2.1 — Eliminar `InfoTab.tsx` zombi**

Mover los 3 tipos (`PriceLevelData`, `TagsData`, `PhotoData`) a `src/types/businessDetail.ts`. Actualizar import en `BusinessDetailScreen.tsx`. Eliminar `src/components/business/InfoTab.tsx`.

**S2.2 — Backfill de 4 archivos de tests faltantes**

- `src/App.test.tsx` — `/comercio/biz_001` renderiza screen, `/comercio/invalid` renderiza `BusinessNotFound`, `?tab=opiniones` activa chip correcto.
- `src/components/business/__tests__/BusinessSheet.test.tsx` — sheet compacto NO renderiza chips ni tabs.
- `src/hooks/__tests__/useDeepLinks.test.ts` — restore via `sessionStorage` + backward compat `?business=biz_001`.
- `src/components/business/__tests__/ShareButton.test.tsx` — share genera `/comercio/:id`, `?business=` sigue funcionando.

Prioridad alta en `useDeepLinks.test.ts` dado que hay links `?business=` en circulación.

**S2.3 — Responsive desktop/tablet**

Decidir y documentar comportamiento en tablet/desktop (max-width centrado tipo dialog vs coexistencia con BottomNav vs standalone). Agregar sección "Comportamiento responsive" al PRD original y ajustar CSS si aplica.

**S2.4 — URL canónica y discovery**

Grep `?business=` en `scripts/`, `functions/src/`, templates de email/push. Decidir si se actualiza a `/comercio/:id` o se mantiene legacy. Documentar decisión en specs sección "Backward compatibility de URLs".

**S2.5 — Documentar `DetailError` inline en specs**

Documentar el componente interno (`BusinessDetailScreen.tsx` líneas 56-71) en sección "Componentes" + "Textos de usuario" del specs. Migrar sus strings al `MSG_BUSINESS_DETAIL` del S1.3.

---

### S3 — P3: Cleanup menor (pueden agruparse en un único PR de cleanup)

- **`useBusinessById`**: renombrar a `getBusinessById` y mover a `src/utils/` (no usa ningún hook React), o wrappear en `useMemo`. Documentar en JSDoc.
- **`sessionStorage` restore agresivo**: escribir la key SOLO en el CTA "Ver detalles"; leer+borrar atómicamente en primer mount. Documentar en specs.
- **Sticky chip bar jitter**: inicializar `headerHeight` con `useLayoutEffect` + `ref.getBoundingClientRect()` antes del paint. Revisar deps del `useEffect` del ResizeObserver.
- **Overflow chip bar 320px**: gradient fade en borde derecho cuando hay contenido scrollable, o verificar que los 5 chips entren en el breakpoint mínimo (iPhone SE, 320px).
- **A11y chips**: agregar `role="tablist"` al contenedor, `role="tab"` + `aria-selected` a cada chip, `aria-label="Secciones del comercio"`, navegación por teclado (Enter/Space).
- **`BUSINESS_ID_REGEX`**: agregar sección "Contrato con formato de IDs" al specs + test parametrizado con inputs inválidos (`<script>`, `../../../etc`, `biz_`, `biz_1234567`, `''`).
- **PR de docs en batch**: consolidar ajustes documentales de PRD/specs del item #17 del issue en un único PR (sin tocar código).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1.1 Fix offline deep link | Alta | S |
| S1.2 Registrar analytics en admin + reporte | Alta | S |
| S1.3 Crear `MSG_BUSINESS_DETAIL` | Alta | S |
| S1.4 Decisión sync rating + test obligatorio | Alta | M |
| S1.5 Sync docs de referencia | Alta | S |
| S2.1 Eliminar `InfoTab.tsx` zombi | Media | XS |
| S2.2 Backfill 4 archivos de tests | Media | M |
| S2.3 Responsive desktop/tablet | Media | S |
| S2.4 URL canónica y discovery | Media | S |
| S2.5 Documentar `DetailError` en specs | Baja | XS |
| S3.x Cleanup menor (7 items) | Baja | M |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Rediseño de los tabs de `BusinessDetailScreen` — el layout chip bar + pantalla full ya está aprobado.
- Nuevas funcionalidades de negocio sobre la pantalla de detalle (ej: reservas, menú online).
- Migración de todos los emails/push de `?business=` a `/comercio/:id` — solo se audita y documenta la decisión.
- Soporte de múltiples tabs activos simultáneos o deep link con múltiples parámetros.

---

## Tests

### Archivos que necesitarán tests

| Archivo | Tipo | Qué testear |
|---------|------|-------------|
| `src/App.test.tsx` | Integración | `/comercio/biz_001` renderiza `BusinessDetailScreen`, `/comercio/invalid` renderiza `BusinessNotFound`, `?tab=opiniones` activa chip correcto |
| `src/components/business/__tests__/BusinessDetailScreen.test.tsx` | Unitario | Comportamiento offline con `data.error && isOffline`: renderiza header estático, no renderiza `BusinessNotFound`; sync rating entre renders |
| `src/components/business/__tests__/BusinessSheet.test.tsx` | Unitario | Sheet compacto NO renderiza chips ni tabs internos; CTA "Ver detalles" navega a `/comercio/:id` |
| `src/hooks/__tests__/useDeepLinks.test.ts` | Unitario | Restore via `sessionStorage` (`mm_last_business_sheet`), backward compat `?business=biz_001`, limpieza atómica de la key |
| `src/components/business/__tests__/ShareButton.test.tsx` | Unitario | Share genera URL `/comercio/:id`, fallback clipboard, `?business=` backward compat |
| `src/components/admin/features/ga4FeatureDefinitions.test.ts` | Unitario | Los 3 eventos `business_detail_*` están registrados |
| `src/constants/messages/businessDetail.test.ts` | Unitario | Exports de `MSG_BUSINESS_DETAIL` completos y sin duplicados con otros `MSG_*` |

### Criterios de testing

- Cobertura >= 80% del código nuevo o modificado
- Tests de integración para los flujos de navegación afectados (deep link directo, volver al mapa, backward compat)
- El test de `useDeepLinks` es bloqueante para merge: hay links `?business=` en circulación en producción
- Los paths offline deben testearse con mocks de `useConnectivity` + `isOffline: true`

---

## Seguridad

Este issue es puramente de cleanup post-implementación. No agrega nuevas colecciones, Cloud Functions ni superficie de ataque. Los items de seguridad relevantes son:

- [ ] `BUSINESS_ID_REGEX` (S3) debe testear inputs de inyección (`<script>`, `../../../etc`, `''`) para confirmar que el guard funciona como barrera de validación de `businessId` antes de cualquier query
- [ ] El `sessionStorage` key `mm_last_business_sheet` contiene un businessId — verificar que no permite inyección si se manipula manualmente (el valor solo se usa para lookup en `allBusinesses` bundled, no para queries a Firestore)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigación requerida |
|-----------|---------------|---------------------|
| `/comercio/:id` — param `id` en URL | Enumerar IDs válidos para scraping de negocios | `BUSINESS_ID_REGEX` + datos bundled (no hay query Firestore por ID de negocio) |
| `sessionStorage` key `mm_last_business_sheet` | XSS lee la key y obtiene businessId | businessId no es dato sensible; dato ya público en `allBusinesses` |

No hay escrituras nuevas a Firestore en este issue — no aplican checklists de `hasOnly()` ni rate limits.

---

## Deuda técnica y seguridad

```bash
gh issue list --label security --state open --json number,title
# → []  (0 vulnerabilidades abiertas)
gh issue list --label "tech-debt" --state open --json number,title
# → #313-#318 (6 issues open)
```

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #318 (este issue) | Es el consolidador de deuda del feature | Atacar por prioridad según criterios de done del issue |
| #317 barrel.test.ts hardcodes export count | Podría fallar si se agrega `MSG_BUSINESS_DETAIL` al barrel | Revisar al crear el archivo de mensajes; actualizar test del barrel si corresponde |
| #316 debounce/concurrency en visibility listeners | No impacta este feature | No agravar |
| #315 measureAsync en fetchAppVersionConfig | No impacta este feature | No agravar |
| #314 import RETRY_DELAYS_MS | No impacta este feature | No agravar |
| #313 isCooldownActive duplication | No impacta este feature | No agravar |

### Mitigación incorporada

- S1.3 crea `MSG_BUSINESS_DETAIL` siguiendo la convención establecida — reduce riesgo de que #317 falle (el barrel test hardcodea counts de exports, no de mensajes).
- S2.1 elimina código zombi (`InfoTab.tsx`) reduciendo superficie de confusión para el linter.

---

## Robustez del código

### Checklist de hooks async

- [ ] `BusinessDetailScreen` — el `useEffect` del ResizeObserver tiene cleanup (`disconnect()`). Verificar que el fix de deps (S3) no rompe el cleanup existente
- [ ] Fix offline (S1.1) — el nuevo path de render sin error state no introduce `setState` post-unmount
- [ ] `useDeepLinks` fix (S3) — el `removeItem` de `sessionStorage` en mount debe estar en el `useEffect` cleanup o en el primer render sincrónico para evitar doble ejecución en Strict Mode
- [ ] `useBusinessById` (S3) — si se mantiene como hook, wrappear resultado en `useMemo` con dep `[allBusinesses, id]`; si se mueve a `src/utils/`, verificar que ningún archivo en `src/hooks/` lo re-exporte con prefix `use`

### Checklist de observabilidad

- [ ] Los 3 eventos `business_detail_*` deben aparecer en `GA4_EVENT_NAMES` y en `ga4FeatureDefinitions.ts` (S1.2)
- [ ] `sub_tab_switched` — decidir explícitamente si se dispara o se elimina del specs (S1.2)

### Checklist offline

- [ ] Fix S1.1 — renderizar `BusinessSheetHeader` con datos estáticos bundled cuando offline + error
- [ ] Empty states en tabs dinámicos (opiniones, fotos, precios) cuando offline — NO mostrar spinner infinito ni error genérico
- [ ] Submit deshabilitado en formularios de opiniones cuando `isOffline` (ya debería estar implementado vía `withOfflineSupport`, verificar que el fix offline no rompa eso)

### Checklist de documentación

- [ ] `docs/reference/features.md` — actualizar sección Comercio (S1.5)
- [ ] `docs/reference/architecture.md` — agregar ruta `/comercio/:id` (S1.5)
- [ ] `docs/reference/patterns.md` — actualizar sección Deep linking (S1.5)
- [ ] `docs/reference/project-reference.md` — fecha + summary (S1.5)
- [ ] `docs/feat/ux/business-detail-screen/prd.md` — agregar `business_detail_cta_clicked` como 3er evento (S1.2)
- [ ] `docs/feat/ux/business-detail-screen/specs.md` — documentar `DetailError` interno (S2.5), tildes en copy, decisión sync rating (S1.4)

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|--------------------|-------------|
| Carga datos bundled del comercio | Read (estático) | Disponible siempre — JSON en bundle | N/A |
| Carga datos dinámicos (ratings, comments, fotos) | Read (Firestore) | Firestore persistent cache + IndexedDB readCache | Empty state por sección, NO `BusinessNotFound` |
| Deep link directo `/comercio/:id` sin conexión | Read | Mostrar datos bundled; secciones dinámicas vacías | Header + chip tabs + empty states |
| Navegar de sheet a detail | N/A | `sessionStorage` write antes de navegar | N/A |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (Firestore persistent cache + readCache)
- [ ] Fix S1.1: el path `data.error && isOffline` debe renderizar header bundled, no `BusinessNotFound`
- [x] APIs externas: no hay APIs externas en esta feature
- [x] UI: `OfflineIndicator` chip global ya disponible
- [ ] Verificar que secciones dinámicas vacías (offline) muestran empty state descriptivo, no spinner infinito

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

No se agrega lógica de negocio a `AppShell` ni `SideMenu`. Los cambios son:
- Fix en `BusinessDetailScreen.tsx` (condicional de render)
- Nuevo archivo de constantes `src/constants/messages/businessDetail.ts`
- Movimiento de tipos de `InfoTab.tsx` a `src/types/businessDetail.ts`
- Eliminación de `InfoTab.tsx`

### Checklist modularizacion

- [ ] Lógica de negocio del fix offline en `BusinessDetailScreen` (componente de dominio), no en layout
- [ ] `MSG_BUSINESS_DETAIL` en `src/constants/messages/businessDetail.ts` — no appendear al barrel de mensajes existente; agregar `export * from './businessDetail'` al `messages/index.ts`
- [ ] Tipos movidos a `src/types/businessDetail.ts` — archivo de dominio correcto
- [ ] `getBusinessById` (si se renombra) va en `src/utils/`, no en `src/hooks/`
- [ ] Ningún archivo modificado supera 400 líneas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Elimina `InfoTab.tsx` zombi y centraliza tipos |
| Estado global | = | No agrega contextos nuevos |
| Firebase coupling | = | No hay cambios en imports de Firebase SDK |
| Organización por dominio | - | Mueve tipos a `src/types/businessDetail.ts` (correcto) |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] Chip bar (S3): agregar `role="tablist"` al contenedor, `role="tab"` + `aria-selected` a cada chip, `aria-label="Secciones del comercio"`, navegación Enter/Space
- [ ] Empty states offline: agregar `role="status"` o `aria-live="polite"` en los empty states de secciones dinámicas
- [ ] `BusinessNotFound` — verificar que el mensaje del error state tiene `role="alert"` o es semánticamente correcto
- [ ] Touch targets de chips: verificar que cumplen 44x44px mínimo en 320px (iPhone SE)

### Checklist de copy

- [ ] S1.3 — `MSG_BUSINESS_DETAIL` con tildes correctas: "Criterios", "Precio", "Etiquetas", "Foto", "Opiniones", "Ver detalles", "Volver al mapa"
- [ ] Voseo: "Necesitás conexión" (no "Necesitas conexion")
- [ ] Terminología: "comercio" (no "negocio"), "reseñas" (no "reviews")
- [ ] Mensajes de error accionables: "No se pudo cargar la información del comercio. Reintentar" con botón funcional

---

## Success Criteria

1. Un usuario offline que abre el deep link `/comercio/:id` ve el nombre, categoría, dirección y tags del comercio (datos bundled), con empty states descriptivos en tabs dinámicos — nunca la pantalla `BusinessNotFound` por causa offline.
2. Los 3 eventos `business_detail_*` aparecen en el panel admin (tab Funcionalidades) y en el reporte diario GA4, con tendencias visibles.
3. Los 4 archivos de tests backfilleados pasan en CI: `App.test.tsx`, `BusinessSheet.test.tsx`, `useDeepLinks.test.ts`, `ShareButton.test.tsx`. Cobertura global no baja del 80%.
4. `InfoTab.tsx` eliminado del repo; los tipos `PriceLevelData`, `TagsData`, `PhotoData` viven en `src/types/businessDetail.ts`.
5. Los docs de referencia (`features.md`, `architecture.md`, `patterns.md`, `project-reference.md`) reflejan la implementación real: ruta `/comercio/:id`, chip tabs, deprecación de `?sheetTab=`, URL canónica documentada.
