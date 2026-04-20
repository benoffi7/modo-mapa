# Plan: Tech debt — HelpSection update (#311)

**PRD:** [prd.md](prd.md) · **Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-18
**Branch:** `feat/311-help-section-update` (desde `new-home`)

---

## Pasos de implementacion

### Paso 1 — Setup

1. Crear worktree o branch local desde `new-home`:

   ```bash
   git checkout new-home && git pull
   git checkout -b feat/311-help-section-update
   ```

2. Confirmar que los tests de la suite pasan antes de tocar nada: `npm run test:run`.

### Paso 2 — Validar datos de referencia (5 min)

1. Abrir `src/constants/avatars.ts` y contar entradas de `AVATAR_OPTIONS`. Anotar el numero real (hoy: 22).
2. Abrir `src/components/profile/SettingsPanel.tsx` y confirmar la seccion "Apariencia" con el toggle dark mode (#231).
3. Confirmar en `functions/src/triggers/comments.ts` que el rate limit 20/dia se aplica a ambos tipos (comment + question) — i.e. el contador `_rateLimits/comments_{uid}` es compartido. Si no lo es, ajustar la descripcion del item "Detalle de comercio" para reflejar realidad.
4. Abrir `docs/reference/features.md` y hacer matching uno-a-uno con los items del array `HELP_GROUPS` actual. Tachar lo que ya esta. Marcar lo que falta.

### Paso 3 — Extraer `HELP_GROUPS` a archivo dedicado

1. Crear `src/components/profile/helpGroups.tsx`.
2. Mover interface `HelpItem`, `HelpGroup` y array `HELP_GROUPS` tal cual desde `HelpSection.tsx`, incluyendo todos los imports de iconos MUI.
3. Exportar `HELP_GROUPS` (named export) y opcionalmente `HelpItem`/`HelpGroup` como tipos.
4. Verificar que TypeScript compile (`npm run typecheck`).

### Paso 4 — Actualizar contenido en `helpGroups.tsx`

Aplicar los cambios descriptos en specs.md seccion "Contenido nuevo/actualizado":

1. **Inicio**:
   - Reescribir `inicio` con secciones reales (Specials, TrendingNearYou, ActivityDigest/Novedades, ForYou, YourInterests, RatingPromptBanner).
2. **Buscar**:
   - Reescribir `buscar` agregando accesibilidad de markers.
   - Reescribir `comercio` con Q&A sub-tabs, Mejor respuesta, 20/dia compartido, fotos de menu staleness.
   - Agregar item nuevo `offline` con descripcion de cola IndexedDB, OfflineIndicator, seccion Pendientes, StaleBanner, limite 50/7d. Icono: `CloudOffOutlinedIcon`.
3. **Social**:
   - Reescribir `social` para mencionar 4 sub-secciones (Actividad, Seguidos, Recomendaciones, Rankings).
   - Agregar item nuevo `rankings` con tiers, badges, streak, Mi zona. Icono: `LeaderboardOutlinedIcon`.
   - Agregar item nuevo `perfil_publico` con stats, badges top-3, ultimos 5 comentarios, FollowButton. Icono: `PersonOutlinedIcon` (o `AccountBoxOutlinedIcon` para diferenciar de "Tu perfil").
   - Actualizar `recomendaciones` con rate limit y "marcar todas como leidas".
4. **Listas**:
   - Reescribir `listas` mencionando 5 secciones (Favoritos, Listas, Compartidas conmigo, Destacadas, Recientes), color/icon picker, batch actions #160.
5. **Perfil**:
   - Reescribir `perfil` con el numero exacto de avatares (validado en Paso 2).
   - Reescribir `notificaciones` con digest frequency y ActivityDigestSection.
6. **Ajustes**:
   - Reescribir `configuracion` con secciones reales (Cuenta, Ubicacion, Apariencia, Privacidad, Notificaciones).
   - Reescribir `modooscuro` con ubicacion correcta (Configuracion > Apariencia).
   - (Opcional) Agregar item `onboarding` con #157 (banners, beneficios, recordatorio, nudge verificacion). Icono: `CelebrationOutlinedIcon`.
   - Revisar label del item `feedback` — alinear con la terminologia real del SideMenu.

### Paso 5 — Simplificar `HelpSection.tsx`

1. Borrar el array `HELP_GROUPS` inline y los imports de iconos (ahora viven en `helpGroups.tsx`).
2. Importar `HELP_GROUPS` de `./helpGroups`.
3. Agregar `aria-label={item.title}` en `<AccordionSummary>`.
4. Verificar que el archivo final queda <100 lineas.

### Paso 6 — Tests

1. Crear `src/components/profile/__tests__/helpGroups.test.ts` con los 6 casos de specs.md.
2. Crear `src/components/profile/__tests__/HelpSection.test.tsx` con los 4 casos de specs.md.
3. Stub de `__APP_VERSION__` en `src/test/setup.ts` si no existe ya (buscar antes para no duplicar).
4. Correr `npm run test:run -- HelpSection helpGroups` y verificar que todo pasa.
5. Correr `npm run test:coverage -- HelpSection helpGroups` y verificar cobertura >=80% en el archivo nuevo.

### Paso 7 — Copy audit

1. Invocar agente `copy-auditor` sobre `src/components/profile/helpGroups.tsx`:

   ```bash
   # Desde Claude Code con agente copy-auditor
   ```

2. Aplicar las correcciones sugeridas (tildes, signos de apertura, voseo consistente).
3. Re-correr tests.

### Paso 8 — Actualizar docs

1. `docs/reference/patterns.md`: agregar bullet en la tabla "UI patterns":

   > **HELP_GROUPS registry** | Array declarativo en `components/profile/helpGroups.tsx` con interface `HelpGroup` y `HelpItem`. `HelpSection` itera el array con Accordions MUI. Agregar/editar item de ayuda = editar el array sin tocar el componente.

2. `docs/reports/changelog.md`: agregar entrada para la version siguiente (TBD por merge skill):

   > - **#311 Tech debt HelpSection**: actualizacion completa de la pantalla de Ayuda para incluir modo offline (#136), Trending cerca tuyo y filtro Mi zona (#200), perfil publico, Q&A (#127), rating prompt (#199), digest frequency (#203), color/icon picker de listas, y correcciones de inconsistencias (ubicacion del toggle dark mode, count real de avatares, limite compartido de 20/dia). Extraccion de `HELP_GROUPS` a archivo dedicado. Tests nuevos.

3. No modificar `docs/reference/features.md` (ya describe las features).

### Paso 9 — Actualizar `docs/_sidebar.md`

Agregar en la seccion **Content**:

```markdown
  - [#311 Help Section Update](/feat/content/311-help-section-update/prd.md)
    - [Specs](/feat/content/311-help-section-update/specs.md)
    - [Plan](/feat/content/311-help-section-update/plan.md)
```

### Paso 10 — Pre-commit checks

1. `npm run lint` — resolver warnings/errors.
2. `npm run typecheck` — cero errores.
3. `npm run test:run` — suite verde.
4. `npm run test:coverage` — cobertura global >=80% (no debe bajar).
5. Revisar `git diff` — cero secretos, cero hex hardcodeados, cero strings magicos nuevos de coleccion Firestore.

### Paso 11 — Validacion manual

Seguir los 7 pasos de "Validacion manual (pre-merge)" de specs.md:

1. Abrir Perfil > Ayuda y soporte.
2. Verificar render de los 6 grupos.
3. Expandir cada item y leer descripciones.
4. Confirmar count real de avatares.
5. Confirmar ubicacion del toggle dark mode.
6. Desconectar wifi y validar descripcion del item `offline`.
7. Abrir Q&A y validar comportamiento del rate limit compartido.

### Paso 12 — Commit

```bash
git add src/components/profile/helpGroups.tsx \
         src/components/profile/HelpSection.tsx \
         src/components/profile/__tests__/helpGroups.test.ts \
         src/components/profile/__tests__/HelpSection.test.tsx \
         docs/reference/patterns.md \
         docs/reports/changelog.md \
         docs/feat/content/311-help-section-update/ \
         docs/_sidebar.md

git commit -m "$(cat <<'EOF'
content(#311): update HelpSection con features faltantes (offline, Q&A, rankings Mi zona, perfil publico, digest)

- Extrae HELP_GROUPS a src/components/profile/helpGroups.tsx para separar contenido de render
- Agrega items nuevos: offline (#136), rankings (#200), perfil_publico
- Actualiza: inicio (secciones reales), comercio (Q&A + 20/dia compartido + fotos staleness),
  listas (color/icon picker, Compartidas conmigo, Destacadas, batch actions),
  configuracion (Apariencia con dark mode, digest frequency), modooscuro (nueva ubicacion),
  notificaciones (digest frequency + ActivityDigestSection), perfil (count real de avatares),
  recomendaciones (rate limit + marcar todas como leidas)
- Agrega aria-label en AccordionSummary para accesibilidad
- Tests: helpGroups (integridad) + HelpSection (render + expand/collapse)
- Docs: patterns.md con HELP_GROUPS registry, changelog

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Paso 13 — Push y PR

No se pushea ni se crea PR en este paso. Se deja al merge skill que tome la rama al cierre del ciclo. Si el usuario pide PR:

```bash
git push -u origin feat/311-help-section-update
gh pr create --title "content(#311): actualizar HelpSection con features faltantes" --body "$(cat <<'EOF'
## Summary
- Extrae HELP_GROUPS a archivo dedicado y sincroniza contenido con features.md
- Agrega items: offline, rankings, perfil publico
- Corrige inconsistencias: ubicacion dark mode (#231), count real de avatares, 20/dia compartido Q&A
- Agrega aria-label en AccordionSummary

## Test plan
- [ ] Tests automatizados: helpGroups.test.ts + HelpSection.test.tsx verdes con cobertura >=80%
- [ ] Validacion manual: desconectar wifi y confirmar item offline matchea comportamiento
- [ ] Validacion manual: abrir Q&A y confirmar limite compartido con comentarios
- [ ] Validacion manual: confirmar toggle dark mode en Configuracion > Apariencia

Cierra #311.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Rollback plan

Si el cambio rompe algo en produccion:

1. `git revert <commit-sha>` — el feature es contenido estatico, rollback completo sin efectos colaterales.
2. No hay datos persistidos que migrar.
3. No hay rules, functions ni storage paths que revertir.

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Typo en la descripcion que confunde al usuario | Media | Bajo | Copy audit con agente + validacion manual |
| Count de avatares desactualizado a futuro | Media | Bajo | Agregar comentario en helpGroups.tsx referenciando AVATAR_OPTIONS.length. Opcional: usar la constante en runtime (`\`${AVATAR_OPTIONS.length} opciones\``) para que se auto-actualice. |
| Dato de rate limit 20/dia compartido resulta incorrecto | Baja | Bajo | Validar en Paso 2 antes de escribir |
| Tests flakiness por snapshot | Baja | Medio | No usamos snapshots de DOM completos; solo assertions de ids y strings especificos |
| Regresion de cobertura global | Baja | Bajo | Tests nuevos cubren todo el codigo nuevo |
| Accessibility regression | Baja | Bajo | `aria-label` redundante podria causar doble anuncio. Validar con NVDA/VoiceOver en Paso 11 |

---

## Dependencias externas

Ninguna. Feature 100% cerrado dentro del codebase, sin Cloud Functions deploys ni cambios de rules.

---

## Criterios de Done

- [ ] `helpGroups.tsx` creado con 6 grupos completos.
- [ ] `HelpSection.tsx` <100 lineas, usa `HELP_GROUPS` importado.
- [ ] Items nuevos: `offline`, `rankings`, `perfil_publico` (+ opcional `onboarding`).
- [ ] Items actualizados: `inicio`, `comercio`, `social`, `recomendaciones`, `listas`, `perfil`, `notificaciones`, `configuracion`, `modooscuro`.
- [ ] Count real de avatares reflejado en item `perfil` (o uso runtime de `AVATAR_OPTIONS.length`).
- [ ] Toggle dark mode reubicado a "Configuracion > Apariencia" en todos los items que lo mencionan.
- [ ] Aclaracion "20/dia compartido" entre comentarios y preguntas en item `comercio`.
- [ ] `aria-label` en cada AccordionSummary.
- [ ] Tests: `helpGroups.test.ts` + `HelpSection.test.tsx` verdes.
- [ ] Cobertura global sin regresiones (>=80%).
- [ ] `lint` y `typecheck` sin errores.
- [ ] Copy audit aplicado.
- [ ] `docs/reference/patterns.md` actualizado con "HELP_GROUPS registry".
- [ ] `docs/reports/changelog.md` con entrada para #311.
- [ ] `docs/_sidebar.md` con enlaces a PRD/specs/plan.
- [ ] Validacion manual (7 pasos) completada y confirmada.
- [ ] Commit con mensaje descriptivo.
- [ ] No se pushea ni se crea PR sin instruccion explicita del usuario.
