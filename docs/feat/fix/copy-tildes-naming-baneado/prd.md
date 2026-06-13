# PRD: Tech debt copy — tildes faltantes y naming baneado (¡Sorpresa!)

**Feature:** copy-tildes-naming-baneado
**Categoria:** fix
**Fecha:** 2026-06-09
**Issue:** #346
**Prioridad:** Media (severidad MEDIUM en el issue; label `enhancement`)

---

## Contexto

El audit `/health-check` detecto 3 regresiones de copy en `new-home` que violan las convenciones de copywriting del proyecto (espanol argentino con tildes, voseo rioplatense, naming canonico) y el guard #309. Son cambios acotados de texto en 3 archivos, sin logica de negocio, pero uno de ellos (`CronCard`) requiere actualizar tambien las aserciones del test que validan el texto sin tilde.

## Problema

- `src/constants/messages/onboarding.ts:4` usa el termino **prohibido por guard #309 regla 3**: `surpriseSuccess` = `` `¡Sorpresa! Descubrí ${name}` ``. La superficie canonica es **"Sorprendeme"** (sin tilde, voseo). El toast es frecuente: se dispara en cada seleccion exitosa de `useSurpriseMe.ts:44`.
- `src/components/profile/helpGroups.tsx:74,88` usa **tuteo peninsular** `"Para ti"` en dos descripciones de ayuda, ademas con **mismatch contra la UI real**, que renderiza `"Para vos"` (`ForYouSection.tsx:51`). El usuario lee en la ayuda un nombre de seccion que no existe en pantalla.
- `src/components/admin/CronCard.tsx:48,52` tiene **tildes faltantes** en el panel admin: `Ultima ejecucion` → `Última ejecución`, `Duracion` → `Duración`. Las aserciones de `CronCard.test.tsx` (lineas 52, 86, 97, 108) asertan el texto SIN tilde, por lo que el fix de produccion rompe los tests si no se actualizan en el mismo cambio.

## Solucion

Tres ediciones de copy puntuales, alineadas con el guard #309 y el patron de copywriting (`docs/reference/patterns.md` > Copywriting). Ninguna toca logica: solo strings y aserciones de test que validan esos strings.

### S1 — Naming baneado en toast de onboarding

En `src/constants/messages/onboarding.ts`, reemplazar el valor de `surpriseSuccess` para eliminar el termino prohibido "Sorpresa" sin reintroducirlo. Sugerencia del issue: `` `¡Sorprendeme eligió ${name}!` ``. Debe respetar:

- Guard #309 regla 3: **no** puede contener `Sorpresa`, `Sorpréndeme` ni `Sorprendeme!` (con exclamacion pegada al naming). La forma canonica es `Sorprendeme` (sin tilde). El signo `!` de cierre va al final de la frase completa (`...eligió ${name}!`), no pegado al naming.
- Guard #309 regla 5: la frase es exclamativa, debe abrir con `¡` y cerrar con `!`.
- Guard #309 regla 1: voseo (`eligió`, 3ra persona, es correcto; la app "elige").
- El cambio es solo del valor de la constante: `useSurpriseMe.ts` ya consume `MSG_ONBOARDING.surpriseSuccess(pick.name)` y no necesita tocarse.

### S2 — Tuteo peninsular en helpGroups

En `src/components/profile/helpGroups.tsx`, reemplazar las dos ocurrencias de `"Para ti"` (lineas 74 y 88) por `"Para vos"`, alineando el texto de ayuda con el label real renderizado en `ForYouSection.tsx:51`. Mantiene la regla 1 de #309 (voseo) y cierra el mismatch ayuda↔UI. No se agregan ni quitan entradas del array `HELP_GROUPS` (sin impacto en el guard #311 de sincronizacion 1:1 con `features.md`, ya que el nombre de la seccion no cambia, solo se corrige el termino).

### S3 — Tildes faltantes en CronCard (admin) + tests

En `src/components/admin/CronCard.tsx`:

- Linea 48: `Ultima ejecucion:` → `Última ejecución:`
- Linea 52: `Duracion:` → `Duración:`

En `src/components/admin/__tests__/CronCard.test.tsx`, actualizar las 4 aserciones que asertan `Duracion:` sin tilde (lineas 52, 86, 97, 108) a `Duración:`. No hay asercion sobre "Ultima ejecucion" en el test actual, pero verificar al implementar que ninguna otra asercion (presente o futura) dependa del texto sin tilde.

> Nota: el path real del test es `src/components/admin/__tests__/CronCard.test.tsx` (no `src/components/admin/CronCard.test.tsx` como cita el issue).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — `surpriseSuccess` sin termino "Sorpresa" (onboarding.ts) | Alta | S |
| S2 — `"Para ti"` → `"Para vos"` x2 (helpGroups.tsx) | Media | S |
| S3 — Tildes `Última ejecución` / `Duración` (CronCard.tsx) | Media | S |
| S3b — Actualizar 4 aserciones `Duración:` en CronCard.test.tsx | Media | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Auditoria global de tildes/voseo en otros archivos no listados por el issue #346.
- Centralizar nuevos strings en `MSG_COMMON` (estos no superan el umbral de >= 2 call sites del guard #309 regla 4; `surpriseSuccess` ya esta centralizado).
- Cambiar el texto completo de las descripciones de ayuda mas alla de `"Para ti"` → `"Para vos"`.
- Modificar el comportamiento de `useSurpriseMe`, `CronCard` o `HelpSection` (solo strings).
- Agregar el diccionario de guard #309 al CI o tocar `scripts/guards/`.

---

## Tests

Politica `docs/reference/tests.md`: cambios de copy puro no requieren tests nuevos, pero S3 **rompe** tests existentes que asertan el texto sin tilde, asi que esas aserciones DEBEN actualizarse en el mismo cambio (no es test nuevo, es mantener verde el suite).

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/admin/__tests__/CronCard.test.tsx` | Update aserciones | Cambiar `Duración:` en las 4 aserciones (lineas 52, 86, 97, 108) para que matcheen el texto con tilde. Sin casos nuevos. |
| `src/hooks/useSurpriseMe.test.ts` | Verificar (no romper) | La asercion (linea 94) usa `MSG_ONBOARDING.surpriseSuccess(...)` (la constante, no un literal), por lo que sigue verde tras S1. Confirmar que no quede ningun literal `¡Sorpresa!` hardcodeado en el test. |

### Criterios de testing

- Suite `CronCard.test.tsx` verde tras el cambio (`npm run test:run -- CronCard`).
- Suite `useSurpriseMe.test.ts` verde sin modificaciones (asercion via constante).
- No se introducen tests nuevos: el codigo afectado es copy sin logica condicional (excepcion documentada en `tests.md` seccion 3).
- Cobertura global del repo no baja (no se agrega codigo nuevo, solo strings).

---

## Seguridad

Sin superficie de seguridad nueva. No hay endpoints, escrituras a Firestore, inputs de usuario, lecturas masivas ni cambios de rules. Son tres cadenas de texto estatico (dos en componentes, una en una constante de mensajes).

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Ninguna | N/A — solo strings estaticos, sin entrada de usuario ni I/O | N/A |

- [x] No escribe a Firestore — checklist de rules no aplica.
- [x] No agrega campos a `userSettings` — converters/defaults no aplican.
- [x] No lee datos — no habilita scraping.
- [x] El valor de `surpriseSuccess(name)` interpola `name`, que proviene de `pick.name` (dato estatico de `businesses.json`, no input de usuario). Sin riesgo de inyeccion. El toast lo renderiza MUI Snackbar como texto plano (no `dangerouslySetInnerHTML`).

---

## Deuda tecnica y seguridad

Este feature **resuelve** deuda de copy abierta y **previene** una regresion del guard #309 (que ya cerro #270/#282/#292/#309). No introduce deuda nueva.

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech debt" --state open --json number,title
```

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #346 (este) | resuelve | Cierra los 3 hallazgos del `/health-check` de copy |
| #309 (guard copy) | mitiga | Restaura el invariante del guard #309 (regla 2 tildes, regla 3 naming "Sorprendeme", regla 1 voseo). El detection pattern `R2-tildes-prohibidas` ya cubre `Sorpresa` y la forma sin tilde de `Última`/`Duración`/`ejecución` |
| #311 (guard help-docs) | no agravar | S2 no agrega/quita entradas de `HELP_GROUPS`, mantiene la sincronizacion 1:1 con `features.md` |

### Mitigacion incorporada

- Eliminar el termino baneado `Sorpresa` del codigo (cierra hit de `R2-tildes-prohibidas` / regla 3 del guard #309), sin reintroducir `Sorpréndeme` ni `Sorprendeme!`.
- Corregir tildes faltantes (`Última`, `ejecución`, `Duración`) detectables por el diccionario `always_tilded` del guard #309.
- Tras el cambio, correr `npm run guards -- --guard 309` para confirmar que el count de hits no sube (idealmente baja).

---

## Robustez del codigo

No hay hooks ni operaciones async nuevas. Solo edicion de strings.

### Checklist de hooks async

- [x] N/A — sin `useEffect`, sin async, sin `setState`. Solo strings.
- [x] No se exporta nada nuevo.
- [x] No se crea archivo en `src/hooks/`.
- [x] No se agregan keys de localStorage.
- [x] Ningun archivo supera 300/400 lineas (helpGroups.tsx ~270 lineas, sin crecer).
- [x] No se toca `logger.error`.

### Checklist de observabilidad

- [x] N/A — no hay Cloud Function trigger nuevo.
- [x] N/A — no hay service nuevo con queries.
- [x] N/A — no hay `trackEvent` nuevo (el `surprise_me` existente no cambia).

### Checklist offline

- [x] N/A — no hay formularios/dialogs que escriban a Firestore.
- [x] El toast `surpriseSuccess` ya se muestra en todos los environments (es `toast.success`, no envuelto en DEV).

### Checklist de documentacion

- [ ] No se agregan secciones de HomeScreen ni de `HELP_GROUPS`.
- [ ] No hay analytics events nuevos.
- [ ] No hay tipos nuevos.
- [ ] `docs/reference/features.md`: verificar que no mencione `"Para ti"` ni `¡Sorpresa!`; si lo hace, alinear (el guard #311 exige sincronizacion help↔features). Confirmar al implementar.
- [ ] `docs/reference/firestore.md`: sin cambios (no hay colecciones/campos).
- [ ] `docs/reference/patterns.md`: sin patrones nuevos.

---

## Offline

Sin flujos de datos. El toast de `useSurpriseMe` se dispara client-side a partir de datos estaticos (`allBusinesses`), funciona identico online y offline. `CronCard` y `helpGroups` son render estatico.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Ninguna | N/A | N/A — solo strings estaticos | N/A |

### Checklist offline

- [x] Reads de Firestore: ninguna involucrada.
- [x] Writes: ninguno.
- [x] APIs externas: ninguna.
- [x] UI: el toast funciona offline (datos estaticos).
- [x] Datos criticos: N/A.

### Esfuerzo offline adicional: S (cero)

---

## Modularizacion y % monolitico

Cambios puramente de copy. No se mueve logica, no se agregan imports cruzados, no se toca AppShell/SideMenu, no se crean contextos.

### Checklist modularizacion

- [x] No se agrega logica de negocio a componentes de layout.
- [x] Los strings ya viven en su capa correcta (`constants/messages/` para el toast; texto inline en el registry declarativo `helpGroups.tsx`, que es contenido especifico del feature por diseno #311; texto inline en `CronCard.tsx`, componente de dominio admin).
- [x] No se agrega `useState` a AppShell/SideMenu.
- [x] No se introducen dependencias implicitas a contextos de layout.
- [x] No hay props de accion nuevas (sin noop).
- [x] Ningun componente nuevo importa de `firebase/*`.
- [x] No se crea archivo en `src/hooks/`.
- [x] Ningun archivo supera 400 lineas.
- [x] No se agregan converters.
- [x] Los 3 archivos editados ya estan en su carpeta de dominio correcta (`constants/messages/`, `components/profile/`, `components/admin/`). No se toca `components/menu/`.
- [x] No se necesita estado global nuevo.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Solo strings; sin nuevos imports |
| Estado global | = | Sin estado nuevo |
| Firebase coupling | = | Sin Firebase |
| Organizacion por dominio | = | Archivos ya en su dominio |

---

## Accesibilidad y UI mobile

Sin nuevos elementos interactivos. Mejora de copy que beneficia a screen readers (texto correcto en espanol, naming consistente).

### Checklist de accesibilidad

- [x] No se agregan `IconButton` ni elementos clickables.
- [x] No cambia la semantica de ningun elemento.
- [x] Touch targets sin cambios.
- [x] Sin estados de carga nuevos.
- [x] Sin imagenes nuevas.
- [x] Sin formularios nuevos.

### Checklist de copy

- [x] Todos los textos en espanol con tildes correctas (`Última`, `ejecución`, `Duración`).
- [x] Voseo consistente: `"Para vos"` (no `"Para ti"`); naming `Sorprendeme` (no `Sorpresa`/`Sorpréndeme`).
- [x] Terminologia: se mantiene "comercios", "reseñas" (sin cambios en estos terminos).
- [x] Strings reutilizables centralizados: `surpriseSuccess` ya esta en `constants/messages/onboarding.ts`. Los textos de ayuda y admin son de un solo call site (no requieren centralizacion, regla 4 #309).
- [x] Mensajes accionables: N/A (no son mensajes de error).

---

## Success Criteria

1. El toast de "Sorprendeme" ya no contiene el termino prohibido `Sorpresa` (ni `Sorpréndeme` ni `Sorprendeme!`), y abre/cierra con `¡...!` segun guard #309 reglas 3 y 5.
2. Las descripciones de ayuda en `helpGroups.tsx` dicen `"Para vos"`, coincidiendo con el label real de `ForYouSection.tsx`.
3. `CronCard` muestra `Última ejecución:` y `Duración:` con tildes, y `CronCard.test.tsx` queda verde con las 4 aserciones actualizadas a `Duración:`.
4. `npm run test:run` pasa completo (CronCard + useSurpriseMe sin regresiones) y la cobertura global no baja.
5. `npm run guards -- --guard 309` no reporta hits nuevos para `Sorpresa`/tildes en estos archivos (idealmente reduce el count del baseline).


## Validacion Funcional (Gate Sofia)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-10
**Revisor:** Sofia (analista funcional)

**Observaciones clave (detalle completo incorporado a specs):** Solo hay 1 ocurrencia de 'Para ti' (helpGroups.tsx:74), no 2 (la 88 es 'Tus intereses'). SC#5 no testeable: el guard 309 tiene 27 violaciones preexistentes — reformular a 'las 3 rutas editadas no aparecen en el output del guard 309'. S2 ('Para ti') no tiene cobertura de guard (solo review manual).
