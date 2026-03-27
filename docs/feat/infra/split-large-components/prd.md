# PRD: Tech debt: large components need splitting

**Feature:** split-large-components
**Categoria:** infra
**Fecha:** 2026-03-27
**Issue:** #195
**Prioridad:** Media

---

## Contexto

El proyecto tiene una directiva formal de tamano de archivos (`docs/reference/file-size-directive.md`) que establece un limite de 400 lineas por componente, con >400 como "warning" y >500 como "bloqueante". Cuatro componentes superan ese umbral: BusinessComments (467), BusinessQuestions (459), SettingsPanel (387) y CommentsList (378). Los dos primeros violan directamente la directiva; los dos ultimos estan en zona de riesgo y merecen refactorizacion preventiva. El proyecto ya tiene precedente exitoso de este patron: `CommentRow`, `CommentInput`, `InlineReplyForm`, `CommentsStats`, `CommentsToolbar` fueron extraidos previamente siguiendo el mismo enfoque, y los paneles admin fueron descompuestos en subdirectorios (`admin/perf/`, `admin/alerts/`).

## Problema

- **BusinessComments (467 lineas)** y **BusinessQuestions (459 lineas)** superan el umbral de 400 lineas de la directiva. Ambos mezclan sorting/filtering logic, optimistic like state management, reply/thread state, edit state, profile visibility y rendering en un solo archivo.
- **SettingsPanel (387 lineas)** concentra secciones de auth (registro, verificacion email, cambio contrasena, logout, eliminacion de cuenta), toggles de notificaciones, locality picker y dark mode toggle en un unico componente con 10+ piezas de estado local.
- **CommentsList (378 lineas)** ya tuvo extracciones parciales (`CommentsStats`, `CommentsToolbar`, `CommentItem`) pero la logica de filtering, sorting, virtualization y swipe actions permanece en el componente principal.

## Solucion

### S1. BusinessComments (467 -> ~200 lineas)

Ya se extrajeron `CommentRow` (239 lineas), `CommentInput` (79 lineas) e `InlineReplyForm` (100 lineas). Lo que queda en BusinessComments es logica que deberia vivir en hooks:

- **Extraer `useCommentSort`**: sort mode state + `sortedTopLevel` memo. ~30 lineas.
- **Extraer `useOptimisticLikes`**: las dos Maps (`optimisticLikeToggle`, `optimisticLikeDelta`), helpers `isLiked` y `getLikeCount`, handler `handleToggleLike`. ~60 lineas.
- **Extraer `useCommentThreads`**: `topLevelComments`/`repliesByParent` grouping memo, `expandedThreads` state, `replyingTo`/`replyText` state. ~50 lineas.
- **Extraer `useCommentEdit`**: `editingId`, `editText`, `isSavingEdit`, handlers `handleStartEdit`/`handleSaveEdit`/`handleCancelEdit`. ~40 lineas.

Despues de las extracciones, BusinessComments queda como orquestador que compone hooks + componentes.

### S2. BusinessQuestions (459 -> ~180 lineas)

Estructura similar a BusinessComments. Los hooks de S1 se pueden reutilizar parcialmente:

- **Reusar `useOptimisticLikes`**: misma logica, diferente estructura interna (Map unificada vs dos Maps). Unificar a una sola implementacion.
- **Extraer `useQuestionThreads`**: separacion questions/answers, `filteredAnswersByQuestion`, `expandedQuestions` state, best answer logic. ~50 lineas.
- **Extraer `QuestionInput`**: analogo a `CommentInput` pero con icono `HelpOutline`, placeholder diferente y `MAX_QUESTION_LENGTH`. ~70 lineas.

### S3. SettingsPanel (387 -> ~150 lineas)

Seguir el patron de admin panel decomposition (subdirectorio con subcomponentes):

- **Extraer `SettingRow`** a archivo propio: ya es un componente interno con interface propia (`SettingRowProps`). ~40 lineas.
- **Extraer `AccountSection`**: toda la logica de auth (anonymous CTA, email display, verification, change password, delete account, logout). Incluye los 6 estados de dialog + cooldown timer. ~150 lineas.
- **Extraer `NotificationsSection`**: master toggle + toggles granulares con logica de disabled cascading. ~60 lineas.
- **Extraer `useVerificationCooldown`**: el cooldown timer con `setInterval` y cleanup. ~25 lineas.

SettingsPanel queda como compositor de secciones con loading skeleton.

### S4. CommentsList (378 -> ~200 lineas)

Extracciones parciales ya se hicieron (`CommentsStats`, `CommentsToolbar`, `CommentItem`). Queda:

- **Extraer `useCommentsListFilters`**: sorting, search text, business filter, `deferredSearch`, `filteredSorted` memo. ~50 lineas.
- **Extraer `useVirtualizedList`**: setup de `useVirtualizer`, `parentRef`, `VIRTUALIZE_THRESHOLD` logic. ~40 lineas.

### Patron general

Todas las extracciones siguen los patrones documentados en `patterns.md`:

- Hooks en `src/hooks/` cuando son reutilizables (e.g., `useOptimisticLikes`).
- Hooks co-localizados junto al componente cuando son especificos (e.g., `useQuestionThreads` en `src/components/business/`).
- Subcomponentes UI en el mismo directorio que el padre.
- El componente padre queda como orquestador: importa hooks, pasa props a subcomponentes.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Extraer hooks de BusinessComments (sort, likes, threads, edit) | Alta | M |
| S2: Extraer hooks y QuestionInput de BusinessQuestions | Alta | M |
| S3: Descomponer SettingsPanel (AccountSection, NotificationsSection, SettingRow, useVerificationCooldown) | Media | M |
| S4: Extraer useCommentsListFilters y useVirtualizedList de CommentsList | Baja | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Cambiar la API publica de los componentes (props de BusinessComments, BusinessQuestions, etc.)
- Refactorizar el service layer de comments (`src/services/comments.ts`)
- Agregar funcionalidad nueva a ninguno de los componentes
- Refactorizar CommentRow (239 lineas) o CommentItem (226 lineas) -- estan dentro del umbral

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useOptimisticLikes.ts` | Hook | Toggle state, delta calculation, `isLiked`/`getLikeCount` helpers, edge cases (double toggle, unknown commentId) |
| `src/hooks/useCommentSort.ts` | Hook | Sort modes (recent, oldest, useful), filtering de pending deletes |
| `src/hooks/useCommentThreads.ts` | Hook | Grouping top-level vs replies, reply sorting chronological, expanded threads toggle |
| `src/hooks/useCommentEdit.ts` | Hook | Start/save/cancel edit flow, isSavingEdit flag, text state management |
| `src/components/business/useQuestionThreads.ts` | Hook | Question/answer separation, best answer sorting, expanded toggle |
| `src/components/business/QuestionInput.tsx` | Componente | Render, submit, rate limit precheck, max length validation |
| `src/components/menu/AccountSection.tsx` | Componente | Anonymous vs email states, dialog open triggers, verification flow |
| `src/hooks/useVerificationCooldown.ts` | Hook | Timer countdown, cleanup on unmount, re-trigger |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)
- Los tests existentes de BusinessComments y CommentsList no deben romperse (regression)

---

## Seguridad

Este refactoring es interno y no cambia superficies de ataque. Verificaciones minimas:

- [ ] No se exponen nuevos datos en props que antes eran internos al componente
- [ ] Los hooks extraidos no alteran la logica de ownership (userId checks)
- [ ] No se introducen `dangerouslySetInnerHTML` ni eval en los archivos nuevos
- [ ] Commit messages limpios, sin exponer detalles de infraestructura (repo publico)

---

## Offline

Este refactoring no modifica flujos de datos. Los componentes ya usan `withOfflineSupport` para writes y Firestore persistent cache para reads. No hay cambios en comportamiento offline.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | Sin cambios | Sin cambios |

### Checklist offline

- [x] Reads de Firestore: sin cambios, usan persistencia offline existente
- [x] Writes: sin cambios, ya tienen `withOfflineSupport`
- [x] APIs externas: no aplica
- [x] UI: sin cambios en indicadores offline
- [x] Datos criticos: sin cambios en cache

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion

Este PRD es inherentemente sobre modularizacion. El objetivo es precisamente separar logica de negocio de componentes de layout.

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services (no inline en componentes de layout) -- este es el objetivo principal
- [ ] Componentes nuevos son reutilizables fuera del contexto actual de layout (SettingRow, AccountSection, NotificationsSection, QuestionInput)
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] Props explicitas en vez de dependencias implicitas a contextos de layout
- [ ] Cada prop de accion (onClick, onSelect, onNavigate) tiene un handler real especificado -- nunca noop `() => {}`
- [ ] `useOptimisticLikes` reutilizable entre BusinessComments y BusinessQuestions (misma interfaz)
- [ ] Hooks co-localizados (useQuestionThreads) documentados como especificos del componente

---

## Success Criteria

1. Ningun archivo `.tsx`/`.ts` en `src/components/` supera 400 lineas despues del refactoring
2. BusinessComments y BusinessQuestions bajan a <250 lineas cada uno
3. SettingsPanel baja a <200 lineas
4. `useOptimisticLikes` es compartido entre BusinessComments y BusinessQuestions (sin duplicacion)
5. Todos los tests existentes pasan sin modificaciones (zero behavioral changes)
6. Cobertura >= 80% en los hooks nuevos extraidos
