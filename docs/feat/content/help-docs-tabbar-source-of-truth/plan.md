# Plan: features.md describe un SideMenu inexistente — alinear la fuente de verdad con la navegacion real (TabBar)

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Issue:** #349
**Fecha:** 2026-06-12

> Basado en `specs.md` (VALIDADO CON OBSERVACIONES por Diego, 2026-06-12). Feature de **documentacion pura**: no se toca `src/`, rules, Firestore, Cloud Functions, Storage ni `scripts/guards/checks.mjs`. Solo 2 archivos de doc: `docs/reference/features.md` y `docs/reference/guards/311-help-docs.md`.

---

## Estimacion de tamaño de archivos

| Archivo | LOC actual | LOC estimado post-cambio | Estrategia si supera 400 |
|---------|-----------|--------------------------|--------------------------|
| `docs/reference/features.md` | ~471 | ~471-480 (reescritura del bloque 50-74 + ediciones puntuales de 13 lineas) | N/A — doc, sin limite de componente |
| `docs/reference/guards/311-help-docs.md` | ~96 | ~105-110 (documentar R2 + sync de tabs) | N/A |

Sin archivos de runtime. No aplica el limite de 400 LOC de componentes.

---

## Fases de implementacion

**Branch:** `fix/349-help-docs-tabbar-source-of-truth` (desde `new-home`)

**Owner:** unico — `documentation` (delegado por `manu`). Sin paralelismo entre agentes → sin conflictos de ownership. Sin codigo de produccion, por lo que no intervienen `luna`/`nico`.

### Fase 1: Reescritura de la seccion de navegacion (S1) — `features.md` lineas 50-74

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Renombrar header `## Menu lateral (SideMenu)` → `## Navegacion principal (TabBar + tabs)` (cierra la mencion `SideMenu` de la linea 50 y la frase "menu lateral" del mismo header). |
| 2 | `docs/reference/features.md` | Describir la `BottomNavigation` de 5 tabs segun `src/components/layout/TabBar.tsx`: **Inicio / Social / Buscar / Listas / Perfil**, con el `SearchFab` central elevado (`src/components/layout/SearchFab.tsx`, prop `active`) y los badges de `Badge` en Social (recomendaciones) y Perfil (notificaciones). |
| 3 | `docs/reference/features.md` | Describir el ruteo de `TabShell.tsx` a las 5 pantallas (`HomeScreen`, `SocialScreen`, `SearchScreen`, `ListsScreen`, `ProfileScreen`), tabpanels via `display:none`, `useNavLayout` (bottom/left) y fallback `Suspense` con `React.lazy`. |
| 4 | `docs/reference/features.md` | Mapear cada seccion previamente bajo "Menu lateral" al tab donde vive hoy, usando la tabla de mapeo de specs (§"Mapeo de ids del registry → tab"). **Preservar todo el detalle funcional**; solo cambiar el contenedor de navegacion. Eliminar/reescribir comportamientos de drawer sin analogo (`SwipeableDrawer`, "borde izquierdo", `swipeAreaWidth=20px`, "footer del SideMenu", "lazy en SideMenu") → su equivalente real (tabs con `React.lazy`/`Suspense`, footer de version en `ProfileScreen`/`SettingsPanel`). |
| 5 | `docs/reference/features.md` | **OBS DIEGO #2 (R1 ids fragiles):** preservar como **literal** la version humana de `primeros_pasos` ("primeros pasos") y de `estadisticas` ("estadisticas") dentro del bloque reescrito — hoy matchean R1 EXCLUSIVAMENTE en lineas 52 y 69, dentro del bloque que se reescribe. Si la reescritura los parafrasea, R1 suma MISSING nuevos. Verificar con `grep -qiE "\bprimeros pasos\b"` y `grep -qiE "\bestadisticas\b"` antes de cerrar. |
| 6 | `docs/reference/features.md` | **Cerrar el MISSING preexistente de R1:** incluir el literal `modooscuro` (slug del item de ayuda) en la seccion Ajustes/Apariencia, ademas de la prosa "modo oscuro" (la regla R1 hace `_`→espacio y `modooscuro` no tiene underscore → no matchea "modo oscuro"). Decision adoptada en specs (D1). |
| 7 | (verificacion) | `grep -qiE "\b(inicio\|buscar\|social\|listas\|perfil)\b"` siguen presentes (labels de tab) — preservados naturalmente por el mapeo por tab. |

### Fase 2: Barrido de las 13 menciones residuales de `SideMenu` (S2) — `features.md`

**OBS DIEGO #1:** las 13 lineas reales con el token `SideMenu` son **50, 56, 59, 94, 103, 133, 134, 150, 151, 155, 182, 323, 392** (la 323 "Seccion Pendientes" no debe omitirse). Ademas las lineas **37 y 50** con la frase "menu lateral" deben dar 0 en `grep -ci`.

| Paso | Linea | Token | Sustitucion (segun tabla de specs §S2) |
|------|-------|-------|-----------------------------------------|
| 1 | 50 | `SideMenu` | header → `## Navegacion principal (TabBar + tabs)` (ya hecho en Fase 1 paso 1) |
| 2 | 37 | `menu lateral` (prosa, **no** token) | "En la lista de comentarios del perfil (tab Perfil), las preguntas muestran badge..." |
| 3 | 56 | `SideMenu` | "Lazy-loaded. Accesible desde tab Listas (Recientes) y, como historial, tab Perfil" |
| 4 | 59 | `SideMenu` | "Badge en el tab Social (`TabBar`) con conteo de no leidas" |
| 5 | 94 | `SideMenu` | "badge del tab Perfil, etc." |
| 6 | 103 | `SideMenu` | "Badge en el tab Perfil y en SettingsPanel" |
| 7 | 133 | `SideMenu` | "Seccion Seguidos en el tab Social" |
| 8 | 134 | `SideMenu` | "Seccion Actividad en el tab Social" |
| 9 | 150 | `SideMenu` | "seccion Recomendaciones en el tab Social" |
| 10 | 151 | `SideMenu` | "el tab Social (`TabBar`) muestra badge..." |
| 11 | 155 | `SideMenu` | "lazy-loaded en el tab Social" |
| 12 | 182 | `SideMenu` | "Accesible desde link en el footer de ProfileScreen (DEV)" |
| 13 | 323 | `SideMenu` | "**Seccion Pendientes** (cola de acciones offline): visible solo si hay acciones pendientes; se expone en el tab **Perfil** (`ProfileScreen`)." La cola vive en `src/components/profile/PendingActionsSection.tsx` (tab Perfil), confirmado por Diego — usar ese contenedor. |
| 14 | 392 | `SideMenu` | "navega al tab Listas (Recientes)", "navega al tab Listas" (SpecialsSection) |
| 15 | (verificacion) | — | `grep -c "SideMenu" docs/reference/features.md` → **0**; `grep -ci "menu lateral" docs/reference/features.md` → **0**. |

> Nota fuera de scope: `helpGroups.tsx` contiene la frase "menu lateral" en descripciones (`primeros_pasos`, `checkin`). NO se toca el registry (Out of Scope del PRD) y NO afecta R2 (R2 solo lee `features.md`).

### Fase 3: Item `notificaciones` + skeleton loaders (S2b) — `features.md`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Reforzar en la prosa de "Notificaciones in-app" (linea ~80) que la campana vive en la **barra de busqueda** (tab Buscar), no en ningun menu lateral. El registry ya lo dice — no se toca. |
| 2 | `docs/reference/features.md` | Agregar mencion de `TabLoader` (`src/components/ui/TabLoader.tsx`) como fallback de `Suspense` al cambiar de tab en `TabShell` (skeleton loaders del mapa/BusinessSheet/CommentsList ya documentados en lineas 15/44/65). |

### Fase 4: Sync de la doc del guard (S3) — `docs/reference/guards/311-help-docs.md`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/guards/311-help-docs.md` | En "Reglas", documentar `R2-features-sidemenu-drift`: falla si `features.md` menciona `SideMenu`/`Menu lateral` y no existe `src/components/layout/SideMenu.tsx`; la navegacion real es `TabBar` (`BottomNavigation`) orquestada por `TabShell`; referencia #349. |
| 2 | `docs/reference/guards/311-help-docs.md` | Reemplazar las menciones a `SideMenu` por la estructura de tabs; "secciones del SideMenu" → "secciones agrupadas por tab". |
| 3 | `docs/reference/guards/311-help-docs.md` | Dejar el ejemplo de mensaje de error consistente con el `desc` real del codigo (`checks.mjs:512-513`). **NO** crear regla nueva ni tocar `checks.mjs` (R2 ya existe en checks.mjs:511-514). |

### Fase 5: Verificacion de cierre (gate de regresion)

**OBS DIEGO #3 — condicion de cierre:** correr la logica COMPLETA de R1 y R2 con el guard runner, no solo verificar los ids tabulados.

| Paso | Comando | Criterio |
|------|---------|----------|
| 1 | `node scripts/guards/run.mjs --rule 311/R2-features-sidemenu-drift` (o `npm run guards` filtrando R2) | **0 violaciones** (antes del fix: 1). |
| 2 | `node scripts/guards/run.mjs --rule 311/R1-helpgroups-coverage` | **0 lineas MISSING** (cierra el preexistente `modooscuro` y no suma nuevos por la reescritura). |
| 3 | `grep -c "SideMenu" docs/reference/features.md` | **0** |
| 4 | `grep -ci "menu lateral" docs/reference/features.md` | **0** |
| 5 | `npm run guards:check` | baseline no sube (no se introducen violaciones nuevas en otras reglas). |

---

## Orden de implementacion

```
1. Fase 1 paso 1        (rename header — desbloquea S1 y cierra mencion linea 50)
2. Fase 1 pasos 2-6     (reescritura del bloque por tab + literales R1 fragiles + modooscuro)
3. Fase 1 paso 7        (verificar tokens de tab presentes)
4. Fase 2 pasos 1-14    (barrido de las 13 lineas SideMenu + linea 37 "menu lateral")
5. Fase 2 paso 15       (grep de cierre SideMenu/menu lateral = 0)
6. Fase 3               (notificaciones + TabLoader)
7. Fase 4               (sync doc del guard 311)
8. Fase 5               (guard runner COMPLETO R1+R2 = 0/0 — gate de cierre)
9. /merge → docs-site-maintainer regenera sidebar/index si aplica
```

Dependencia clave: Fase 2 depende de Fase 1 (el rename del header y la reescritura tocan lineas que se solapan). Fase 5 requiere Fases 1-4 terminadas. Todo en un solo branch, commits atomicos por fase.

---

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| La reescritura del bloque 50-74 parafrasea `primeros pasos` / `estadisticas` y R1 suma MISSING nuevos (OBS Diego #2) | Preservar ambos literales (Fase 1 paso 5) y verificar con grep dedicado + guard runner completo (Fase 5 paso 2) antes de cerrar. |
| Se omite la linea 323 ("Seccion Pendientes en SideMenu") y R2 queda en 1 (OBS Diego #1) | La tabla de Fase 2 incluye explicitamente la 323 con su sustitucion verificada (`PendingActionsSection.tsx`, tab Perfil). El grep de cierre (paso 15) lo captura. |
| `modooscuro` sigue MISSING tras el fix | Fase 1 paso 6 incluye el literal `modooscuro`; Fase 5 paso 2 lo valida con el guard runner. |
| Las lineas se corren al editar y los numeros de specs dejan de coincidir | Editar por contenido (match de string unico), no por numero de linea; re-leer el archivo tras la reescritura grande de Fase 1 antes de Fase 2. |
| Drift de `SideMenu` en los otros 8 docs | Fuera de scope (R2 solo valida `features.md`). Followup propuesto en specs §"Followup propuesto" — abrir issue aparte, no en este PR. |

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/*` — N/A (sin codigo)
- [x] Archivos nuevos en carpeta de dominio correcta — N/A (solo docs existentes)
- [x] Logica de negocio en hooks/services — N/A
- [x] Si se toca archivo con deuda, se incluye el fix — el feature ES el fix de deuda doc
- [x] Ningun archivo de runtime — N/A al limite de 400 LOC

## Guardrails de seguridad

- [x] Colecciones/campos/rules/CF/Storage — N/A (sin codigo de produccion)
- [x] No hay secrets, admin emails ni credenciales en archivos commiteados — verificado (solo prosa de doc)

## Guardrails de observabilidad

- [x] CF trigger / service / `trackEvent` nuevos — N/A
- [x] `logger.error` fuera de `import.meta.env.DEV` — N/A

## Guardrails de accesibilidad y UI

- [x] `IconButton`/`Typography onClick`/touch targets/`<img>` onError/`httpsCallable` — N/A (sin UI nueva)

## Guardrails de copy

- [x] Voseo en prosa user-facing-equivalente — aplicar en Fases 1-3
- [x] Tildes obligatorias (navegacion, busqueda, ubicacion, configuracion) — el guard #309 corre sobre `features.md`
- [x] Terminologia: "comercios" (no "negocios"), "resenas" (no "reviews") — verificar en la reescritura
- [x] Strings reutilizables en `src/constants/messages/` — N/A (contenido de doc, no UI)

## Criterios de done

- [ ] `## Navegacion principal (TabBar + tabs)` describe los 5 tabs + `SearchFab` + ruteo `TabShell` (SC#1)
- [ ] Cada seccion previa de "Menu lateral" mapeada a su tab real, sin perder detalle (SC#2)
- [ ] Item `notificaciones` aclara campana en barra de busqueda; `TabLoader` documentado (SC#3)
- [ ] `grep -c "SideMenu" docs/reference/features.md` → 0 (las 13 lineas: 50,56,59,94,103,133,134,150,151,155,182,323,392)
- [ ] `grep -ci "menu lateral" docs/reference/features.md` → 0 (lineas 37 y 50)
- [ ] `311-help-docs.md` documenta `R2-features-sidemenu-drift` y refleja tabs (SC#4)
- [ ] Literales `primeros pasos` y `estadisticas` preservados; `modooscuro` incluido (OBS Diego #2 + cierre preexistente)
- [ ] Guard runner COMPLETO: R1 = 0 MISSING **y** R2 = 0 violaciones (OBS Diego #3, gate de cierre)
- [ ] `npm run guards:check` no sube baseline
- [ ] No se toco `src/`, rules, Firestore, CF ni `scripts/guards/checks.mjs`

---

## Validacion de Plan

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Ciclo:** 1

**Observaciones para el implementador:**

1. **Sellos previos OK.** PRD VALIDADO CON OBSERVACIONES por Sofia (prd.md:269-275); specs VALIDADO CON OBSERVACIONES por Diego (specs.md:274-280). Habilitado a revisar plan.

2. **Cobertura specs->plan completa y verificada contra el repo.** Las 13 lineas con token `SideMenu` (50,56,59,94,103,133,134,150,151,155,182,323,392) y las 2 lineas "menu lateral" (37,50) coinciden exactamente con `grep` real. `PendingActionsSection.tsx` (tab Perfil) y `TabLoader.tsx` existen. R1 (checks.mjs:504) y R2 (checks.mjs:511) existen. Literales fragiles confirmados: "primeros pasos" (linea 52) y "estadisticas" (linea 69) viven DENTRO del bloque 50-74 que se reescribe; "modooscuro" NO existe hoy (MISSING preexistente real). Las 3 OBS de Diego tienen mitigacion agendada en la tabla de Riesgos.

3. **Ordering y granularidad correctos.** Owner unico (`documentation`), sin paralelismo -> cero riesgo de overlap de ownership. Fase 1 (reescritura) antes de Fase 2 (barrido); Fase 5 (gate) despues de 1-4. Commits atomicos por fase. Rollback trivial (revert de commit de doc, reversible, sin migracion de datos).

4. **IMPORTANTE (no bloqueante): linea 50 editada en dos tablas.** Fase 1 paso 1 renombra el header y Fase 2 paso 1 la lista como "ya hecho". El orden es correcto, pero tras la reescritura grande de Fase 1 los numeros de linea corren. Editar SIEMPRE por contenido (match de string unico), no por numero de linea, y re-leer `features.md` antes de empezar Fase 2. El plan ya lo contempla (Riesgos, linea 119) — solo reforzarlo en ejecucion.

5. **OBSERVACION — gate Fase 5 paso 5 (`guards:check`): el problema es que el baseline BAJA, no que sube.** `check-baseline.mjs` (lineas 11-12) falla en AMBOS sentidos: si una regla sube (regresion) Y si una regla baja (exige `--update` con justificacion). El fix de #349 reduce R1 (1->0) y R2 (1->0), por lo que `npm run guards:check` va a FALLAR con "rule REDUCED" hasta que se corra `npm run guards:baseline` para registrar los nuevos counts 0/0. El criterio del plan ("baseline no sube") es incompleto: agregar paso explicito de actualizar el baseline tras cerrar R1/R2 (o documentarlo como parte del gate de cierre). Esto lo va a frenar en el push si no esta previsto.

**Listo para pasar a implementacion:** Si, con las observaciones 4 y 5. Ningun bloqueante. No se abre ciclo con specs-plan-writer.
