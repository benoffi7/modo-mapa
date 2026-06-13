# PRD: Tech debt — features.md describe un SideMenu inexistente; alinear la fuente de verdad con la navegacion real (TabBar)

**Feature:** help-docs-tabbar-source-of-truth
**Categoria:** content
**Fecha:** 2026-06-09
**Issue:** #349
**Prioridad:** Media (severidad MEDIUM en /health-check)

---

## Contexto

`docs/reference/features.md` (lineas 50-74) describe toda la navegacion principal de la app como un **"Menu lateral (SideMenu)"** con secciones lazy-loaded, pero el codigo real implementa una **BottomNavigation de 5 tabs** (`src/components/layout/TabBar.tsx`: Inicio / Social / Buscar / Listas / Perfil) mas un `SearchFab` central, orquestada por `TabShell.tsx` que rutea a `HomeScreen`, `SocialScreen`, `SearchScreen`, `ListsScreen` y `ProfileScreen`. No existe ningun archivo `SideMenu.tsx` en `src/`. El registry `helpGroups.tsx` / `HelpSection.tsx` ya esta alineado a la estructura de tabs (ids `inicio`, `social`, `buscar`, `listas`, `perfil`, etc.), por lo que es `features.md` — la fuente de verdad declarada por el guard #311 — el que quedo desincronizado (drift).

## Problema

- `features.md` describe un componente `SideMenu` que no existe en el codigo; un lector (humano o agente) que tome ese doc como fuente de verdad razonara sobre una arquitectura de navegacion equivocada (drawer lateral vs bottom tabs).
- El guard #311 declara `features.md` como la fuente de verdad contra la que se valida la Ayuda in-app. Si la fuente de verdad esta drifteada, el guard `R1-helpgroups-coverage` valida contra texto incorrecto y pierde su valor contractual: un item del registry podria "matchear" una seccion mal descrita.
- Gaps menores de documentacion en la Ayuda: la campana de notificaciones vive en la barra de busqueda (no en un menu), el item `notificaciones` no lo aclara; y los skeleton loaders / estados de carga no estan documentados.

## Solucion

Esta es una tarea de **documentacion y guard**, sin cambios en codigo de produccion. El trabajo se concentra en reescribir la seccion de navegacion de `features.md` para reflejar la realidad (`TabBar` + `TabShell`), barrer el resto de menciones a `SideMenu` en la doc, y endurecer el guard #311 para que detecte este tipo de drift en el futuro.

### S1 — Reescribir la seccion de navegacion en `features.md`

- Renombrar el header `## Menu lateral (SideMenu)` (linea 50) a algo como `## Navegacion principal (TabBar + tabs)`.
- Describir la `BottomNavigation` de 5 tabs (Inicio / Social / Buscar / Listas / Perfil) con su `SearchFab` central, segun `src/components/layout/TabBar.tsx`, y el ruteo de `TabShell.tsx` a las 5 pantallas (`HomeScreen`, `SocialScreen`, `SearchScreen`, `ListsScreen`, `ProfileScreen`).
- Mapear cada seccion que hoy esta listada bajo "Menu lateral" (Mis visitas, Seguidos, Actividad, Recomendaciones, Recientes, Sugeridos, Sorprendeme, Mis Listas, Favoritos, Comentarios, Calificaciones, Rankings, Feedback, Estadisticas, Configuracion, Ayuda) al **tab donde vive hoy**. Usar el agrupamiento por tab que ya define `helpGroups.tsx` como referencia de mapeo (Inicio / Buscar / Social / Listas / Perfil / Ajustes).
- Preservar todo el detalle funcional existente de cada seccion (no borrar contenido util); solo corregir el contenedor de navegacion y la ubicacion.
- Reescribir las menciones a comportamiento de drawer que ya no aplican (`SwipeableDrawer`, abrir desde el borde izquierdo, swipeAreaWidth, footer del SideMenu) por su equivalente real o eliminarlas si no tienen analogo en la UI de tabs.

### S2 — Barrer menciones residuales de `SideMenu` en `features.md`

Corregir las 13 menciones detectadas (referencias como `SideMenuNav`, "badge SideMenu", "lazy-loaded en SideMenu", "footer del SideMenu", "seccion X en SideMenu"). Para cada una, sustituir por el contenedor real (tab Perfil, tab Social, tab Listas, barra de busqueda, etc.). Verificar tambien que `SpecialsSection` (linea ~392) no describa navegacion "abre la seccion X en SideMenu" — debe apuntar al tab real.

> Nota de scope: otros docs de referencia (`architecture.md`, `coding-standards.md`, `files.md`, `patterns.md`, `issues.md`, `file-size-directive.md`, `perf-audit-recommendations.md`, `project-reference.md`) tambien mencionan `SideMenu`. Ver "Out of Scope" y la decision de producto pendiente.

### S3 — Alinear la doc del guard #311

- El check automatizado anti-drift **ya existe**: `scripts/guards/checks.mjs` define la regla `R2-features-sidemenu-drift` (grupo `311 help-docs`) que falla si `features.md` menciona `SideMenu`/`Menu lateral` y no existe `src/components/layout/SideMenu.tsx`. La regla referencia explicitamente #349. **Hoy esta regla esta fallando** porque `features.md` aun tiene el drift; corregir el doc (S1/S2) la pone en verde. No hay que escribir el check, solo satisfacerlo.
- Actualizar la **doc** del guard `docs/reference/guards/311-help-docs.md` para: (a) documentar la regla `R2-features-sidemenu-drift` en la seccion "Reglas" (hoy solo describe la cobertura 1:1 contra SideMenu); (b) reemplazar las referencias a `SideMenu` por la estructura de tabs (`TabBar`/`TabShell`) en el texto del guard. El check de codigo y su doc deben quedar consistentes.

> Verificacion (2026-06-09): `R2-features-sidemenu-drift` existe en `scripts/guards/checks.mjs` (linea ~511). El check S3b que un primer draft de este PRD proponia crear ya esta implementado — el trabajo de S3 es satisfacerlo y documentarlo, no crearlo.

### Consideraciones UX

Ninguna. No hay cambios de UI; la navegacion real (TabBar) ya esta en produccion. El unico "consumidor" del cambio es la documentacion y los agentes/lectores que la usan como fuente de verdad.

### Consideraciones de seguridad

Ninguna superficie de ataque nueva. No se tocan rules, callables, Firestore ni inputs de usuario. Ver seccion Seguridad.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — Reescribir seccion de navegacion en `features.md` (header + mapeo por tab) | Alta | M |
| S2 — Barrer 13 menciones residuales de `SideMenu` en `features.md` | Alta | S |
| S2b — Aclarar item `notificaciones` (campana en barra de busqueda) + documentar skeleton loaders | Baja | S |
| S3 — Actualizar doc del guard `311-help-docs.md` (documentar `R2-features-sidemenu-drift` + estructura de tabs) | Media | S |

**Esfuerzo total estimado:** M

> El check de codigo anti-drift (`R2-features-sidemenu-drift`) ya existe en `scripts/guards/checks.mjs`; no es un item de scope. El trabajo de docs (S1/S2) lo pone en verde.

---

## Out of Scope

- Cambios en codigo de produccion (`src/`), componentes, hooks o servicios — la navegacion real ya es correcta.
- Reescribir las menciones a `SideMenu` en los **otros** docs de referencia (`architecture.md`, `coding-standards.md`, `files.md`, etc.). Decision de producto: ver "Deuda tecnica". Por defecto este PRD solo cubre `features.md` (la fuente de verdad del guard #311) + el guard mismo.
- Cambios en `helpGroups.tsx` / `HelpSection.tsx`: el registry ya esta alineado a tabs; solo se ajusta si el barrido revela un item que aun describe drawer.
- Renombrar el directorio `src/components/profile/` o reorganizar componentes por tab.

---

## Tests

Esta es una tarea de documentacion + guard. No agrega codigo de produccion con logica condicional, por lo que la politica de cobertura >=80% no aplica a codigo nuevo de runtime. El testing relevante es la verificacion del guard.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `scripts/guards/checks.mjs` | Guard script (ya existe `R2-features-sidemenu-drift`) | Correr el guard y confirmar que `R2-features-sidemenu-drift` pasa (verde) tras el fix de docs; antes del fix debe estar fallando |
| `docs/reference/features.md` | Doc (no testeable por unit) | Verificacion: 0 ocurrencias de `SideMenu`/`Menu lateral`; cada id de `helpGroups.tsx` matchea un header/seccion de tab |

### Criterios de testing

- El check `R2-features-sidemenu-drift` (ya existente en `scripts/guards/checks.mjs`) pasa tras el fix: `grep -qiE "SideMenu|Menu lateral" docs/reference/features.md` no debe encontrar nada que dispare la regla.
- Verificacion CI-friendly: `grep -c "SideMenu" docs/reference/features.md` debe dar `0` tras el fix.
- El check `R1-helpgroups-coverage` existente debe seguir pasando contra el `features.md` reescrito (cada id del registry encuentra su mencion — slug literal o version humana con `_` -> espacio).
- No aplica cobertura >=80% (no hay codigo de runtime nuevo). No se agregan tests unitarios nuevos: el guard ya esta cubierto por su propio mecanismo de ejecucion en el guard runner.

---

## Seguridad

Esta feature no escribe ni lee Firestore, no agrega endpoints, no toca rules ni Storage, no procesa input de usuario. No hay superficie de ataque nueva.

- [x] Sin secretos en codigo: el PRD y los docs no exponen credenciales, infra interna ni emails.
- [x] PR description profesional, sin detalles de infraestructura interna.
- [x] No se agregan colecciones, callables ni inputs de usuario.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Ninguna nueva | N/A — cambio de documentacion + guard | N/A |

No aplica: el feature no escribe a Firestore, no agrega campos a `userSettings`, no lee datos de usuario ni expone superficie para scraping.

---

## Deuda tecnica y seguridad

```bash
gh issue list --label security --state open --json number,title   # -> [] (sin issues abiertos)
gh issue list --label "tech debt" --state open --json number,title # -> [] (sin issues abiertos)
```

No hay issues abiertos con label `security` ni `tech debt` al momento de redactar (2026-06-09). El propio #349 es un item de deuda tecnica de documentacion.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #311 (guard help-docs / fuente de verdad) | afecta | El guard valida la Ayuda contra `features.md`; corregir la fuente de verdad y endurecer el guard como parte de este feature |
| #328 (helpGroups coverage, +7 tests) | contexto | El registry ya esta alineado a tabs; sirve como referencia de mapeo seccion->tab |
| #309 (guard voseo) | no agravar | Cualquier texto reescrito en `features.md` mantiene voseo rioplatense consistente |

### Mitigacion incorporada

- **Cerrar el loop del drift detectado por /health-check**: el guard `R2-features-sidemenu-drift` (ya implementado en `scripts/guards/checks.mjs`, referencia #349) detecta automaticamente este tipo de drift. Hoy esta en rojo; corregir `features.md` (S1/S2) lo pone en verde y cierra el loop. S3 sincroniza la doc del guard con el check de codigo.
- **No empeorar el drift en otros docs**: este PRD documenta explicitamente que otros docs aun mencionan `SideMenu` y deja la decision de barrerlos como item de producto, en vez de fixearlos a medias.

---

## Robustez del codigo

No se agregan hooks ni componentes async. Si S3b agrega un check al guard script:

### Checklist de hooks async

- [x] N/A — no hay `useEffect`, handlers async ni `setState`.
- [x] El check del guard (si se agrega) es sincrono (lectura de archivo + grep), sin side effects.
- [x] No se agregan archivos en `src/hooks/` ni constantes de localStorage.
- [x] `features.md` y el guard no superan limites de lineas de codigo (son docs).

### Checklist de observabilidad

- [x] N/A — no hay Cloud Function trigger, service con queries ni `trackEvent` nuevo.

### Checklist offline

- [x] N/A — no hay formularios ni writes a Firestore.

### Checklist de documentacion

- [x] No hay nuevas secciones de HomeScreen (no se toca `homeSections.ts`).
- [x] No hay analytics events nuevos.
- [x] No hay tipos nuevos.
- [x] `docs/reference/features.md` se actualiza (es el objetivo central del feature).
- [ ] `docs/reference/firestore.md`: N/A — no hay colecciones/campos nuevos.
- [ ] `docs/reference/patterns.md`: evaluar si conviene barrer su mencion a `SideMenu` (ver Out of Scope / decision de producto).
- [x] `docs/reference/guards/311-help-docs.md` se actualiza a la estructura de tabs.

---

## Offline

No aplica. El feature no introduce data flows: no lee ni escribe Firestore, no llama APIs externas, no agrega UI.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Ninguna | N/A | N/A | N/A |

### Checklist offline

- [x] Reads de Firestore: N/A — ninguno.
- [x] Writes: N/A — ninguno.
- [x] APIs externas: N/A — ninguna.
- [x] UI: N/A — no hay UI nueva.
- [x] Datos criticos: N/A.

### Esfuerzo offline adicional: S (nulo)

---

## Modularizacion y % monolitico

No se toca codigo de UI, layout ni estado global. El feature no puede aumentar el % monolitico porque no agrega imports, contextos ni componentes.

### Checklist modularizacion

- [x] No se agrega logica de negocio (solo docs + guard script).
- [x] No se agregan componentes.
- [x] No se agregan `useState` a AppShell/SideMenu (SideMenu ni existe).
- [x] No hay props ni dependencias a contextos de layout.
- [x] No hay handlers de accion (no hay UI).
- [x] Ningun archivo nuevo importa de `firebase/firestore`, `firebase/functions` ni `firebase/storage`.
- [x] No se agregan archivos en `src/hooks/`.
- [x] Ningun archivo nuevo de codigo (el guard check ya existe en `scripts/guards/checks.mjs`).
- [x] No se agregan converters.
- [x] No se agregan archivos en `components/menu/` (no existe).
- [x] No se necesita estado global nuevo.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No se tocan componentes |
| Estado global | = | No se toca estado |
| Firebase coupling | = | No se toca Firebase |
| Organizacion por dominio | = | Solo docs + guard; sin cambios en `src/` |

---

## Accesibilidad y UI mobile

No se agregan componentes interactivos ni UI. La navegacion real (TabBar) ya esta en produccion y fuera de scope.

### Checklist de accesibilidad

- [x] N/A — no hay `IconButton`, elementos clickables, touch targets, imagenes ni formularios nuevos.

### Checklist de copy

- [x] Todos los textos reescritos en `features.md` en espanol con tildes correctas.
- [x] Tono consistente: voseo donde corresponda (alineado con guard #309).
- [x] Terminologia: "comercios" (no "negocios"), "resenas" (no "reviews").
- [ ] Strings reutilizables centralizados: N/A — son textos de documentacion, no UI.
- [x] Mensajes de error del guard (si se agrega check) accionables: ej "features.md menciona SideMenu (componente inexistente); usar TabBar/tabs".

---

## Success Criteria

1. `grep -c "SideMenu" docs/reference/features.md` devuelve `0`; la seccion de navegacion describe la `BottomNavigation` de 5 tabs (Inicio/Social/Buscar/Listas/Perfil) + `SearchFab` segun `TabBar.tsx`/`TabShell.tsx`.
2. Cada seccion previamente listada bajo "Menu lateral" queda mapeada al tab real donde vive hoy, sin perder detalle funcional, usando el agrupamiento de `helpGroups.tsx` como referencia.
3. El item `notificaciones` aclara que la campana vive en la barra de busqueda; los skeleton loaders quedan documentados como minimo a nivel de mencion.
4. El guard `R2-features-sidemenu-drift` (ya existente en `scripts/guards/checks.mjs`) pasa (verde) tras el fix; `docs/reference/guards/311-help-docs.md` documenta esa regla y refleja la estructura de tabs.
5. El check `R1-helpgroups-coverage` existente sigue pasando contra el `features.md` reescrito (cada id del registry encuentra su mencion).

---

## Validacion Funcional

**Analista**: Sofia
**Fecha**: 2026-06-10
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos cerrados en esta iteracion

- IMPORTANTE: "El PRD proponia crear un check anti-drift (S3b) que ya existe" → resuelto: se verifico que `R2-features-sidemenu-drift` ya esta implementado en `scripts/guards/checks.mjs` (linea ~511, referencia #349). Se reescribio S3 para satisfacer/documentar el check existente en vez de crearlo, y se ajustaron Scope, Tests, Deuda tecnica y Success Criteria en consecuencia.
- IMPORTANTE: "Count de menciones de SideMenu incorrecto (14 vs 13)" → corregido en S2 y Scope tras verificar con `grep -c`.
- OBSERVACION: "La mayoria de las categorias de edge-case (auth, offline, billing, privacy, multi-tab, race conditions, mobile UI) son N/A" → justificado: el feature no introduce codigo de runtime, solo documentacion + sincronizacion de doc de guard. Las secciones lo marcan N/A correctamente.

### Observaciones abiertas para el implementador

- Decision de producto (Gonzalo): el "Out of Scope" deja explicitamente afuera el barrido de menciones a `SideMenu` en los otros 8 docs de referencia (`architecture.md`, `coding-standards.md`, `files.md`, `patterns.md`, `issues.md`, `file-size-directive.md`, `perf-audit-recommendations.md`, `project-reference.md`). Riesgo bajo: el guard `R2-features-sidemenu-drift` solo valida `features.md`, asi que el otro drift no rompe CI, pero sigue siendo desinformacion para lectores/agentes. Evaluar al armar el plan si se abre un issue de followup o se incluye en este scope.


## Validacion Funcional (Gate Sofia)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-10
**Revisor:** Sofia (analista funcional)

**Observaciones clave (detalle completo incorporado a specs):** R1-helpgroups-coverage YA falla hoy por el id 'modooscuro' — reformular SC#5 a 'R1 no suma nuevos MISSING' o incluir el literal en features.md. Path real: src/components/profile/helpGroups.tsx. Asegurar que inicio/buscar/social/listas/perfil sigan como texto literal.
