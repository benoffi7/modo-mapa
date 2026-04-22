# PRD: Tech debt architecture — prop-drilling, sabanas, console.error bypass

**Feature:** 306-architecture-prop-drilling-sabanas
**Categoria:** infra
**Fecha:** 2026-04-18
**Issue:** #306
**Prioridad:** Media

---

## Contexto

El `/health-check` sobre `new-home` (2026-04-18) confirmo que la base es saludable (service layer limpio, admin split, converters centralizados, lazy loading, logger adoptado) pero detecto tres patrones de deuda arquitectonica que conviene pagar antes de sumar features al BusinessSheet o al SettingsPanel. Esta iteracion elimina un bypass de logger, desarma la "sabana" del SettingsPanel y corta el prop-drilling de `businessId`/`businessName` en la capa de business components.

## Problema

- `src/components/admin/ModerationActions.tsx:68` usa `console.error` directo en vez de `logger.error`, rompiendo captura Sentry en prod (ultimo bypass residual de logger en `src/`).
- `SettingsPanel.tsx` renderiza 5 secciones separadas por `<Divider>` (Cuenta, Ubicacion, Apariencia, Privacidad, Notificaciones + Frecuencia, Datos) — el patron "sabana" prohibido por `docs/reference/patterns.md` (max 5 secciones) y por el merge gate.
- 11 componentes del dominio Business reciben `businessId` + `businessName` como props desde `BusinessSheetContent`, sumando ~22 props repetidas e InfoTab absorbe 11 props para 3 features independientes.
- El dirty-tracking de comentarios atraviesa 4 componentes (`BusinessComments` → `OpinionesTab` → `BusinessSheetContent` → `BusinessSheet`) via `onDirtyChange`, sin necesidad — podria localizarse en un contexto del subarbol de la tab.
- 3 archivos estan a punto de cruzar el threshold de 400 LOC: `FeedbackList.tsx` (320), `AbuseAlerts.tsx` (327), `BusinessQuestions.tsx` (375).

## Solucion

### S1 — Reemplazar `console.error` por `logger.error` (quick win)

- Cambiar `console.error('Moderation error:', err)` en `ModerationActions.tsx:68` por `logger.error('Moderation error:', err)`.
- Eliminar el unico bypass residual. No hay cambio funcional — solo visibilidad Sentry en produccion.
- Patron de referencia: cualquier `catch` en `src/components/admin/AbuseAlerts.tsx` ya usa `logger.error`.

### S2 — BusinessScopeContext (eliminar prop-drilling businessId/businessName)

- Crear `src/context/BusinessScopeContext.tsx` con `{ businessId, businessName, location }` y provider localizado dentro de `BusinessSheetContent`.
- Expone hook `useBusinessScope()` para consumidores del subarbol (tags, favorite, price level, recommend, check-in, add-to-list, comments, menu photo, etc.).
- Migrar 11 componentes a leer desde contexto en vez de props:
  - `FavoriteButton`, `BusinessTags`, `BusinessQuestions`, `BusinessPriceLevel`, `RecommendDialog`, `CheckInButton`, `AddToListDialog`, `CommentInput` (via `BusinessComments`), `OpinionesTab`, `BusinessComments`, `MenuPhotoUpload` (via `MenuPhotoSection`).
- Mantener compat: las funciones de servicio y hooks (`useBusinessRating`, `useCommentListBase`) siguen recibiendo `businessId` como parametro — el contexto solo reemplaza prop-drilling a traves de componentes.
- Referencia: el patron "Shell/Content" ya separa logica de negocio en el subarbol de Content (`patterns.md`). BusinessScopeContext es complemento natural.

### S3 — InfoTab slim API via sub-data objects

- Reducir el prop surface de `InfoTab.tsx` de 11 props a 4 (`business`, `ratingData`, `priceLevelData`, `tagsData`, `photoData`).
- Agrupar props por feature:
  - `priceLevelData = { levels, onChange }`
  - `tagsData = { seed, user, custom, onChange }`
  - `photoData = { photo, onChange }`
- No altera `BusinessSheetContent` mas alla de consolidar los props que arma.

### S4 — Dirty-tracking localizado con `CommentsDirtyContext`

- Crear `useCommentsDirty()` context en el subarbol de `OpinionesTab`. `BusinessComments` registra dirty por estado local; `OpinionesTab` consume y aplica callback a `BusinessSheet` **solo** en el borde de la tab.
- Desacopla `onDirtyChange` prop de `BusinessSheetContent` e `InfoTab`. Reduce re-renders del header al escribir un comentario.
- Alternativa mas simple: dejar el `onDirtyChange` solo en `OpinionesTab` y propagar a `BusinessSheetContent` via un unico prop — en la practica es lo mismo pero sin contexto nuevo. Se evaluara en specs cual tiene menos codigo.

### S5 — Descomponer 3 archivos cerca de 400 LOC (preventivo)

- `AbuseAlerts.tsx` (327 LOC): extraer `AlertsFilters.tsx` (filters grid, ~70 LOC), `AlertsTable.tsx` (table + expanded row, ~90 LOC) y mantener orquestador.
- `FeedbackList.tsx` (320 LOC): extraer `FeedbackRespondForm.tsx` (respond inline, ~50 LOC) y `FeedbackBusinessDialog.tsx` (business detail dialog, ~30 LOC).
- `BusinessQuestions.tsx` (375 LOC): extraer `QuestionForm.tsx` (input + limit alert, ~50 LOC) y reutilizar `InlineReplyForm` que ya existe para el thread de respuestas.
- Ninguno debe quedar > 250 LOC post-refactor; todos los hooks y servicios siguen intactos.

### UX

- No hay cambio visible para el usuario en S1–S5. Verificacion via tests + regression manual del BusinessSheet (Info + Opiniones), SettingsPanel completo, Admin feedback + abuse alerts.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — `logger.error` en ModerationActions | Alta | XS |
| S2 — BusinessScopeContext | Alta | M |
| S3 — InfoTab slim API | Media | S |
| S4 — Dirty-tracking localizado | Media | S |
| S5 — Descomponer 3 archivos cerca del threshold | Media | M |
| Tests para hooks y contextos nuevos | Alta | S |
| Actualizar `docs/reference/patterns.md` | Media | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Reescribir `SettingsPanel` como tabs/accordion. El item #3 del health-check ("SettingsPanel sabana") NO entra en este scope — es un cambio visual para el usuario y merece PRD/UX separado. Se mantiene con `<Divider>` por ahora.
- Migrar otros subarboles que usen prop-drilling (admin panels, lists, social). Solo dominio Business.
- Touch aria/accessibility (#290 ya cubrio touch targets + aria-labels).
- Performance: no se introducen memos adicionales mas alla de los necesarios para que el contexto no cause re-renders.

---

## Tests

Politica segun `docs/reference/tests.md`: >=80% cobertura del codigo nuevo.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/context/BusinessScopeContext.tsx` | Context | Provider + hook, error fuera de provider, valor de default |
| `src/context/BusinessScopeContext.test.tsx` | Test | Render dentro/fuera de provider, memoizacion de value |
| `src/components/business/BusinessTags.tsx` (migrado) | Integration | Continua funcionando con contexto, no rompe offline flow |
| `src/components/business/FavoriteButton.tsx` (migrado) | Integration | Mantiene optimistic + offline |
| `src/components/business/InfoTab.tsx` (nueva API) | Integration | Pasa data agrupada a hijos |
| `src/components/admin/AbuseAlerts.tsx` (split) | Integration | KPIs + filters + tabla siguen funcionando |
| `src/components/admin/FeedbackList.tsx` (split) | Integration | Respond inline + business dialog integrados |
| `src/components/business/BusinessQuestions.tsx` (split) | Integration | Form + list + reply siguen funcionando |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para `useBusinessScope()` fuera de provider (error explicito)
- Paths condicionales cubiertos (con/sin businessName, dirty toggle)
- Side effects verificados (no se rompen toasts, ni cache, ni offline queue)

---

## Seguridad

Este PRD es refactor puro — no toca rules, no agrega colecciones ni callables, no lee/escribe campos nuevos.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Ninguna nueva — refactor solo reorganiza codigo existente | N/A | N/A |

**Checks rapidos:**

- [ ] No se agregan escrituras a Firestore
- [ ] No se agregan callables ni triggers
- [ ] No se tocan Firestore rules
- [ ] No se modifican converters
- [ ] El cambio de `logger.error` mejora observabilidad (captura Sentry en prod)

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #306 (este) | origen | health-check 2026-04-18 |
| (no hay issues abiertos de `security` ni `tech debt` labels en este momento) | — | — |

### Mitigacion incorporada

- Elimina ultimo bypass de `logger` en `src/` (S1) — cierra gap de observabilidad Sentry.
- Previene cruce de threshold 400 LOC (S5) — evita futuras reaperturas de este tipo de issues.
- Reduce acoplamiento del dominio Business (S2) — prepara terreno para eventual extraccion a tab/module.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] El contexto nuevo (`BusinessScopeContext`) no dispara operaciones async por si mismo
- [ ] Los handlers async preservan sus `try/catch` con `logger.error` + toast existentes
- [ ] No se rompen cancellation patterns en hooks consumidores
- [ ] Archivos nuevos <= 200 LOC; archivos refactorizados <= 250 LOC
- [ ] `logger.error` reemplaza `console.error` en `ModerationActions.tsx` — nunca dentro de `if (import.meta.env.DEV)`

### Checklist de observabilidad

- [ ] No hay triggers nuevos (no aplica `trackFunctionTiming`)
- [ ] No hay services nuevos (no aplica `measureAsync`)
- [ ] No hay eventos analytics nuevos — si se crean, registrar en `GA4_EVENT_NAMES` y `ga4FeatureDefinitions.ts`

### Checklist offline

- [ ] Los componentes migrados (FavoriteButton, BusinessTags, CommentInput, RecommendDialog) preservan su `withOfflineSupport`
- [ ] `isOffline` continua leyendose via `useConnectivity()` dentro de los componentes, no via prop drilling

### Checklist de documentacion

- [ ] Nuevo contexto registrado en `docs/reference/architecture.md` seccion "Contextos"
- [ ] Nuevo patron registrado en `docs/reference/patterns.md` bajo "Datos y estado" (BusinessScopeContext)
- [ ] No se agregan secciones de HomeScreen
- [ ] `docs/reference/patterns.md` actualizado con el patron "Scope context para dominios anidados"
- [ ] `docs/reference/firestore.md` sin cambios (no hay campos ni colecciones nuevas)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Ninguna nueva — refactor mantiene `withOfflineSupport` actual | — | Preservada | Preservada |

### Checklist offline

- [ ] Reads de Firestore: sin cambios
- [ ] Writes: `withOfflineSupport` wrappers intactos en componentes migrados
- [ ] APIs externas: sin cambios
- [ ] UI: indicadores offline actuales (OfflineIndicator) sin cambios
- [ ] Datos criticos: sin cambios en read caching

### Esfuerzo offline adicional: S (verificacion manual de que el flujo offline no se rompio)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio sigue en hooks/services — no se migra a componentes
- [x] `BusinessScopeContext` es un proveedor de datos, no de acciones (data-only context)
- [x] No se agregan useState de logica de negocio a componentes de layout
- [x] Props de accion siguen siendo handlers reales (no noops)
- [x] Ningun componente nuevo importa de `firebase/firestore`, `firebase/functions` ni `firebase/storage`
- [x] Archivos en `src/hooks/` sin cambios
- [x] Archivos nuevos <= 200 LOC; archivos refactorizados <= 250 LOC
- [x] Archivos nuevos van en carpeta de dominio correcta (`src/context/` para contexto, `src/components/business/` para split de BusinessQuestions, `src/components/admin/alerts/` y `src/components/admin/feedback/` para splits de admin)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Reduce 11 componentes con props duplicadas a contexto compartido |
| Estado global | = | El nuevo contexto es local al subarbol de BusinessSheetContent, no global |
| Firebase coupling | = | No cambia boundary del service layer |
| Organizacion por dominio | - | Split de admin y business pone codigo en subcarpetas dedicadas |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [x] No se agregan `<IconButton>` nuevos (no aplica aria-label nuevo)
- [x] Semantica de elementos interactivos existentes preservada
- [x] Touch targets sin cambios
- [x] Componentes con carga de datos mantienen skeleton/error state
- [x] Imagenes con URLs dinamicas sin cambios
- [x] Formularios mantienen labels

### Checklist de copy

- [x] No se agregan textos user-facing
- [x] Los mensajes existentes en `MSG_COMMENT`/`MSG_QUESTION`/`MSG_ADMIN` se preservan sin cambios

---

## Success Criteria

1. `npm run lint` y `npm run test:run` pasan sin regresiones.
2. Cobertura global se mantiene >= 80% (statements, branches, functions, lines).
3. `src/components/admin/ModerationActions.tsx` no contiene `console.error` — solo `logger.error`.
4. Ningun componente del dominio Business recibe `businessId` o `businessName` como prop desde `BusinessSheetContent` (excepto `BusinessSheetHeader` que sigue recibiendo `business` completo para mostrar nombre/categoria).
5. `SettingsPanel` sigue identico visualmente — el item "sabana" queda documentado como out-of-scope (PRD separado).
6. Ningun archivo en `src/components/admin/` ni `src/components/business/` supera los 300 LOC post-refactor.
