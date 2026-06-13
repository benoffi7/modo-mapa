# Specs: Tech debt — FANOUT_MAX_RECIPIENTS_PER_ACTION naming y semantica del batch commit

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-23

---

## Modelo de datos

No aplica. El cambio es puramente interno a Cloud Functions: un literal numerico extraido a constante local + ampliacion de JSDoc. No se crean ni modifican colecciones, documentos, indices, ni interfaces TypeScript.

## Firestore Rules

No aplica. El cambio no toca rules.

### Rules impact analysis

No aplica. No se agregan queries nuevas ni se modifican call-sites existentes de Firestore.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | No |

### Field whitelist check

No aplica. No se agregan ni modifican campos en documentos Firestore.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

`fanOutToFollowers` (ubicado en `functions/src/utils/fanOut.ts`) es la unica funcion afectada. **No se modifica su comportamiento runtime**: el cambio se limita a (a) sustituir un literal `500` por la constante nombrada `BATCH_COMMIT_MAX_OPS` y (b) ampliar JSDoc. Los triggers que la invocan (`onRatingCreated`, `onCommentCreated`, `onFavoriteCreated`) no se tocan.

## Seed Data

No aplica. El feature no introduce nuevas colecciones ni campos requeridos. `scripts/seed-admin-data.ts` y `scripts/seed-staging.ts` no se modifican.

## Componentes

No aplica. Feature de backend puro; no hay componentes React involucrados.

### Mutable prop audit

No aplica.

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| N/A | N/A | N/A | N/A | N/A |

## Textos de usuario

No aplica. El unico texto nuevo es JSDoc en ingles dentro de codigo de functions, consistente con el resto del archivo. No hay copy visible al usuario.

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| N/A | N/A | N/A |

## Hooks

No aplica. No se agregan ni modifican hooks React (el cambio es server-side, en Node).

## Servicios

No aplica. No hay servicios frontend tocados. El utility `fanOutToFollowers` en `functions/src/utils/fanOut.ts` ya existe; solo cambia su implementacion interna (un literal extraido a constante local) y JSDoc.

## Integracion

El cambio es local a dos archivos de `functions/src/`:

- `functions/src/constants/fanOut.ts`: ampliar JSDoc de `FANOUT_MAX_RECIPIENTS_PER_ACTION`.
- `functions/src/utils/fanOut.ts`: definir y exportar `BATCH_COMMIT_MAX_OPS = 500`; reemplazar el literal `500` en `if (count >= 500)` por la constante. Actualizar el comentario existente (`// Firestore batch hard cap is 500 writes; we write 2 per recipient`) para referenciar el nombre de la constante.

Ningun otro call-site del repo se toca. Los tests existentes (`fanOut.test.ts`, `fanOutBatch.test.ts`) siguen verdes sin modificaciones porque ninguno compara contra el literal `500` del batch commit.

### Preventive checklist

- [x] **Service layer**: No aplica (no hay componentes frontend involucrados).
- [x] **Duplicated constants**: `BATCH_COMMIT_MAX_OPS` es deliberadamente local a `functions/src/utils/fanOut.ts` (decision tomada en PRD, seccion S2). Si aparece el patron reutilizable cross-module, se promueve a `constants/firestore.ts` como follow-up separado — explicito en "Out of Scope" del PRD.
- [x] **Context-first data**: No aplica.
- [x] **Silent .catch**: No aplica. No se agrega ni modifica manejo de errores.
- [x] **Stale props**: No aplica.

## Tests

No se crean tests nuevos (cambio puramente de naming interno, sin logica nueva). La suite completa de `functions/` debe seguir verde.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/utils/fanOut.test.ts` | Sigue verde sin modificaciones. Ningun test compara contra el literal `500` del batch commit. Los tests que usan `FANOUT_MAX_RECIPIENTS_PER_ACTION` importan la constante, no el valor literal. | Existente (sin cambios) |
| `functions/src/__tests__/utils/fanOutBatch.test.ts` | Sigue verde sin modificaciones. El test verifica chunking de `getAll` contra `FANOUT_MAX_RECIPIENTS_PER_ACTION` (no contra el cap del batch commit). | Existente (sin cambios) |

## Analytics

No aplica. No se agregan eventos `trackEvent` nuevos. `trackFunctionTiming('fanOutToFollowers')` y `trackFunctionTiming('fanOutDedupBatch')` existentes se preservan sin cambios.

---

## Offline

No aplica. El fan-out corre exclusivamente en Cloud Functions (servidor). El cliente nunca invoca `fanOutToFollowers` directamente; es disparado por triggers de `onRatingCreated` / `onCommentCreated` / `onFavoriteCreated`. No hay flujo de datos cliente para evaluar.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

No aplica.

---

## Accesibilidad y UI mobile

No aplica. Feature sin UI.

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| N/A | N/A | N/A | N/A | N/A |

### Reglas

N/A.

## Textos y copy

No aplica. El unico texto que cambia es JSDoc tecnico en ingles (consistente con el resto del archivo de functions). No hay copy visible al usuario.

| Texto | Donde | Regla aplicada |
|-------|-------|----------------|
| N/A | N/A | N/A |

### Reglas de copy

N/A.

---

## Decisiones tecnicas

### 1. `BATCH_COMMIT_MAX_OPS` local al utility, no en `constants/fanOut.ts`

Se coloca la constante en el mismo archivo donde se usa (`functions/src/utils/fanOut.ts`) y se exporta para permitir su uso en tests si fuera necesario. Razon: el valor 500 es el **limite duro del SDK de Firestore**, no una decision de producto del dominio fan-out. Agruparlo junto a `FANOUT_MAX_RECIPIENTS_PER_ACTION` (que si es decision de producto) diluiria la diferencia semantica que este PRD busca clarificar.

**Alternativa considerada (descartada en PRD):** crear `functions/src/constants/firestore.ts` centralizado para constantes del SDK. Se descarto porque requeriria migrar otros 7+ call-sites del repo que usan el mismo literal `500` (`cleanupNotifications`, `cleanupActivityFeed`, `comments`, `moderation`, `featuredLists`, `admin/listItems`, `admin/menuPhotos`, `deleteUserData`) — cross-module churn fuera del scope XS de #320. Se deja como follow-up si el patron aparece nuevamente.

### 2. Mantener el nombre `FANOUT_MAX_RECIPIENTS_PER_ACTION`

Se decidio explicitamente **no renombrar** la constante. El nombre describe correctamente el cap semantico (destinatarios maximos de una accion de fan-out). El problema era solo de claridad en la relacion con el batch commit interno, que se resuelve con JSDoc ampliado + extraccion del literal. Renombrar tendria costo (rebase en otros PRs, ruido en git blame) sin beneficio adicional.

### 3. JSDoc explicita la relacion aritmetica 500 × 2 = 2 batches

Se incluye en el JSDoc de ambas constantes la relacion exacta: `FANOUT_MAX_RECIPIENTS_PER_ACTION` (500 recipients) × 2 writes por recipient = 1000 writes = exactamente 2 commits de `BATCH_COMMIT_MAX_OPS` writes. Esto deja trazabilidad para que un lector futuro entienda por que el batch se commitea a la mitad del proceso aunque el cap sea 500.

---

## Hardening de seguridad

### Firestore rules requeridas

No aplica. El cambio no toca rules.

### Rate limiting

No aplica. El cambio no modifica escrituras del usuario. `FANOUT_MAX_RECIPIENTS_PER_ACTION = 500` (ya existente) sigue siendo el guardrail contra fan-out con bases de seguidores patologicas — su valor no cambia.

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| N/A | N/A | N/A |

### Vectores de ataque mitigados

No aplica. El cambio es puramente documental y de nombres. Un actor malicioso no puede explotar un JSDoc ni la extraccion de un literal.

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| N/A | N/A | N/A |

---

## Deuda tecnica: mitigacion incorporada

Consultados issues abiertos con labels `security` y `tech debt`: ambas listas vinieron vacias (verificado en PRD, seccion Deuda tecnica). Unicos issues abiertos: #168 (bloqueado), #319, #320 (este mismo), #321. Ninguno solapa.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #312 (cerrado) | Claridad documental pendiente tras bajar el cap de 5000 a 500 | Fase 1, pasos 1-3 |
| #320 (este mismo) | Nombre + literal del batch commit confusos | Fase 1 completo |

No se agrava deuda existente: los dos archivos tocados tras el cambio siguen debajo del threshold de 400 lineas (`fanOut.ts` ~175 tras cambio; `constants/fanOut.ts` ~30 tras cambio).

---

## Validacion Tecnica

**Arquitecto**: Diego
**Fecha**: 2026-04-23
**Ciclo**: 1
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos

Sin BLOQUEANTES. Sin IMPORTANTES. Dos OBSERVACIONES menores.

### Observaciones técnicas para el plan

- **OBS Diego #1 — JSDoc existente contradice al nuevo**: El JSDoc actual en `functions/src/constants/fanOut.ts:10-14` dice "500 = 250 recipients × 2 writes each (feed + dedup) stays within one Firestore batch limit". El nuevo JSDoc según el PRD dice "500 recipients × 2 writes = 1000 writes = 2 batches". Ambos son incompatibles. El plan debe **reemplazar completo** el JSDoc, no extenderlo. Pablo verificar.

- **OBS Diego #2 — Alcance del find-and-replace**: El plan debe ser explícito: solo tocar el literal `500` en la condición `if (count >= 500)` y la prosa del comentario inmediato en `functions/src/utils/fanOut.ts:158`. NO tocar el literal `500` que aparecerá dentro del JSDoc descriptivo del propio `BATCH_COMMIT_MAX_OPS` ("500 ops per batch" — texto descriptivo que debe conservarse).

### Claims verificados contra codebase

- `functions/src/constants/fanOut.ts:15` tiene `FANOUT_MAX_RECIPIENTS_PER_ACTION = 500`.
- `functions/src/utils/fanOut.ts:158` tiene `if (count >= 500)` con comentario adjacente.
- `BATCH_COMMIT_MAX_OPS` no existe todavía (namespace libre).
- Ningún test depende del literal `500` (solo string decorativo en `fanOutBatch.test.ts:133`).
- `patterns.md:110` efectivamente tiene "Batch writes de 500" — target del update.

### Listo para pasar a plan?

Sí con observaciones para que Pablo las incorpore al criterio de validación del plan.
