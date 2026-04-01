# Plan: #292-#294 — Copy, Dark Mode y Code Quality

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-01

---

## Fases de implementación

### Fase 1: Copy — tildes, voseo, strings centralizados (#292)

**Branch:** `fix/292-294-copy-darkmode-quality`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/messages/common.ts` | Corregir `editError`: `'edicion'` → `'edición'`. Agregar `discardWarning: 'Tenés texto sin enviar. Si cerrás, se va a perder.'` |
| 2 | `src/constants/messages/comment.ts` | Agregar `deleteSuccess: 'Comentario eliminado'` |
| 3 | `src/components/common/DiscardDialog.tsx` | Usar `MSG_COMMON.discardWarning` en lugar del string inline |
| 4 | `src/components/business/RecommendDialog.tsx` | Corregir `'limite'`→`'límite'`, `'dia'`→`'día'` en el Alert. Corregir `'Busca'`→`'Buscá'` en Typography. Extraer a constantes en `MSG_SOCIAL` (si hay slot disponible) o dejar inline corregido |
| 5 | `src/components/social/ActivityFeedItem.tsx` | Corregir `TYPE_LABELS`: `'califico'`→`'calificó'`, `'comento en'`→`'comentó en'`, `'agrego a favoritos'`→`'agregó a favoritos'` |
| 6 | `src/components/business/MenuPhotoUpload.tsx` | Corregir `title` del botón: `'Requiere conexion'`→`'Requiere conexión'` |
| 7 | `src/components/business/ShareButton.tsx` | Reemplazar `message="Link copiado"` por `message={MSG_LIST.linkCopied}`. Agregar import de `MSG_LIST` |
| 8 | `src/components/business/BusinessComments.tsx` | Reemplazar `deleteMessage: 'Comentario eliminado'` por `deleteMessage: MSG_COMMENT.deleteSuccess`. Verificar import de `MSG_COMMENT` |
| 9 | `src/components/profile/CommentsList.tsx` | Reemplazar `message: 'Comentario eliminado'` por `MSG_COMMENT.deleteSuccess`. Verificar import |
| 10 | `src/components/business/CommentRow.tsx` | Reemplazar `'Comentario eliminado'` (label inline) por `MSG_COMMENT.deleteSuccess`. Verificar import |
| 11 | `src/components/admin/audit/AuditKpiCards.tsx` | Corregir JSX inline: `"Tasa de exito"`→`"Tasa de éxito"`, `"Ultima eliminacion"`→`"Última eliminación"` |
| 12 | `src/components/admin/audit/DeletionAuditPanel.tsx` | Corregir JSX inline: `"Sin registros de eliminacion."`→`"Sin registros de eliminación."` |

### Fase 2: Dark mode — reemplazar tokens hardcodeados (#293)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/MenuPhotoViewer.tsx` | L46: `'black'`→`'common.black'`. L49: `'white'`→`'common.white'`. L66: `'white'`→`'common.white'` |
| 2 | `src/components/business/MenuPhotoSection.tsx` | L99: `color: 'white'`→`color: 'common.white'` (dentro de `sx` del IconButton) |
| 3 | `src/components/map/BusinessMarker.tsx` | Agregar `import { useTheme } from '@mui/material/styles'`. Usar `theme.palette.common.white` para `borderColor` y `glyphColor` en el componente `Pin` |
| 4 | `src/components/map/MapView.tsx` | L131: reemplazar el callback `bgcolor: (theme) => \`rgba(${...},0.95)\`` por `bgcolor: 'background.paper'` |
| 5 | `src/components/home/ForYouSection.tsx` | Definir `const CATEGORY_ICON_COLOR = 'rgba(255,255,255,0.8)' as const` arriba del componente. Reemplazar las 7 ocurrencias de `'rgba(255,255,255,0.8)'` en `CATEGORY_ICONS`. Reemplazar `'#546e7a'` fallback por constante: verificar `CATEGORY_COLORS` en `src/constants/business.ts` — si tiene fallback/default, usarlo; si no, agregar `DEFAULT_CATEGORY_COLOR = '#546e7a'` ahí y referenciarlo |

### Fase 3: Code quality — logger.error y DailyMetrics (#294)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/admin.ts` | Agregar `id: string` a `DailyMetrics` (primera propiedad del interface) |
| 2 | `src/config/adminConverters.ts` | En `dailyMetricsConverter.fromFirestore`, agregar `id: snap.id` al objeto retornado (junto al `date: snap.id` ya existente) |
| 3 | `src/components/admin/PerformancePanel.tsx` | Eliminar cast `as unknown as Record<string, unknown>` en L52. `dailyMetrics[0]` ya es `DailyMetrics | undefined` con el tipo corregido |
| 4 | `src/hooks/useBusinessData.ts` | Remover guard `if (import.meta.env.DEV)` de las 2 llamadas a `logger.error` |
| 5 | `src/hooks/useAsyncData.ts` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |
| 6 | `src/hooks/useFollow.ts` | Remover guard `if (import.meta.env.DEV)` de las 2 llamadas a `logger.error` |
| 7 | `src/hooks/useUserSearch.ts` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |
| 8 | `src/hooks/useCommentListBase.ts` | Remover guard `if (import.meta.env.DEV)` de las 2 llamadas a `logger.error` |
| 9 | `src/hooks/usePaginatedQuery.ts` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |
| 10 | `src/services/users.ts` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |
| 11 | `src/context/NotificationsContext.tsx` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |
| 12 | `src/context/AuthContext.tsx` | Remover guard `if (import.meta.env.DEV)` de las 4 llamadas a `logger.error` |
| 13 | `src/components/admin/AbuseAlerts.tsx` | Remover guard `if (import.meta.env.DEV)` de las 2 llamadas a `logger.error` |
| 14 | `src/components/admin/alerts/ReincidentesView.tsx` | Remover guard `if (import.meta.env.DEV)` de las 2 llamadas a `logger.error` |
| 15 | `src/components/social/ReceivedRecommendations.tsx` | Remover guard `if (import.meta.env.DEV)` de las 2 llamadas a `logger.error` |
| 16 | `src/components/profile/FeedbackForm.tsx` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |
| 17 | `src/components/business/BusinessQuestions.tsx` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |
| 18 | `src/components/business/BusinessTags.tsx` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |
| 19 | `src/components/business/FavoriteButton.tsx` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |
| 20 | `src/components/business/BusinessComments.tsx` | Remover guard `if (import.meta.env.DEV)` de las 2 llamadas a `logger.error` (además del paso de MSG_COMMENT de Fase 1) |
| 21 | `src/components/business/RecommendDialog.tsx` | Remover guard `if (import.meta.env.DEV)` de las 2 llamadas a `logger.error` |
| 22 | `src/components/business/MenuPhotoUpload.tsx` | Remover guard `if (import.meta.env.DEV)` de la llamada a `logger.error` |

### Fase final: Documentación

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar nota en sección de logging: "`logger.error` nunca debe envolverse en `if (import.meta.env.DEV)` — rompe la captura Sentry en prod" |
| 2 | `docs/reference/features.md` | Sin cambios (no hay funcionalidad visible nueva) |
| 3 | `docs/reference/project-reference.md` | Actualizar versión y fecha |

---

## Orden de implementación

1. `src/constants/messages/common.ts` — constante base para DiscardDialog
2. `src/constants/messages/comment.ts` — constante base para consumidores
3. `src/types/admin.ts` — tipo base para PerformancePanel
4. `src/config/adminConverters.ts` — depende de (3)
5. Resto de componentes de Fase 1 en cualquier orden (sin dependencias entre sí)
6. Fase 2 (dark mode) en cualquier orden
7. Fase 3 pasos 3-22 (logger.error) en cualquier orden (independientes)
8. `src/components/admin/PerformancePanel.tsx` — depende de (3) y (4)

---

## Estimación de tamaño de archivos resultantes

| Archivo | Líneas actuales | Líneas estimadas | Riesgo |
|---------|----------------|-----------------|--------|
| `src/constants/messages/common.ts` | 9 | 11 | ninguno |
| `src/constants/messages/comment.ts` | 11 | 12 | ninguno |
| `src/types/admin.ts` | 210 | 211 | ninguno |
| `src/config/adminConverters.ts` | ~130 | 131 | ninguno |
| `src/components/business/RecommendDialog.tsx` | 141 | 141 | ninguno (cambio inline) |
| `src/components/common/DiscardDialog.tsx` | 35 | 36 | ninguno |
| `src/components/social/ActivityFeedItem.tsx` | 48 | 48 | ninguno (cambio inline) |
| `src/components/home/ForYouSection.tsx` | 91 | 93 | ninguno |
| `src/components/map/BusinessMarker.tsx` | 61 | 64 | ninguno |
| `src/components/map/MapView.tsx` | 147 | 144 | ninguno (se simplifica) |
| `src/components/business/MenuPhotoViewer.tsx` | 88 | 88 | ninguno |
| `src/components/admin/PerformancePanel.tsx` | ~200 | ~199 | ninguno |

Ningún archivo supera 400 líneas.

---

## Riesgos

1. **`BusinessMarker` con `useTheme`**: el componente es `memo`. Agregar `useTheme` introduce una subscripción al tema que podría causar re-renders en cambios de tema. Mitigación: extraer los valores de color a variables estables fuera del componente si el tema no cambia en runtime (en Modo Mapa el tema se fija al inicio). Si hay dudas, usar `Pin` con valores hardcodeados `'#ffffff'` solo para `glyphColor` (blanco puro es invariante) y `common.white` solo para `borderColor` via `useTheme`.

2. **`MSG_COMMENT.deleteSuccess` en tests**: los tests en `useCommentListBase.test.ts` y `useUndoDelete.test.ts` comparan con el string literal `'Comentario eliminado'`. Después del refactor, estos tests deben importar `MSG_COMMENT.deleteSuccess` para la comparación, o se romperán. Mitigación: actualizar los test files como parte de la Fase 1.

3. **`DailyMetrics.id` y `date`**: el converter ya asigna `date: snap.id`. Agregar `id: snap.id` es redundante pero necesario para limpiar el cast. Verificar que ningún consumidor externo dependa de que `id` esté ausente del tipo (improbable, los tipos solo sirven en TypeScript).

---

## Guardrails de modularidad

- [x] Ningún componente nuevo importa `firebase/firestore` directamente
- [x] No hay archivos nuevos — todos son modificaciones a archivos existentes
- [x] Lógica de negocio permanece en hooks/services
- [x] Se resuelve deuda de #294 sin agravar otras deudas
- [x] Ningún archivo resultante supera 400 líneas

## Guardrails de seguridad

No aplica a este fix (sin colecciones nuevas, sin campos nuevos en Firestore).

## Guardrails de accesibilidad y UI

- [x] No hay `<IconButton>` nuevos sin `aria-label`
- [x] No hay `<Typography onClick>` nuevos
- [x] Cambios de color son puramente cosméticos
- [x] No hay fetches nuevos sin error state

## Guardrails de copy

- [x] Todos los textos corregidos usan voseo (Buscá, Tenés, cerrás)
- [x] Tildes agregadas en todos los casos identificados
- [x] Terminología consistente: "comercios" (RecommendDialog mantiene esta terminología)
- [x] `MSG_COMMENT.deleteSuccess` y `MSG_COMMON.discardWarning` centralizados

---

## Criterios de done

- [ ] Los 13 textos corregidos pasan revisión visual
- [ ] Los 3 strings hardcodeados usan constantes existentes
- [ ] `MenuPhotoViewer`, `MenuPhotoSection`, `BusinessMarker`, `MapView` no tienen `'white'`/`'black'`/`rgba` hardcodeados
- [ ] `ForYouSection` usa constante local `CATEGORY_ICON_COLOR`
- [ ] `grep -rn "import.meta.env.DEV.*logger.error" src/` devuelve 0 resultados
- [ ] `DailyMetrics` tiene campo `id: string`
- [ ] `PerformancePanel.tsx` no tiene cast `as unknown as`
- [ ] Tests de `useCommentListBase` y `useUndoDelete` actualizados con `MSG_COMMENT.deleteSuccess`
- [ ] `npm run lint` sin errores
- [ ] Build (`npm run build`) sin errores
- [ ] `docs/reference/patterns.md` actualizado con nota de logging
