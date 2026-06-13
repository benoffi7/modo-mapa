# Specs: features.md describe un SideMenu inexistente; alinear la fuente de verdad con la navegacion real (TabBar)

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-10
**Issue:** #349

---

## Naturaleza del feature

Tarea de **documentacion + sincronizacion de doc de guard**. No hay codigo de produccion nuevo: no se tocan `src/` (runtime), rules, Firestore, Cloud Functions, Storage ni inputs de usuario. Por lo tanto, las secciones de modelo de datos, rules, functions, seed, componentes, hooks, servicios, offline, analytics y seguridad estan marcadas N/A con su justificacion.

El trabajo concreto es:

1. **S1** — Reescribir la seccion `## Menu lateral (SideMenu)` de `docs/reference/features.md` (lineas 50-74) como `## Navegacion principal (TabBar + tabs)`, describiendo la `BottomNavigation` de 5 tabs y mapeando cada seccion al tab real.
2. **S2** — Barrer las 13 menciones residuales de `SideMenu` en `docs/reference/features.md` (verificado con `grep -c "SideMenu"` → 13).
3. **S2b** — Aclarar el item `notificaciones` (campana en barra de busqueda) y documentar skeleton loaders.
4. **S3** — Actualizar `docs/reference/guards/311-help-docs.md` para documentar la regla `R2-features-sidemenu-drift` (ya implementada en codigo) y reemplazar las referencias a `SideMenu` por la estructura de tabs.

---

## Modelo de datos

N/A — no se agregan ni modifican colecciones, campos ni tipos. No se toca `src/types/`.

## Firestore Rules

N/A — no se modifican rules. El feature no escribe ni lee Firestore.

### Rules impact analysis

N/A — sin queries nuevas.

### Field whitelist check

N/A — sin campos nuevos.

## Cloud Functions

N/A — sin triggers, scheduled ni callables nuevos.

## Seed Data

N/A — no se crean colecciones ni campos requeridos. No se toca `scripts/seed-admin-data.*` ni `scripts/seed-staging.ts`.

## Componentes

N/A — no se crean ni modifican componentes React. `helpGroups.tsx` y `HelpSection.tsx` quedan **sin cambios** (el registry ya esta alineado a tabs; el barrido de S2 solo toca `features.md`).

### Mutable prop audit

N/A — sin componentes editables nuevos.

## Textos de usuario

N/A para UI. Los unicos textos que se escriben son **contenido de documentacion** en `features.md` y `311-help-docs.md`, no strings user-facing. Aplican igual las reglas de copy (voseo, tildes) por el guard #309.

## Hooks

N/A — sin hooks nuevos ni modificados.

## Servicios

N/A — sin servicios nuevos ni modificados.

---

## Trabajo de documentacion (el core del feature)

### Estado verificado de los guards (2026-06-10)

Ejecucion manual de la logica de ambas reglas contra el repo actual:

| Regla | Estado HOY | Causa | Estado objetivo post-fix |
|-------|-----------|-------|--------------------------|
| `R1-helpgroups-coverage` (checks.mjs:504) | **ROJO — 1 MISSING** | El id `modooscuro` no matchea: la regla hace `_`→espacio, pero `modooscuro` no tiene underscore (`human === id === "modooscuro"`), y en `features.md` solo existe "modo oscuro" **con espacio** (linea 70). `grep -qiE "\b(modooscuro)\b"` no encuentra nada. **Fallo PREEXISTENTE, independiente de #349.** | Cerrar el MISSING incluyendo el literal `modooscuro` en el `features.md` reescrito (ver S1) → R1 verde. |
| `R2-features-sidemenu-drift` (checks.mjs:511) | **ROJO — 1 violacion** | `features.md` menciona `SideMenu`/`Menu lateral` (13 hits) y no existe `src/components/layout/SideMenu.tsx`. | S1+S2 dejan 0 menciones de `SideMenu`/`Menu lateral` → R2 verde. |

> **Como cuenta violaciones el runner** (`scripts/guards/run.mjs:44-46`): toda linea de stdout no vacia cuenta como una violacion (`lines.length`). Por eso R1 emite una linea `MISSING in features.md: <id> ...` por cada id no cubierto, y cada una suma. Hoy R1 emite exactamente 1 linea (`modooscuro`).

### Mapeo de ids del registry → tab (referencia para S1)

`ALL_TAB_IDS = ['inicio', 'social', 'buscar', 'listas', 'perfil']` (`src/types/navigation.ts:3`). `TabShell.tsx` rutea cada tab a su Screen (`HomeScreen`, `SocialScreen`, `SearchScreen`, `ListsScreen`, `ProfileScreen`). El registro `HELP_GROUPS` (`src/components/profile/helpGroups.tsx`) ya agrupa por tab. La seccion reescrita de `features.md` debe seguir este agrupamiento:

| Grupo HELP_GROUPS | ids del registry | Tab real / ubicacion |
|-------------------|------------------|----------------------|
| Inicio | `inicio`, `sorprendeme`, `tus_intereses_home`, `primeros_pasos` | tab **Inicio** → `HomeScreen` |
| Buscar | `buscar`, `comercio`, `checkin`, `confirmacion_salir`, `offline` | tab **Buscar** → `SearchScreen` |
| Social | `social`, `rankings`, `perfil_publico`, `recomendaciones` | tab **Social** → `SocialScreen` |
| Listas | `listas`, `colaborativas` | tab **Listas** → `ListsScreen` |
| Perfil | `perfil`, `tus_intereses_perfil`, `estadisticas`, `logros`, `notificaciones` | tab **Perfil** → `ProfileScreen` |
| Ajustes | `cuenta`, `onboarding`, `configuracion`, `modooscuro`, `feedback` | dentro de **Perfil** → `SettingsPanel` / `HelpSection` |

### S1 — Reescritura de la seccion de navegacion (`features.md` lineas 50-74)

- Renombrar el header `## Menu lateral (SideMenu)` → `## Navegacion principal (TabBar + tabs)`.
- Describir la `BottomNavigation` de 5 tabs segun `src/components/layout/TabBar.tsx`: **Inicio / Social / Buscar / Listas / Perfil**, con el `SearchFab` central elevado (`src/components/layout/SearchFab.tsx`, prop `active`). Mencionar los badges de `Badge` en Social (recomendaciones) y Perfil (notificaciones).
- Describir el ruteo de `TabShell.tsx` a las 5 pantallas (`HomeScreen`, `SocialScreen`, `SearchScreen`, `ListsScreen`, `ProfileScreen`) con tabpanels via `display: none` y `useNavLayout` (posicion bottom/left).
- Mapear cada seccion previamente bajo "Menu lateral" al tab donde vive hoy, usando la tabla de mapeo de arriba. **Preservar todo el detalle funcional** de cada seccion; solo cambiar el contenedor de navegacion.
- Eliminar/reescribir las menciones de comportamiento de drawer sin analogo: `SwipeableDrawer`, "abrir desde el borde izquierdo", `swipeAreaWidth=20px`, "footer del SideMenu", "lazy-loaded en SideMenu" → su equivalente real (tabs con `React.lazy`/`Suspense` en `TabShell`, footer de version en `ProfileScreen`/`SettingsPanel`).

**Constraints de cobertura R1 dentro de S1 (criticos):**

- **Preservar como texto LITERAL** los tokens `inicio`, `buscar`, `social`, `listas`, `perfil` (hoy todos matchean R1; ver tabla en "Verificacion R1" mas abajo). El rename del header a "Navegacion principal (TabBar + tabs)" + el mapeo por tab los preserva naturalmente (los labels de tab son "Inicio/Social/Buscar/Listas/Perfil"), pero hay que verificarlo explicitamente con grep antes de cerrar.
- **Incluir el literal `modooscuro`** en algun punto del `features.md` reescrito para cerrar el MISSING preexistente de R1. Recomendacion: en la seccion Ajustes/Apariencia, agregar referencia al id del topic, p.ej. una linea que mencione el slug del item de ayuda `modooscuro` (ademas de la prosa "modo oscuro"). Alternativa formalmente equivalente: dejar el MISSING de `modooscuro` como **preexistente fuera de scope** y reformular SC#5 (ver Success Criteria). Decision adoptada en este specs: **cerrar el MISSING** incluyendo el literal, porque el costo es una sola linea y deja R1 totalmente verde.

### S2 — Barrido de las 13 menciones residuales de `SideMenu`

Hay dos conjuntos de menciones a barrer, con tokens distintos (verificado con `grep -in`, 2026-06-12):

- **Token `SideMenu`** (13 lineas): **50, 56, 59, 94, 103, 133, 134, 150, 151, 155, 182, 323, 392**. Estas son las que cuentan para R2 (que matchea el string `SideMenu`). **Todas deben quedar en 0** para `grep -c "SideMenu"`.
- **Frase `menu lateral`** en prosa, sin el token `SideMenu` (2 lineas, case-insensitive): **37 y 50** (la 50 ya esta cubierta por el rename del header en S1). La 37 es prosa ("En el menu lateral, las preguntas...") y NO contiene el token `SideMenu`; se corrige para que `grep -ci "menu lateral"` → 0 (SC#1), pero **no** es una mencion del token `SideMenu`.

Sustituciones:

| Linea | Token | Mencion actual | Sustitucion |
|-------|-------|----------------|-------------|
| 37 | `menu lateral` (prosa, **no** `SideMenu`) | "En el menu lateral, las preguntas muestran badge..." | "En la lista de comentarios del perfil (tab Perfil), las preguntas muestran badge..." |
| 50 | `SideMenu` | `## Menu lateral (SideMenu)` (header) | `## Navegacion principal (TabBar + tabs)` (S1) |
| 56 | `SideMenu` | "Lazy-loaded en SideMenu" (Mis visitas) | "Lazy-loaded. Accesible desde tab Listas (Recientes) y, como historial, tab Perfil" — segun ubicacion real de check-ins |
| 59 | `SideMenu` | "Badge en SideMenuNav con conteo de no leidas" | "Badge en el tab Social (`TabBar`) con conteo de no leidas" |
| 94 | `SideMenu` | "badge SideMenu, etc." | "badge del tab Perfil, etc." |
| 103 | `SideMenu` | "Badge en SideMenu y SettingsPanel" | "Badge en el tab Perfil y en SettingsPanel" |
| 133 | `SideMenu` | "Seccion Seguidos en SideMenu" | "Seccion Seguidos en el tab Social" |
| 134 | `SideMenu` | "Seccion Actividad en SideMenu" | "Seccion Actividad en el tab Social" |
| 150 | `SideMenu` | "seccion Recomendaciones en SideMenu" | "seccion Recomendaciones en el tab Social" |
| 151 | `SideMenu` | "`SideMenuNav` muestra badge..." | "el tab Social (`TabBar`) muestra badge..." |
| 155 | `SideMenu` | "lazy-loaded en SideMenu" | "lazy-loaded en el tab Social" |
| 182 | `SideMenu` | "Accesible desde link en footer del SideMenu" | "Accesible desde link en el footer de ProfileScreen (DEV)" |
| 323 | `SideMenu` | "**Seccion Pendientes en SideMenu**: visible solo si hay acciones pendientes..." | "**Seccion Pendientes** (cola de acciones offline): visible solo si hay acciones pendientes; hoy se expone en el tab **Perfil** (`ProfileScreen`). **VERIFICAR con el componente real** la ubicacion exacta de la cola de pendientes antes de cerrar (puede vivir en `ProfileScreen` o en un panel de sincronizacion); reemplazar el token `SideMenu` por el contenedor real que se confirme." |
| 392 | `SideMenu` | "abre la seccion Recientes en SideMenu", "abre la seccion Listas en SideMenu" (SpecialsSection) | "navega al tab Listas (Recientes)", "navega al tab Listas" |

> Verificacion de cierre de S2: `grep -c "SideMenu" docs/reference/features.md` debe dar `0` (las 13 lineas con el token: 50, 56, 59, 94, 103, 133, 134, 150, 151, 155, 182, 323, 392) y `grep -ci "menu lateral" docs/reference/features.md` debe dar `0` (lineas 37 y 50). Cuidado adicional: el registry `helpGroups.tsx` contiene la frase "menu lateral" en descripciones (`primeros_pasos`, `checkin`) — **eso esta fuera de scope** (no se toca el registry, ver Out of Scope del PRD) y NO afecta R2 (R2 solo lee `features.md`).

### S2b — Item `notificaciones` y skeleton loaders

- En la prosa de notificaciones (seccion "Notificaciones in-app", ya correcta en linea 80: "Campana con badge ... en la barra de busqueda"), reforzar que la campana **no** vive en ningun menu lateral sino en la barra de busqueda del tab Buscar. El registry ya lo dice ("Tocá la campana o andá a Perfil > Notificaciones") — no se toca el registry.
- Documentar skeleton loaders al menos a nivel de mencion: el mapa ya lo documenta (linea 15), el BusinessSheet (linea 44) y CommentsList (linea 65). Agregar mencion de `TabLoader` (`src/components/ui/TabLoader.tsx`) como fallback de `Suspense` al cambiar de tab en `TabShell`.

### S3 — Actualizar `docs/reference/guards/311-help-docs.md`

- En la seccion "Reglas", agregar la regla `R2-features-sidemenu-drift` documentando: que falla si `features.md` menciona `SideMenu`/`Menu lateral` y no existe `src/components/layout/SideMenu.tsx`; que la navegacion real es `TabBar` (`BottomNavigation`) orquestada por `TabShell`; referencia #349.
- Reemplazar en el texto del guard las menciones a `SideMenu` por la estructura de tabs. En particular el bloque "Reglas → 1. Cobertura 1:1" ("debe reflejar toda seccion listada en features.md") esta OK, pero cualquier texto que asuma "secciones del SideMenu" debe pasar a "secciones agrupadas por tab".
- Dejar consistente el ejemplo de mensaje de error del guard con el `desc` real del codigo (`checks.mjs:512`).

> **Nota sobre el otro guard mencionado por Sofia (R2-features-sidemenu-drift ya existe):** el fix es doc-fix (`features.md`) + sync de la doc del guard (`311-help-docs.md`). **NO** se crea ninguna regla nueva ni se toca `scripts/guards/checks.mjs`. El check ya esta implementado (checks.mjs:511-514).

### Verificacion R1 post-reescritura (ids que deben seguir matcheando)

Todos los ids de `HELP_GROUPS` deben encontrar mencion en `features.md` reescrito. Estado actual verificado por id (los 5 tab tokens, el preexistente y los ids FRAGILES que matchean solo dentro del bloque reescrito):

| id | Match HOY | Donde matchea | Accion en el fix |
|----|-----------|---------------|------------------|
| `inicio` | SI | label de tab | preservar literal (label de tab) |
| `buscar` | SI | label de tab | preservar literal (label de tab) |
| `social` | SI | label de tab | preservar literal (label de tab) |
| `listas` | SI | label de tab | preservar literal (label de tab) |
| `perfil` | SI | label de tab | preservar literal (label de tab) |
| `modooscuro` | **NO (preexistente)** | — | incluir literal `modooscuro` → cerrar MISSING |
| `primeros_pasos` | SI | **FRAGIL — solo linea 52, dentro del bloque 50-74 que S1 reescribe** | **preservar el literal** "primeros pasos" (version humana de `primeros_pasos`, la regla R1 hace `_`→espacio) en el `features.md` reescrito. Verificar con `grep -qiE "\bprimeros pasos\b"` antes de cerrar. **Riesgo:** si la reescritura por tab elimina/parafrasea la prosa de "Primeros pasos", R1 suma un MISSING nuevo. |
| `estadisticas` | SI | **FRAGIL — solo linea 69, dentro del bloque 50-74 que S1 reescribe** | **preservar el literal** "estadisticas" en el `features.md` reescrito (tab Perfil). Verificar con `grep -qiE "\bestadisticas\b"` antes de cerrar. **Riesgo:** si la reescritura elimina/parafrasea la prosa de "Estadisticas", R1 suma un MISSING nuevo. |
| resto (`sorprendeme`, `comercio`, `checkin`, `rankings`, ...) | SI | fuera del bloque 50-74 (safe) | no romper al reescribir |

> **Chequeo definitivo (generalizado):** despues de la reescritura de S1+S2, **correr la logica completa de R1** (`scripts/guards/run.mjs --rule 311/R1-helpgroups-coverage`), NO solo verificar los ids tabulados. La tabla destaca los ids fragiles conocidos (`primeros_pasos`, `estadisticas`) porque matchean exclusivamente dentro del bloque que se reescribe, pero el guard runner es el chequeo definitivo: solo se cierra el feature si R1 emite 0 lineas MISSING.

---

## Integracion

El unico "consumidor" del cambio es la documentacion y los lectores/agentes que la usan como fuente de verdad, mas el guard runner que valida R1/R2 contra `features.md`.

### Preventive checklist

- [x] **Service layer**: N/A — no se toca codigo.
- [x] **Duplicated constants**: N/A.
- [x] **Context-first data**: N/A.
- [x] **Silent .catch**: N/A — no se agrega codigo. `checks.mjs` no se toca.
- [x] **Stale props**: N/A.

## Tests

No se agrega codigo de runtime → no aplica cobertura >=80%. El "test" relevante es la ejecucion del guard runner sobre las reglas existentes.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `scripts/guards/run.mjs --rule 311/R2-features-sidemenu-drift` | Verde tras el fix de docs (0 violaciones). Antes del fix: 1 violacion | Guard runner (existente) |
| `scripts/guards/run.mjs --rule 311/R1-helpgroups-coverage` | No suma nuevos MISSING tras la reescritura; cierra el MISSING preexistente `modooscuro` (0 violaciones) | Guard runner (existente) |
| `docs/reference/features.md` | `grep -c "SideMenu"` → `0`; `grep -ci "menu lateral"` → `0`; cada id de `helpGroups.tsx` matchea | Verificacion CI grep (no unit) |

> No se agregan tests unitarios nuevos: `__tests__/helpGroups.test.ts` (ids unicos / voseo) ya cubre el registry y no se modifica el registry.

## Analytics

N/A — sin `logEvent`/`trackEvent` nuevos.

---

## Offline

N/A — el feature no introduce data flows (no lee/escribe Firestore, no llama APIs, no agrega UI).

### Cache strategy / Writes offline / Fallback UI

N/A.

---

## Accesibilidad y UI mobile

N/A — no se agregan componentes ni elementos interactivos. La navegacion real (`TabBar`) ya esta en produccion y fuera de scope.

## Textos y copy

Los textos escritos son contenido de `features.md` y `311-help-docs.md` (documentacion). Aplican las reglas de copy del guard #309 al texto en espanol.

### Reglas de copy aplicadas

- Voseo donde corresponda en prosa user-facing-equivalente.
- Tildes obligatorias: navegacion, busqueda, ubicacion, configuracion, etc.
- Terminologia: "comercios" (no "negocios"), "resenas" (no "reviews").
- Mensaje de error del guard accionable (ya presente en `checks.mjs:513`): "describe SideMenu inexistente; la navegacion real es TabBar (BottomNavigation)".

---

## Decisiones tecnicas

1. **Cerrar el MISSING preexistente `modooscuro` en vez de declararlo fuera de scope.** Sofia detecto que R1 ya falla hoy por `modooscuro` (el id no tiene underscore, asi que la regla `_`→espacio no produce el match con "modo oscuro"). Dado que estamos reescribiendo `features.md` igual, incluir el literal `modooscuro` cuesta una linea y deja R1 totalmente verde. Alternativa rechazada: reformular SC#5 a "R1 no suma nuevos MISSING" y dejar el fallo abierto — rechazada porque deja un guard rojo evitable. SC#5 se reformula igual (ver abajo) para ser explicito sobre que el criterio es "R1 no suma nuevos MISSING **y** se cierra el preexistente".
2. **No tocar el registry `helpGroups.tsx`.** Ya esta alineado a tabs. Las frases "menu lateral" que contiene son descripciones de ayuda y no afectan R2 (que solo lee `features.md`). Tocarlo seria fuera de scope del PRD.
3. **No crear ninguna regla de guard.** `R2-features-sidemenu-drift` ya existe (checks.mjs:511). S3 es solo sincronizacion de su doc.
4. **Drift de `SideMenu` en los otros 8 docs queda fuera de scope.** R2 solo valida `features.md`, asi que no rompe CI. Decision de seguimiento documentada abajo.

---

## Hardening de seguridad

N/A — el feature no introduce superficie de ataque (sin rules, callables, Firestore, Storage ni inputs de usuario). Ver seccion Seguridad del PRD.

### Firestore rules requeridas / Rate limiting / Vectores de ataque

N/A.

---

## Deuda tecnica: mitigacion incorporada

```bash
gh issue list --label security --state open --json number,title   # -> [] (PRD: sin issues)
gh issue list --label "tech debt" --state open --json number,title # -> [] (PRD: sin issues)
```

El propio #349 es el item de deuda tecnica de documentacion que se resuelve.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #349 | Drift `features.md` SideMenu → TabBar + sync doc guard | Fases 1-3 |
| #349 (sub) | MISSING preexistente `modooscuro` en R1 | Fase 1, paso de cierre R1 |

### Followup propuesto (decision de producto, fuera de scope #349)

Los 8 docs restantes que mencionan `SideMenu` (`architecture.md`, `coding-standards.md`, `files.md`, `patterns.md`, `issues.md`, `file-size-directive.md`, `perf-audit-recommendations.md`, `project-reference.md`) siguen drifteados. Riesgo bajo (R2 no los valida), pero es desinformacion para lectores/agentes. **Recomendacion: abrir issue de followup** para barrerlos en un PR aparte. No incluir en este scope (lo confirma el "Out of Scope" del PRD). Nota: `patterns.md` menciona `SideMenu` (lineas ~55, 80, 84, 100, 101) — incluido en ese followup, no aca.

---

## Success Criteria (reformulados con observaciones de Sofia)

1. `grep -c "SideMenu" docs/reference/features.md` devuelve `0` y `grep -ci "menu lateral" docs/reference/features.md` devuelve `0`; la seccion de navegacion describe la `BottomNavigation` de 5 tabs (Inicio/Social/Buscar/Listas/Perfil) + `SearchFab` segun `TabBar.tsx`/`TabShell.tsx`.
2. Cada seccion previamente bajo "Menu lateral" queda mapeada al tab real, sin perder detalle funcional, usando el agrupamiento de `helpGroups.tsx`.
3. El item `notificaciones` aclara que la campana vive en la barra de busqueda; los skeleton loaders (incl. `TabLoader`) quedan documentados como minimo a nivel de mencion.
4. El guard `R2-features-sidemenu-drift` (existente en `scripts/guards/checks.mjs:511`) pasa (0 violaciones) tras el fix; `docs/reference/guards/311-help-docs.md` documenta esa regla y refleja la estructura de tabs.
5. **(Reformulado)** El guard `R1-helpgroups-coverage` **no suma nuevos MISSING** por la reescritura **y** cierra el MISSING preexistente `modooscuro` → R1 verde (0 violaciones). Los tokens literales `inicio`/`buscar`/`social`/`listas`/`perfil` siguen presentes en `features.md`.

---

## Revisión Técnica (Gate Diego)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Revisor:** Diego (solution architect)

**Observaciones:** Dos bloqueantes detectados y cerrados en esta iteracion. (1) La tabla de S2 omitia la linea 323 ("Seccion Pendientes en SideMenu") e incluia mal categorizada la 37 ("menu lateral", prosa, no token `SideMenu`): las 13 lineas reales con el token `SideMenu` son 50, 56, 59, 94, 103, 133, 134, 150, 151, 155, 182, 323, 392 — todas deben quedar en 0; ademas las lineas 37 y 50 con "menu lateral" deben dar 0 en `grep -ci`. La cola de pendientes se confirmo en `src/components/profile/PendingActionsSection.tsx` (tab Perfil), la sustitucion propuesta es correcta. (2) Los ids R1 `primeros_pasos` (linea 52) y `estadisticas` (linea 69) matchean EXCLUSIVAMENTE dentro del bloque 50-74 que S1 reescribe; si la reescritura los parafrasea, R1 suma MISSING nuevos. El plan debe respetar: preservar esos dos literales/versiones humanas, y como condicion de cierre correr la logica COMPLETA de R1 y R2 con el guard runner (no solo verificar los ids tabulados) — 0 lineas MISSING en R1 y 0 violaciones en R2. Sin cambios en codigo de runtime, rules, Firestore ni Functions: N/A correctamente justificados.
