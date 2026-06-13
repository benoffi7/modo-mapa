# Plan: Tech debt — privacy feedback PDF support + contact categories wording

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-29

---

## Fases de implementacion

### Fase 1: Disclosure de PDF en politica

**Branch:** `feat/329-privacy-feedback-pdf-categories`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/PrivacyPolicy.tsx` | Linea 71-73: cambiar `feedback (incluyendo imágenes adjuntas opcionales)` por `feedback (incluyendo imagen o PDF adjunto opcional)` |
| 2 | `src/components/profile/PrivacyPolicy.tsx` | Linea 157-159: cambiar `imágenes adjuntas de feedback subidas por los usuarios` por `imágenes o PDFs adjuntos de feedback subidos por los usuarios` |
| 3 | `src/components/profile/PrivacyPolicy.tsx` | Linea 218: cambiar `imagen adjunta si la hay` por `imagen o PDF adjunto si lo hay` |

### Fase 2: Categorias de contacto completas

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `src/components/profile/PrivacyPolicy.tsx` | Linea 293-299 (seccion "Contacto"): preservar el parrafo existente sobre "Datos de usuario" / "Datos de comercio". Agregar un segundo `<P>` con: `Otras categorías (&quot;Bug&quot;, &quot;Sugerencia&quot; y &quot;Otro&quot;) están disponibles para feedback general sobre la app.` |

### Fase 3: Fixes cosmeticos

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | `src/components/profile/PrivacyPolicy.tsx` | Linea 124: cambiar `google para administradores` por `google [para administradores]` (corchetes para evitar parentesis anidados — ver Decision D2 en specs) |
| 6 | `src/components/profile/PrivacyPolicy.tsx` | Linea 34: simplificar a `Última actualización: {mes calendario al commit} 2026`. Hoy es 2026-04-29; si el commit aterriza en abril, queda "abril 2026"; si en mayo, "mayo 2026". Eliminar el sufijo `(actualizada el 20/04/2026)`. |

### Fase 4: Guard — detection pattern para PDF

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `docs/reference/guards/308-privacy.md` | En el bloque "Detection patterns" (lineas ~62-63), agregar un chequeo explicito que falle si la politica no menciona `pdf` cuando `feedback.ts` lo declare. Reemplazar el comentario `# luego cruzar contra:` + `grep -in "image\|pdf\|imagen\|video\|audio"` por un check fijo: `grep -i "pdf" src/components/profile/PrivacyPolicy.tsx` debe devolver al menos un match si `feedback.ts` incluye `'pdf'` en `mediaType`. Documentar el contrato del chequeo (regla 6 enforced por grep). |
| 8 | `docs/reference/guards/308-privacy.md` | Actualizar la nota debajo del bloque ("Ambos greps deben devolver al menos un match...") para reflejar el nuevo check fijo de PDF. |

### Fase 5: Validacion manual

| Paso | Archivo | Cambio |
|------|---------|--------|
| 9 | (terminal) | Ejecutar `grep -i "PDF" src/components/profile/PrivacyPolicy.tsx`. Esperado: >= 3 matches (Contenido generado, Almacenamiento, Comparticion con terceros). |
| 10 | (terminal) | Ejecutar `grep -in "Bug\|Sugerencia\|Datos de usuario\|Datos de comercio\|Otro" src/components/profile/PrivacyPolicy.tsx`. Esperado: las cinco variantes presentes. |
| 11 | (terminal) | Ejecutar `grep -c "Última actualización" src/components/profile/PrivacyPolicy.tsx` — esperado 1. `grep -c "actualizada el" src/components/profile/PrivacyPolicy.tsx` — esperado 0. |
| 12 | (terminal) | `npm run lint && npm run typecheck && npm run build`. Todo debe pasar. |
| 13 | (terminal) | `npm test`. No debe haber regresiones (no hay tests para `PrivacyPolicy.tsx`, asi que el tiempo de tests no debe cambiar). |

### Fase 6: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 14 | `docs/reference/security.md` | N/A — no hay cambios de rules ni rate limits ni storage. No tocar. |
| 15 | `docs/reference/firestore.md` | N/A — no hay colecciones nuevas ni campos modificados. No tocar. |
| 16 | `docs/reference/features.md` | N/A — la politica ya esta listada en el indice. No tocar. |
| 17 | `docs/reference/patterns.md` | N/A — no se introduce patron nuevo. No tocar. |
| 18 | `docs/reference/project-reference.md` | Bumpear version (segun convencion del proyecto, version patch) y fecha. Agregar resumen de una linea: `#329 — Privacy: feedback PDF support + contact categories wording.` |
| 19 | `src/components/menu/HelpSection.tsx` | N/A — no cambia comportamiento visible al usuario mas alla de la politica misma. No tocar. |
| 20 | `docs/_sidebar.md` | Agregar entradas Specs y Plan debajo de la entrada PRD existente para `#329 Privacy — Feedback PDF + Contact Categories` (linea 245). |
| 21 | `docs/reports/changelog.md` | Agregar entrada de la version bumpeada con resumen del cambio. |
| 22 | `docs/reports/backlog-producto.md` | Si #329 figuraba como pendiente, marcar como cerrado. Si no figuraba, no tocar. |

---

## Orden de implementacion

1. Crear branch `feat/329-privacy-feedback-pdf-categories` desde `new-home`.
2. Fase 1 (pasos 1-3) — pueden hacerse en una sola edicion del archivo.
3. Fase 2 (paso 4).
4. Fase 3 (pasos 5-6).
5. Fase 4 (pasos 7-8) — independiente de la politica, puede ir en paralelo pero conviene mismo commit que las anteriores.
6. Fase 5 (pasos 9-13) — validacion. Si algun grep falla, volver a la fase correspondiente y corregir.
7. Fase 6 (pasos 14-22) — docs. Bumpear version + actualizar sidebar + changelog en el mismo commit.
8. Commit unico con mensaje siguiendo la convencion del proyecto: `feat(#329): privacy policy — feedback PDF support + contact categories wording`.

Las fases 1-4 son strings independientes — no hay orden critico entre ellas. La fase 5 depende de las anteriores. La fase 6 depende de todo.

## Riesgos

1. **Mes calendario incorrecto al merge.** Si el merge se desliza al mes siguiente y el implementador no actualiza la fecha. Mitigacion: verificar la fecha en el paso 6 al momento del commit final, no al iniciar el branch.
2. **Drift futuro de `mediaType`.** Si en el futuro se agregan mas variantes (ej. `'video'`, `'audio'`) y el guard no las detecta. Mitigacion: la regla 6 del guard (textual) cubre el caso; el detection pattern especifico para PDF deja precedente para extender el guard si aparecen mas variantes.
3. **Comillas tipograficas vs HTML entities.** El archivo actual usa `&quot;` (linea 297). Mantener consistencia en el parrafo nuevo. Mitigacion: copiar el patron existente.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — N/A, no hay componente nuevo.
- [x] Archivos nuevos en carpeta de dominio correcta — N/A, no hay archivos nuevos.
- [x] Logica de negocio en hooks/services, no en componentes — N/A, no hay logica nueva.
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — el archivo tiene drift conocido (#329), este plan lo cierra.
- [x] Ningun archivo resultante supera 400 lineas — `PrivacyPolicy.tsx` actual = 302, cambio agrega ~6 lineas → ~308.

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` — N/A, no hay colecciones nuevas.
- [x] Todo campo string tiene `.size() <= N` — N/A.
- [x] Todo campo list tiene `.size() <= N` + validacion de items — N/A.
- [x] Admin writes tambien tienen validacion de campos — N/A.
- [x] Counter decrements usan `Math.max(0, ...)` — N/A.
- [x] Rate limits llaman `snap.ref.delete()` — N/A.
- [x] Toda coleccion nueva escribible por usuarios tiene CF trigger con rate limit — N/A.
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados — verificado, solo strings de copy publicos.
- [x] `getCountFromServer` → usar `getCountOfflineSafe` — N/A.

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo tiene `trackFunctionTiming` — N/A.
- [x] Todo service nuevo con queries Firestore tiene `measureAsync` — N/A.
- [x] Todo `trackEvent` nuevo registrado en `GA4_EVENT_NAMES` — N/A.
- [x] Todo `trackEvent` nuevo tiene feature card en `ga4FeatureDefinitions.ts` — N/A.
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — N/A.

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — N/A, no hay IconButtons.
- [x] No hay `<Typography onClick>` — N/A.
- [x] Touch targets minimo 44x44px — N/A.
- [x] Componentes con fetch tienen error state con retry — N/A.
- [x] `<img>` con URL dinamica tienen `onError` fallback — N/A.
- [x] httpsCallable en componentes user-facing tienen guard offline — N/A.

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo (tenés, podés) — verificado en seccion Textos de usuario del specs.
- [x] Tildes correctas — Última, actualización, categoría, categorías, menú, gestión, corrección, están, compartición, anónima.
- [x] Terminologia consistente: "comercios" (ya usado), "feedback" (ya usado), "PDF" en mayusculas.
- [x] Strings reutilizables en `src/constants/messages/` — N/A. Texto largo de policy, no UI reutilizable.

## Fase final: Documentacion (OBLIGATORIA)

Cubierta en Fase 6 arriba. Resumen de filas que SI aplican:

- `docs/reference/project-reference.md` — bump version + fecha + resumen.
- `docs/_sidebar.md` — agregar entradas Specs y Plan.
- `docs/reports/changelog.md` — entrada de la version.
- `docs/reports/backlog-producto.md` — solo si figuraba pendiente.

Filas eliminadas (no aplican):
- `docs/reference/security.md`, `docs/reference/firestore.md`, `docs/reference/features.md`, `docs/reference/patterns.md`, `src/components/menu/HelpSection.tsx` — el cambio es disclosure-only sobre la politica, no afecta superficies operativas.

## Criterios de done

- [ ] Linea 34 muestra una sola fecha vigente (mes calendario del commit).
- [ ] `grep -i "PDF" src/components/profile/PrivacyPolicy.tsx` devuelve >= 3 matches.
- [ ] Seccion "Contacto" menciona las cinco variantes de `FeedbackCategory`.
- [ ] Linea 124 reformulada con corchetes para evitar parentesis anidados.
- [ ] `docs/reference/guards/308-privacy.md` tiene detection pattern fijo para `pdf`.
- [ ] Build, lint y typecheck pasan.
- [ ] `npm test` pasa sin regresiones (no hay tests sobre `PrivacyPolicy.tsx`).
- [ ] `docs/_sidebar.md` actualizado con entradas Specs y Plan.
- [ ] `docs/reports/changelog.md` y `docs/reference/project-reference.md` reflejan el cambio.
- [ ] No hay tests nuevos (excepcion del componente visual respetada).

---

## Validacion de Plan

**Fecha:** 2026-05-01
**Auditor:** Pablo (delivery lead)
**Estado:** VALIDADO CON OBSERVACIONES

### Cerrado en esta iteracion

No se abrieron BLOQUEANTES ni IMPORTANTES. La cobertura specs → plan es completa: las 6 filas de la tabla "Cambios concretos" del specs (lineas 60-65) estan mapeadas a los pasos 1-6, y el guard `308-privacy.md` queda cubierto en los pasos 7-8. Las decisiones D1-D4 del specs estan respetadas (mes calendario al commit, corchetes en linea 124, chequeo fijo del guard, dos parrafos en Contacto). El test plan respeta la excepcion de componente visual y mueve la validacion automatizada a greps en la Fase 5 (en el mismo flujo que la edicion, no como paso desconectado al final). Risk staging coherente: cambio disclosure-only, commit unico, revert trivial. Documentacion agendada cubre los archivos relevantes con justificaciones para cada N/A.

### Observaciones para la implementacion

1. **Paso 20 (sidebar) puede ser no-op.** `grep -n "329" docs/_sidebar.md` muestra que las entradas PRD/Specs/Plan ya existen en lineas 245-247. El implementador debe verificar antes de tocar el sidebar — si ya estan, no agregar duplicados. Reformular mentalmente como "verificar que existan; agregar solo si faltan".

2. **Paso 22 (backlog) tiene matching real.** `grep -n "329" docs/reports/backlog-producto.md` muestra la entrada en linea 27 con estado "Pendiente PRD". El paso 22 SI aplica — marcar como cerrado / actualizar estado.

3. **Specs sin sello formal de Diego.** El specs.md no tiene seccion "Validacion Tecnica". Dado el alcance trivial (solo strings + grep en guard, sin types nuevos, sin rules, sin hooks, sin servicios), no es bloqueante para delivery, pero conviene formalizarlo en futuros PRs aunque sean tech-debt cosmeticos para mantener consistencia del proceso PRD-specs-plan.

4. **Estimacion granular ausente.** El plan no asigna S/M/L por paso. Para 22 pasos donde 13 son edits de strings o validaciones trigger una sola vez, no agrega valor explicitarlo, pero el proximo plan con scope mediano deberia incluirlo.

5. **Consistencia de comillas tipograficas.** El plan menciona en Riesgo #3 que el archivo usa `&quot;` y hay que mantener la consistencia. En el paso 4, el snippet propuesto ya usa `&quot;` correctamente — solo confirmar que el implementador no lo "moderniza" a comillas curvas.

### Listo para pasar a implementacion?

Si.
