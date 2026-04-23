---
name: bulk-prd
description: Create PRDs in batch from a list of GitHub issues. Pass issue numbers as arguments.
argument-hint: "[issue-numbers separated by spaces]"
---

# Bulk PRD Creator

Create PRDs for multiple GitHub issues at once.

## Input

Issue numbers: $ARGUMENTS

## Options

- **Default mode:** Creates only PRDs (user reviews before specs/plan)
- **Full mode:** If `$ARGUMENTS` contains the word "full" or "completo", creates PRD + specs + plan for each issue in one pass. Saves a full round-trip of review.

## Process

### Step 1: Create PRDs (or full docs)

For each issue number, launch a `prd-writer` agent with the prompt:

```
Create a PRD for GitHub issue #<number>.
```

If full mode: append "full" to each prompt so the prd-writer produces PRD + specs + plan in one pass:

```
Create a PRD for GitHub issue #<number>. full
```

Launch all agents in parallel if there are no dependencies between them.

The prd-writer agent handles: reading reference docs, fetching the issue, determining category, creating the directory, writing the PRD, and updating the sidebar. It also invokes `sofia` automatically to validate each PRD — do not skip this step manually, the writer handles it.

### Step 1b: Summarize Sofia's verdicts

After prd-writer finishes each issue, it stamps the PRD with a "Validacion Funcional" section. Collect the states:

- PRDs with state **VALIDADO** or **VALIDADO CON OBSERVACIONES**: ready for specs/plan
- PRDs with state **NO VALIDADO** or missing seal: flag the specific issues in the final report to the user. Do NOT auto-advance those to specs/plan.

Example summary to the user:

```markdown
## Bulk PRD result

| Issue | PRD | Sofia |
|-------|-----|-------|
| #123 | ✓ created | VALIDADO |
| #124 | ✓ created | VALIDADO CON OBSERVACIONES (ver seccion) |
| #125 | ✓ created | NO VALIDADO — requiere decision del usuario |
```

### Step 2: Commit and push

After all PRDs are created:

```text
docs: add PRDs for issues #X, #Y, #Z
```

Push to main (docs-only, per workflow rules).

### Step 3: Comment on issues

For each issue, determine the category and slug from the created PRD path, then:

```bash
gh issue comment <number> --body "📄 [PRD](https://benoffi7.github.io/modo-mapa/#/feat/{category}/{slug}/prd)"
```
