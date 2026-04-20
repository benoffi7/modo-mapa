# Plan: Privacy policy drift (Sentry + Google Maps + analytics events)

**PRD:** [prd.md](./prd.md)
**Specs:** [specs.md](./specs.md)
**Issue:** #308
**Fecha:** 2026-04-18

---

## Estrategia

Un único commit editando `src/components/profile/PrivacyPolicy.tsx` con los cinco cambios de copy. Sin migraciones de datos, sin rules, sin Cloud Functions, sin tests nuevos. Gates de CI preexistentes (TypeScript strict + markdownlint) son suficientes.

---

## Pasos

### Paso 1 — Branch desde `new-home`

```bash
git checkout new-home
git pull --rebase
git checkout -b fix/308-privacy-policy-drift
```

Base branch: `new-home` (según `feedback_base_branch` — `new-home` reemplaza a `main`).

### Paso 2 — Editar `PrivacyPolicy.tsx`

Aplicar en orden los cinco cambios del [specs.md](./specs.md):

1. **Línea 34** — Actualizar la fecha a `"abril 2026 (actualizada el 18/04/2026)"`.
2. **Líneas 110-127** (sección "Datos de uso") — Reemplazar el `<Li>` exhaustivo por la versión por dominios con "entre otros". Agregar tag `<code>` para `auth_type`.
3. **Líneas 146-149** (sección Cloud Firestore) — Agregar un nuevo `<Li>` con el bullet de `abuseLogs`.
4. **Líneas 154-163** (sección localStorage) — Reemplazar el `<Li>` cerrado por la versión por categorías.
5. **Líneas 208-221** (sección "Compartición con terceros") — Insertar dos `<P>` nuevos (Sentry + Google Maps) antes del bullet de GitHub (mantener el orden: explicación de servicios técnicos primero, luego feedback → GitHub, luego compartir voluntario del usuario).

Usar la tool `Edit` con `old_string` / `new_string` por cada bloque — no reescribir el archivo completo con `Write`.

### Paso 3 — Verificar compilación y lint

```bash
npm run typecheck    # tsc --noEmit, verifica que <code> y <Li> sigan válidos
npm run build        # full Vite build, asegura que no haya regresiones
```

Si alguna falla, revisar los `old_string` del Edit y corregir.

### Paso 4 — Verificar markdownlint del bundle de docs

```bash
npx markdownlint docs/feat/security/308-privacy-policy-drift/*.md
```

Corregir cualquier warning (blank lines around headings/lists/fences, language en code blocks, etc.).

### Paso 5 — Smoke test local (dev:full)

```bash
npm run dev:full
```

(equivalente a Vite + Firebase emulators, según `feedback_run_local_full`).

Navegar: http://localhost:5173 → Perfil → Ayuda y soporte → abrir política de privacidad.

Checklist visual:

- [ ] Sección "Última actualización" muestra la fecha nueva.
- [ ] Sección "Datos de uso" termina con "entre otros eventos de uso" y menciona `auth_type`.
- [ ] Sección "Almacenamiento" incluye bullet de `abuseLogs` debajo del de Cloud Firestore.
- [ ] Sección "localStorage" describe categorías en vez de enumerar keys.
- [ ] Sección "Compartición con terceros" tiene bullets nuevos de Sentry y Google Maps antes del bullet de GitHub.
- [ ] Sin warnings en la consola del navegador.
- [ ] Dark mode funciona (cambiar tema en Configuración > Apariencia y volver a política).

### Paso 6 — Actualizar `docs/_sidebar.md`

Agregar entrada en la sección Security:

```markdown
  - [#308 Privacy Policy Drift](/feat/security/308-privacy-policy-drift/prd.md)
    - [Specs](/feat/security/308-privacy-policy-drift/specs.md)
    - [Plan](/feat/security/308-privacy-policy-drift/plan.md)
```

Insertar en orden numérico entre `#258 Deletion Audit Log` y el siguiente bloque.

### Paso 7 — Commit

Mensaje sugerido (sin co-author, solo crear commit cuando el usuario lo pida):

```text
docs(privacy): declare Sentry + Google Maps + abuseLogs; reformulate analytics + localStorage as non-exhaustive (#308)
```

Scope: `docs(privacy)` porque el único archivo de código modificado es un componente que es 100% copy estática.

### Paso 8 — Abrir PR (cuando el usuario lo pida)

Base: `new-home`. Título: `docs(privacy): cerrar drift de política — Sentry, Google Maps, abuseLogs (#308)`.

Body:

```markdown
## Resumen
- Agrega Sentry y Google Maps/tile providers a "Compartición con terceros"
- Agrega `abuseLogs` al detalle de Cloud Firestore
- Reformula "Datos de uso" y "localStorage" a lenguaje no-exhaustivo (reduce drift crónico)
- Actualiza fecha "Última actualización"

## Test plan
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` pasa
- [ ] Markdownlint de los docs pasa
- [ ] Smoke test manual con `npm run dev:full` (checklist en `plan.md` paso 5)

Cierra #308.
```

---

## Checklist de merge

Al final del merge, correr la skill `/merge` (nunca skip, según `feedback_never_skip_merge_skill`). Esa skill incluye:

- Bump de versión
- Actualización de changelog
- Actualización de backlog-producto.md (mover #308 a cerrados)
- Deploy a GH Pages de los docs
- Verificación post-deploy

---

## Rollback

Si post-deploy aparece un issue con el copy:

- `git revert <commit-sha>` en `new-home` → push.
- Hosting rebuild automático.
- Sin migraciones de datos que revertir.

---

## Estimación temporal

| Paso | Tiempo |
|------|--------|
| Paso 1 (branch) | 1 min |
| Paso 2 (edición) | 15 min |
| Paso 3 (typecheck + build) | 3 min |
| Paso 4 (markdownlint) | 2 min |
| Paso 5 (smoke test) | 5 min |
| Paso 6 (sidebar) | 2 min |
| Paso 7 (commit) | 1 min |
| Paso 8 (PR) | 3 min |
| **Total** | **~30 min** |

---

## Dependencias y bloqueos

- Sin dependencias con otros tickets abiertos.
- Sin dependencias con deploy de Cloud Functions.
- Sin dependencias con cambios en Firestore rules.
- Puede mergear solo, sin batch.
