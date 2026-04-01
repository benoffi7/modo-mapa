# Specs: #292-#294 — Copy, Dark Mode y Code Quality

**Issues:** #292 Copy, #293 Dark Mode, #294 Code Quality
**Fecha:** 2026-04-01

---

## Alcance

Tres fixes mecánicos sin cambios de modelo de datos ni reglas de Firestore:

| Issue | Tipo | Alcance |
|-------|------|---------|
| #292 | Copy | 13 tildes faltantes, voseo inconsistente, 3 strings hardcodeados |
| #293 | Dark mode | `'white'`/`'black'`/`rgba` hardcodeados → tokens MUI |
| #294 | Code quality | 30 `logger.error` silenciados en prod, campo `id` faltante en `DailyMetrics` |

---

## Modelo de datos

No hay cambios de colecciones Firestore. El único cambio de tipo es en `src/types/admin.ts`:

```ts
// Antes — falta el campo id que el converter ya serializa (snap.id)
export interface DailyMetrics extends PublicMetrics {
  dailyReads: number;
  // ...
}

// Después — agregar el campo id
export interface DailyMetrics extends PublicMetrics {
  id: string;           // <- campo nuevo (snap.id del converter)
  dailyReads: number;
  // ...
}
```

El `dailyMetricsConverter` en `src/config/adminConverters.ts` ya asigna `date: snap.id`. El campo `id` es un alias semántico del documento Firestore; no hay escrituras nuevas. Una vez agregado al tipo, el cast `as unknown as Record<string, unknown>` en `PerformancePanel.tsx:52` se puede eliminar.

## Firestore Rules

Sin cambios. Este fix no agrega queries ni escribe nuevos campos.

### Rules impact analysis

No aplica — no hay queries nuevas.

### Field whitelist check

No aplica — no hay campos nuevos escritos en Firestore.

## Cloud Functions

Sin cambios.

## Seed Data

Sin cambios de esquema — no se requiere seed.

---

## Componentes

### #292 — Copy fixes

#### `src/components/business/RecommendDialog.tsx`

Líneas 84 y 89:

| Texto actual | Texto correcto |
|-------------|----------------|
| `"Alcanzaste el limite de {N} recomendaciones por dia"` | `"Alcanzaste el límite de {N} recomendaciones por día"` |
| `"Busca un usuario para recomendarle este comercio"` | `"Buscá un usuario para recomendarle este comercio"` |

Ambos strings se mueven a `MSG_SOCIAL` (ver sección Servicios/Constantes).

#### `src/components/common/DiscardDialog.tsx`

Línea 22:

| Texto actual | Texto correcto |
|-------------|----------------|
| `"Tenes texto sin enviar. Si cerras, se va a perder."` | `"Tenés texto sin enviar. Si cerrás, se va a perder."` |

Se mueve a `MSG_COMMON` como `discardWarning`.

#### `src/components/social/ActivityFeedItem.tsx`

`TYPE_LABELS` (líneas 15-19):

| Clave | Valor actual | Valor correcto |
|-------|-------------|----------------|
| `rating` | `'califico'` | `'calificó'` |
| `comment` | `'comento en'` | `'comentó en'` |
| `favorite` | `'agrego a favoritos'` | `'agregó a favoritos'` |

#### `src/constants/messages/common.ts`

| Campo | Valor actual | Valor correcto |
|-------|-------------|----------------|
| `editError` | `'No se pudo guardar la edicion'` | `'No se pudo guardar la edición'` |

Agregar nuevo campo:
```ts
discardWarning: 'Tenés texto sin enviar. Si cerrás, se va a perder.',
```

#### `src/components/business/MenuPhotoUpload.tsx`

Línea 147 (atributo `title` del botón Enviar):

| Texto actual | Texto correcto |
|-------------|----------------|
| `'Requiere conexion'` | `'Requiere conexión'` |

#### `src/components/business/ShareButton.tsx`

Línea 41 — reemplazar string hardcodeado por constante existente:

```ts
// Antes
message="Link copiado"

// Después — MSG_LIST.linkCopied ya contiene "Link copiado"
import { MSG_LIST } from '../../constants/messages';
message={MSG_LIST.linkCopied}
```

#### `src/components/business/BusinessComments.tsx` y `src/components/profile/CommentsList.tsx`

Líneas con `deleteMessage: 'Comentario eliminado'` — mover a `MSG_COMMENT.deleteSuccess`.

Agregar a `src/constants/messages/comment.ts`:
```ts
deleteSuccess: 'Comentario eliminado',
```

Consumidores a actualizar:
- `src/components/business/BusinessComments.tsx:50`
- `src/components/profile/CommentsList.tsx:63`
- `src/components/business/CommentRow.tsx:104` (label de comentario eliminado)

#### Admin copy (prioridad LOW — strings admin-only)

- `src/components/admin/audit/AuditKpiCards.tsx:35` — `"Tasa de exito"` → `"Tasa de éxito"`
- `src/components/admin/audit/AuditKpiCards.tsx:45` — `"Ultima eliminacion"` → `"Última eliminación"`
- `src/components/admin/audit/DeletionAuditPanel.tsx:140` — `"Sin registros de eliminacion."` → `"Sin registros de eliminación."`

Estos son JSX inline en panel admin; no requieren extracción a constantes (uso único, contexto admin).

### #293 — Dark mode token fixes

#### `src/components/business/MenuPhotoViewer.tsx`

| Línea | Antes | Después |
|-------|-------|---------|
| 46 | `bgcolor: 'black'` | `bgcolor: 'common.black'` |
| 49 | `color: 'white'` | `color: 'common.white'` |
| 66 | `color: 'white'` | `color: 'common.white'` |

#### `src/components/business/MenuPhotoSection.tsx`

| Línea | Antes | Después |
|-------|-------|---------|
| 99 | `color: 'white'` | `color: 'common.white'` |

Nota: Las líneas 96-105 ya usan `alpha(theme.palette.common.black, ...)` y `alpha(theme.palette.common.white, ...)` correctamente mediante callback de tema — esas líneas no requieren cambio.

#### `src/components/map/BusinessMarker.tsx`

| Línea | Antes | Después |
|-------|-------|---------|
| 51 | `borderColor={isSelected ? '#fff' : color}` | `borderColor={isSelected ? theme.palette.common.white : color}` |
| 52 | `glyphColor="#fff"` | `glyphColor={theme.palette.common.white}` |

Requiere importar `useTheme` de `@mui/material/styles`.

#### `src/components/map/MapView.tsx`

| Línea | Antes | Después |
|-------|-------|---------|
| 131 | `` bgcolor: (theme) => `rgba(${theme.palette.mode === 'dark' ? '30,30,30' : '255,255,255'},0.95)` `` | `bgcolor: 'background.paper'` |

`background.paper` ya tiene semántica correcta en ambos modos (oscuro/claro) y no necesita alpha manual para este caso de uso (overlay de "sin resultados").

#### `src/components/home/ForYouSection.tsx`

| Línea | Antes | Después |
|-------|-------|---------|
| 16-22 | `color: 'rgba(255,255,255,0.8)'` en cada icono | Extraer a constante local `ICON_COLOR = 'rgba(255,255,255,0.8)'` o inline `alpha(theme.palette.common.white, 0.8)` |
| 47 | `const bgColor = CATEGORY_COLORS[cat] ?? '#546e7a'` | `const bgColor = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other` — verificar que `CATEGORY_COLORS` tiene un fallback definido en `src/constants/business.ts`; si no, agregar la constante `DEFAULT_CATEGORY_COLOR = '#546e7a'` en ese archivo |

Para los iconos: el `rgba(255,255,255,0.8)` se aplica sobre un fondo de color sólido (no el tema), por lo que es semánticamente correcto. Se centraliza como constante local para evitar repetición:

```ts
const CATEGORY_ICON_COLOR = 'rgba(255,255,255,0.8)' as const;
```

### #294 — Code quality fixes

#### `src/utils/logger.ts`

Sin cambios. El logger ya implementa el comportamiento correcto: en prod, `logger.error` llama `captureToSentry`. El problema es que los call sites lo envuelven en `if (import.meta.env.DEV)`, neutralizando la captura Sentry.

#### `src/types/admin.ts`

Agregar `id: string` a `DailyMetrics`:

```ts
export interface DailyMetrics extends PublicMetrics {
  id: string;
  dailyReads: number;
  dailyWrites: number;
  dailyDeletes: number;
  writesByCollection: Record<string, number>;
  readsByCollection: Record<string, number>;
  deletesByCollection: Record<string, number>;
  activeUsers: number;
  newAccounts?: number;
}
```

#### `src/config/adminConverters.ts`

Actualizar `dailyMetricsConverter.fromFirestore` para incluir `id`:

```ts
return {
  id: snap.id,   // <- agregar
  date: snap.id, // mantener para compatibilidad con código existente
  // ...resto sin cambios
};
```

#### `src/components/admin/PerformancePanel.tsx`

Eliminar el cast `as unknown as Record<string, unknown>` (línea 52) una vez que `DailyMetrics` tenga el campo `id`.

#### Los 30 call sites de `logger.error` con guard DEV

Patrón a reemplazar en cada archivo:

```ts
// Antes
if (import.meta.env.DEV) logger.error('mensaje:', err);

// Después
logger.error('mensaje:', err);
```

Lista completa de archivos (30 ocurrencias):

| Archivo | Ocurrencias |
|---------|-------------|
| `src/hooks/useBusinessData.ts` | 2 |
| `src/hooks/useAsyncData.ts` | 1 |
| `src/hooks/useFollow.ts` | 2 |
| `src/hooks/useUserSearch.ts` | 1 |
| `src/hooks/useCommentListBase.ts` | 2 |
| `src/hooks/usePaginatedQuery.ts` | 1 |
| `src/services/users.ts` | 1 |
| `src/context/NotificationsContext.tsx` | 1 |
| `src/context/AuthContext.tsx` | 4 |
| `src/components/admin/AbuseAlerts.tsx` | 2 |
| `src/components/admin/alerts/ReincidentesView.tsx` | 2 |
| `src/components/social/ReceivedRecommendations.tsx` | 2 |
| `src/components/profile/FeedbackForm.tsx` | 1 |
| `src/components/business/BusinessQuestions.tsx` | 1 |
| `src/components/business/BusinessTags.tsx` | 1 |
| `src/components/business/FavoriteButton.tsx` | 1 |
| `src/components/business/BusinessComments.tsx` | 2 |
| `src/components/business/RecommendDialog.tsx` | 2 |
| `src/components/business/MenuPhotoUpload.tsx` | 1 |
| **Total** | **30** |

---

## Textos de usuario

| Texto | Donde se usa | Regla aplicada |
|-------|-------------|----------------|
| `"Alcanzaste el límite de {N} recomendaciones por día"` | `RecommendDialog` Alert | tilde en límite y día |
| `"Buscá un usuario para recomendarle este comercio"` | `RecommendDialog` Typography | voseo |
| `"Tenés texto sin enviar. Si cerrás, se va a perder."` | `DiscardDialog` DialogContentText | voseo |
| `"calificó"` | `ActivityFeedItem` TYPE_LABELS | tilde en ó |
| `"comentó en"` | `ActivityFeedItem` TYPE_LABELS | tilde en ó |
| `"agregó a favoritos"` | `ActivityFeedItem` TYPE_LABELS | tilde en ó |
| `"No se pudo guardar la edición"` | `MSG_COMMON.editError` | tilde en ó |
| `"Requiere conexión"` | `MenuPhotoUpload` button title | tilde en ó |
| `"Tasa de éxito"` | `AuditKpiCards` (admin) | tilde en é |
| `"Última eliminación"` | `AuditKpiCards` (admin) | tilde en Ú y ó |
| `"Sin registros de eliminación."` | `DeletionAuditPanel` (admin) | tilde en ó |
| `"Comentario eliminado"` | `MSG_COMMENT.deleteSuccess` (nuevo) | sin cambio de texto |

---

## Hooks

Sin hooks nuevos ni modificados.

---

## Servicios

Sin servicios modificados. Los cambios son:

- `src/constants/messages/common.ts` — agregar `discardWarning`
- `src/constants/messages/comment.ts` — agregar `deleteSuccess`
- `src/constants/business.ts` — verificar/agregar `DEFAULT_CATEGORY_COLOR` si no existe

---

## Integración

### #292 — Consumidores de constantes nuevas

| Constante nueva | Archivo consumidor | Cambio |
|----------------|-------------------|--------|
| `MSG_COMMON.discardWarning` | `DiscardDialog.tsx` | importar y usar |
| `MSG_COMMON.editError` (corrección) | ya importado en consumidores existentes | solo el valor cambia |
| `MSG_COMMENT.deleteSuccess` | `BusinessComments.tsx`, `CommentsList.tsx`, `CommentRow.tsx` | usar en lugar de string literal |
| `MSG_LIST.linkCopied` | `ShareButton.tsx` | importar y usar |
| Corrección TYPE_LABELS | `ActivityFeedItem.tsx` | cambio in-file |

### Preventive checklist

- [x] **Service layer**: No hay nuevas importaciones de `firebase/firestore` en componentes
- [x] **Duplicated constants**: `MSG_LIST.linkCopied` ya existe — se reusa, no se duplica
- [x] **Context-first data**: No aplica
- [x] **Silent .catch**: Los 30 call sites silenciados se desenmascaran. No se agrega ningún `.catch(() => {})` nuevo
- [x] **Stale props**: No aplica (no hay componentes nuevos con props mutables)

---

## Tests

No se requieren tests nuevos para este fix. Los cambios son:

- Strings: verificables visualmente / lint
- Token de color: verificable visualmente
- `logger.error` sin guard: el comportamiento en DEV es idéntico (la función ya hacía `console.error` en DEV de todas formas); en prod ahora llama Sentry. El test de `logger.ts` existente cubre esto.
- `DailyMetrics.id`: el tipo ya se serializa desde `snap.id` en el converter; el fix solo alinea el tipo.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/utils/logger.test.ts` (si existe) | Verificar que `logger.error` llama `captureToSentry` en prod | unit |

---

## Analytics

Sin cambios de analytics.

---

## Offline

Sin impacto offline. Todos los cambios son de presentación o logging.

---

## Accesibilidad y UI mobile

Sin componentes interactivos nuevos. Los cambios de token de color no afectan accesibilidad (los tokens `common.white`/`common.black` tienen el mismo valor en todos los temas).

---

## Decisiones técnicas

### #292 — Alcance de centralización de strings

Se centraliza `'Comentario eliminado'` en `MSG_COMMENT.deleteSuccess` porque tiene 3 consumidores activos. `'Link copiado'` se redirige a `MSG_LIST.linkCopied` ya existente. Los strings de admin (`AuditKpiCards`, `DeletionAuditPanel`) se corrigen inline sin extracción porque tienen un único consumidor y son UI interna.

### #293 — `bgcolor: 'background.paper'` en MapView

El overlay "sin resultados" en `MapView` necesita contrastar con el mapa. `background.paper` proporciona el color correcto en ambos modos sin hard-coding. Alternativa descartada: `alpha(theme.palette.background.paper, 0.95)` — innecesaria porque `background.paper` ya es opaco.

### #293 — ForYouSection icon color

`rgba(255,255,255,0.8)` sobre fondo de color de categoría es semánticamente correcto (no depende del modo claro/oscuro). Se centraliza como constante local `CATEGORY_ICON_COLOR` para eliminar 7 repeticiones sin cambiar el comportamiento.

### #294 — Solo `logger.error`, no `logger.warn`

El issue #294 especifica explícitamente que `logger.warn` y `logger.log` deben permanecer silenciados en prod (son ruido operacional). Solo `logger.error` debe fluir a Sentry. Esta distinción ya existe en `logger.ts`; el fix es únicamente en los call sites que neutralizaban el comportamiento correcto.

---

## Hardening de seguridad

No aplica — estos fixes no introducen superficies de escritura nuevas ni colecciones nuevas.

---

## Deuda técnica: mitigación incorporada

```bash
gh issue list --label "tech debt" --state open --json number,title
```

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #294 | 30 `logger.error` silenciados en prod pierden captura Sentry | Fase 2 |
| #294 | `DailyMetrics` type gap fuerza cast `as unknown as` | Fase 3 |
