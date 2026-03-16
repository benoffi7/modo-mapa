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

1. Fetch each issue from GitHub: `gh issue view <number> --json title,body,labels`

2. For each issue, determine category from labels or content:
   - `social` — social features (comments, follows, recommendations)
   - `content` — content/data features (menus, photos, search)
   - `infra` — infrastructure (offline, performance, loading)
   - `ux` — UX improvements (onboarding, accessibility, drag)
   - `admin` — admin panel features
   - `security` — security features
   - `fix` — bug fixes

3. Create directory: `docs/feat/{category}/{slug}/`
   - Slug: kebab-case from issue title

4. Create `prd.md` using this template:

```markdown
# PRD: {title}

**Feature:** {slug}
**Categoria:** {category}
**Fecha:** {today YYYY-MM-DD}
**Issue:** #{number}
**Prioridad:** {from labels or Media by default}

---

## Contexto

{1-2 sentences based on issue body and project context}

## Problema

{2-3 bullet points explaining the problem}

## Solución

{High-level solution sections with S1, S2, S3 format}

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|

**Esfuerzo total estimado:** {S/M/L/XL}

---

## Out of Scope

{3-4 bullet points}

---

## Success Criteria

{4-5 numbered criteria}
```

5. Update `docs/_sidebar.md` — add entries for each new PRD under the correct category section.

6. Commit all PRDs in a single commit:
   ```
   docs: add PRDs for issues #X, #Y, #Z
   ```

7. Push to main (docs-only, per workflow rules).

8. Comment on each issue with the GH Pages link:
   ```
   gh issue comment <number> --body "📄 [PRD](https://benoffi7.github.io/modo-mapa/#/feat/{category}/{slug}/prd)"
   ```
