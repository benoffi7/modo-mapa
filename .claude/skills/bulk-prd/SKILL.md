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

### Step 1: Create PRDs

For each issue number, launch a `prd-writer` agent with the prompt:

```
Create a PRD for GitHub issue #<number>.
```

Launch all agents in parallel if there are no dependencies between them.

The prd-writer agent handles: reading reference docs, fetching the issue, determining category, creating the directory, writing the PRD, and updating the sidebar.

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
