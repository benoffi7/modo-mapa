# Specs: Tech debt copy — tildes faltantes y naming baneado (¡Sorpresa!)

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-10
**Issue:** #346

---

## Resumen

Tres ediciones de copy puntuales detectadas por el `/health-check`, alineadas con el guard #309 y el patron de copywriting (`docs/reference/patterns.md` > Copywriting). Ninguna toca logica de negocio: solo strings estaticos y las aserciones de test que validan esos strings.

| Cambio | Archivo | Tipo |
|--------|---------|------|
| S1 — naming baneado `Sorpresa` | `src/constants/messages/onboarding.ts:4` | string en constante |
| S2 — tuteo `"Para ti"` → `"Para vos"` (1 ocurrencia) | `src/components/profile/helpGroups.tsx:74` | string inline |
| S3 — tildes faltantes | `src/components/admin/CronCard.tsx:48,52` | strings inline |
| S3b — aserciones `Duración:` | `src/components/admin/__tests__/CronCard.test.tsx:52,86,97,108` | test assertions |

> **Correccion de scope (Sofia, VALIDADO CON OBSERVACIONES):** S2 tiene **1** sola ocurrencia de `"Para ti"` en `helpGroups.tsx:74`. La linea 88 dice `"Tus intereses"` (NO `"Para ti"`). El PRD original mencionaba 2 ocurrencias; se reduce a 1.

---

## Modelo de datos

Sin cambios. No hay colecciones, documentos, campos ni indexes nuevos. No se tocan tipos de `src/types/`.

## Firestore Rules

Sin cambios. No hay escrituras ni lecturas nuevas.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|------------|-------------|--------------------|-------------------|
| N/A — feature de copy puro, sin queries | — | — | — | No |

### Field whitelist check

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio de rule? |
|-----------|----------------------|----------------------|--------------------------------------|-----------------|
| N/A — sin escrituras | — | — | — | No |

## Cloud Functions

Sin cambios. No hay triggers, scheduled ni callables nuevos.

## Seed Data

N/A. No se crean colecciones ni se agregan campos requeridos a colecciones existentes. Seccion omitida por inaplicable.

## Componentes

No se crean componentes nuevos. Se modifican strings inline en dos componentes existentes:

### `helpGroups.tsx` (modificado — solo string)

- Ubicacion: `src/components/profile/helpGroups.tsx`.
- Cambio: en la `description` del item `id: 'inicio'` (linea 74), reemplazar la unica ocurrencia de `Sección "Para ti"` por `Sección "Para vos"`.
- Rationale: el label real renderizado en `src/components/home/ForYouSection.tsx` es `"Para vos"`. La ayuda referenciaba un nombre de seccion que no existe en pantalla (`"Para ti"`, tuteo peninsular).
- Sin cambios en el array `HELP_GROUPS` (no se agregan/quitan items → no afecta guard #311 de sincronizacion 1:1 con `features.md`).
- **No tocar** las apariciones validas del termino canonico `Sorprendeme` en las lineas 74 y 79-81 (ya estan correctas, sin tilde y voseo).

### `CronCard.tsx` (modificado — solo strings)

- Ubicacion: `src/components/admin/CronCard.tsx`.
- Cambio linea 48: `Ultima ejecucion: {formatRelativeTime(...)}` → `Última ejecución: {formatRelativeTime(...)}`.
- Cambio linea 52: `Duracion: {formatDuration(...)}` → `Duración: {formatDuration(...)}`.
- Componente de dominio admin; render estatico, sin logica condicional nueva.

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| N/A — ningun componente editable nuevo | — | — | No | — |

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `¡Sorprendeme eligió ${name}!` | toast `toast.success` en `useSurpriseMe.ts` (via `MSG_ONBOARDING.surpriseSuccess`) | naming canonico `Sorprendeme` (sin tilde, regla 3 #309); abre `¡` cierra `!` (regla 5); `eligió` con tilde |
| `Para vos` | `description` del item `inicio` en `helpGroups.tsx:74` | voseo (regla 1 #309); coincide con label de `ForYouSection.tsx` |
| `Última ejecución:` | label en `CronCard.tsx:48` (panel admin) | tildes en `Última` y `ejecución` (regla 2 #309) |
| `Duración:` | label en `CronCard.tsx:52` (panel admin) | tilde en `Duración` (regla 2 #309) |

## Hooks

Sin cambios. `useSurpriseMe.ts` ya consume `MSG_ONBOARDING.surpriseSuccess(pick.name)` y **no se toca** — el cambio es solo del valor de la constante.

## Servicios

Sin cambios. No hay servicios involucrados.

## Constantes (modificado — solo string)

### `src/constants/messages/onboarding.ts`

Cambiar el valor de `surpriseSuccess`:

```ts
// Antes (linea 4):
surpriseSuccess: (name: string) => `¡Sorpresa! Descubrí ${name}`,
// Despues:
surpriseSuccess: (name: string) => `¡Sorprendeme eligió ${name}!`,
```

Restricciones de guard #309 que debe respetar el nuevo valor:
- **Regla 3 (naming):** no contiene `Sorpresa`, `Sorpréndeme`, ni `Sorprendeme!` (con `!` pegado al naming). La forma canonica es `Sorprendeme` (sin tilde). El `!` de cierre va al final de la frase completa (`...${name}!`), no pegado al naming.
- **Regla 5 (exclamativas):** abre con `¡` y cierra con `!`.
- **Regla 1 (voseo):** `eligió` (3ra persona, la app elige) es correcto.
- **Regla 4 (centralizacion):** ya esta centralizado; sin cambios de estructura.

## Integracion

El cambio de `surpriseSuccess` se propaga automaticamente a `useSurpriseMe.ts:44` (consume la constante). No hay cambios de firma ni de call sites. Los cambios de `helpGroups.tsx` y `CronCard.tsx` son strings inline sin propagacion.

### Preventive checklist

- [x] **Service layer**: ningun componente importa `firebase/firestore` para escrituras (no aplica, sin escrituras).
- [x] **Duplicated constants**: no se definen arrays/objetos nuevos. `surpriseSuccess` sigue centralizado.
- [x] **Context-first data**: no hay `getDoc` nuevo.
- [x] **Silent .catch**: no se agrega ningun `.catch`.
- [x] **Stale props**: no hay componente que reciba props y mute esa data.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/components/admin/__tests__/CronCard.test.tsx` | Actualizar las 4 aserciones `Duracion:` (lineas 52, 86, 97, 108) → `Duración:` para que matcheen el texto con tilde. Sin casos nuevos. | Update aserciones |
| `src/hooks/useSurpriseMe.test.ts` | **Verificar (no romper):** la asercion de linea 94 usa `MSG_ONBOARDING.surpriseSuccess(...)` (la constante, no un literal), por lo que sigue verde tras S1. Confirmar que no quede ningun literal `¡Sorpresa!` hardcodeado. **No requiere edicion.** | Verificacion |

**Mock strategy:** sin cambios. `CronCard.test.tsx` ya mockea `formatRelativeTime`; las aserciones de duracion usan el `formatDuration` real (no mockeado). El cambio de tilde es solo en el prefijo del label, no en el formato del valor.

**Criterio de aceptacion:**
- Suite `CronCard` verde: `npm run test:run -- CronCard`.
- Suite `useSurpriseMe` verde sin modificaciones.
- No se introducen tests nuevos (copy sin logica condicional — excepcion documentada en `tests.md` seccion "Politica de Testing" > Excepciones).
- Cobertura global del repo no baja (no se agrega codigo nuevo, solo strings).

## Analytics

Sin cambios. El evento `surprise_me` existente no se modifica.

---

## Offline

Sin flujos de datos. El toast de `useSurpriseMe` se dispara client-side a partir de datos estaticos (`allBusinesses`), funciona identico online y offline. `CronCard` y `helpGroups` son render estatico.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A — solo strings estaticos | — | — | — |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Ninguna | — | — |

### Fallback UI

Ninguno. El toast `surpriseSuccess` ya se muestra en todos los environments (`toast.success`, no envuelto en `import.meta.env.DEV`).

---

## Accesibilidad y UI mobile

Sin nuevos elementos interactivos. Mejora de copy que beneficia a screen readers (texto correcto en espanol, naming consistente).

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| N/A — sin elementos interactivos nuevos | — | — | — | — |

### Reglas
- [x] No se agregan `<IconButton>`.
- [x] No se introduce `<Typography onClick>`.
- [x] No cambian touch targets.
- [x] No hay componentes con fetch nuevos.
- [x] No hay `<img>` con URL dinamica nueva.

## Textos y copy

| Texto | Donde | Regla aplicada |
|-------|-------|----------------|
| `¡Sorprendeme eligió ${name}!` | toast en `useSurpriseMe.ts` (via constante) | naming canonico (regla 3), exclamativa `¡...!` (regla 5), tilde en `eligió` (regla 2) |
| `Para vos` | `helpGroups.tsx:74` (descripcion ayuda) | voseo (regla 1) |
| `Última ejecución:` | `CronCard.tsx:48` (admin) | tildes (regla 2) |
| `Duración:` | `CronCard.tsx:52` (admin) | tilde (regla 2) |

### Reglas de copy aplicadas
- Voseo: `Para vos` (no `Para ti`). Naming `Sorprendeme` (no `Sorpresa`/`Sorpréndeme`).
- Tildes obligatorias: `Última`, `ejecución`, `Duración`, `eligió`.
- Terminologia "comercios"/"reseñas" sin cambios.
- `surpriseSuccess` ya centralizado en `src/constants/messages/onboarding.ts`. Los textos de ayuda y admin son de un solo call site → no requieren centralizacion (regla 4 #309).

---

## Success Criteria (reformulados — Sofia)

1. El toast de "Sorprendeme" ya no contiene el termino prohibido `Sorpresa` (ni `Sorpréndeme` ni `Sorprendeme!`), y abre/cierra con `¡...!` (guard #309 reglas 3 y 5).
2. La descripcion de ayuda del item `inicio` en `helpGroups.tsx:74` dice `Sección "Para vos"`, coincidiendo con el label real de `ForYouSection.tsx:51`.
3. `CronCard` muestra `Última ejecución:` y `Duración:` con tildes, y `CronCard.test.tsx` queda verde con las **4 aserciones `Duración:`** actualizadas (lineas 52, 86, 97, 108).
4. `npm run test:run` pasa completo (CronCard + useSurpriseMe sin regresiones) y la cobertura global no baja.
5. **(reformulado)** Tras el fix, **ninguna de las 3 rutas editadas** (`onboarding.ts:4`, `helpGroups.tsx:74`, `CronCard.tsx:48,52`) aparece en el output de `npm run guards -- --guard 309`. NO se exige count global 0: el guard tiene **27 violaciones preexistentes fuera de scope** que este feature no toca. El criterio es la ausencia de estas 3 rutas en el output, no un baseline limpio.

> **Nota sobre la cobertura de S2:** el cambio `"Para ti"` → `"Para vos"` **no tiene cobertura de guard** (el #309 R2 detecta tildes faltantes y naming baneado via diccionario, pero NO tiene regla de deteccion de tuteo peninsular `"Para ti"`). S2 se valida **solo por review manual** (confirmado por Sofia). Por eso S2 no figura en el SC#5 reformulado: solo S1 (`onboarding.ts:4`) y S3 (`CronCard.tsx:48,52`) son verificables por el guard 309.

## Decisiones tecnicas

1. **Forma del naming en S1.** Se elige `¡Sorprendeme eligió ${name}!` (sugerencia del issue ligeramente ajustada). El `!` de cierre va al final de la frase, NO pegado al naming, para no disparar la variante prohibida `Sorprendeme!` del guard #309 regla 3. La forma canonica `Sorprendeme` (sin tilde) coincide con el title del item `sorprendeme` en `helpGroups.tsx:79` y con la accion rapida del Inicio.

2. **No se toca `useSurpriseMe.ts`.** El hook consume la constante; cambiar el valor centralizado es suficiente. Evita propagacion innecesaria y mantiene `useSurpriseMe.test.ts:94` verde via la constante (no via literal). **El fix de S1 NO rompe `useSurpriseMe.test.ts`** porque la asercion compara contra `MSG_ONBOARDING.surpriseSuccess(...)` (resuelve dinamicamente el nuevo valor), no contra un literal `¡Sorpresa!`.

3. **S2 = 1 sola ocurrencia (correccion de scope de Sofia).** El PRD original citaba 2 ocurrencias de `"Para ti"` en `helpGroups.tsx` (lineas 74 y 88). **Verificado: solo hay 1**, en la linea 74 (dentro de la `description` del item `inicio`, en `Sección "Para ti"`). La linea 88 dice `"Tus intereses"`, NO `"Para ti"`. Tambien hay un `"Para ti"` en un comentario de codigo en `useTabNavigation.ts:8`, pero NO es user-facing y queda **fuera de scope**. S2 edita exactamente 1 string.

4. **S2 sin cobertura de guard.** No existe regla de tuteo en el guard #309 (solo voseo positivo via diccionario, sin deteccion de `"Para ti"`). El cambio `"Para ti"` → `"Para vos"` se valida **solo por review manual** (confirmado por Sofia). No es regresion automatizable. Por eso queda excluido del SC#5.

5. **Aserciones de test como parte del mismo cambio (S3b).** El fix de produccion de `CronCard` (S3) rompe `CronCard.test.tsx` porque las aserciones asertan `Duracion:` sin tilde. Actualizar las **4 aserciones `Duración:`** (lineas 52, 86, 97, 108) en el mismo commit NO es agregar tests nuevos: es mantener el suite verde (politica `tests.md`). No hay asercion sobre `Ultima ejecucion` en el test actual (verificado: el test solo aserta `Duracion:` en esas 4 lineas).

---

## Hardening de seguridad

Sin superficie de seguridad nueva. Son tres cadenas de texto estatico (dos en componentes, una en constante de mensajes).

### Firestore rules requeridas

Ninguna. No hay escrituras ni lecturas.

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| N/A — sin escrituras | — | — |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Inyeccion via `name` interpolado en `surpriseSuccess(name)` | `name` proviene de `pick.name` (dato estatico de `businesses.json`, no input de usuario); MUI Snackbar lo renderiza como texto plano (no `dangerouslySetInnerHTML`) | `useSurpriseMe.ts` / `onboarding.ts` |

- [x] No escribe a Firestore.
- [x] No lee datos (no habilita scraping).
- [x] No agrega campos a colecciones.

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #346 (este) | Cierra los 3 hallazgos del `/health-check` de copy | Fases 1-3 |
| #309 (guard copy) | Elimina la regresion: termino baneado `Sorpresa` (regla 3) + tildes faltantes `Última`/`ejecución`/`Duración` (regla 2). Detectables por `R2-tildes-prohibidas` | Fases 1 y 3 |
| #311 (guard help-docs) | No agravar: S2 no agrega/quita entradas de `HELP_GROUPS`, mantiene la sincronizacion 1:1 con `features.md` | Fase 2 |

No introduce deuda nueva.

---

## Validacion Tecnica

(pendiente — sello de Diego)

## Revisión Técnica (Gate Diego)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Revisor:** Diego (solution architect)

**Observaciones:** Cobertura PRD→specs completa y verificada contra código (onboarding.ts:4, helpGroups.tsx:74 con 1 sola ocurrencia de "Para ti", CronCard.tsx:48,52, CronCard.test.tsx:52/86/97/108, useSurpriseMe.ts:44 y .test.ts:94 que aserta vía constante). Sin superficie de data model / rules / functions / offline. Patrones respetados (constante en constants/messages/, strings inline en componentes de dominio). Observaciones que el plan DEBE respetar: (1) las 4 aserciones de CronCard.test.tsx usan `getByText('Duracion: <valor>')` como string completo — deben editarse como string completo (`'Duración: 5.0s'`, `'Duración: 150ms'`, `'Duración: 250ms'`, `'Duración: 12.5s'`), no solo el prefijo, o el match rompe. (2) En helpGroups.tsx:74 cambiar ÚNICAMENTE `Sección "Para ti"` → `Sección "Para vos"`; NO tocar los términos canónicos `Sorprendeme` presentes en la misma línea. (3) S2 sin cobertura de guard (validación solo por review manual, confirmado). (4) S3 y S3b deben ir en el mismo commit para no dejar el suite en rojo.
