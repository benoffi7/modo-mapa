# Specs: Help-docs — outdated BusinessDetailScreen tabs + missing items en HelpSection

**PRD:** [prd.md](prd.md)
**Issue:** #328
**Fecha:** 2026-04-29

---

## Resumen

Cambio puramente de contenido sobre el registry declarativo `src/components/profile/helpGroups.tsx`. No introduce componentes, hooks, services, queries Firestore, rules ni Cloud Functions. El alcance es:

1. Reescribir el item `comercio` para reflejar `BusinessDetailScreen` post-#318/#319 (5 chip tabs + sheet compacto + deep link + sub-pestañas Comentarios/Preguntas).
2. Agregar mencion de `MapErrorBoundary` auto-fallback al item `buscar`.
3. Reescribir el bloque "Recientes" del item `listas` para describir el historial unificado (visitas locales + check-ins).
4. Agregar 5 items nuevos: `sorprendeme`, `tus_intereses_home`, `tus_intereses_perfil`, `estadisticas`, `confirmacion_salir`.
5. Agregar mencion textual de pull-to-refresh en `inicio`, `social`, `listas`, `notificaciones`.
6. Copy pass general (tildes + voseo) sobre `helpGroups.tsx`.
7. Extender `helpGroups.test.ts` con casos de regresion para los puntos 1-5.
8. Actualizar `docs/reference/guards/311-help-docs.md` con los nuevos ids esperados como ejemplo.
9. Verificar presencia textual de los 5 ids nuevos en `docs/reference/features.md` (bloqueante del guard #311).

---

## Modelo de datos

No aplica. El feature no introduce nuevas colecciones, campos, ni tipos Firestore. Las interfaces `HelpItem` y `HelpGroup` (en `helpGroups.tsx`) se reusan sin modificaciones.

```ts
// src/components/profile/helpGroups.tsx (sin cambios estructurales)
export interface HelpItem {
  id: string;
  icon: ReactElement;
  title: string;
  description: string;
}

export interface HelpGroup {
  label: string;
  items: HelpItem[];
}
```

## Firestore Rules

No aplica — no hay nuevas queries ni colecciones.

### Rules impact analysis

N/A. Este feature no toca Firestore.

### Field whitelist check

N/A. No se modifican campos.

## Cloud Functions

No aplica.

## Seed Data

No aplica — el cambio es contenido estatico embebido en el bundle.

## Componentes

### Modificados

| Componente | Path | Cambio |
|-----------|------|--------|
| `helpGroups` (registry) | `src/components/profile/helpGroups.tsx` | Reescritura del item `comercio`; edicion de `buscar`, `listas`, `inicio`, `social`, `notificaciones`; +5 items nuevos; copy pass tildes/voseo |
| `HelpSection.tsx` | `src/components/profile/HelpSection.tsx` | **Sin cambios.** Render puro del registry |

### Nuevos

Ninguno. El patron HELP_GROUPS solo requiere agregar entradas al array.

### Mutable prop audit

N/A. El registry es contenido estatico, no se expone via props mutables.

## Textos de usuario

Todos los textos nuevos / modificados pasan por el copy pass de S7 y deben respetar voseo + tildes. Lista exhaustiva:

### Item `comercio` (reescrito)

| Texto clave | Notas |
|-------------|-------|
| "Tocá un pin o un comercio en cualquier lista para ver el detalle." | Voseo, tilde en á |
| "Sheet compacto con header (nombre, calificacion, accion rapida) y CTA **\"Ver detalles\"** que abre la pantalla full." | Mencion explicita de la CTA — **criterio testeable #1** |
| "La pantalla full vive en `/comercio/:id` y tiene **5 secciones organizadas como chip tabs sticky**: Criterios, Precio, Tags, Foto y Opiniones." | Frase "5 secciones" o "5 chip tabs" — **criterio testeable #1** |
| "Compartis una pestaña especifica con el link `/comercio/:id?tab=criterios|precio|tags|foto|opiniones` (deep link)." | Mencion de deep link — **criterio testeable #1** |
| "Dentro del tab Opiniones hay **sub-pestañas internas** Comentarios y Preguntas, con threads de un nivel, likes y badge \"Mejor respuesta\"." | Distincion explicita "sub-pestañas" vs "secciones / chip tabs" — **criterio testeable #2** |
| "El limite de 20 por dia es **compartido** entre comentarios y preguntas." | Conserva mencion del test existente |
| "Sin conexion, tus acciones se encolan y se sincronizan al reconectar." | Conservado |

### Item `buscar` (extendido)

| Texto agregado | Notas |
|----------------|-------|
| "Si el mapa no carga (Maps API caida o sin conexion), la app cambia automaticamente a vista de lista para que sigas buscando." | Mencion de fallback — **criterio testeable #3** |

### Item `listas` (Recientes reescrito)

| Texto reescrito | Notas |
|-----------------|-------|
| "Recientes (historial **unificado**: comercios visitados localmente + tus check-ins, deduplicados por comercio, con la fecha mas reciente)" | Palabra "unificado" — **criterio testeable #5** |

### Items nuevos (S5)

| Id | Grupo | Texto resumen |
|----|-------|---------------|
| `sorprendeme` | Inicio | "Tocá Sorprendeme en las acciones rapidas del Inicio para que la app elija un comercio al azar que no hayas visitado, priorizando los cercanos (radio 5km) si tenes GPS activo." |
| `tus_intereses_home` | Inicio | "En el Inicio, la seccion **Tus intereses** es un feed de descubrimiento que te muestra comercios filtrados por los tags que seguis. Si todavia no seguis ninguno, ves sugerencias para empezar." |
| `tus_intereses_perfil` | Perfil | "Andá a Perfil → **Tus intereses** para gestionar los tags que seguis (agregar, quitar, ver sugerencias). Limite: 20 tags. Lo que elegis aca alimenta el feed Tus intereses del Inicio." |
| `estadisticas` | Perfil | "Tocá la card de estadisticas en tu perfil para abrir la pantalla **Estadisticas**: distribucion de tus calificaciones (pie), tags mas usados (pie) y top 10 de comercios mas favoriteados, comentados y calificados." |
| `confirmacion_salir` | Buscar | "Si estas escribiendo un comentario, una pregunta o un feedback y queres cerrar la pantalla con texto sin guardar, la app te avisa con el dialogo \"Descartar cambios?\" para que no pierdas lo que escribiste." |

### Items extendidos con mencion pull-to-refresh (S5b)

| Id | Linea agregada al final |
|----|------------------------|
| `inicio` | "Tira hacia abajo para refrescar las secciones del Inicio." |
| `social` | "En Actividad podes tirar hacia abajo para refrescar el feed." |
| `listas` | "Tira hacia abajo en Favoritos o Recientes para refrescar la lista." |
| `notificaciones` | "Tira hacia abajo para refrescar la lista de notificaciones." |

### Copy pass S7 — tildes/voseo en strings legacy

Auditar y corregir en TODO el archivo (replace_all donde aplique, manteniendo contexto):

| Antes | Despues |
|-------|---------|
| rapidas | rápidas |
| categoria | categoría |
| Seccion / seccion | Sección / sección |
| leidas | leídas |
| direccion / Direccion | dirección / Dirección |
| ubicacion / Ubicacion | ubicación / Ubicación |
| semanticos | semánticos |
| calificacion / Calificacion | calificación / Calificación |
| Configuracion | Configuración |
| Recomendaciones (sin tilde donde aplique) | revisar caso por caso |
| Toca (imperativo) | Tocá |
| Anda (imperativo) | Andá |
| Activa (imperativo) | Activá |
| Calificá / Registrá | conservar (ya correctos) |
| Buscar — verificar voseo en imperativos | "Busca comercios..." → "Buscá comercios..." |
| Filtra (imperativo) | Filtrá |
| Usa (imperativo) | Usá |

**Importante**: el copy-auditor agente final corre como parte de `/merge`. Este pass es preventivo — no es success criterion (degradado de criterio en Sofia ciclo 2).

## Hooks

No aplica. Sin hooks nuevos ni modificados.

## Servicios

No aplica.

## Integracion

El cambio es autocontenido en `helpGroups.tsx`. `HelpSection.tsx` lo consume sin modificaciones (render puro del registry via `.flatMap(...)` + Accordion). El icono de cada item nuevo sigue el patron MUI `*OutlinedIcon` con `color="primary"`.

### Iconos sugeridos para items nuevos

| Item | Icono |
|------|-------|
| `sorprendeme` | `AutoAwesomeOutlinedIcon` (alternativa: `CasinoOutlinedIcon`) |
| `tus_intereses_home` | `ExploreOutlinedIcon` (feed/descubrimiento) |
| `tus_intereses_perfil` | `LocalOfferOutlinedIcon` (gestion de tags) |
| `estadisticas` | `BarChartOutlinedIcon` (alternativa: `InsightsOutlinedIcon`) |
| `confirmacion_salir` | `ExitToAppOutlinedIcon` (alternativa: `WarningAmberOutlinedIcon`) |

Implementador puede elegir alternativas dentro del set MUI Outlined consistente. No es criterio testeable.

### Preventive checklist

- [x] **Service layer**: no se importa `firebase/firestore` — N/A.
- [x] **Duplicated constants**: no se introducen constantes; `AVATAR_COUNT` ya existe.
- [x] **Context-first data**: N/A.
- [x] **Silent .catch**: N/A.
- [x] **Stale props**: N/A.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/components/profile/__tests__/helpGroups.test.ts` | Extension del test existente con casos de regresion para items reescritos y nuevos (ver "Casos nuevos" abajo) | Unit (regresion de contenido) |

### Casos nuevos a agregar

```ts
it('item "comercio" describe las 5 secciones (chip tabs) y el deep link', () => {
  const item = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'comercio');
  expect(item).toBeDefined();
  // Acepta "5 chip tabs", "5 secciones", "cinco secciones", etc.
  expect(item?.description).toMatch(/(5|cinco)\s+(chip\s+tabs?|secciones)/i);
  // Deep link a la pantalla full
  expect(item?.description).toMatch(/(\/comercio\/|pantalla\s+full|Ver\s+detalles)/i);
});

it('item "comercio" distingue chip tabs de sub-pestañas', () => {
  const item = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'comercio');
  expect(item?.description).toMatch(/sub-?pestañas?/i);
});

it('item "buscar" menciona el auto-fallback a vista de lista', () => {
  const item = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'buscar');
  expect(item?.description).toMatch(/(automaticamente|auto-?fallback|automatic).*lista|lista.*automaticamente/i);
});

it('contiene los 5 items nuevos de #328', () => {
  const ids = HELP_GROUPS.flatMap((g) => g.items.map((i) => i.id));
  expect(ids).toContain('sorprendeme');
  expect(ids).toContain('tus_intereses_home');
  expect(ids).toContain('tus_intereses_perfil');
  expect(ids).toContain('estadisticas');
  expect(ids).toContain('confirmacion_salir');
});

it('items nuevos estan en el grupo correcto', () => {
  const findGroup = (id: string) =>
    HELP_GROUPS.find((g) => g.items.some((i) => i.id === id))?.label;
  expect(findGroup('sorprendeme')).toBe('Inicio');
  expect(findGroup('tus_intereses_home')).toBe('Inicio');
  expect(findGroup('tus_intereses_perfil')).toBe('Perfil');
  expect(findGroup('estadisticas')).toBe('Perfil');
  expect(findGroup('confirmacion_salir')).toBe('Buscar');
});

it('item "listas" describe Recientes como historial unificado', () => {
  const item = HELP_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'listas');
  expect(item?.description.toLowerCase()).toContain('unificado');
  // Debe mencionar ambos origenes
  expect(item?.description).toMatch(/check-?in/i);
  expect(item?.description).toMatch(/visitad/i);
});

it('al menos 3 de inicio/social/listas/notificaciones mencionan pull-to-refresh', () => {
  const targets = ['inicio', 'social', 'listas', 'notificaciones'];
  const items = HELP_GROUPS.flatMap((g) => g.items).filter((i) => targets.includes(i.id));
  const withPtr = items.filter((i) =>
    /tira\s+hacia\s+abajo|tirar\s+hacia\s+abajo|refrescar/i.test(i.description),
  );
  expect(withPtr.length).toBeGreaterThanOrEqual(3);
});
```

### Compatibilidad con tests existentes

- `'item "comercio" aclara que 20/dia es compartido entre comentarios y preguntas'` (linea 61) — DEBE seguir pasando. La reescritura de `comercio` mantiene la palabra "compartido". Verificar al editar.
- `'contiene items clave de features recientes'` (linea 41) — sin cambios; los ids `offline`, `rankings`, `perfil_publico` permanecen.

### Mock strategy

N/A. Test puro de contenido estatico.

## Analytics

No aplica. Es contenido estatico embebido; no genera nuevos eventos.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Registry HELP_GROUPS | Embebido en bundle JS | N/A | Bundle (siempre disponible) |

### Writes offline

N/A.

### Fallback UI

N/A — el contenido siempre esta disponible.

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| `HelpSection` (sin cambios) | `AccordionSummary` | Ya tiene `aria-label` explicito (validado en #311) | Ya cumple | N/A — contenido estatico |

### Reglas
- Items nuevos respetan el patron actual: `<HelpItemIcon color="primary" />` + Typography puro.
- No se introducen `IconButton` ni handlers click nuevos.
- No hay imagenes con URL dinamica.
- No hay fetch — no se requiere error state.

## Textos y copy

Tabla completa en seccion "Textos de usuario" arriba.

### Reglas de copy aplicadas
- Voseo: Tocá, Andá, Activá, Calificá, Tirá, Buscá, Filtrá, Usá.
- Tildes: rápidas, categoría, sección, leídas, dirección, ubicación, semánticos, calificación, configuración.
- Terminologia: "comercios" (no "negocios"), "reseñas" no necesario aca pero se mantiene si aparece.
- Distincion explicita "5 chip tabs" / "5 secciones" vs "sub-pestañas" en item `comercio`.

---

## Decisiones tecnicas

### D1 — Items separados `tus_intereses_home` y `tus_intereses_perfil`

**Contexto**: existen dos componentes distintos (`YourInterestsSection` en Home y `InterestsSection` en Perfil) que cumplen funciones diferentes (descubrimiento vs gestion).

**Decision**: dos items separados, uno en Inicio y uno en Perfil.

**Alternativa rechazada**: un solo item `tus_intereses` con descripcion compuesta. Rechazada por ambiguedad de localizacion ("¿donde lo encuentro?").

### D2 — `pull_to_refresh` como mencion textual, no item dedicado

**Decision**: agregar la frase "tira hacia abajo" / "refrescar" en los 4 items que ya soportan el gesto. Sin item dedicado.

**Alternativa rechazada**: item `pull_to_refresh` propio. Rechazada por ser un gesto transversal (no una feature autocontenida) y por no agregar valor informativo independiente.

### D3 — Id `confirmacion_salir` (no `discard_dialog`)

**Decision**: id en snake_case espanol alineado con tono del registry (`primeros_pasos`, `perfil_publico`, `modooscuro`).

**Alternativa rechazada**: `discard_dialog` (nombre tecnico ingles). Rechazada por inconsistencia con la convencion del registry.

### D4 — `estadisticas` en grupo Perfil (no Ajustes ni SideMenu)

**Decision**: grupo Perfil, justificado por el codigo (`ProfileScreen.tsx` L29/L60/L101/L160 — sub-pantalla del flow Perfil → tap en card de stats).

### D5 — `confirmacion_salir` en grupo Buscar

**Decision**: grupo Buscar, por proximidad tematica al item `comercio` (donde el dialogo aparece principalmente). Reconsiderar a Perfil si durante implementacion se observa que es transversal a otros flows (review propia, edicion de perfil, feedback).

### D6 — No partir `helpGroups.tsx` por grupo en este PR

**Contexto**: el PRD estima 285 lineas finales (warn @ 300). Sofia observo el budget ajustado.

**Decision**: dejar el archivo monolitico y evaluar split en follow-up si supera 300 LOC.

**Alternativa rechazada**: partir en sub-archivos por grupo (`helpGroups/inicio.ts`, etc.) ahora. Rechazada para no contaminar este PR de scope-creep estructural.

### D7 — No modificar `scripts/guards/checks.mjs`

**Contexto**: el script CI ya itera dinamicamente sobre los ids del registry y soporta snake_case underscore (`[a-z_-]+`) + version humana (`tr '_' ' '`). Los nuevos ids pasaran sin cambios al script.

**Decision**: solo se actualiza el doc de referencia `docs/reference/guards/311-help-docs.md` con los ids como ejemplos en el pseudocodigo. El script se queda como esta.

---

## Hardening de seguridad

### Firestore rules requeridas

N/A — feature sin escrituras Firestore.

### Rate limiting

N/A.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| XSS via copy del registry | Strings se renderizan via JSX (`{item.description}`) — escape automatico de React. `HelpSection.tsx` usa `Typography` puro, no `dangerouslySetInnerHTML` | `HelpSection.tsx` (validado, sin cambios) |
| Injection via id de item | Ids estaticos hardcodeados en el array, no provienen de input de usuario | `helpGroups.tsx` |

---

## Deuda tecnica: mitigacion incorporada

Issues abiertos consultados al 2026-04-29:

```bash
gh issue list --label security --state open  # vacio
gh issue list --label "tech debt" --state open  # vacio
```

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #328 (este) | Cierra el drift detectado por health-check 2026-04-25 entre `helpGroups.tsx` y `BusinessDetailScreen` | Fase 1 |
| #311 (guard activo) | Refuerza el guard agregando ids documentados como ejemplo en el doc de referencia | Fase 4 |
| #309 (voseo, guard activo) | Copy pass de tildes/voseo limpia strings legacy | Fase 1 paso 7 |
| Health-check `notificaciones-comment-reply` | Item `notificaciones` ya menciona "respuestas a tus comentarios"; se revalida en el copy pass S7 sin cambio estructural | Fase 1 paso 7 |

Ningun archivo tocado tiene deuda tecnica conocida que pueda agravarse.

---

## Validacion Tecnica


**Validador:** Diego (solution architect senior — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-04-30
**Ciclo:** 1

### Contexto revisado

- PRD: `docs/feat/content/328-help-docs-tabs-missing-items/prd.md` (sello Sofia: VALIDADO CON OBSERVACIONES, 2026-04-30, ciclo 2).
- Specs: `docs/feat/content/328-help-docs-tabs-missing-items/specs.md`.
- Patrones revisados: `docs/reference/patterns.md` (HELP_GROUPS registry, copywriting), `docs/reference/tests.md` (template Tests).
- Codigo verificado: `src/components/profile/helpGroups.tsx` (230 LOC actuales), `src/components/profile/__tests__/helpGroups.test.ts` (66 LOC, 9 cases existentes), `src/components/home/YourInterestsSection.tsx`, `src/components/profile/InterestsSection.tsx`, `src/components/lists/RecentsUnifiedTab.tsx`, `src/components/search/MapErrorBoundary.tsx`, `src/hooks/useUnsavedChanges.ts`.
- Guard verificado: `scripts/guards/checks.mjs` L361-374 (regex real `[a-z_-]+` con `tr '_' ' '`). Doc `docs/reference/guards/311-help-docs.md` L50 muestra regex desactualizada `[a-z-]+`.
- Iconos MUI verificados en `node_modules/@mui/icons-material/`: `AutoAwesomeOutlined`, `ExploreOutlined`, `LocalOfferOutlined`, `BarChartOutlined`, `ExitToAppOutlined` — todos existen.

Checklist tecnico aplicable a un feature de contenido estatico ejecutado: cobertura PRD->specs OK, sin data model / rules / Cloud Functions / observabilidad / offline / multi-tab nuevos (todos N/A justificados). El foco del review fueron tests, dependencias verificables, y consistencia con el guard #311.

### IMPORTANTE #1 — Copy concreto a agregar a `features.md` no especificado para 3 de los 5 nuevos ids

**Seccion del specs:** Resumen punto 9 ("Verificar presencia textual de los 5 ids nuevos en `docs/reference/features.md`").

**Hueco tecnico:** el guard #311 (script real en `scripts/guards/checks.mjs:371`) busca `\b(slug|human)\b` case-insensitive donde `human = slug.replace(/_/g, ' ')`. Verificado contra `features.md` actual:

- `sorprendeme` -> presente (linea 62: "Sorprendeme"). OK.
- `estadisticas` -> presente (linea 69: "Estadisticas"). OK.
- `tus_intereses_home` -> human form "tus intereses home" no aparece como cadena consecutiva. La seccion `## Seguir Tags / Tus Intereses (#205)` (L440) menciona `YourInterestsSection` pero no la frase exacta "tus intereses home".
- `tus_intereses_perfil` -> human form "tus intereses perfil" no aparece como cadena consecutiva.
- `confirmacion_salir` -> human form "confirmacion salir" no aparece. Lo mas cercano es "Confirmación al salir" (L46) con tilde y palabra extra "al" — no matchea `\bconfirmacion salir\b`.

**Escenario concreto:** implementador edita `helpGroups.tsx` con los 5 ids, corre `node scripts/guards/checks.mjs` (o el equivalente local), recibe MISSING para 3 ids, abre `features.md` y debe inferir donde y como agregar la mencion. PRD linea 245 marca esto como bloqueante de merge.

**Que necesitamos en el specs:** la tabla de "Items extendidos" o un nuevo bloque "Cambios en `features.md`" con el copy minimo y la sub-seccion destino para cada id que falta. Por ejemplo: en `features.md`, agregar `tus intereses home` y `tus intereses perfil` como sub-bullets dentro de `## Seguir Tags / Tus Intereses (#205)`, y agregar `confirmacion salir` (sin tilde, o el slug literal) en el bullet de `## Confirmación al salir` (L46) para que el guard lo encuentre. Sin esa especificacion, el implementador toma decision editorial sobre features.md sin guia.

### IMPORTANTE #2 — Regex del test de `buscar` rompe si el copy final usa tilde

**Seccion del specs:** Tests > "Casos nuevos a agregar", L211.

**Hueco tecnico:** la regex propuesta es:

```
/(automaticamente|auto-?fallback|automatic).*lista|lista.*automaticamente/i
```

El copy pass S7 corrige tildes (linea 90, voseo + tildes). Si el implementador escribe "automáticamente" (con tilde) — comportamiento esperado por el guard #309 — la regex falla en ambas ramas: ni `automaticamente` (sin tilde) ni `automatic` matchean `automáticamente`. La rama `lista.*automaticamente` tambien falla.

**Escenario concreto:** copy pass aplica tilde correctamente, test queda rojo en CI. El implementador o bien revierte la tilde (rompe S7) o bien edita la regex sin tener spec actualizado.

**Que necesitamos en el specs:** la regex del test debe tolerar la forma con tilde — por ejemplo, ampliar a `/autom[áa]ticamente|auto-?fallback/` y separar la condicion de presencia de "lista" en una expectativa adicional, o equivalente. Spec actualizado para no chocar con S7.

### IMPORTANTE #3 — S9 no menciona corregir la regex desactualizada en el doc del guard

**Seccion del specs:** S9 (decision D7 referencia + Resumen punto 8).

**Hueco tecnico:** `docs/reference/guards/311-help-docs.md:50` muestra el pseudocodigo del script con regex `[a-z-]+` (sin underscore). El script real `scripts/guards/checks.mjs:371` ya usa `[a-z_-]+` con `tr '_' ' '`. S9 dice "agregar los nuevos ids esperados como ejemplos en el pseudocodigo" pero no aclara si el regex del pseudocodigo se actualiza para coincidir con el script real. Si solo se agregan ejemplos sin tocar la regex, el doc queda con un pseudocodigo que filtraria los nuevos ids `tus_intereses_home`, `tus_intereses_perfil`, `confirmacion_salir` (todos con underscore) — divergente del script real.

**Escenario concreto:** un futuro lector del doc copia el pseudocodigo localmente, corre el grep, no encuentra los nuevos ids con underscore, asume que el guard no los reconoce. Confusion gratis.

**Que necesitamos en el specs:** que S9 explicite si el pseudocodigo del doc se actualiza tambien a `[a-z_-]+` para mantener paridad con el script (decision menor pero binaria). No se modifica `scripts/guards/checks.mjs` — solo el doc de referencia.

### OBSERVACION #1 — Voseo en "Tira hacia abajo" del copy S5b

S5b (specs L122-126) usa el imperativo "Tira hacia abajo" (sin tilde) en 3 de las 4 lineas sugeridas. El copy pass de S7 (L130-150) lista `Tirá` implicitamente como voseo correcto. El test propuesto (L242-247) acepta ambas formas via regex case-insensitive sin tilde. No bloquea — el copy final deberia quedar "Tirá hacia abajo" por consistencia con guard #309. El implementador puede aplicarlo en el pass de S7.

### OBSERVACION #2 — Budget LOC

`helpGroups.tsx` actual: 230 LOC (verificado). PRD estima 285 post-edit (linea 226), warn @ 300. Margen real: 70 LOC para 5 items + 4 menciones inline + copy pass. Si los descripciones de items nuevos crecen mas de ~10 lineas cada una, el budget se aprieta. No bloquea — Sofia ya lo observo y la decision D6 cierra el split como follow-up.

### Cerrado en esta iteracion

Ninguno (Ciclo 1).

### Abierto

- IMPORTANTE #1: copy concreto para `features.md` (3 ids).
- IMPORTANTE #2: regex del test `buscar` tolerante a tilde.
- IMPORTANTE #3: aclaracion sobre regex en doc del guard #311.

### Observaciones tecnicas para el plan (Pablo)

- El guard #311 corre como parte del flujo CI (script `scripts/guards/checks.mjs`). El plan debe incluir un paso "correr guards localmente" antes de PR para detectar el MISSING de `features.md`.
- El doc `docs/reference/guards/311-help-docs.md` y `docs/reference/features.md` son los unicos archivos de docs/ que se tocan en este feature — el plan deberia ordenarlos como Fase final (post-codigo, post-tests) para que el implementador no parchee features.md a ciegas.
- Los IMPORTANTE arriba se pueden resolver editando el specs (no codigo) — el implementador puede arrancar Fase 1 (helpGroups.tsx) en paralelo.

### Listo para pasar a plan?

Si con observaciones — los 3 IMPORTANTE son ajustes editoriales sobre el specs, no bloquean el flujo. Pueden resolverse antes o durante la fase de plan. Sin BLOQUEANTES.
