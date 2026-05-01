# PRD: Help-docs — outdated BusinessDetailScreen tabs + missing items en HelpSection

**Feature:** 328-help-docs-tabs-missing-items
**Categoria:** content
**Fecha:** 2026-04-29
**Issue:** #328
**Prioridad:** Media

---

## Contexto

`HelpSection` es la guia in-app de la app y vive en el registry declarativo `src/components/profile/helpGroups.tsx` (patron HELP_GROUPS extraido en #311). Un health-check del `help-docs-reviewer` el 2026-04-25 detecto que el item `comercio` describe la version pre-#318 del business sheet (dos pestañas Info / Opiniones) cuando la realidad actual es `BusinessDetailScreen` con 5 chip tabs sticky (Criterios / Precio / Tags / Foto / Opiniones) en `/comercio/:id` mas un sheet compacto con CTA "Ver detalles". El mismo health-check encontro otros items desactualizados (`buscar` no menciona `MapErrorBoundary` auto-fallback de #304, `social` puede tener Recomendaciones mal ubicado), features sin item dedicado en Ayuda (Sorprendeme, Tus intereses tanto en Home como en Perfil, Estadisticas, confirmacion al salir con cambios sin guardar, Pull-to-refresh transversal), y un copy pass pendiente sobre `helpGroups.tsx` (tildes faltantes en strings legacy).

## Problema

- El item `comercio` desinforma al usuario sobre la nueva pantalla de detalle: dice "Dos pestañas: Info y Opiniones" cuando en realidad son **5 chip tabs en una pantalla full** con URL canonica deep-linkeable (`/comercio/:id?tab=`) y un sheet compacto con CTA "Ver detalles". El uso de la palabra "pestañas" en dos niveles distintos (los 5 chip tabs de la pantalla full + las sub-pestañas Comentarios/Preguntas dentro del tab Opiniones) puede ser confuso si no se distingue copy explicitamente.
- Capabilities entregadas (Sorprendeme, Tus intereses tanto en Home como en Perfil, Estadisticas en ProfileScreen, confirmacion al salir con cambios sin guardar via `DiscardDialog`, MapErrorBoundary auto-fallback, Pull-to-refresh transversal) no estan documentadas en Ayuda — viola la regla 1:1 del guard #311.
- Strings legacy en `helpGroups.tsx` tienen faltantes de tildes/acentos (rapidas, categoria, Seccion, leidas, direccion, ubicacion, semanticos) que rompen el voseo argentino prolijo establecido en guard #309.

## Solucion

### S1 — Reescribir item `comercio`

Actualizar el item para reflejar `BusinessDetailScreen` post-#318/#319:

- Sheet compacto (50dvh): header con nombre, accion rapida, **CTA "Ver detalles"** que abre la pantalla full.
- Pantalla full en `/comercio/:id`: 5 chip tabs sticky (Criterios, Precio, Tags, Foto, Opiniones). URL deep-linkeable con `?tab=criterios|precio|tags|foto|opiniones`. Restore al volver via `sessionStorage`.
- Dentro del tab Opiniones existen **sub-pestañas internas** Comentarios / Preguntas con threads, likes y "Mejor respuesta". El copy debe distinguir explicitamente los **5 chip tabs** (nivel pantalla) de las **sub-pestañas** internas (nivel tab Opiniones), para evitar ambiguedad sobre "pestañas" en dos niveles. Sugerencia: hablar de "las 5 secciones (chips)" para el nivel exterior y "sub-pestañas Comentarios y Preguntas" para el nivel interior.
- Conservar el dato actual sobre limite 20/dia compartido entre comentarios y preguntas (cubierto por test existente).
- Conservar mencion a offline queue para acciones del comercio (ratings, comentarios, favoritos).

### S2 — Actualizar item `buscar`

Agregar mencion explicita al fallback automatico via `MapErrorBoundary` (#304):

> "Si el mapa no carga (Maps API caida o sin conexion), la app cambia automaticamente a vista de lista para que sigas buscando."

### S3 — Verificar item `social` y `recomendaciones`

`SocialScreen.tsx` confirma que las 4 sub-tabs (Actividad, Seguidos, Recomendaciones, Rankings) viven en la pestaña Social. El item `social` actual ya lo describe correctamente — **el hallazgo del health-check #3 esta resuelto**. Conservar el copy actual y solo aplicar el copy pass general (S7).

### S4 — Aclarar `Recientes` en item `listas`

El componente real es `RecentsUnifiedTab` (sub-tab de Listas) que **unifica visitas implicitas (localStorage de los ultimos comercios abiertos) con check-ins explicitos (Firestore via `useMyCheckIns`)**. La descripcion actual implica solo el localStorage de 20 visitados. Reescribir para reflejar la unificacion real:

> "Recientes (historial unificado: comercios visitados localmente + tus check-ins de Firestore, deduplicados por comercio, con la fecha mas reciente)"

### S5 — Items nuevos a agregar

Agregar entradas al registry `HELP_GROUPS`. Cada id sigue la convencion snake_case minusculas exigida por el guard #311 (regex `[a-z-]+` en el script CI-friendly de `docs/reference/guards/311-help-docs.md`):

| Item nuevo | Grupo | Razon |
|-----------|-------|-------|
| `sorprendeme` | Inicio | Capability con boton dedicado en QuickActions y `useSurpriseMe` hook. Ya esta tracked en `ga4FeatureDefinitions.ts`. Va en grupo Inicio porque es accesible desde QuickActions del Home. |
| `tus_intereses_home` | Inicio | `YourInterestsSection` en HomeScreen (`src/components/home/YourInterestsSection.tsx`): **feed de descubrimiento** que muestra comercios filtrados por los tags seguidos. Empty state con sugerencias. Item describe el surface de descubrimiento. |
| `tus_intereses_perfil` | Perfil | `InterestsSection` en ProfileScreen (`src/components/profile/InterestsSection.tsx`): **gestion de tags seguidos** (agregar/quitar tags, ver sugerencias). Se accede desde el boton "Tus intereses" en ProfileScreen (`ProfileScreen.tsx` L173-183). Item describe el surface de gestion. |
| `estadisticas` | Perfil | Sub-pantalla `StatsView` accesible desde ProfileScreen tap en card de estadisticas (`ProfileScreen.tsx` L29 lazy import, L60 union de activeSection, L101 `{activeSection === 'stats' && <StatsView />}`, L160 `onPlacesTap={() => setActiveSection('stats')}`). Distribucion de ratings/tags y top 10. **No es un tab de SideMenu**; vive en el flow Perfil → tap en stats. |
| `confirmacion_salir` | Buscar | Confirmacion al cerrar con cambios sin guardar (`useUnsavedChanges` + `DiscardDialog`). Aparece principalmente en flows de calificar / comentar / editar dentro del detalle de comercio. Va en grupo Buscar (proximidad temática al item `comercio`). Id elegido en lugar de `discard_dialog` para alinearlo con el tono actual del registry (snake_case en español, ej: `primeros_pasos`, `perfil_publico`). |
| `pull_to_refresh` | (no item dedicado) | **Decision producto:** integrarlo como mencion textual en los items existentes que ya lo soportan, en vez de un item separado. Items afectados (S5b abajo): `inicio`, `social`, `listas`, `notificaciones`. Es un gesto transversal, no una feature dedicada. |

#### S5a — Decision sobre separar `tus_intereses` en dos items

Existen dos componentes con la misma temática pero distinta función:
- `src/components/home/YourInterestsSection.tsx` — feed de descubrimiento (Home).
- `src/components/profile/InterestsSection.tsx` — gestion de tags (Perfil).

Documentarlos como un solo item dejaria ambiguo donde y como se usa cada surface. Por eso se separan en dos ids (`tus_intereses_home` y `tus_intereses_perfil`), uno por grupo, con descripciones que diferencian feed (descubrimiento) vs gestion (agregar/quitar). Esta decision se refleja en el guard #311 (S9 abajo): la lista de "items clave" del guard incluye ambos ids.

#### S5b — Mencion de `pull_to_refresh` en items existentes

En vez de un item separado (descartado por ser un gesto transversal y no una feature autocontenida), agregar una linea breve a cada uno de los siguientes items existentes:

| Item existente | Donde agregar mencion | Texto sugerido |
|---------------|----------------------|----------------|
| `inicio` | Al final de la descripcion | "Tira hacia abajo para refrescar las secciones del Inicio." |
| `social` | Al final de la descripcion | "En Actividad podes tirar hacia abajo para refrescar el feed." |
| `listas` | Al final de la descripcion | "Tira hacia abajo en Favoritos o Recientes para refrescar la lista." |
| `notificaciones` | Al final de la descripcion | "Tira hacia abajo para refrescar la lista de notificaciones." |

No se crea item dedicado; la presencia textual de la frase "tira hacia abajo" en al menos 3 items es lo que el test de S8 valida.

### S6 — Item nuevo: `notificaciones` reply tipo

El hallazgo de bajo impacto del health-check pide hacer explicito el tipo `comment_reply`. El item actual ya menciona "respuestas a tus comentarios" — esta cubierto. **No se agrega nada nuevo aca**; se documenta el cierre en este PRD para que Sofia no lo flaggee.

### S7 — Copy pass sobre `helpGroups.tsx`

Auditar todos los strings de `description` para:

- **Tildes faltantes**: rapidas → rápidas, categoria → categoría, Seccion → Sección, leidas → leídas, direccion → dirección, ubicacion → ubicación, semanticos → semánticos, calificacion → calificación, etc.
- **Voseo consistente** (guard #309): Tocá / Andá / Activá / Calificá / Registrá. Detectar y corregir cualquier "Toca" suelto.
- **Signos de apertura**: "¿" donde corresponda.

Aplicar via agente `copy-auditor` post-edit (manual o como parte del PR).

### S8 — Tests (extender el existente)

Extender `src/components/profile/__tests__/helpGroups.test.ts` con nuevos casos para defender contra regresiones. Este es **el test del guard #311** (no el guard mismo en `scripts/guards/checks.mjs`):

- `comercio` describe **5 chip tabs** y menciona "Ver detalles" + "/comercio/" o `pantalla full`.
- `comercio` distingue explicitamente "5 chip tabs" o "5 secciones" (nivel pantalla) de "sub-pestañas" (nivel interno del tab Opiniones), o usa redaccion equivalente que no use la palabra "pestañas" para ambos niveles.
- `buscar` menciona auto-fallback / lista cuando el mapa falla.
- Existen items con ids `sorprendeme`, `tus_intereses_home`, `tus_intereses_perfil`, `estadisticas`, `confirmacion_salir`.
- `tus_intereses_home` esta en el grupo "Inicio" y `tus_intereses_perfil` esta en el grupo "Perfil".
- `estadisticas` esta en el grupo "Perfil" (no SideMenu/Ajustes).
- Al menos 3 items entre `inicio`, `social`, `listas`, `notificaciones` mencionan "tira hacia abajo" o "refrescar" (cobertura de pull-to-refresh transversal).
- Cobertura por id contra `features.md` (test parametrizado simple: cada id del registry tiene presencia textual en `features.md` — el guard #311 ya define el patron).

### S9 — Actualizar documentacion del guard #311

Aclaracion de scope: este paso modifica **el documento de referencia del guard** (`docs/reference/guards/311-help-docs.md`), no el script CI (`scripts/guards/checks.mjs`). El test del registry esta cubierto en S8.

Editar `docs/reference/guards/311-help-docs.md`:
- En la seccion "Reglas", mantener la regla de cobertura 1:1 actual.
- En el pseudocodigo del script CI-friendly, agregar como ejemplo los nuevos ids esperados (`sorprendeme`, `tus_intereses_home`, `tus_intereses_perfil`, `estadisticas`, `confirmacion_salir`) en un comentario que diga "ejemplos de ids esperados".

No se modifica `scripts/guards/checks.mjs` — el script ya itera dinamicamente sobre los ids del registry.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Reescribir item `comercio` (5 chip tabs + CTA + deep link + distincion sub-pestañas) | Alta | S |
| S2: Agregar fallback `MapErrorBoundary` al item `buscar` | Alta | XS |
| S3: Validar item `social` (no-op confirmado) | Baja | XS |
| S4: Reescribir item `listas` para Recientes unificado | Media | XS |
| S5: 5 items nuevos (`sorprendeme`, `tus_intereses_home`, `tus_intereses_perfil`, `estadisticas`, `confirmacion_salir`) | Alta | S |
| S5b: Mencion `pull_to_refresh` en `inicio`, `social`, `listas`, `notificaciones` | Media | XS |
| S6: Item `notificaciones` (no-op confirmado) | Baja | XS |
| S7: Copy pass tildes/voseo en `helpGroups.tsx` | Media | S |
| S8: Extender tests `helpGroups.test.ts` | Alta | S |
| S9: Actualizar `docs/reference/guards/311-help-docs.md` con nuevos ids esperados | Baja | XS |

**Esfuerzo total estimado:** S (1 archivo principal + 1 test + 1 doc, ~2-3 horas)

---

## Out of Scope

- Reescribir `HelpSection.tsx` (componente render): no se toca, sigue siendo render puro del registry.
- Cambiar el patron HELP_GROUPS (interfaces, agrupacion por tab): se mantiene 1:1.
- Documentar features admin-only o experimentales: la Ayuda es solo user-facing.
- Migrar copy a `src/constants/messages/`: las descripciones de Ayuda son contenido especifico del feature; viven en `helpGroups.tsx` por design (ver guard #311).
- Agregar busqueda dentro de Ayuda, deep link a items, o highlight de items nuevos: futuro ticket si surge demanda.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/profile/__tests__/helpGroups.test.ts` | Extension de test existente | (a) `comercio` menciona "5" o "cinco" + chip + deep link + redaccion que distingue sub-pestañas; (b) `buscar` menciona auto-fallback / lista; (c) ids nuevos presentes (`sorprendeme`, `tus_intereses_home`, `tus_intereses_perfil`, `estadisticas`, `confirmacion_salir`); (d) `tus_intereses_home` esta en grupo "Inicio", `tus_intereses_perfil` en "Perfil", `estadisticas` en "Perfil"; (e) `listas.recientes` menciona unificado / check-in y visitado; (f) al menos 3 items entre `inicio`, `social`, `listas`, `notificaciones` mencionan "tira hacia abajo" o "refrescar" |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo: aplica al test de regresion. El registry no tiene logica condicional; los tests son de contenido textual.
- No hay validacion de input del usuario (es contenido estatico).
- No hay paths condicionales nuevos.
- Side effects: ninguno (datos estaticos).

---

## Seguridad

Esta feature no introduce nuevas superficies de ataque. Es contenido estatico embebido en el bundle del cliente. No hay escrituras a Firestore, ni inputs de usuario, ni datos sensibles.

- [x] No hay nuevos endpoints/queries
- [x] No hay nuevos campos en colecciones
- [x] No hay nuevas APIs externas
- [x] No hay user input nuevo
- [x] CSP no se ve afectado

### Vectores de ataque automatizado

N/A — el cambio es solo a un registry de strings tipados (no markdown, no HTML inyectado, no eval).

### Notas

- Los strings se renderizan via JSX (`{item.description}`) — escapado automatico de React. No usar `dangerouslySetInnerHTML` en `HelpSection.tsx` (ya validado: el componente usa Typography puro).

---

## Deuda tecnica y seguridad

Issues abiertos consultados al 2026-04-29:

```bash
gh issue list --label security --state open  # vacio
gh issue list --label "tech debt" --state open  # vacio
gh issue list --state open --label enhancement  # 12 issues, ninguno bloquea este
```

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #311 (cerrado, guard activo) | base — define patron HELP_GROUPS y guard 1:1 | Mantener compatibilidad con el guard, opcionalmente extender la lista de "items clave" |
| #318 (cerrado) | introdujo `BusinessDetailScreen` con 5 chip tabs — el desfasaje del item `comercio` es secuela | Cerrar el desfasaje en este PRD |
| #304 (cerrado) | introdujo `MapErrorBoundary` con auto-fallback — no documentado en Ayuda | Cubierto en S2 |
| #205 (cerrado) | introdujo `YourInterestsSection` y seguir tags — no documentado en Ayuda | Cubierto en S5 |
| #319 (cerrado) | tech debt followup de #318 (setMetaTag, chip focus, noop dirty) | Confirma que el flow del item `comercio` es estable, sin mas cambios estructurales pendientes |
| #309 (guard activo) | voseo argentino | Cubierto por S7 (copy pass) |

### Mitigacion incorporada

- Resincronizar Ayuda con la realidad del producto post-#318/#319 (cierra el drift del health-check 2026-04-25).
- Extender el test `helpGroups.test.ts` con casos de regresion para los items nuevos y reescritos — el guard #311 se vuelve mas dificil de violar accidentalmente.
- Aprovechar la edicion para hacer el copy pass que el agente `copy-auditor` ya marcaba como pendiente en strings legacy.

---

## Robustez del codigo

### Checklist de hooks async

- [x] No hay `useEffect` async nuevos (cambio es contenido estatico).
- [x] No hay handlers async nuevos.
- [x] No hay `setState` post-async.
- [x] N/A: archivos no en `src/hooks/`.
- [x] N/A: no hay constantes de localStorage nuevas.
- [x] `helpGroups.tsx` con los nuevos items debe quedar **<= 300 lineas** (warn) y **<= 400** (blocker). Hoy esta en 230, +5 items nuevos + 4 menciones inline de `pull_to_refresh` = ~285, dentro del budget pero rozando el warn — si supera 300, considerar dividir en sub-archivos por grupo.
- [x] No hay `logger.error` envuelto en `import.meta.env.DEV`.

### Checklist de observabilidad

- [x] No hay Cloud Function trigger nuevo.
- [x] No hay service nuevo con queries Firestore.
- [x] No hay `trackEvent` nuevo (es contenido estatico, no hay nuevos eventos).

### Checklist offline

- [x] No hay formularios/dialogs nuevos que escriban a Firestore.
- [x] N/A: no hay error handlers nuevos.

### Checklist de documentacion

- [x] No se modifica HomeScreen JSX.
- [x] No se agregan analytics events.
- [x] No se agregan tipos nuevos al barrel.
- [ ] **`docs/reference/features.md`**: verificar que cada uno de los nuevos ids (`sorprendeme`, `tus_intereses_home`, `tus_intereses_perfil`, `estadisticas`, `confirmacion_salir`) tenga presencia textual o un header relacionado para que el guard #311 (regla 1:1) pase. Si alguno no esta, agregar mencion minima en la seccion correspondiente (Home / Perfil / Buscar). Esto es **bloqueante** para el merge: sin presencia en `features.md`, el script CI-friendly del guard #311 reporta MISSING.
- [x] N/A: `docs/reference/firestore.md` (no hay colecciones nuevas).
- [x] N/A: `docs/reference/patterns.md` (no hay patron nuevo; HELP_GROUPS ya esta documentado).
- [ ] **`docs/reference/guards/311-help-docs.md`**: agregar los nuevos ids esperados como ejemplos en el pseudocodigo del script CI-friendly. No se modifica `scripts/guards/checks.mjs`.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Render de `HelpSection` | Read estatico desde bundle | Funciona offline (es contenido estatico embebido) | N/A — no hay estado de carga |

### Checklist offline

- [x] Reads de Firestore: ninguna.
- [x] Writes: ninguno.
- [x] APIs externas: ninguna.
- [x] UI: el item `offline` ya menciona el indicador y el comportamiento (sin cambios).
- [x] Datos criticos: el registry esta en el bundle, disponible siempre.

### Esfuerzo offline adicional: XS (none)

---

## Modularizacion y % monolitico

El cambio respeta el patron HELP_GROUPS establecido por #311: agregar items = agregar entradas al array, sin tocar `HelpSection.tsx`.

### Checklist modularizacion

- [x] Logica de negocio: no aplica (datos estaticos).
- [x] Componentes nuevos: ninguno.
- [x] No se agrega useState a AppShell ni SideMenu.
- [x] No hay props nuevas.
- [x] No hay handlers/onClick nuevos.
- [x] No se importan modulos de Firebase.
- [x] N/A: archivo no esta en `src/hooks/`.
- [x] El archivo `helpGroups.tsx` sigue en `src/components/profile/` (no en `menu/`).
- [x] No se necesita estado global.
- [x] El archivo final estara entre 280-300 lineas — bajo el limite de 400.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Solo se edita un registry de datos. |
| Estado global | = | Sin cambios. |
| Firebase coupling | = | Sin cambios. |
| Organizacion por dominio | = | El archivo sigue en `components/profile/` (dominio Ayuda). |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [x] N/A: no se agregan IconButtons.
- [x] N/A: no se cambia la semantica del Accordion.
- [x] N/A: no hay touch targets nuevos.
- [x] N/A: no hay carga de datos nueva.
- [x] N/A: no hay imagenes con URLs dinamicas.
- [x] N/A: no hay formularios.
- [x] Los iconos de los items nuevos siguen el patron MUI `*OutlinedIcon` con `color="primary"` (consistente con items existentes).

### Checklist de copy

- [x] Todos los textos en espanol con tildes correctas (cubierto por S7).
- [x] Tono consistente: voseo (Buscá, Tocá, Activá, Calificá) — cubierto por S7.
- [x] Terminologia: "comercios" (no "negocios"), "reseñas" (no "reviews").
- [x] Strings reutilizables: las descripciones de Ayuda viven en `helpGroups.tsx` por design (no en `messages/`).
- [x] No hay mensajes de error (es contenido informativo).

---

## Success Criteria

1. El item `comercio` describe textualmente las 5 chip tabs (Criterios / Precio / Tags / Foto / Opiniones), la CTA "Ver detalles" y la URL deep-linkeable `/comercio/:id`. Test parametrizado lo valida.
2. El item `comercio` distingue explicitamente "5 chip tabs" o equivalente (nivel pantalla) de "sub-pestañas" Comentarios/Preguntas (nivel tab Opiniones). Test valida que la palabra "sub-pestañas" o "subpestañas" aparece y que la frase "5 chip tabs" / "5 secciones" tambien aparece.
3. El item `buscar` menciona el auto-fallback a vista de lista cuando el mapa falla. Test lo valida.
4. Existen 5 items nuevos en el registry con ids `sorprendeme`, `tus_intereses_home`, `tus_intereses_perfil`, `estadisticas`, `confirmacion_salir`. Test valida la presencia y el grupo correcto (`tus_intereses_home` en Inicio, `tus_intereses_perfil` y `estadisticas` en Perfil, `confirmacion_salir` en Buscar, `sorprendeme` en Inicio).
5. El item `listas` describe Recientes como **unificado** (visitas + check-ins). Test valida la palabra "unificado" o equivalente.
6. Test parametrizado verifica que al menos 3 de los 4 items afectados por S5b (`inicio`, `social`, `listas`, `notificaciones`) contienen el string "tira hacia abajo" o "refrescar" en su descripcion.
7. El test `helpGroups.test.ts` extendido pasa en CI. El guard `help-docs-reviewer` corrido manualmente sobre el diff no reporta drift entre `helpGroups.tsx` y `features.md` para los ids nuevos.

---


---

## Validacion Funcional

**Validador:** Sofia (analista funcional senior — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-04-30
**Ciclo:** 2 (post-correccion de prd-writer)

### Cerrado en esta iteracion

- BLOQUEANTE #1 "id `discard_dialog` rompe convencion del registry" → resuelto en S5 (tabla, fila `confirmacion_salir`) y S8/S9 (ids actualizados). El nuevo id sigue snake_case en español, alineado con el tono del registry (`primeros_pasos`, `perfil_publico`).
- BLOQUEANTE #2 "`estadisticas` mal localizado como tab de SideMenu" → resuelto en S5 (fila `estadisticas` ahora en grupo Perfil, con cita de `ProfileScreen.tsx` L29/L60/L101/L160). Verificado contra el codigo: es sub-pantalla del flow Perfil → tap en card de stats, no item de menu lateral.
- BLOQUEANTE #3 "`tus_intereses` documenta dos surfaces distintos en un solo item" → resuelto en S5 (separacion en `tus_intereses_home` e `tus_intereses_perfil`) y S5a (decision documentada). Ambos componentes (`YourInterestsSection`, `InterestsSection`) verificados en disco con responsabilidades distintas (descubrimiento vs gestion).
- IMPORTANTE #4 "`pull_to_refresh` sin definicion de items afectados ni copy" → resuelto en S5b (tabla con 4 items afectados + texto sugerido) y Success Criteria #6 (criterio testeable de presencia textual).
- IMPORTANTE #5 "Success Criteria #5 no testeable (copy-auditor pass)" → resuelto: Success Criteria reformulado de 5 a 7 criterios objetivos; copy-auditor pass degradado a paso del flow en S7 (no es criterio de exito).
- IMPORTANTE #6 "S9 ambiguedad sobre que doc/script modifica" → resuelto en S9 (lineas 110-118): se aclara que toca `docs/reference/guards/311-help-docs.md` (existe en disco, verificado), no `scripts/guards/checks.mjs`.
- OBSERVACION #7 "sub-pestañas en dos niveles riesgo de copy ambiguo" → incorporado en S1 (linea 29) como exigencia explicita de copy + criterio testeable #2.

### Abierto

Ninguno bloqueante.

### Observaciones para el implementador

- **Budget LOC ajustado (285 / 300 warn)**: el archivo queda rozando el warn. Si el copy pass de S7 expande algun string mas de lo previsto, evaluar partir `helpGroups.tsx` por grupo (Inicio / Buscar / Listas / Social / Perfil) en un follow-up — no en este PR.
- **Checklist docs bloqueante features.md**: antes de mergear, confirmar presencia textual de los 5 ids nuevos en `docs/reference/features.md`. Si falta alguno, agregar mencion minima en la seccion correspondiente. El guard #311 falla en CI sin esto.
- **Tono de S6**: el item `notificaciones` se confirma como no-op pero el implementador deberia revalidar al hacer el copy pass de S7 que la frase "respuestas a tus comentarios" siga vigente (es lo que cierra el hallazgo #notificaciones-comment-reply del health-check).
- **Distincion "5 chip tabs" vs "sub-pestañas"**: el test de S8 valida presencia de ambas frases. Si el copy del implementador prefiere "5 secciones" en lugar de "5 chip tabs", el test parametrizado debe aceptar ambos sinonimos.
- **`confirmacion_salir` en grupo Buscar**: la asignacion de grupo es por proximidad tematica al item `comercio`. Si durante implementacion se observa que la confirmacion es transversal (review propia, edicion de perfil, etc.), reconsiderar moverlo a grupo Perfil. No bloquea — decidir al editar.

### Listo para specs-plan-writer

Si — todos los BLOQUEANTES cerrados, scope claro, criterios testeables, casos edge documentados.
