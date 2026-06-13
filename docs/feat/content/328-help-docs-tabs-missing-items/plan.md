# Plan: Help-docs — outdated BusinessDetailScreen tabs + missing items en HelpSection

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Issue:** #328
**Fecha:** 2026-04-29

---

## Estimacion de tamaño de archivos

| Archivo | LOC actual | LOC estimado post-cambio | Estrategia si supera 400 |
|---------|-----------|-------------------------|--------------------------|
| `src/components/profile/helpGroups.tsx` | 230 | ~285-300 (warn @ 300) | Split por grupo en follow-up — NO en este PR (decision D6 del specs) |
| `src/components/profile/__tests__/helpGroups.test.ts` | 66 | ~120 | N/A |
| `docs/reference/guards/311-help-docs.md` | 96 | ~100 | N/A |
| `docs/reference/features.md` | 471 | ~471-475 (mencion minima de 1-2 ids si faltan) | N/A |

Ningun archivo proyectado supera 400 LOC. `helpGroups.tsx` queda rozando warn — aceptable per Sofia.

---

## Fases de implementacion

### Fase 1: Editar registry `helpGroups.tsx`

**Branch:** `feat/328-help-docs-tabs-missing-items`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/helpGroups.tsx` | Agregar imports de iconos nuevos: `AutoAwesomeOutlinedIcon`, `ExploreOutlinedIcon`, `LocalOfferOutlinedIcon`, `BarChartOutlinedIcon`, `ExitToAppOutlinedIcon` (verificar que existan en `@mui/icons-material/*Outlined`) |
| 2 | `src/components/profile/helpGroups.tsx` | **Reescribir item `comercio`** (description completa). Mencionar: sheet compacto + CTA "Ver detalles", pantalla full en `/comercio/:id`, 5 chip tabs (Criterios/Precio/Tags/Foto/Opiniones), deep link `?tab=...`, sub-pestañas Comentarios/Preguntas dentro del tab Opiniones, "Mejor respuesta", limite 20/dia compartido, offline queue |
| 3 | `src/components/profile/helpGroups.tsx` | **Editar item `buscar`**: agregar al final "Si el mapa no carga (Maps API caida o sin conexion), la app cambia automaticamente a vista de lista para que sigas buscando." |
| 4 | `src/components/profile/helpGroups.tsx` | **Reescribir el bloque "Recientes" del item `listas`**: cambiar la descripcion de Recientes para reflejar el historial unificado (visitas locales + check-ins de Firestore, deduplicados, fecha mas reciente). Mantener el resto del item intacto |
| 5 | `src/components/profile/helpGroups.tsx` | **Agregar 5 items nuevos** en sus grupos correspondientes: `sorprendeme` (grupo Inicio), `tus_intereses_home` (grupo Inicio), `tus_intereses_perfil` (grupo Perfil), `estadisticas` (grupo Perfil), `confirmacion_salir` (grupo Buscar). Textos en specs.md > "Items nuevos (S5)" |
| 6 | `src/components/profile/helpGroups.tsx` | **Agregar mencion pull-to-refresh** al final de las descripciones de `inicio`, `social`, `listas`, `notificaciones` (textos en specs.md > "Items extendidos con mencion pull-to-refresh") |
| 7 | `src/components/profile/helpGroups.tsx` | **Copy pass S7**: aplicar tildes y voseo a TODOS los strings de `description` y `title` (tabla en specs.md > "Copy pass S7 — tildes/voseo en strings legacy"). Usar `replace_all` con cuidado (verificar ocurrencias 1 a 1 — algunas palabras como "Configuracion" aparecen muchas veces). Re-leer el archivo despues |
| 8 | (verificacion) | `npm run build` local para asegurar que tipos y JSX compilan. `wc -l src/components/profile/helpGroups.tsx` para confirmar <300 LOC |

### Fase 2: Extender tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/__tests__/helpGroups.test.ts` | Agregar 7 casos nuevos (codigo en specs.md > "Casos nuevos a agregar"): (a) `comercio` 5 chip tabs + deep link, (b) `comercio` distingue chip tabs de sub-pestañas, (c) `buscar` auto-fallback lista, (d) 5 ids nuevos presentes, (e) ids nuevos en grupo correcto, (f) `listas` Recientes unificado + check-in + visitad, (g) >=3 de inicio/social/listas/notificaciones mencionan pull-to-refresh |
| 2 | `src/components/profile/__tests__/helpGroups.test.ts` | Confirmar que los casos existentes siguen pasando (no editar). En particular: `'item "comercio" aclara que 20/dia es compartido entre comentarios y preguntas'` debe seguir verde — la reescritura de `comercio` mantiene la palabra "compartido" |
| 3 | (verificacion) | `npm test -- helpGroups.test.ts` local. Todos los casos en verde |

### Fase 3: Verificar guard #311 — presencia en `features.md`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | (verificacion) | Correr el script del guard manualmente: `for id in $(grep -oP "id:\s*'\K[a-z_-]+" src/components/profile/helpGroups.tsx); do human=$(echo "$id" \| tr '_' ' '); grep -qiE "\b($id\|$human)\b" docs/reference/features.md \|\| echo "MISSING: $id"; done`. Verificar que ningun id nuevo reporta MISSING |
| 2 | `docs/reference/features.md` | **Si algun id nuevo esta MISSING**, agregar mencion textual minima en la seccion correspondiente. Hint del estado actual al 2026-04-29: `Sorprendeme` y `MapErrorBoundary` ya aparecen; `tus_intereses` aparece como header `## Seguir Tags / Tus Intereses (#205)` y como `tus intereses` (sin underscore) — la regex del guard convierte `tus_intereses_home` a `tus intereses home`, asi que probablemente falte la palabra "home"/"perfil" para los dos ids granulares; `estadisticas` aparece en el bloque de SideMenu ("**Estadisticas**: distribucion de ratings...") — match probable; `confirmacion_salir` no aparece (la frase "Confirmacion al salir" si esta presente en linea 46 — match con `tr '_' ' '` da "confirmacion salir", la regex con `\b` matchea el header "Confirmación al salir" si se quita la tilde; agregar mencion minima si el guard reporta MISSING). **Bloqueante para el merge** |
| 3 | (verificacion) | Re-correr el script. Cero MISSING. Si modificaste `features.md`, verificar que las menciones agregadas no rompen la prosa existente |

### Fase 4: Actualizar doc de referencia del guard

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/guards/311-help-docs.md` | En la seccion "Script CI-friendly" (linea 47-58 aprox), agregar comentario en el pseudocodigo con los nuevos ids esperados como ejemplo. Sugerencia de lugar: justo despues del `# Extraer ids del registry`, agregar: `# Ejemplos de ids esperados (post #328): comercio, buscar, sorprendeme, tus_intereses_home, tus_intereses_perfil, estadisticas, confirmacion_salir, ...` |
| 2 | `docs/reference/guards/311-help-docs.md` | (Opcional, no bloqueante) En la seccion "Reglas", actualizar la regla 1 si se considera oportuno mencionar la nueva regex `[a-z_-]+` (snake_case con underscore). Ya soportado por el script — solo doc |

### Fase 5: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | N/A — sin cambios de rules / auth / storage |
| 2 | `docs/reference/firestore.md` | N/A — sin cambios de colecciones / campos |
| 3 | `docs/reference/features.md` | Cubierto en Fase 3 (mencion minima de ids nuevos si faltan). No requiere cambios estructurales adicionales |
| 4 | `docs/reference/patterns.md` | N/A — el patron HELP_GROUPS ya esta documentado (#311). Agregar si surge un patron nuevo (no es el caso) |
| 5 | `docs/reference/project-reference.md` | Actualizar version (si bump aplica) y resumen de features con una linea referenciando #328 ("resincronizacion de Ayuda con BusinessDetailScreen + 5 items nuevos"). Coordinar con `manu` al delegar |
| 6 | `src/components/menu/HelpSection.tsx` | N/A — render puro del registry, sin cambios |
| 7 | `docs/reference/guards/311-help-docs.md` | Cubierto en Fase 4 |

---

## Orden de implementacion

```
1. Fase 1 paso 1-2     (imports + reescritura comercio)        — el cambio mas grande, hacer primero
2. Fase 1 paso 3-4     (buscar + listas Recientes)
3. Fase 1 paso 5       (5 items nuevos)
4. Fase 1 paso 6       (mencion pull-to-refresh inline)
5. Fase 1 paso 7       (copy pass tildes/voseo) — al final para no peleear con renames
6. Fase 1 paso 8       (build local)
7. Fase 2 paso 1-2     (extender tests)
8. Fase 2 paso 3       (correr tests)
9. Fase 3              (guard check + features.md si falta)
10. Fase 4             (doc del guard #311)
11. Fase 5             (otros docs si aplica)
12. /merge → docs auto-actualizan changelog/backlog
```

Dependencia clave: Fase 2 puede empezar en paralelo con Fase 1 (escribir los tests apuntando al estado deseado, correr al final). Fase 3 requiere que Fase 1 este terminada.

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Copy pass S7 con `replace_all` rompe palabras donde "Configuracion" / "Seccion" aparecen como parte de un nombre propio o ya tienen tilde | Revisar diff completo antes de commitear. Preferir `replace_all` solo cuando la palabra es ambigua-libre (ej: "rapidas" → "rápidas"); para "Configuracion" → "Configuración" usar replace_all (no hay ambiguedad razonable). Verificar visualmente |
| Item `comercio` reescrito pierde la palabra "compartido" → rompe test existente (linea 61) | Specs incluye explicitamente la frase "limite de 20 por dia es compartido". Test confirma en Fase 2 paso 2 |
| Algun id nuevo no encuentra match en `features.md` por la regex `\b` con tildes | Si pasa: el match sin tilde (`estadisticas` vs `Estadisticas`) ya esta cubierto por `grep -i`. Para `tus_intereses_home/perfil`: la regex convierte underscore a espacio (`tus intereses home`), que no hay match exacto en `features.md`. Mitigacion: Fase 3 paso 2 agrega mencion minima ("seccion **Tus intereses** del Home" / "**Tus intereses** del Perfil") |
| `helpGroups.tsx` supera 300 LOC tras el copy pass | Ver decision D6: dejar pasar (aceptable per Sofia, warn no blocker). Si supera 400, escalar y hacer split en follow-up |
| Cambio de iconos rompe import en runtime (icono no existe en `@mui/icons-material/*Outlined`) | Verificar imports validos. Algunos iconos `*Outlined` requieren paths especificos. Build local en Fase 1 paso 8 captura el error |

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — N/A (no hay componentes nuevos)
- [x] Archivos nuevos en carpeta de dominio correcta — N/A (no hay archivos nuevos)
- [x] Logica de negocio en hooks/services, no en componentes — N/A (datos estaticos)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — `helpGroups.tsx` no tiene deuda conocida; el copy pass S7 limpia strings legacy (mejora colateral)
- [x] Ningun archivo resultante supera 400 lineas — proyectado <300

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` — N/A
- [x] Todo campo string tiene `.size() <= N` — N/A
- [x] Todo campo list tiene `.size() <= N` — N/A
- [x] Admin writes con validacion de campos — N/A
- [x] Counter decrements con `Math.max(0, ...)` — N/A
- [x] Rate limits llaman `snap.ref.delete()` — N/A
- [x] Coleccion escribible por usuarios con CF trigger — N/A
- [x] No hay secrets, admin emails ni credenciales en archivos commiteados — verificado
- [x] `getCountFromServer` → usar `getCountOfflineSafe` — N/A

## Guardrails de observabilidad

- [x] CF trigger nuevo con `trackFunctionTiming` — N/A
- [x] Service nuevo con queries Firestore con `measureAsync` — N/A
- [x] Todo `trackEvent` nuevo en `GA4_EVENT_NAMES` — N/A
- [x] Todo `trackEvent` nuevo con feature card en `ga4FeatureDefinitions.ts` — N/A
- [x] `logger.error` no envuelto en `import.meta.env.DEV` — N/A

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — N/A (no se agregan IconButtons)
- [x] No hay `<Typography onClick>` — N/A
- [x] Touch targets >=44x44px — N/A (no se agregan handlers)
- [x] Componentes con fetch tienen error state — N/A (sin fetch)
- [x] `<img>` con URL dinamica con `onError` — N/A
- [x] `httpsCallable` con guard offline — N/A

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo (Tocá, Andá, Activá, Buscá, Filtrá, Usá) — verificar en Fase 1 paso 7
- [x] Tildes correctas en todos los textos — verificar en Fase 1 paso 7
- [x] Terminologia consistente: "comercios" no "negocios" — verificar
- [x] Strings reutilizables en `src/constants/messages/` — N/A por design (descripciones de Ayuda viven en `helpGroups.tsx`, ver guard #311)

## Criterios de done

- [ ] Item `comercio` reescrito con 5 chip tabs + CTA + deep link + sub-pestañas (criterios testeable #1 y #2)
- [ ] Item `buscar` menciona auto-fallback lista (criterio testeable #3)
- [ ] 5 items nuevos en grupos correctos (criterio testeable #4)
- [ ] Item `listas` Recientes unificado (criterio testeable #5)
- [ ] >=3 de inicio/social/listas/notificaciones mencionan pull-to-refresh (criterio testeable #6)
- [ ] `helpGroups.test.ts` extendido pasa en CI (criterio testeable #7)
- [ ] Copy pass tildes/voseo aplicado
- [ ] `helpGroups.tsx` <= 300 LOC (warn) y siempre <= 400 LOC (blocker)
- [ ] Tests existentes siguen verdes (especialmente "comercio compartido" y "perfil AVATAR_OPTIONS.length")
- [ ] Guard #311 corre limpio: cero `MISSING in features.md` para cualquier id del registry
- [ ] `docs/reference/guards/311-help-docs.md` actualizado con ids ejemplo
- [ ] No lint errors (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Cobertura del codigo nuevo (test contenido) >= 80% — automatico, son aserciones puras

---

## Validacion de Plan

(Pendiente de Pablo — el caller de este agente lo invoca a continuacion.)

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-04-30
**Ciclo:** 1

### Cerrado en este ciclo

- Cobertura specs → plan completa (S1-S9 mapeados a fases concretas).
- Granularidad razonable (8 pasos en Fase 1, cada uno = un commit logico).
- Ordering correcto: imports → reescrituras → items nuevos → menciones inline → copy pass al final → build → tests → guard check → doc guard → docs.
- Risk staging adecuado para feature de contenido estatico (sin schemas/rules/CF).
- Single owner — sin conflictos de ownership entre agentes paralelos.
- Test plan integrado en Fase 2 (no al final).
- Out of scope respetado (no se toca `HelpSection.tsx`, no se parte el archivo, no se modifica `scripts/guards/checks.mjs`).
- Rollback simple: revert commit (no hay migrations ni datos).

### Observaciones para el implementador

1. **Sello de Diego sobre specs** (IMPORTANTE #1): al momento de validar este plan, `specs.md` linea 395 todavia dice "Pendiente de Diego". Confirmar el sello tecnico antes de empezar Fase 1 — si Diego pide cambios de scope (ej: forzar split de `helpGroups.tsx`), el plan se reescribe.

2. **Regex del guard #311 desalineada entre doc y plan** (IMPORTANTE #2): `docs/reference/guards/311-help-docs.md` linea 50 usa `[a-z-]+` (sin underscore). El plan en Fase 3 paso 1 corre `[a-z_-]+`. Specs D7 afirma que el script soporta underscore. Verificacion: `scripts/guards/checks.mjs` no contiene check de help-docs (el guard real es el agente `help-docs-reviewer`). Recomendacion: en Fase 4, ademas de agregar el comentario de ejemplo, **actualizar la regex del pseudocodigo a `[a-z_-]+`** para que el doc refleje la realidad. No bloquea — solo evita drift latente.

3. **Decision pre-redactada de mencion en `features.md`** (IMPORTANTE #3): Fase 3 paso 2 dice "si algun id nuevo esta MISSING, agregar mencion minima". Hint del estado al 2026-04-29:
   - `sorprendeme` → ya esta presente (linea 62 de features.md tiene `**Sorprendeme**`)
   - `estadisticas` → ya esta presente (linea 69)
   - `tus_intereses_home` / `tus_intereses_perfil` → el header `## Seguir Tags / Tus Intereses (#205)` matchea `tus_intereses` pero no las variantes `_home` / `_perfil`. Probable MISSING.
   - `confirmacion_salir` → no aparece textualmente. Probable MISSING.
   
   Si MISSING confirmado, sugerencia de mencion minima:
   - Para `tus_intereses_home`: agregar bullet "Tus Intereses **en el Home**: feed de descubrimiento" en la seccion #205.
   - Para `tus_intereses_perfil`: agregar bullet "Tus Intereses **en el Perfil**: gestion de tags" en la seccion #205.
   - Para `confirmacion_salir`: agregar mencion en la seccion de Buscar/Comercio: "Confirmacion al salir con cambios sin guardar (`DiscardDialog`)".
   
   Decidir antes de editar para no improvisar copy en caliente.

4. **Replace_all `Configuracion` rompe test legacy** (OBSERVACION #6): el test existente en `helpGroups.test.ts` linea 57 usa el regex `/Configuracion\s*>\s*Apariencia/i` (sin tilde). Si Fase 1 paso 7 corre `replace_all "Configuracion" → "Configuración"`, el test falla. Antes de hacer replace, verificar el regex del test y, si es necesario, actualizarlo en el mismo paso (o usar `/Configuraci[oó]n/i`). El test de `comercio compartido` (linea 61) NO tiene riesgo — la palabra "compartido" no lleva tilde.

5. **Fase 5 paso 5 (`project-reference.md`)** (OBSERVACION #5): el version bump y el changelog/backlog los hace `/merge` skill automaticamente (Phase 7). Implementador NO edita `project-reference.md` para version. Si hay linea de feature a agregar en el resumen, hacerla a mano; si no, dejar que `/merge` se encargue.

6. **Estimacion** (OBSERVACION #4): PRD estima S total (~2-3hs). Plan no rompe por fase. Si Fase 1 paso 7 (copy pass) tarda >60min, escalar a manu — puede haber mas ocurrencias de las previstas.

### Listo para pasar a implementacion?

Si — con las 6 observaciones documentadas arriba. Ningun BLOQUEANTE abierto. Implementador (delegado por manu) puede empezar Fase 1 una vez Diego selle specs.
