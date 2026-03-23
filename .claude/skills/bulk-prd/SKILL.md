---
name: bulk-prd
description: Create PRDs in batch from a list of GitHub issues. Pass issue numbers as arguments.
argument-hint: "[issue-numbers separated by spaces]"
---

# Bulk PRD Creator

Create PRDs for multiple GitHub issues at once.

## Input

Issue numbers: $ARGUMENTS

## Process

### Step 0: Read reference docs

Before creating any PRD, read these files to understand the current state of the project:

- `docs/reference/project-reference.md` — stack, features, patterns (understand what exists)
- `docs/reference/features.md` — detailed feature list (avoid duplicating existing functionality)
- `docs/reference/security.md` — security checklist (identify relevant security considerations)
- `docs/reference/tests.md` — testing policy and patterns (determine what tests the feature needs)
- `docs/reference/patterns.md` — existing conventions (align the solution with project patterns)

### Step 1: Fetch issues

For each issue, fetch from GitHub: `gh issue view <number> --json title,body,labels`

### Step 2: Determine category

From labels or content:

- `social` — social features (comments, follows, recommendations)
- `content` — content/data features (menus, photos, search)
- `infra` — infrastructure (offline, performance, loading)
- `ux` — UX improvements (onboarding, accessibility, drag)
- `admin` — admin panel features
- `security` — security features
- `fix` — bug fixes

### Step 3: Create directory

`docs/feat/{category}/{slug}/` — Slug: kebab-case from issue title

### Step 4: Create `prd.md`

Use this template, informed by the reference docs read in Step 0:

```markdown
# PRD: {title}

**Feature:** {slug}
**Categoria:** {category}
**Fecha:** {today YYYY-MM-DD}
**Issue:** #{number}
**Prioridad:** {from labels or Media by default}

---

## Contexto

{1-2 sentences based on issue body and project context from reference docs}

## Problema

{2-3 bullet points explaining the problem}

## Solución

{High-level solution sections with S1, S2, S3 format.
Reference existing patterns from patterns.md where applicable.
Note any security considerations from security.md.}

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|

**Esfuerzo total estimado:** {S/M/L/XL}

---

## Out of Scope

{3-4 bullet points}

---

## Tests

{Based on docs/reference/tests.md policy — ≥80% coverage for new code}

### Archivos que necesitarán tests

| Archivo | Tipo | Qué testear |
|---------|------|-------------|

### Criterios de testing

- Cobertura ≥ 80% del código nuevo
- Tests de validación para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

{Based on security.md checklist — only include items relevant to this feature}

- [ ] {relevant security items}

---

## Offline

{Evaluate this feature's offline behavior. For each data flow (reads and writes), specify:}

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|

### Checklist offline

- [ ] Reads de Firestore: usan persistencia offline?
- [ ] Writes: tienen queue offline o optimistic UI?
- [ ] APIs externas: hay manejo de error de red?
- [ ] UI: hay indicador de estado offline en contextos relevantes?
- [ ] Datos criticos: disponibles en cache para primera carga?

### Esfuerzo offline adicional: {S/M/L}

---

## Success Criteria

{4-5 numbered criteria}
```

### Step 5: Update sidebar

Update `docs/_sidebar.md` — add entries for each new PRD under the correct category section.

### Step 6: Commit and push

```text
docs: add PRDs for issues #X, #Y, #Z
```

Push to main (docs-only, per workflow rules).

### Step 7: Comment on issues

```bash
gh issue comment <number> --body "📄 [PRD](https://benoffi7.github.io/modo-mapa/#/feat/{category}/{slug}/prd)"
```
