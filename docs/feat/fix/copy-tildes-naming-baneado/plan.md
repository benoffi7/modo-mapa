# Plan de implementación: Copy — tildes faltantes y naming baneado (¡Sorpresa!) (#346)

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-12

> Basado en `specs.md` (VALIDADO CON OBSERVACIONES por Diego, 2026-06-12) y `prd.md` (VALIDADO CON OBSERVACIONES por Sofia, 2026-06-10).

---

## Estrategia y staging de riesgo

Feature de copy puro: tres ediciones de strings estáticos, ninguna toca lógica de negocio. Las fases se ordenan de menor a mayor acoplamiento con tests. S1 y S2 son cambios aislados de string sin tests asociados; S3+S3b se agrupan en un solo commit porque el fix de producción rompe el suite si no se actualizan las aserciones en simultáneo (observación 3 de Diego).

| Fase | Riesgo | Notas |
|------|--------|-------|
| F1 — Naming baneado en `onboarding.ts` (S1) | Bajo | Solo valor de constante; consumidor vía constante, sin propagación |
| F2 — Tuteo en `helpGroups.tsx` (S2) | Bajo | 1 string inline; sin cobertura de guard (review manual) |
| F3 — Tildes en `CronCard.tsx` + tests (S3+S3b) | Bajo | Producción y test en el MISMO commit para no dejar el suite en rojo |

**Branch:** `fix/346-copy-tildes-naming-baneado`

---

## Fase 1 — Naming baneado en toast de onboarding (S1)

- **Archivo:** `src/constants/messages/onboarding.ts` (línea 4).
- **Cambio:** reemplazar el valor de `surpriseSuccess`:
  ```ts
  // Antes:
  surpriseSuccess: (name: string) => `¡Sorpresa! Descubrí ${name}`,
  // Después:
  surpriseSuccess: (name: string) => `¡Sorprendeme eligió ${name}!`,
  ```
- **Restricciones (guard #309):** sin `Sorpresa`/`Sorpréndeme`/`Sorprendeme!` (el `!` cierra la frase completa, no pegado al naming — regla 3); abre `¡` y cierra `!` (regla 5); `eligió` con tilde (regla 2).
- **No tocar** `src/hooks/useSurpriseMe.ts`: consume `MSG_ONBOARDING.surpriseSuccess(pick.name)` (línea 44) y se propaga automáticamente.
- **File ownership:** `src/constants/messages/onboarding.ts` (único archivo de esta fase).
- **Test:** ninguno nuevo. Verificar que `src/hooks/useSurpriseMe.test.ts:94` sigue verde — la aserción compara contra `MSG_ONBOARDING.surpriseSuccess(...)` (la constante, no un literal `¡Sorpresa!`). Confirmar que no quede ningún literal `¡Sorpresa!` hardcodeado en el test.
  - `npm run test:run -- useSurpriseMe` → verde sin editar el test.
- **Commit:** `fix(#346): eliminar naming baneado "Sorpresa" del toast surpriseSuccess`
- **Rollback:** revert del único archivo.

## Fase 2 — Tuteo peninsular en helpGroups (S2)

- **Archivo:** `src/components/profile/helpGroups.tsx` (línea 74).
- **Cambio:** dentro de la `description` del item `id: 'inicio'`, reemplazar **únicamente** `Sección "Para ti"` → `Sección "Para vos"`.
  - **Observación 2 de Diego (respetar):** NO tocar los términos canónicos `Sorprendeme` presentes en la MISMA línea 74; el reemplazo se acota exactamente al substring `Para ti` → `Para vos`.
- **Alcance:** 1 sola ocurrencia (corrección de scope de Sofia). La línea 88 dice `"Tus intereses"`, NO `"Para ti"` — no se toca. El `"Para ti"` en comentario de `useTabNavigation.ts:8` es fuera de scope (no user-facing).
- **No se agregan/quitan items** de `HELP_GROUPS` → sin impacto en guard #311 (sincronización 1:1 con `features.md`).
- **File ownership:** `src/components/profile/helpGroups.tsx` (único archivo de esta fase).
- **Test:** ninguno. S2 no tiene cobertura de guard (#309 no detecta tuteo peninsular) → validación **solo por review manual** (observación 3 de Diego / decisión Sofia). Validar visualmente que la ayuda del item `inicio` ahora referencia `"Para vos"`, coincidiendo con `ForYouSection.tsx:51`.
- **Commit:** `fix(#346): alinear ayuda "Para ti" -> "Para vos" en helpGroups (voseo + match UI)`
- **Rollback:** revert del único archivo.

## Fase 3 — Tildes faltantes en CronCard (admin) + aserciones (S3 + S3b)

> **Observación 3 de Diego (respetar):** S3 (producción) y S3b (test) van en el **MISMO commit**. El fix de producción rompe el suite porque las aserciones asertan el texto sin tilde; agruparlos evita dejar el suite en rojo entre commits.

### Paso 1 — Producción (S3)

- **Archivo:** `src/components/admin/CronCard.tsx`.
- **Cambios:**
  - Línea 48: `Ultima ejecucion: {formatRelativeTime(...)}` → `Última ejecución: {formatRelativeTime(...)}`.
  - Línea 52: `Duracion: {formatDuration(...)}` → `Duración: {formatDuration(...)}`.

### Paso 2 — Tests (S3b, mismo commit)

- **Archivo:** `src/components/admin/__tests__/CronCard.test.tsx`.
- **Cambio:** actualizar las 4 aserciones `getByText(...)`. **Observación 1 de Diego (respetar):** son strings COMPLETOS, no solo el prefijo. Editar el string entero:
  - Línea 52: `'Duracion: 5.0s'` → `'Duración: 5.0s'`
  - Línea 86: `'Duracion: 150ms'` → `'Duración: 150ms'`
  - Línea 97: `'Duracion: 250ms'` → `'Duración: 250ms'`
  - Línea 108: `'Duracion: 12.5s'` → `'Duración: 12.5s'`
- **No hay aserción sobre `Ultima ejecucion`** en el test actual (verificado: solo `Duracion:` en esas 4 líneas). No se agregan casos nuevos.

- **File ownership:** `src/components/admin/CronCard.tsx` + `src/components/admin/__tests__/CronCard.test.tsx` (ambos en el mismo commit).
- **Test:** `npm run test:run -- CronCard` → verde con las 4 aserciones actualizadas.
- **Commit (único, ambos archivos):** `fix(#346): tildes en CronCard (Última ejecución / Duración) + aserciones`
- **Rollback:** revert del commit (restaura producción y test juntos, manteniendo el suite verde).

---

## Orden de implementación

1. **F1** — `src/constants/messages/onboarding.ts` (independiente; valida `useSurpriseMe.test.ts` no rompe).
2. **F2** — `src/components/profile/helpGroups.tsx` (independiente; review manual).
3. **F3** — `src/components/admin/CronCard.tsx` + `__tests__/CronCard.test.tsx` (mismo commit; valida suite `CronCard`).

Las tres fases son independientes entre sí (archivos disjuntos). El orden es indicativo; F3 es la única con acoplamiento producción↔test que obliga a commit atómico.

---

## Test plan global

- **F1:** `npm run test:run -- useSurpriseMe` → verde SIN editar el test (aserción vía constante).
- **F3:** `npm run test:run -- CronCard` → verde con las 4 aserciones `Duración:` actualizadas.
- **Global:** `npm run test:run` completo verde; cobertura global no baja (no se agrega código nuevo, solo strings).
- **Guard:** `npm run guards -- --guard 309` → ninguna de las 3 rutas editadas (`onboarding.ts:4`, `helpGroups.tsx:74`, `CronCard.tsx:48,52`) aparece en el output. NO se exige count global 0 (hay 27 violaciones preexistentes fuera de scope — SC#5 reformulado por Sofia). S2 (`Para ti`) NO es verificable por guard → review manual.
- **Lint/build:** `npm run lint` sin errores; build verde.

---

## Rollback global

Tres commits independientes y revertibles. F3 es el único commit que toca producción + test juntos: su revert restaura ambos en simultáneo, manteniendo el suite verde. No hay migraciones, datos, ni cambios de rules que revertir.

---

## Guardrails (verificación)

### Modularidad
- [x] Ningún componente importa `firebase/firestore` directamente (no se toca Firebase).
- [x] Archivos en su carpeta de dominio correcta (`constants/messages/`, `components/profile/`, `components/admin/`). No se toca `components/menu/`.
- [x] Sin lógica de negocio nueva en componentes; solo strings.
- [x] Ningún archivo supera 400 líneas (`helpGroups.tsx` ~270, sin crecer).
- [x] No se crea archivo en `src/hooks/`; no se agrega estado global.

### Seguridad
- [x] Sin colecciones/escrituras/lecturas nuevas → no aplica `hasOnly()`, rate limits ni rules.
- [x] `name` interpolado en `surpriseSuccess` proviene de `pick.name` (dato estático de `businesses.json`); MUI Snackbar lo renderiza como texto plano. Sin inyección.
- [x] Sin secrets ni credenciales en archivos commiteados.

### Observabilidad
- [x] Sin CF triggers, services con queries, ni `trackEvent` nuevos (el evento `surprise_me` no cambia).
- [x] No se toca `logger.error`.

### Accesibilidad y UI
- [x] Sin `<IconButton>`, `<Typography onClick>`, touch targets, estados de carga ni `<img>` nuevos.
- [x] Mejora de copy beneficia a screen readers (texto correcto en español).

### Copy
- [x] Voseo: `Para vos` (no `Para ti`); naming `Sorprendeme` (no `Sorpresa`/`Sorpréndeme`).
- [x] Tildes: `Última`, `ejecución`, `Duración`, `eligió`.
- [x] `surpriseSuccess` ya centralizado en `constants/messages/`. Textos de ayuda y admin son de 1 solo call site (no requieren centralización — regla 4 #309).

---

## Fase final — Documentación

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Verificar que no mencione `"Para ti"` ni `¡Sorpresa!`; si lo hace, alinear a `"Para vos"` / nuevo toast (guard #311 exige sincronización help↔features). Confirmar al implementar. |

Filas eliminadas por no aplicar: `security.md` (sin rules/auth), `firestore.md` (sin colecciones/campos), `patterns.md` (sin patrones nuevos), `project-reference.md` (sin feature visible nuevo), `HelpSection.tsx` (comportamiento sin cambios; solo el copy de `helpGroups.tsx` que ya se edita en F2).

---

## Riesgos

1. **Match parcial en aserciones de test (F3).** `getByText` usa string completo (`'Duración: 5.0s'`, etc.); editar solo el prefijo `Duracion:` → `Duración:` sin el valor rompería el match. **Mitigación:** editar los 4 strings completos según observación 1 de Diego (valores confirmados: `5.0s`, `150ms`, `250ms`, `12.5s`).
2. **Re-introducción de término baneado en F1.** Usar `Sorprendeme!` (con `!` pegado) o `Sorpréndeme` volvería a disparar #309. **Mitigación:** forma exacta `¡Sorprendeme eligió ${name}!` (validada en specs decisión técnica 1).
3. **Edición fuera de scope en F2.** `replace_all` o un match laxo podría tocar los `Sorprendeme` canónicos de la línea 74 o el `"Tus intereses"` de la 88. **Mitigación:** reemplazo acotado al substring exacto `Sección "Para ti"` → `Sección "Para vos"` (observación 2 de Diego).

---

## Criterios de done

- [ ] S1: toast sin `Sorpresa`/`Sorpréndeme`/`Sorprendeme!`, con `¡...!` (SC#1).
- [ ] S2: ayuda del item `inicio` dice `Sección "Para vos"` (SC#2, review manual).
- [ ] S3+S3b: `CronCard` muestra `Última ejecución:` y `Duración:`; las 4 aserciones `Duración:` verdes (SC#3).
- [ ] `npm run test:run` completo verde; cobertura no baja (SC#4).
- [ ] Las 3 rutas editadas no aparecen en `npm run guards -- --guard 309` (SC#5 reformulado).
- [ ] `npm run lint` sin errores; build verde.
- [ ] `docs/reference/features.md` verificado/alineado si referenciaba copy viejo.

---

## Validacion de Plan

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO
**Fecha:** 2026-06-12
**Ciclo:** 1

**Observaciones para el implementador:** F3 (CronCard.tsx) y F3b (CronCard.test.tsx) van en el MISMO commit — no separar, o el suite queda en rojo entre commits (las 4 aserciones `getByText` usan string completo: `'Duración: 5.0s'`, `'Duración: 150ms'`, `'Duración: 250ms'`, `'Duración: 12.5s'`; editar prefijo + valor, no solo el prefijo). F1/F2/F3 tienen archivos disjuntos: si se paraleliza (luna/nico) no hay overlap, pero F1 toca `src/constants/messages/onboarding.ts` — usar Edit (patrón aditivo de constantes), nunca Write. La fila de documentación (`features.md`) es verificación defensiva: grep confirmó que hoy no menciona `"Para ti"` ni `¡Sorpresa!`, así que probablemente sea no-op — confirmar al implementar, no asumir cambio. S2 sin cobertura de guard #309: validar por review manual que `helpGroups.tsx:74` queda `Sección "Para vos"` sin tocar los `Sorprendeme` canónicos ni `"Tus intereses"` de la misma descripción. El pre-push (tsc + vite build) y el guard 309 (ausencia de las 3 rutas editadas, no count global 0) deben correr antes del merge.
